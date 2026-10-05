'use server';
import type { InventoryStatus } from '@/features/materiel/domain/inventory';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { askAI } from '@/lib/ai/askAI';
import {
  COMPAS_AUTOFILL_SPEC,
  buildCompasAutofillPrompt,
  buildCompasAutofillSystem,
  buildCompasStagesPrompt,
  buildCompasStagesSystem,
} from '@/lib/ai/features/compasAutofill';
import { extractIntentJson } from '@/lib/ai/features/compasIntent';
import { ARRIVAL_TOLERANCE_M, elevationsAt, routeAttempt } from '@/features/adventure-prep/routingService';
import { haversineKm } from '@/features/adventure-prep/engine/routing';
import { generateTripContextualKit } from '@/features/trips/engine/contextualKitEngine';
import type { TripItem } from '@/features/trips/types/trip.types';
import { readCompasMeta } from '../engine/meta';
import {
  NIGHT_LABEL,
  budgetLines,
  budgetTotal,
  estimateCarTrip,
  estimateMeals,
  gearForNights,
  keepRuleForNights,
  keepRuleForActivity,
  nightsPrefFor,
  needFromRule,
  sameNeed,
  planNights,
  sanitizeAdvice,
  sanitizeStages,
  sourceGear,
  approachMode,
  fuelForKm,
  CAR_ASSUMPTIONS,
  STEP_TRANSPORT,
  type StageMove,
  type AutofillAiAdvice,
  type Autonomy,
  type BudgetLine,
  type GearNeed,
  type GearSource,
  type NightPlan,
  type Priority,
  type SourceShop,
  movesFromSteps,
} from '../engine/autofill';
import { compasMeta, patchTripMetadata, requireEditor, resplitSteps, type Supa } from './compasServer';
import { lookupDestination, lookupReverse, stageCandidates } from './placeLookup';
import { destinationRadiusKm, distanceKm, maxLegKm, pickPlace, type CompasPlace } from '../engine/places';
import { localToday } from './weather';

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/**
 * Préremplissage du Compas. Dès que le lieu et les dates sont connus (ou après
 * une phrase « Dis-le »), il ÉCRIT directement dans le voyage : étapes,
 * nuits, trajet depuis la position réelle, kit (inventaire → prêts →
 * location → boutique), repas et budget complet. Tout est annulable d'un
 * geste : chaque ligne créée est tracée dans `metadata.compas.autofill`.
 *
 * L'IA (Nemotron) relit les faits en spécialiste et chiffre ce que la base ne
 * connaît pas ; sans elle, les règles déterministes s'appliquent.
 */

export interface CompasAutofillSummary {
  nights: Array<{ night: number; type: NightPlan['type']; place: string | null; reason: string }>;
  transport: {
    mode: 'voiture' | 'avion';
    km: number;
    minutes: number;
    walkKm: number;
    fuelEur: number;
    basis: string;
  } | null;
  kit: Record<GearSource, number>;
  budget: BudgetLine[];
  total: number;
  notes: string[];
  usedAi: boolean;
  stepsCreated: number;
}

export type CompasAutofillResult =
  | { success: true; summary: CompasAutofillSummary }
  | { success: false; error: string };

const point = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
const schema = z.object({
  tripId: z.string().uuid(),
  tripSlug: z.string().min(1).max(200),
  /** Position actuelle de l'appareil (départ du trajet) ; null si refusée. */
  from: point.nullable(),
});

interface StepRow {
  id: string;
  day_number: number;
  order_index: number;
  latitude: number | null;
  longitude: number | null;
  accommodation_name: string | null;
  source: string | null;
  title: string;
  distance_km: number | null;
  transport_mode: string | null;
}

interface Refuge {
  name: string;
  lat: number;
  lon: number;
  altitudeM: number | null;
  pricePerNight: number | null;
}

const HIKING_ACTIVITIES = new Set(['hiking', 'trekking', 'bivouac', 'mixed']);
const MS_DAY = 86_400_000;

function tripDays(start: string | null, end: string | null): number | null {
  if (!start) return null;
  const a = Date.parse(`${start}T12:00:00Z`);
  const b = Date.parse(`${end ?? start}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / MS_DAY) + 1;
}

async function loadSteps(supabase: Supa, tripId: string): Promise<StepRow[]> {
  const { data } = await supabase
    .from('trip_steps')
    .select('id, day_number, order_index, latitude, longitude, accommodation_name, source, title, distance_km, transport_mode')
    .eq('trip_id', tripId)
    .order('day_number', { ascending: true })
    .order('order_index', { ascending: true });
  return ((data ?? []) as StepRow[]).map((s) => ({
    ...s,
    latitude: s.latitude == null ? null : Number(s.latitude),
    longitude: s.longitude == null ? null : Number(s.longitude),
    distance_km: s.distance_km == null ? null : Number(s.distance_km),
  }));
}

/** Refuges connus (base) à moins de 3 km : la table tarifée d'abord, puis l'annuaire. */
async function refugesNear(supabase: Supa, p: { lat: number; lon: number }): Promise<Refuge[]> {
  const dLat = 0.11;
  const dLon = 0.11 / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
  const [{ data: priced }, { data: listed }] = await Promise.all([
    supabase
      .from('map_refuges')
      .select('name, lat, lng, altitude_m, price_per_night')
      .gte('lat', p.lat - dLat)
      .lte('lat', p.lat + dLat)
      .gte('lng', p.lon - dLon)
      .lte('lng', p.lon + dLon)
      .limit(20),
    supabase
      .from('places')
      .select('name, latitude, longitude, altitude_m')
      .eq('category', 'refuge')
      .gte('latitude', p.lat - dLat)
      .lte('latitude', p.lat + dLat)
      .gte('longitude', p.lon - dLon)
      .lte('longitude', p.lon + dLon)
      .limit(20),
  ]);
  const out: Refuge[] = [
    ...((priced ?? []) as Array<Record<string, unknown>>).map((r) => ({
      name: String(r.name),
      lat: Number(r.lat),
      lon: Number(r.lng),
      altitudeM: r.altitude_m == null ? null : Number(r.altitude_m),
      pricePerNight: r.price_per_night == null ? null : Number(r.price_per_night),
    })),
    ...((listed ?? []) as Array<Record<string, unknown>>).map((r) => ({
      name: String(r.name),
      lat: Number(r.latitude),
      lon: Number(r.longitude),
      altitudeM: r.altitude_m == null ? null : Number(r.altitude_m),
      pricePerNight: null,
    })),
  ].filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lon));
  return out
    .map((r) => ({ r, d: haversineKm(p, r) }))
    .filter((x) => x.d <= 3)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.r);
}

/** Petit ordonnanceur : `limit` appels réseau en parallèle au plus. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * `think` : raisonnement du modèle (il compte dans `maxTokens`). Les étapes
 * jour par jour sont une liste longue : sans raisonnement, la réponse tient
 * en entier et arrive vite ; le chiffrage, court, garde le raisonnement.
 */
async function askJson(
  userId: string,
  system: string,
  prompt: string,
  maxTokens: number,
  think: boolean
): Promise<unknown | null> {
  try {
    const res = await askAI({
      feature: 'compas-autofill',
      tier: think ? COMPAS_AUTOFILL_SPEC.tier : 'fast',
      system,
      prompt,
      maxTokens,
      ...(think ? { reasoningBudget: COMPAS_AUTOFILL_SPEC.maxReasoningBudget } : {}),
      cacheTtlSeconds: 0,
      userId,
      json: true,
    });
    if (res.degraded || res.provider === 'fallback') return null;
    return extractIntentJson(res.text);
  } catch {
    return null;
  }
}

interface Anchor {
  name: string;
  lat: number;
  lon: number;
  countryCode: string | null;
  country: string | null;
  radiusKm: number;
}

function readAnchor(meta: Record<string, unknown>): Anchor | null {
  const a = compasMeta(meta).anchor as Record<string, unknown> | undefined;
  if (!a || typeof a !== 'object') return null;
  const lat = Number(a.lat);
  const lon = Number(a.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const place: CompasPlace = {
    name: String(a.name ?? ''),
    lat,
    lon,
    countryCode: typeof a.countryCode === 'string' ? a.countryCode : null,
    country: typeof a.country === 'string' ? a.country : null,
    kind: String(a.kind ?? 'place'),
    extent: Array.isArray(a.extent) && a.extent.length === 4 ? (a.extent.map(Number) as CompasPlace['extent']) : null,
  };
  return { ...place, radiusKm: destinationRadiusKm(place) };
}

export async function compasAutofillAction(
  input: z.input<typeof schema>
): Promise<CompasAutofillResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  const { tripId, from } = parsed.data;
  try {
    const auth = await requireEditor(tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const { supabase, userId, trip } = auth;
    const limited = await enforceRateLimit(userId, {
      scope: 'compas-autofill',
      limit: 6,
      windowMs: 10 * 60_000,
      failMode: 'closed',
    });
    if (limited) return { success: false, error: 'Préparation déjà lancée plusieurs fois : patiente quelques minutes.' };

    const meta = (trip.metadata ?? {}) as Record<string, unknown>;
    const compas = readCompasMeta(meta);
    const planned = Number(compasMeta(meta).planned_days);
    const days =
      tripDays(trip.start_date, trip.end_date) ??
      (Number.isInteger(planned) && planned >= 1 ? Math.min(60, planned) : null);
    if (!days) return { success: false, error: 'Dis-moi combien de jours, ou choisis les dates.' };
    const nightsCount = Math.max(0, days - 1);
    const party = Math.max(1, trip.party_size ?? 1);
    const prev = compasMeta(meta).autofill as { runId?: string } | undefined;
    if (prev?.runId) return { success: false, error: 'Le voyage est déjà prérempli : annule d’abord pour relancer.' };
    const notes: string[] = [];
    const runId = randomUUID();
    const today = localToday('Europe/Paris');
    const startedAt = Date.now();

    const [{ data: tripRow }, { data: orientation }] = await Promise.all([
      supabase.from('trips').select('primary_activity, estimated_budget').eq('id', tripId).maybeSingle(),
      supabase.from('user_orientation').select('autonomy, priority').eq('user_id', userId).maybeSingle(),
    ]);
    const activity = String((tripRow as { primary_activity?: string } | null)?.primary_activity ?? 'hiking');
    const prevBudget = (tripRow as { estimated_budget?: number | null } | null)?.estimated_budget ?? null;

    /* 1. Où : la destination retrouvée sur la carte (Dis-le), sinon les étapes, sinon son nom. */
    let steps = await loadSteps(supabase, tripId);
    let anchor = readAnchor(meta);
    const firstGeo = steps.find((s) => s.latitude != null && s.longitude != null);
    if (!anchor && firstGeo)
      anchor = {
        name: trip.destination_name ?? 'Départ',
        lat: firstGeo.latitude as number,
        lon: firstGeo.longitude as number,
        countryCode: trip.destination_country_code?.toUpperCase() ?? null,
        country: null,
        radiusKm: 60,
      };
    if (!anchor && trip.destination_name) {
      const place = await lookupDestination(trip.destination_name);
      if (place) anchor = { ...place, radiusKm: destinationRadiusKm(place) };
    }
    if (!anchor) return { success: false, error: 'Dis-moi où tu pars (« au Népal », « dans le Vercors »…).' };

    /* 2. Étapes : parcours du catalogue (destination locale), sinon itinéraire du spécialiste vérifié sur la carte. */
    let stepsCreated = 0;
    let routeSet = false;
    const createdStepIds: string[] = [];
    let stagePlaces: Array<{ day: number; name: string; lat: number; lon: number; move: StageMove }> = [];
    if (steps.length === 0) {
      if (HIKING_ACTIVITIES.has(activity) && compas.routeId == null && anchor.radiusKm <= 80) {
        const { data: near } = await supabase.rpc('compas_search_routes', {
          p_lat: anchor.lat,
          p_lng: anchor.lon,
          p_radius_km: 50,
          p_query: null,
          p_limit: 5,
        });
        const best = ((near ?? []) as Array<{ route_id: number; name: string | null }>)[0];
        if (best) {
          const { error } = await supabase
            .from('trips')
            .update({
              metadata: await patchTripMetadata(supabase, tripId, (m) => ({ ...m, route_id: Number(best.route_id) })),
            })
            .eq('id', tripId);
          if (!error) {
            await resplitSteps(supabase, tripId, Number(best.route_id), days);
            routeSet = true;
            notes.push(`Parcours du catalogue le plus proche choisi : ${best.name ?? `n° ${best.route_id}`}.`);
          }
        }
      }
      if (!routeSet) {
        const stagesPrompt = buildCompasStagesPrompt({
          destination: anchor.name,
          country: anchor.country,
          days,
          activity,
          partySize: party,
          month: trip.start_date ? MONTHS_FR[Number(trip.start_date.slice(5, 7)) - 1] ?? null : null,
          pace: compas.preferences?.pace ?? null,
          wishes: compas.preferences?.wishes ?? [],
          avoid: compas.preferences?.avoid ?? [],
        });
        // Un second essai si le premier échoue (modèle lent ou réponse illisible),
        // tant qu'il reste du temps avant la limite du serveur.
        let proposed: ReturnType<typeof sanitizeStages> = [];
        for (let attempt = 0; attempt < 2 && !proposed.length; attempt += 1) {
          if (attempt && Date.now() - startedAt > 25_000) break;
          proposed = sanitizeStages(
            await askJson(userId, buildCompasStagesSystem(), stagesPrompt, 2000, false),
            days
          );
        }
        // Chaque lieu proposé doit exister sur la carte, dans le pays, et à une
        // distance plausible de l'étape de la veille (village de préférence).
        const names = [...new Set(proposed.map((p) => p.place))];
        const found = await mapLimit(names, 6, (n) =>
          stageCandidates(n, { countryCode: anchor!.countryCode, country: anchor!.country })
        );
        const byName = new Map(names.map((n, i) => [n, found[i]]));
        let last: { name: string; lat: number; lon: number } | null = null;
        let dropped = 0;
        for (const p of proposed) {
          const hit = pickPlace(byName.get(p.place) ?? [], {
            near: last ?? anchor,
            maxKm: maxLegKm(p.move, last == null, anchor.radiusKm),
          });
          // Le titre garde le nom proposé (lisible) ; la position vient de la carte.
          if (hit) last = { name: p.place, lat: hit.lat, lon: hit.lon };
          else if (last?.name !== p.place) dropped += 1;
          const at = last ?? { name: anchor.name, lat: anchor.lat, lon: anchor.lon };
          stagePlaces.push({ day: p.day, name: at.name, lat: at.lat, lon: at.lon, move: hit ? p.move : 'aucun' });
        }
        if (!proposed.length) {
          notes.push('Itinéraire détaillé indisponible pour le moment : une étape par jour sur le lieu, à affiner dans Parcours.');
          stagePlaces = Array.from({ length: days }, (_, i) => ({
            day: i + 1,
            name: anchor!.name,
            lat: anchor!.lat,
            lon: anchor!.lon,
            move: 'aucun' as StageMove,
          }));
        } else if (dropped) notes.push(`${dropped} lieu(x) proposé(s) introuvable(s) sur la carte : étape gardée au lieu précédent.`);

        // Distances réelles entre deux soirs (à pied, à vélo ou sur la route), en parallèle.
        const legs = await mapLimit(stagePlaces, 4, async (st, i) => {
          const prevPlace = i > 0 ? stagePlaces[i - 1] : null;
          if (!prevPlace || distanceKm(prevPlace, st) < 0.3) return null;
          const mode = st.move === 'marche' ? 'pieton' : st.move === 'velo' ? 'velo' : 'voiture';
          if (st.move === 'vol' || st.move === 'bateau') return { km: Math.round(distanceKm(prevPlace, st)), ascent: null, measured: false };
          const r = await routeAttempt([prevPlace, st], mode);
          const km = r.legs?.reduce((t, l) => t + l.distanceKm, 0);
          const ascent = r.legs?.every((l) => l.ascentM != null) ? r.legs.reduce((t, l) => t + (l.ascentM ?? 0), 0) : null;
          if (km == null) return null;
          // Une journée à pied ou à vélo hors de portée : distance non retenue plutôt que fausse.
          if ((st.move === 'marche' && km > 45) || (st.move === 'velo' && km > 180)) return null;
          return { km: Math.round(km * 10) / 10, ascent: ascent != null ? Math.round(ascent) : null, measured: true };
        });
        const proposedByDay = new Map(proposed.map((p) => [p.day, p]));
        const rows = stagePlaces.map((st, i) => ({
          trip_id: tripId,
          day_number: st.day,
          order_index: 0,
          title: `Jour ${st.day} · ${st.name}`,
          description: proposedByDay.get(st.day)?.note ?? null,
          transport_mode: STEP_TRANSPORT[st.move],
          source: 'compas',
          latitude: Math.round(st.lat * 1e5) / 1e5,
          longitude: Math.round(st.lon * 1e5) / 1e5,
          distance_km: legs[i]?.km ?? null,
          elevation_gain_m: legs[i]?.ascent ?? null,
        }));
        await supabase.from('trip_steps').insert(rows);
      }
      steps = await loadSteps(supabase, tripId);
      createdStepIds.push(...steps.map((s) => s.id));
      stepsCreated = steps.length;
    }

    /* 3. Altitude réelle des étapes : acclimatation et kit en dépendent. */
    const geoSteps = steps.filter((s) => s.latitude != null && s.longitude != null);
    const altitudes =
      geoSteps.length > 0
        ? await elevationsAt(geoSteps.map((s) => [s.longitude as number, s.latitude as number] as const))
        : null;
    const maxStepAltitude = altitudes ? Math.max(0, ...altitudes.filter((a): a is number => a != null)) || null : null;

    /* 4. Nuits : profil + terrain + refuges connus (en parallèle). */
    const dayStep = (day: number) => steps.find((s) => s.day_number === day) ?? null;
    const nightPoint = (night: number) => {
      const s = dayStep(night) ?? dayStep(night + 1);
      return s?.latitude != null && s.longitude != null ? { lat: s.latitude, lon: s.longitude } : anchor!;
    };
    const refugesByNight: Refuge[][] = await mapLimit(
      Array.from({ length: nightsCount }, (_, i) => i + 1),
      6,
      (n) => refugesNear(supabase, nightPoint(n))
    );
    const maxAltitude =
      Math.max(maxStepAltitude ?? 0, ...refugesByNight.flat().map((r) => r.altitudeM ?? 0)) || null;
    const o = (orientation ?? {}) as { autonomy?: string | null; priority?: string | null };
    const plan = planNights({
      nights: nightsCount,
      pref: nightsPrefFor(activity, compas.preferences?.nights ?? null),
      autonomy: (o.autonomy ?? null) as Autonomy,
      priority: (o.priority ?? null) as Priority,
      maxAltitudeM: maxAltitude,
      refugeNear: refugesByNight.map((r) => r.length > 0),
    });
    if (maxAltitude != null && maxAltitude >= 2500)
      notes.push(
        `Altitude jusqu’à ${Math.round(maxAltitude)} m : monte progressivement (300 à 500 m de couchage par jour au-dessus de 3 000 m) et garde un jour de repos tous les 3 à 4 jours.`
      );

    const stays: Array<{ stepId: string; name: string }> = [];
    const nightsOut: CompasAutofillSummary['nights'] = [];
    for (const n of plan) {
      const refuge = n.type === 'refuge' ? refugesByNight[n.night - 1][0] ?? null : null;
      const step = dayStep(n.night);
      const where = step?.title?.split(' · ').slice(1).join(' · ') || null;
      const name =
        n.type === 'refuge' && refuge
          ? `Refuge · ${refuge.name}`
          : n.type === 'bivouac'
            ? 'Bivouac'
            : `Hébergement à réserver${where ? ` · ${where}` : ''}`;
      nightsOut.push({ night: n.night, type: n.type, place: refuge?.name ?? where, reason: n.reason });
      if (step && !step.accommodation_name) {
        const { error } = await supabase
          .from('trip_steps')
          .update({ accommodation_name: name.slice(0, 120), updated_at: new Date().toISOString() })
          .eq('id', step.id);
        if (!error) stays.push({ stepId: step.id, name: name.slice(0, 120) });
      }
    }

    /* 5. Venir : route mesurée si c'est raisonnable, sinon avion (chiffré par le spécialiste). */
    let transport: CompasAutofillSummary['transport'] = null;
    let carFuel: ReturnType<typeof estimateCarTrip> = null;
    const start = dayStep(1);
    const target = start?.latitude != null && start.longitude != null ? { lat: start.latitude, lon: start.longitude } : anchor;
    const origin = from ? await lookupReverse(from.lat, from.lon) : null;
    const abroad =
      anchor.countryCode != null && (origin?.countryCode ?? 'FR') !== anchor.countryCode;
    let flightNeeded = false;
    if (!from) notes.push('Position non partagée : le trajet jusqu’au départ est chiffré depuis la France, à ajuster.');
    const mode = from ? approachMode({ straightKm: distanceKm(from, target) }) : abroad ? 'avion' : 'route';
    if (mode === 'avion') {
      flightNeeded = true;
      transport = {
        mode: 'avion',
        km: Math.round(from ? distanceKm(from, target) : 0),
        minutes: 0,
        walkKm: 0,
        fuelEur: 0,
        basis: `vol aller-retour ${origin?.name ? `depuis ${origin.name}` : 'depuis la France'} vers ${anchor.name}`,
      };
    } else if (mode === 'route' && from) {
      const car = await routeAttempt([from, target], 'voiture');
      if (car.legs?.length) {
        const km = car.legs.reduce((t, l) => t + l.distanceKm, 0);
        const min = car.legs.reduce((t, l) => t + l.durationMin, 0);
        const last = car.legs[car.legs.length - 1].geometry.at(-1);
        let walkKm = 0;
        if (last) {
          const end = { lat: last[1], lon: last[0] };
          if (haversineKm(end, target) * 1000 > ARRIVAL_TOLERANCE_M) {
            const walk = await routeAttempt([end, target], 'pieton');
            walkKm = walk.legs?.reduce((t, l) => t + l.distanceKm, 0) ?? haversineKm(end, target);
          }
        }
        carFuel = estimateCarTrip({ oneWayKm: km, oneWayMin: min, partySize: party });
        if (carFuel)
          transport = {
            mode: 'voiture',
            km: carFuel.oneWayKm,
            minutes: carFuel.oneWayMin,
            walkKm: Math.round(walkKm * 10) / 10,
            fuelEur: carFuel.fuelEur,
            basis: carFuel.basis,
          };
      } else {
        // Pas de route (île, autre continent) : l'avion ou le bateau s'imposent.
        flightNeeded = true;
        transport = { mode: 'avion', km: Math.round(distanceKm(from, target)), minutes: 0, walkKm: 0, fuelEur: 0, basis: `aucune route praticable vers ${anchor.name}` };
      }
    } else if (mode === 'sur_place') notes.push('Tu es déjà au départ : aucun trajet à prévoir.');
    const motorLegs = steps.filter((s, i) => i > 0 && s.distance_km != null && s.distance_km > 0).length;
    // Étapes proposées à l'instant, sinon celles déjà en place avec leur moyen de transport.
    const moves = stagePlaces.length ? stagePlaces : movesFromSteps(steps);
    const localMoves = moves.filter((s, i) => i > 0 && ['bus', 'train', 'bateau', 'vol'].includes(s.move));
    // Road trip : kilomètres mesurés en voiture entre les étapes ; arrivé en avion, il faut louer.
    const carDays = moves.filter((s, i) => i > 0 && s.move === 'voiture');
    const carKmOnSite = steps
      .filter((st) => st.transport_mode === 'car' && st.distance_km != null)
      .reduce((t, st) => t + (st.distance_km ?? 0), 0);
    const rentalNeeded = carDays.length > 0 && flightNeeded;

    /* 6. Kit : règles contextuelles (pays, altitude réelle) + couchage selon les nuits. */
    const [{ data: itemRows }, { data: inv }, { data: loans }, { data: shopRows }] = await Promise.all([
      supabase.from('trip_items').select('item_name').eq('trip_id', tripId),
      supabase.from('product_ownership').select('id, name, is_lent, status').eq('user_id', userId).limit(500),
      supabase.from('materiel_loans').select('product_ownership_id, status').eq('borrower_id', userId).eq('status', 'en_cours').limit(50),
      supabase
        .from('shop_products')
        .select('id, name, transaction_type, price_eur, price_per_day')
        .eq('is_active', true)
        .is('deleted_at', null)
        .limit(400),
    ]);
    const tripItemNames = ((itemRows ?? []) as Array<{ item_name: string }>).map((r) => r.item_name);
    const loanIds = ((loans ?? []) as Array<{ product_ownership_id: string }>).map((l) => l.product_ownership_id);
    let borrowed: Array<{ inventoryItemId: string; name: string; lender: string | null }> = [];
    if (loanIds.length) {
      const { data } = await supabase.from('product_ownership').select('id, name').in('id', loanIds);
      borrowed = ((data ?? []) as Array<{ id: string; name: string }>).map((b) => ({ inventoryItemId: b.id, name: b.name, lender: null }));
    }
    const month = Number(trip.start_date?.slice(5, 7)) || undefined;
    const analysis = generateTripContextualKit({
      countryCode: anchor.countryCode ?? trip.destination_country_code,
      activity,
      durationDays: days,
      seasonMonth: month,
      currentItems: tripItemNames.map((item_name) => ({ item_name }) as unknown as TripItem),
      ...(maxAltitude ? { elevationProfile: { maxM: maxAltitude } as never } : {}),
    });
    const needs: GearNeed[] = [];
    const nightTypes = plan.map((n) => n.type);
    const ruleNeeds = [...analysis.vitalGaps, ...analysis.recommendedGaps]
      .filter((g) => keepRuleForNights(g.category, nightTypes) && keepRuleForActivity(g.key, activity))
      .map(needFromRule);
    for (const g of [...gearForNights(nightTypes), ...ruleNeeds])
      if (!needs.some((n) => sameNeed(n, g))) needs.push(g);
    const shop: SourceShop[] = ((shopRows ?? []) as Array<Record<string, unknown>>).map((p) => ({
      id: String(p.id),
      name: String(p.name ?? ''),
      mode: (p.transaction_type as SourceShop['mode']) ?? null,
      priceEur: p.price_eur == null ? null : Number(p.price_eur),
      pricePerDay: p.price_per_day == null ? null : Number(p.price_per_day),
    }));
    const picks = sourceGear(needs, {
      tripItemNames,
      inventory: ((inv ?? []) as Array<{ id: string; name: string; is_lent: boolean | null; status: InventoryStatus }>).map((i) => ({
        id: i.id,
        name: i.name,
        isLent: i.is_lent === true,
        inventoryStatus: i.status,
      })),
      borrowed,
      shop,
      days,
    });
    const SOURCE_NOTE: Record<GearSource, string> = {
      inventaire: 'dans ton inventaire',
      pret: 'prêté',
      location: 'à louer',
      achat: 'à acheter',
      a_trouver: 'à trouver',
    };
    let createdItemIds: string[] = [];
    if (picks.length) {
      const { data: inserted } = await supabase
        .from('trip_items')
        .insert(
          picks.map((p) => ({
            trip_id: tripId,
            item_name: p.need.name,
            category: p.need.category,
            quantity: 1,
            is_vital: p.need.vital,
            priority: p.need.vital ? 'vital' : 'recommended',
            source: 'compas-auto',
            ownership: 'personal',
            owner_id: userId,
            inventory_item_id: p.inventoryItemId,
            shop_product_id: p.shopProductId,
            reason: p.need.reason,
            notes: p.source === 'a_trouver' ? 'à trouver' : `${SOURCE_NOTE[p.source]} : ${p.label}`,
          }))
        )
        .select('id');
      createdItemIds = ((inserted ?? []) as Array<{ id: string }>).map((r) => r.id);
    }
    const kitCount: Record<GearSource, number> = { inventaire: 0, pret: 0, location: 0, achat: 0, a_trouver: 0 };
    for (const p of picks) kitCount[p.source] += 1;

    /* 7. Le spécialiste chiffre ce que la base ne connaît pas. */
    const hebergementNights = plan.filter((n) => n.type === 'hebergement').length;
    const stageLine = steps
      .map((s) => `J${s.day_number} ${s.title.split(' · ').slice(1).join(' · ')}${s.distance_km ? ` (${s.distance_km} km)` : ''}`)
      .join(' ; ');
    const facts = [
      `Destination : ${anchor.name}${anchor.country ? `, ${anchor.country}` : ''} (code ${anchor.countryCode ?? 'inconnu'}).`,
      `Départ de la personne : ${origin?.name ? `${origin.name}${origin.country ? `, ${origin.country}` : ''}` : 'France (position non partagée)'}.`,
      `${trip.start_date ? `Dates : ${trip.start_date} au ${trip.end_date ?? trip.start_date}` : 'Dates non choisies'} (${days} jour(s)), groupe de ${party}, activité ${activity}.`,
      abroad ? 'Voyage à l’étranger : oui.' : 'Voyage à l’étranger : non.',
      flightNeeded ? 'Vol à prévoir : oui (aller-retour).' : transport?.mode === 'voiture' ? `Trajet d’approche mesuré : ${transport.km} km en voiture (${transport.minutes} min) puis ${transport.walkKm} km à pied.` : 'Trajet d’approche : non mesuré.',
      `Itinéraire : ${stageLine || 'non détaillé'}.`,
      rentalNeeded
        ? `Voiture de location à prévoir : ${days} jour(s), ${fuelForKm(carKmOnSite, party).cars} voiture(s), ${Math.round(carKmOnSite)} km mesurés sur place.`
        : '',
      localMoves.length
        ? `Déplacements en transport entre étapes : ${localMoves.map((m) => `J${m.day} ${m.move} vers ${m.name}`).join(' ; ')}.`
        : motorLegs
          ? 'Déplacements entre étapes : à pied surtout.'
          : 'Déplacements entre étapes : aucun.',
      `Nuits : ${plan.map((n) => `nuit ${n.night} ${NIGHT_LABEL[n.type]}${refugesByNight[n.night - 1]?.[0] && n.type === 'refuge' ? ` (${refugesByNight[n.night - 1][0].name}${refugesByNight[n.night - 1][0].pricePerNight != null ? `, ${refugesByNight[n.night - 1][0].pricePerNight} €/pers en base` : ''})` : ''}`).join(' ; ') || 'aucune'}.`,
      maxAltitude ? `Altitude maximale mesurée : ${Math.round(maxAltitude)} m.` : '',
      `Matériel déjà possédé ou prêté (NE PAS le conseiller à l’achat) : ${picks.filter((p) => p.source === 'inventaire' || p.source === 'pret').map((p) => p.need.name).join(', ') || 'aucun'}.`,
      `Matériel à louer ou acheter : ${picks.filter((p) => p.source === 'location' || p.source === 'achat').map((p) => p.need.name).join(', ') || 'aucun'}.`,
      `Matériel introuvable en boutique : ${picks.filter((p) => p.source === 'a_trouver').map((p) => p.need.name).join(', ') || 'aucun'}.`,
    ]
      .filter(Boolean)
      .join('\n');
    // Budget de temps : l'appel rapide peut durer jusqu'à 30 s ; au-delà de
    // 25 s déjà passées (carte ou IA lentes), le chiffrage passe par les règles
    // plutôt que de risquer la limite de 60 s du serveur. Sans raisonnement :
    // avec, Nemotron 3.5 Lightning met ~50 s (mesure du 2026-10-05).
    const lateRun = Date.now() - startedAt > 25_000;
    const rawAdvice = lateRun
      ? null
      : await askJson(userId, buildCompasAutofillSystem(), buildCompasAutofillPrompt(facts), 1200, false);
    if (lateRun) notes.push('Préparation longue : chiffrage par les règles du Compas, relance « Tout préparer » pour l’avis du spécialiste.');
    const advice: AutofillAiAdvice = sanitizeAdvice(rawAdvice);
    const usedAi = rawAdvice != null;
    notes.push(...advice.notes);

    /* 8. Budget complet, chaque ligne avec sa source. */
    const refugeCost = plan.reduce((t, n) => {
      const r = n.type === 'refuge' ? refugesByNight[n.night - 1][0] : null;
      return t + (r?.pricePerNight ?? 0) * party;
    }, 0);
    const unpricedRefuges = plan.filter(
      (n) => n.type === 'refuge' && refugesByNight[n.night - 1][0]?.pricePerNight == null
    ).length;
    if (unpricedRefuges) notes.push(`${unpricedRefuges} nuit(s) en refuge sans prix connu : à vérifier auprès du refuge.`);
    if (hebergementNights && advice.lodgingPerPersonNight == null)
      notes.push('Hébergement sans prix connu : cherche une offre dans Résa · Nuits.');
    if (flightNeeded && advice.flightPerPerson == null) notes.push('Vol non chiffré : cherche-le dans Résa · Vols.');
    const meals = estimateMeals({
      days,
      partySize: party,
      nights: plan.map((n) => n.type),
      aiPerPersonDay: advice.mealsPerPersonDay,
    });
    const rental = picks.filter((p) => p.source === 'location').reduce((t, p) => t + (p.costEur ?? 0), 0);
    const purchase = picks.filter((p) => p.source === 'achat').reduce((t, p) => t + (p.costEur ?? 0), 0);
    const lines = budgetLines([
      refugeCost
        ? { category: 'hébergement', title: 'Nuits en refuge', amount: refugeCost, source: 'base', basis: 'prix des refuges en base × personnes' }
        : null,
      hebergementNights && advice.lodgingPerPersonNight != null
        ? {
            category: 'hébergement',
            title: `${hebergementNights} nuit(s) en hébergement`,
            amount: advice.lodgingPerPersonNight * hebergementNights * party,
            source: 'estimation',
            basis: `estimation de l’IA pour ${anchor.country ?? anchor.name}`,
          }
        : null,
      flightNeeded && advice.flightPerPerson != null
        ? {
            category: 'transport',
            title: `Vol aller-retour × ${party}`,
            amount: advice.flightPerPerson * party,
            source: 'estimation',
            basis: `estimation de l’IA · ${transport?.basis ?? 'vol'} · à confirmer dans Résa · Vols`,
          }
        : null,
      carFuel
        ? { category: 'transport', title: `Carburant aller-retour (${carFuel.roundTripKm} km)`, amount: carFuel.fuelEur, source: 'mesure', basis: carFuel.basis }
        : null,
      carKmOnSite > 0
        ? {
            category: 'transport',
            title: `Carburant sur place (${Math.round(carKmOnSite)} km)`,
            amount: fuelForKm(carKmOnSite, party).fuelEur,
            source: 'mesure',
            basis: `kilomètres mesurés entre les étapes · ${CAR_ASSUMPTIONS.litersPer100Km} L/100 km à ${CAR_ASSUMPTIONS.fuelEurPerLiter.toFixed(2).replace('.', ',')} €/L`,
          }
        : null,
      rentalNeeded && advice.carRentalPerDay != null
        ? {
            category: 'transport',
            title: `Location de voiture · ${days} jour(s)`,
            amount: advice.carRentalPerDay * days * fuelForKm(carKmOnSite, party).cars,
            source: 'estimation',
            basis: `estimation de l’IA pour ${anchor.country ?? anchor.name} · à comparer dans Résa · Trajets`,
          }
        : null,
      localMoves.length && advice.localTransportPerPerson != null
        ? {
            category: 'transport',
            title: `Transports sur place (${localMoves.length} trajet${localMoves.length > 1 ? 's' : ''})`,
            amount: advice.localTransportPerPerson * party,
            source: 'estimation',
            basis: 'estimation de l’IA pour les trajets entre étapes',
          }
        : null,
      { category: 'nourriture', title: `Repas · ${days} jour(s) × ${party}`, amount: meals.amount, source: 'estimation', basis: meals.basis },
      rental ? { category: 'matériel', title: 'Location de matériel', amount: rental, source: 'base', basis: 'prix par jour de la boutique × jours' } : null,
      purchase ? { category: 'matériel', title: 'Matériel à acheter', amount: purchase, source: 'base', basis: 'prix de la boutique' } : null,
      abroad && advice.entryFeesPerPerson != null
        ? {
            category: 'divers',
            title: advice.entryFeesDetail ? `Formalités : ${advice.entryFeesDetail}` : 'Visa, permis et taxes',
            amount: advice.entryFeesPerPerson * party,
            source: 'estimation',
            basis: 'estimation de l’IA · vérifie les montants officiels avant de partir',
          }
        : null,
      advice.insurancePerPerson != null && (abroad || (maxAltitude ?? 0) >= 2500)
        ? {
            category: 'divers',
            title: 'Assurance voyage et rapatriement',
            amount: advice.insurancePerPerson * party,
            source: 'estimation',
            basis: 'estimation de l’IA',
          }
        : null,
    ]);
    let createdExpenseIds: string[] = [];
    if (lines.length) {
      const { data: inserted, error: expenseError } = await supabase
        .from('trip_expenses')
        .insert(
          lines.map((l) => ({
            trip_id: tripId,
            payer_id: userId,
            title: l.title.slice(0, 100),
            amount: l.amount,
            currency: 'EUR',
            category: l.category,
            expense_date: trip.start_date ?? today,
            split_type: 'equal',
            is_planned: true,
            metadata: { autofill: runId, source: l.source, basis: l.basis },
          }))
        )
        .select('id');
      if (expenseError) console.warn('[compas] autofill dépenses', expenseError.code, expenseError.message);
      createdExpenseIds = ((inserted ?? []) as Array<{ id: string }>).map((r) => r.id);
    }
    const total = budgetTotal(lines);
    const setBudget = prevBudget == null && total > 0;

    /* 9. Trace pour l'annulation, puis budget cible si aucun n'était fixé. */
    const metadata = await patchTripMetadata(supabase, tripId, (m) => ({
      ...m,
      compas: {
        ...compasMeta(m),
        autofill: {
          runId,
          at: new Date().toISOString(),
          stepIds: createdStepIds,
          routeSet,
          itemIds: createdItemIds,
          expenseIds: createdExpenseIds,
          stays,
          budgetSet: setBudget,
          notes: notes.slice(0, 6),
        },
      },
    }));
    await supabase
      .from('trips')
      .update({ metadata, ...(setBudget ? { estimated_budget: total } : {}), updated_at: new Date().toISOString() })
      .eq('id', tripId);

    return {
      success: true,
      summary: { nights: nightsOut, transport, kit: kitCount, budget: lines, total, notes: notes.slice(0, 6), usedAi, stepsCreated },
    };
  } catch (err) {
    console.error('[compas] compasAutofillAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const undoSchema = z.object({ tripId: z.string().uuid(), tripSlug: z.string().min(1).max(200) });

/** Annule le préremplissage : retire exactement ce qu'il a écrit, rien d'autre. */
export async function compasUndoAutofillAction(
  input: z.input<typeof undoSchema>
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = undoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  const { tripId } = parsed.data;
  try {
    const auth = await requireEditor(tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const { supabase } = auth;
    const run = compasMeta((auth.trip.metadata ?? {}) as Record<string, unknown>).autofill as
      | {
          runId?: string;
          stepIds?: string[];
          routeSet?: boolean;
          itemIds?: string[];
          expenseIds?: string[];
          stays?: Array<{ stepId: string; name: string }>;
          budgetSet?: boolean;
        }
      | undefined;
    if (!run?.runId) return { success: false, error: 'Rien à annuler.' };
    if (run.itemIds?.length) await supabase.from('trip_items').delete().eq('trip_id', tripId).in('id', run.itemIds);
    if (run.expenseIds?.length)
      await supabase.from('trip_expenses').delete().eq('trip_id', tripId).in('id', run.expenseIds);
    for (const s of run.stays ?? [])
      await supabase
        .from('trip_steps')
        .update({ accommodation_name: null, updated_at: new Date().toISOString() })
        .eq('id', s.stepId)
        .eq('accommodation_name', s.name);
    if (run.stepIds?.length) await supabase.from('trip_steps').delete().eq('trip_id', tripId).in('id', run.stepIds);
    const metadata = await patchTripMetadata(supabase, tripId, (m) => {
      const next: Record<string, unknown> = { ...m, compas: { ...compasMeta(m), autofill: { undone: true } } };
      if (run.routeSet) delete next.route_id;
      return next;
    });
    await supabase
      .from('trips')
      .update({ metadata, ...(run.budgetSet ? { estimated_budget: null } : {}), updated_at: new Date().toISOString() })
      .eq('id', tripId);
    return { success: true };
  } catch (err) {
    console.error('[compas] compasUndoAutofillAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

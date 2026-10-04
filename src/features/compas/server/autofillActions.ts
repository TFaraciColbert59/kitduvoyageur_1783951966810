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
} from '@/lib/ai/features/compasAutofill';
import { extractIntentJson } from '@/lib/ai/features/compasIntent';
import { geocodePlace } from '@/features/adventure-prep/geocodeService';
import { ARRIVAL_TOLERANCE_M, routeAttempt } from '@/features/adventure-prep/routingService';
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
  needFromRule,
  sameNeed,
  planNights,
  sanitizeAdvice,
  sourceGear,
  type AutofillAiAdvice,
  type Autonomy,
  type BudgetLine,
  type GearNeed,
  type GearSource,
  type NightPlan,
  type Priority,
  type SourceShop,
} from '../engine/autofill';
import { compasMeta, patchTripMetadata, requireEditor, resplitSteps, type Supa } from './compasServer';

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
  transport: { km: number; minutes: number; walkKm: number; fuelEur: number; basis: string } | null;
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
    .select('id, day_number, order_index, latitude, longitude, accommodation_name, source')
    .eq('trip_id', tripId)
    .order('day_number', { ascending: true })
    .order('order_index', { ascending: true });
  return ((data ?? []) as StepRow[]).map((s) => ({
    ...s,
    latitude: s.latitude == null ? null : Number(s.latitude),
    longitude: s.longitude == null ? null : Number(s.longitude),
  }));
}

/** Refuges connus (base) à moins de ~12 km : la table tarifée d'abord, puis l'annuaire. */
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
    .filter((x) => x.d <= 12)
    .sort((a, b) => (a.r.pricePerNight == null ? 1 : 0) - (b.r.pricePerNight == null ? 1 : 0) || a.d - b.d)
    .map((x) => x.r);
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

    const days = tripDays(trip.start_date, trip.end_date);
    if (!days) return { success: false, error: 'Choisis d’abord les dates.' };
    const nightsCount = Math.max(0, days - 1);
    const party = Math.max(1, trip.party_size ?? 1);
    const meta = (trip.metadata ?? {}) as Record<string, unknown>;
    const compas = readCompasMeta(meta);
    const prev = compasMeta(meta).autofill as { runId?: string } | undefined;
    if (prev?.runId) return { success: false, error: 'Le voyage est déjà prérempli : annule d’abord pour relancer.' };
    const notes: string[] = [];
    const runId = randomUUID();

    const [{ data: tripRow }, { data: orientation }] = await Promise.all([
      supabase.from('trips').select('primary_activity, estimated_budget').eq('id', tripId).maybeSingle(),
      supabase.from('user_orientation').select('autonomy, priority').eq('user_id', userId).maybeSingle(),
    ]);
    const activity = String((tripRow as { primary_activity?: string } | null)?.primary_activity ?? 'hiking');
    const prevBudget = (tripRow as { estimated_budget?: number | null } | null)?.estimated_budget ?? null;

    /* 1. Étapes : celles du voyage, sinon le parcours du catalogue le plus proche, sinon une étape par jour. */
    let steps = await loadSteps(supabase, tripId);
    let anchor: { lat: number; lon: number; label: string | null } | null = null;
    const firstGeo = steps.find((s) => s.latitude != null && s.longitude != null);
    if (firstGeo) anchor = { lat: firstGeo.latitude as number, lon: firstGeo.longitude as number, label: trip.destination_name };
    if (!anchor && trip.destination_name) {
      const geo = await geocodePlace(trip.destination_name);
      const m = geo.status === 'ok' ? geo.matches[0] : null;
      if (m) anchor = { lat: m.lat, lon: m.lon, label: m.name };
    }
    if (!anchor) return { success: false, error: 'Indique d’abord où tu vas (lieu introuvable).' };

    let stepsCreated = 0;
    let routeSet = false;
    const createdStepIds: string[] = [];
    if (steps.length === 0) {
      if (HIKING_ACTIVITIES.has(activity) && compas.routeId == null) {
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
        const rows = Array.from({ length: days }, (_, i) => ({
          trip_id: tripId,
          day_number: i + 1,
          order_index: 0,
          title: `Jour ${i + 1} · ${anchor!.label ?? trip.destination_name ?? 'Sur place'}`,
          description: 'Étape posée par le Compas sur le lieu du voyage : choisis un parcours pour la détailler.',
          transport_mode: 'foot',
          source: 'compas',
          latitude: Math.round(anchor.lat * 1e5) / 1e5,
          longitude: Math.round(anchor.lon * 1e5) / 1e5,
        }));
        await supabase.from('trip_steps').insert(rows);
      }
      steps = await loadSteps(supabase, tripId);
      createdStepIds.push(...steps.map((s) => s.id));
      stepsCreated = steps.length;
    }

    /* 2. Nuits : profil + terrain + refuges connus. */
    const dayStep = (day: number) => steps.find((s) => s.day_number === day) ?? null;
    const nightPoint = (night: number) => {
      const s = dayStep(night + 1) ?? dayStep(night);
      return s?.latitude != null && s.longitude != null ? { lat: s.latitude, lon: s.longitude } : anchor!;
    };
    const refugesByNight: Refuge[][] = [];
    for (let n = 1; n <= nightsCount; n += 1) refugesByNight.push(await refugesNear(supabase, nightPoint(n)));
    const maxAltitude = Math.max(0, ...refugesByNight.flat().map((r) => r.altitudeM ?? 0)) || null;
    const o = (orientation ?? {}) as { autonomy?: string | null; priority?: string | null };
    const plan = planNights({
      nights: nightsCount,
      pref: compas.preferences?.nights ?? null,
      autonomy: (o.autonomy ?? null) as Autonomy,
      priority: (o.priority ?? null) as Priority,
      maxAltitudeM: maxAltitude,
      refugeNear: refugesByNight.map((r) => r.length > 0),
    });

    const stays: Array<{ stepId: string; name: string }> = [];
    const nightsOut: CompasAutofillSummary['nights'] = [];
    for (const n of plan) {
      const refuge = n.type === 'refuge' ? refugesByNight[n.night - 1][0] ?? null : null;
      const name =
        n.type === 'refuge' && refuge
          ? `Refuge · ${refuge.name}`
          : n.type === 'bivouac'
            ? 'Bivouac'
            : 'Hébergement à réserver';
      nightsOut.push({ night: n.night, type: n.type, place: refuge?.name ?? null, reason: n.reason });
      const step = dayStep(n.night);
      if (step && !step.accommodation_name) {
        const { error } = await supabase
          .from('trip_steps')
          .update({ accommodation_name: name, updated_at: new Date().toISOString() })
          .eq('id', step.id);
        if (!error) stays.push({ stepId: step.id, name });
      }
    }

    /* 3. Trajet depuis la position réelle : voiture jusqu'au point le plus proche, puis à pied jusqu'au départ. */
    let transport: CompasAutofillSummary['transport'] = null;
    let carFuel: ReturnType<typeof estimateCarTrip> = null;
    const start = dayStep(1);
    const target = start?.latitude != null && start.longitude != null ? { lat: start.latitude, lon: start.longitude } : anchor;
    if (!from) notes.push('Position non partagée : le trajet jusqu’au départ n’est pas chiffré.');
    else if (haversineKm(from, target) < 0.5) notes.push('Tu es déjà au départ : aucun trajet à prévoir.');
    else {
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
            km: carFuel.oneWayKm,
            minutes: carFuel.oneWayMin,
            walkKm: Math.round(walkKm * 10) / 10,
            fuelEur: carFuel.fuelEur,
            basis: carFuel.basis,
          };
      } else notes.push('Itinéraire routier indisponible pour le moment : trajet non chiffré.');
    }

    /* 4. Kit : règles contextuelles + couchage selon les nuits, trouvés dans l'ordre voulu. */
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
      countryCode: trip.destination_country_code,
      activity,
      durationDays: days,
      seasonMonth: month,
      currentItems: tripItemNames.map((item_name) => ({ item_name }) as unknown as TripItem),
    });
    const needs: GearNeed[] = [];
    const nightTypes = plan.map((n) => n.type);
    const ruleNeeds = [...analysis.vitalGaps, ...analysis.recommendedGaps]
      .filter((g) => keepRuleForNights(g.category, nightTypes))
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

    /* 5. L'IA relit et chiffre ce que la base ne connaît pas. */
    const hebergementNights = plan.filter((n) => n.type === 'hebergement').length;
    const facts = [
      `Lieu : ${anchor.label ?? trip.destination_name ?? 'inconnu'} (${trip.destination_country_code ?? 'pays inconnu'}), lat ${anchor.lat.toFixed(3)}, lon ${anchor.lon.toFixed(3)}.`,
      `Dates : ${trip.start_date} au ${trip.end_date ?? trip.start_date} (${days} jour(s)), groupe de ${party}, activité ${activity}.`,
      `Nuits : ${plan.map((n) => `nuit ${n.night} ${NIGHT_LABEL[n.type]}${refugesByNight[n.night - 1]?.[0] && n.type === 'refuge' ? ` (${refugesByNight[n.night - 1][0].name}${refugesByNight[n.night - 1][0].pricePerNight != null ? `, ${refugesByNight[n.night - 1][0].pricePerNight} €/pers en base` : ''})` : ''}`).join(' ; ') || 'aucune'}.`,
      transport
        ? `Trajet d’approche mesuré : ${transport.km} km en voiture (${transport.minutes} min) puis ${transport.walkKm} km à pied jusqu’au départ.`
        : 'Trajet non mesuré.',
      `Matériel déjà possédé ou prêté (NE PAS le conseiller à l’achat) : ${picks.filter((p) => p.source === 'inventaire' || p.source === 'pret').map((p) => p.need.name).join(', ') || 'aucun'}.`,
      `Matériel à louer ou acheter : ${picks.filter((p) => p.source === 'location' || p.source === 'achat').map((p) => p.need.name).join(', ') || 'aucun'}.`,
      `Matériel introuvable en boutique : ${picks.filter((p) => p.source === 'a_trouver').map((p) => p.need.name).join(', ') || 'aucun'}.`,
      maxAltitude ? `Altitude des refuges proches : jusqu’à ${maxAltitude} m.` : '',
    ]
      .filter(Boolean)
      .join('\n');
    let advice: AutofillAiAdvice = { mealsPerPersonDay: null, lodgingPerPersonNight: null, notes: [] };
    let usedAi = false;
    try {
      const res = await askAI({
        feature: 'compas-autofill',
        tier: COMPAS_AUTOFILL_SPEC.tier,
        system: buildCompasAutofillSystem(),
        prompt: buildCompasAutofillPrompt(facts),
        maxTokens: 700,
        reasoningBudget: COMPAS_AUTOFILL_SPEC.maxReasoningBudget,
        cacheTtlSeconds: 0,
        userId,
      });
      if (!res.degraded && res.provider !== 'fallback') {
        advice = sanitizeAdvice(extractIntentJson(res.text));
        usedAi = true;
      }
    } catch {
      /* repli déterministe */
    }
    notes.push(...advice.notes);

    /* 6. Budget complet, chaque ligne avec sa source. */
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
            basis: 'estimation de l’IA pour la région',
          }
        : null,
      carFuel
        ? { category: 'transport', title: `Carburant aller-retour (${carFuel.roundTripKm} km)`, amount: carFuel.fuelEur, source: 'mesure', basis: carFuel.basis }
        : null,
      { category: 'nourriture', title: `Repas · ${days} jour(s) × ${party}`, amount: meals.amount, source: 'estimation', basis: meals.basis },
      rental ? { category: 'matériel', title: 'Location de matériel', amount: rental, source: 'base', basis: 'prix par jour de la boutique × jours' } : null,
      purchase ? { category: 'matériel', title: 'Matériel à acheter', amount: purchase, source: 'base', basis: 'prix de la boutique' } : null,
    ]);
    let createdExpenseIds: string[] = [];
    if (lines.length) {
      const { data: inserted } = await supabase
        .from('trip_expenses')
        .insert(
          lines.map((l) => ({
            trip_id: tripId,
            payer_id: userId,
            title: l.title.slice(0, 100),
            amount: l.amount,
            currency: 'EUR',
            category: l.category,
            expense_date: trip.start_date,
            split_type: 'equal',
            is_planned: true,
            metadata: { autofill: runId, source: l.source, basis: l.basis },
          }))
        )
        .select('id');
      createdExpenseIds = ((inserted ?? []) as Array<{ id: string }>).map((r) => r.id);
    }
    const total = budgetTotal(lines);
    const setBudget = prevBudget == null && total > 0;

    /* 7. Trace pour l'annulation, puis budget cible si aucun n'était fixé. */
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

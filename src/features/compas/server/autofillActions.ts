'use server';
import type { InventoryStatus } from '@/features/materiel/domain/inventory';

import { createHash, randomUUID } from 'node:crypto';
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
import { ARRIVAL_TOLERANCE_M, routeAttempt } from '@/features/adventure-prep/routingService';
import { terrainElevations } from '@/lib/geo/terrainElevation';
import { cached, coordKey, readShared, writeShared } from './sharedCache';
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
  gearForActivity,
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
  FLIGHT_THRESHOLD_KM,
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
import { compasMeta, patchTripMetadata, readProfile, requireEditor, resplitSteps, tripBasis, type Supa } from './compasServer';
import { adaptationText, expectedKm, pickCatalogRoute, resolveProjectContext } from '../engine/projectContext';
import { bestPeriod, monthName } from '../engine/period';
import { partsText, retryParts, staleParts, unionParts, untouchedSince, type AutofillPart, type ProjectBasis } from '../engine/dependencies';
import { lookupDestination, lookupReverse, stageCandidates } from './placeLookup';
import { destinationRadiusKm, distanceKm, maxLegKm, pickPlace, stageTitleFor, type CompasPlace } from '../engine/places';
import { untangleStages } from '../engine/stageOrder';
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
  /** Phase « étapes » terminée : l'itinéraire est écrit, la suite reste à lancer. */
  | { success: true; pending: true; stepsCreated: number }
  /** `retryInS` : limite de fréquence atteinte, l'écran relance seul après ce délai. */
  | { success: false; error: string; retryInS?: number };

/** Itinéraire écrit par la phase « étapes », en attente de la phase « reste ». */
interface PendingRun {
  runId: string;
  stepIds: string[];
  routeSet: boolean;
  notes: string[];
  /** Dates posées par le préremplissage (meilleure période) : l'annulation les retire. */
  datesSet?: boolean;
  /** Heure (ms) à laquelle une phase « rest » a pris la main. */
  restAt?: number;
  /** Préremplissages d'affilée restés sur l'itinéraire de secours (0 : itinéraire réel). */
  stagesFallback?: number;
}

const point = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
const schema = z.object({
  tripId: z.string().uuid(),
  tripSlug: z.string().min(1).max(200),
  /** Position actuelle de l'appareil (départ du trajet) ; null si refusée. */
  from: point.nullable(),
  /**
   * Deux appels courts plutôt qu'un long : « steps » écrit l'itinéraire,
   * « rest » les nuits, le trajet, le kit et le budget. Chaque appel tient
   * largement sous la limite de 60 s du serveur, même quand l'IA est lente.
   */
  phase: z.enum(['steps', 'rest', 'all']).default('all'),
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

const HIKING_ACTIVITIES = new Set(['hiking', 'trekking', 'bivouac', 'mixed', 'trail', 'running']);
/** Transfert en véhicule plausible entre deux étapes d'un trek ou d'un circuit à vélo. */
const TRANSFER_MAX_KM = 250;
/** Au-delà de ce rayon (un pays, une grande région), les étapes ne sont pas cherchées « près du centre ». */
const STAGE_BIAS_MAX_KM = 120;
/** Étape de l'autre côté d'une frontière : au plus 300 km de la précédente. */
const BORDER_MAX_KM = 300;
/** Activités qui changent de lieu chaque jour ou presque : un itinéraire figé sur un lieu est un échec. */
const ITINERANT_ACTIVITIES = new Set(['roadtrip', 'vanlife', 'trekking', 'cycling']);
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
  think: boolean,
  /** Réponse partagée entre tous ceux qui posent la même question (0 = jamais). */
  cacheTtlSeconds = 0,
  /** Temps maximal accordé à cet appel (ms) : la fonction serveur s'arrête à 60 s. */
  timeoutMs?: number
): Promise<unknown | null> {
  if (timeoutMs != null && timeoutMs < 4000) return null;
  try {
    const res = await askAI({
      ...(timeoutMs != null ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
      feature: 'compas-autofill',
      tier: think ? COMPAS_AUTOFILL_SPEC.tier : 'fast',
      system,
      prompt,
      maxTokens,
      ...(think ? { reasoningBudget: COMPAS_AUTOFILL_SPEC.maxReasoningBudget } : {}),
      cacheTtlSeconds,
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
  /** Nature OSM (« other » : massif, lac, vallée…), absente des anciennes ancres. */
  kind?: string;
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

function readPending(meta: Record<string, unknown>): PendingRun | null {
  const p = compasMeta(meta).autofill_pending as Partial<PendingRun> | undefined;
  if (!p || typeof p.runId !== 'string') return null;
  return {
    runId: p.runId,
    stepIds: Array.isArray(p.stepIds) ? p.stepIds.filter((x): x is string => typeof x === 'string') : [],
    routeSet: p.routeSet === true,
    datesSet: p.datesSet === true,
    restAt: typeof p.restAt === 'number' ? p.restAt : undefined,
    stagesFallback: Number.isInteger(p.stagesFallback) ? Number(p.stagesFallback) : 0,
    notes: Array.isArray(p.notes) ? p.notes.filter((x): x is string => typeof x === 'string') : [],
  };
}

function withoutPending(c: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...c };
  delete rest.autofill_pending;
  delete rest.autofill_carry;
  return rest;
}

/** Ce qu'une réadaptation a gardé du préremplissage précédent (retouché ou encore juste). */
interface Carry {
  /** Étapes du préremplissage à remplacer, mais seulement par un itinéraire exploitable. */
  replaceStepIds?: string[];
  /** Le parcours du catalogue posé par le préremplissage part avec ces étapes. */
  replaceRoute?: boolean;
  stepIds: string[];
  routeSet: boolean;
  itemIds: string[];
  expenseIds: string[];
  expenseTitles: string[];
  stays: Array<{ stepId: string; name: string }>;
  /** Préremplissages d'affilée restés sur l'itinéraire de secours. */
  stagesFallback?: number;
}

function strIds(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function readCarry(meta: Record<string, unknown>): Carry | null {
  const c = compasMeta(meta).autofill_carry as Record<string, unknown> | undefined;
  if (!c || typeof c !== 'object') return null;
  return {
    replaceStepIds: strIds(c.replaceStepIds),
    replaceRoute: c.replaceRoute === true,
    stepIds: strIds(c.stepIds),
    routeSet: c.routeSet === true,
    itemIds: strIds(c.itemIds),
    expenseIds: strIds(c.expenseIds),
    expenseTitles: strIds(c.expenseTitles),
    stays: Array.isArray(c.stays)
      ? (c.stays as Array<Record<string, unknown>>)
          .filter((s) => typeof s?.stepId === 'string' && typeof s?.name === 'string')
          .map((s) => ({ stepId: String(s.stepId), name: String(s.name) }))
      : [],
    stagesFallback: Number.isInteger(c.stagesFallback) ? Number(c.stagesFallback) : 0,
  };
}



export async function compasAutofillAction(
  input: z.input<typeof schema>
): Promise<CompasAutofillResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  const { tripId, from, phase } = parsed.data;
  try {
    const auth = await requireEditor(tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const { supabase, userId, trip } = auth;
    // La phase « rest », ou une reprise (itinéraire déjà écrit, en attente),
    // continue une préparation déjà comptée.
    if (phase !== 'rest' && !readPending((trip.metadata ?? {}) as Record<string, unknown>)) {
      const limited = await enforceRateLimit(userId, {
        scope: 'compas-autofill',
        limit: 6,
        windowMs: 10 * 60_000,
        failMode: 'closed',
      });
      if (limited) {
        const wait = Number(limited.headers.get('Retry-After'));
        const retryInS = limited.status === 429 && Number.isFinite(wait) && wait > 0 ? Math.min(wait, 900) : undefined;
        return {
          success: false,
          error: retryInS
            ? `Beaucoup de préparations d’affilée : je reprends seul dans ${Math.max(1, Math.ceil(retryInS / 60))} min.`
            : 'Préparation déjà lancée plusieurs fois : patiente quelques minutes.',
          retryInS,
        };
      }
    }

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
    // Un second appel « rest » (onglet rouvert, double déclenchement) arrive après la fin : rien à dire.
    if (prev?.runId && phase === 'rest') return { success: true, pending: true, stepsCreated: 0 };
    if (prev?.runId) return { success: false, error: 'Le voyage est déjà prérempli : annule d’abord pour relancer.' };
    const pending = readPending(meta);
    const carry = readCarry(meta);
    // Une phase « steps » relancée alors qu'un itinéraire attend déjà : on le garde.
    if (phase === 'steps' && pending) return { success: true, pending: true, stepsCreated: pending.stepIds.length };
    const resume = phase === 'rest' ? pending : null;
    // Un seul « rest » à la fois : deux onglets, ou l'écran remonté pendant la
    // préparation, n'écrivent jamais deux fois les objets et les dépenses.
    if (phase === 'rest' && pending) {
      const claimed = Number(pending.restAt ?? 0);
      // Une fonction serveur ne dépasse jamais 60 s : passé 65 s, l'autre « rest » est mort.
      if (Date.now() - claimed < 65_000) return { success: true, pending: true, stepsCreated: 0 };
      const md = await patchTripMetadata(supabase, tripId, (m) => ({
        ...m,
        compas: { ...compasMeta(m), autofill_pending: { ...pending, restAt: Date.now() } },
      }));
      await supabase.from('trips').update({ metadata: md }).eq('id', tripId);
    }
    const notes: string[] = [...(resume?.notes ?? [])];
    const runId = resume?.runId ?? randomUUID();
    const today = localToday('Europe/Paris');
    const startedAt = Date.now();
    // Durée de chaque étape (journal serveur) : la limite d'une fonction est de 60 s.
    const laps: Record<string, number> = {};
    let lapAt = startedAt;
    // Ce qu'il reste avant 48 s (marge pour écrire avant la limite de 60 s).
    const remaining = () => 48_000 - (Date.now() - startedAt);
    const lap = (name: string) => {
      const now = Date.now();
      laps[name] = now - lapAt;
      lapAt = now;
    };

    const [{ data: tripRow }, profile] = await Promise.all([
      supabase.from('trips').select('primary_activity, estimated_budget').eq('id', tripId).maybeSingle(),
      readProfile(supabase, userId),
    ]);
    const activity = String((tripRow as { primary_activity?: string } | null)?.primary_activity ?? 'hiking');
    // Contexte projet : la phrase et les réglages du projet priment, le profil
    // n'est qu'un point de départ (adapté s'il ne tient pas pour CE projet).
    const ctx = resolveProjectContext({
      activity,
      days,
      hours: compas.durationHours,
      partySize: party,
      month: trip.start_date ? Number(trip.start_date.slice(5, 7)) : null,
      project: compas.preferences,
      profile,
    });
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
    // Sortie de quelques heures sans lieu dit : autour de la position partagée.
    if (!anchor && from && ctx.scope === 'sortie') {
      const here = await lookupReverse(from.lat, from.lon);
      anchor = {
        name: here?.locality ?? here?.name ?? 'Autour de toi',
        lat: from.lat,
        lon: from.lon,
        countryCode: here?.countryCode ?? null,
        country: here?.country ?? null,
        radiusKm: 15,
      };
    }
    if (!anchor)
      return {
        success: false,
        error:
          ctx.scope === 'sortie'
            ? 'Partage ta position ou dis où tu sors (« à Annecy », « en forêt de Fontainebleau »…).'
            : 'Dis-moi où tu pars (« au Népal », « dans le Vercors »…).',
      };

    /* 1 bis. Quand : sans date, la meilleure période pour CE projet (annoncée, modifiable). */
    let datesSet = resume?.datesSet ?? false;
    if (!trip.start_date && !resume && ctx.scope === 'sejour') {
      const period = bestPeriod({ activity, lat: anchor.lat, today, days });
      if (period) {
        const { error } = await supabase
          .from('trips')
          .update({ start_date: period.start, end_date: period.end, updated_at: new Date().toISOString() })
          .eq('id', tripId);
        if (!error) {
          trip.start_date = period.start;
          trip.end_date = period.end;
          datesSet = true;
          notes.push(
            `Période proposée : ${monthName(period.month)} (${period.why}). Change-la dans « Quand » si elle ne te va pas.`
          );
        }
      }
    }

    /* 2. Étapes : parcours du catalogue (destination locale), sinon itinéraire du spécialiste vérifié sur la carte. */
    let stepsCreated = resume?.stepIds.length ?? 0;
    let routeSet = resume?.routeSet ?? false;
    // Itinéraire de secours (aucune proposition à temps) : retenté à l'ouverture suivante.
    let stagesFallback = resume?.stagesFallback ?? 0;
    const createdStepIds: string[] = [...(resume?.stepIds ?? [])];
    let stagePlaces: Array<{ day: number; name: string; lat: number; lon: number; move: StageMove; note: string | null }> = [];
    // Réadaptation : l'ancien itinéraire n'est remplacé que par un meilleur.
    const replacing = !resume ? (carry?.replaceStepIds ?? []) : [];
    const dropReplaced = async () => {
      if (!replacing.length) return;
      await supabase.from('trip_steps').delete().eq('trip_id', tripId).in('id', replacing);
      if (carry?.replaceRoute) {
        const md = await patchTripMetadata(supabase, tripId, (m) => {
          const next = { ...m };
          delete next.route_id;
          return next;
        });
        await supabase.from('trips').update({ metadata: md }).eq('id', tripId);
      }
    };
    if ((steps.length === 0 || replacing.length > 0) && !resume) {
      if (HIKING_ACTIVITIES.has(activity) && (compas.routeId == null || carry?.replaceRoute) && anchor.radiusKm <= 80) {
        const { data: near } = await supabase.rpc('compas_search_routes', {
          p_lat: anchor.lat,
          p_lng: anchor.lon,
          p_radius_km: 50,
          p_query: null,
          p_limit: 12,
        });
        // Le parcours qui épouse le projet (distance dite, durée, rythme, niveau), pas le premier venu.
        const best = pickCatalogRoute(
          (near ?? []) as Array<{ route_id: number; name: string | null; distance_km: number | null; distance_from_m: number | null }>,
          expectedKm(ctx, { hours: compas.durationHours, days, targetKm: compas.preferences?.targetKm ?? null })
        );
        if (best) {
          await dropReplaced();
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
          // Grand massif ou chaîne (Pyrénées, Alpes) : son « pays » n'est que
          // celui de son centre ; l'itinéraire peut passer d'un versant à l'autre.
          country: anchor.kind === 'other' && anchor.radiusKm > STAGE_BIAS_MAX_KM ? null : anchor.country,
          days,
          activity,
          partySize: party,
          month: trip.start_date ? MONTHS_FR[Number(trip.start_date.slice(5, 7)) - 1] ?? null : null,
          pace: ctx.pace.value,
          wishes: compas.preferences?.wishes ?? [],
          avoid: compas.preferences?.avoid ?? [],
          level: ctx.level.value,
          terrain: ctx.terrain.value,
          targetKm: compas.preferences?.targetKm ?? null,
          outdoorNights: ctx.outdoorNights.value,
        });
        // Itinéraire de base partagé une semaine (même destination, durée,
        // activité, mois et envies), mais seulement s'il est exploitable : une
        // réponse illisible ou figée sur un seul lieu pour un circuit n'est ni
        // gardée ni servie. Sinon on redemande, tant qu'il reste du temps.
        const minPlaces = ITINERANT_ACTIVITIES.has(activity) && days >= 4 ? 3 : 1;
        const usable = (st: ReturnType<typeof sanitizeStages>) =>
          st.length > 0 && new Set(st.map((x) => x.place)).size >= minPlaces;
        const stagesKey = createHash('sha256').update(`${buildCompasStagesSystem()}\n${stagesPrompt}`).digest('hex');
        let proposed: ReturnType<typeof sanitizeStages> =
          (await readShared<ReturnType<typeof sanitizeStages>>('stages', stagesKey)) ?? [];
        if (!usable(proposed)) proposed = [];
        for (let attempt = 0; attempt < 3 && !usable(proposed); attempt += 1) {
          if (attempt && Date.now() - startedAt > 20_000) break;
          // La suite (carte, distances) a besoin d'environ 15 s : l'IA n'a que le reste.
          const next = sanitizeStages(
            await askJson(userId, buildCompasStagesSystem(), stagesPrompt, 2000, false, 0, Math.min(30_000, remaining() - 15_000)),
            days
          );
          if (usable(next)) {
            proposed = next;
            await writeShared('stages', stagesKey, next, 7 * 86_400);
          } else if (new Set(next.map((x) => x.place)).size > new Set(proposed.map((x) => x.place)).size) {
            // Le moins mauvais en attendant mieux (jamais partagé).
            proposed = next;
          }
        }
        // Chaque lieu proposé doit exister sur la carte, dans le pays, et à une
        // distance plausible de l'étape de la veille (village de préférence).
        const names = [...new Set(proposed.map((p) => p.place))];
        const found = await mapLimit(names, 6, (n) =>
          // Recherche biaisée vers la destination seulement si elle est compacte
          // (une ville, un massif) : vers le centre d'un pays, elle ferait
          // préférer un hameau homonyme (« Cusco » au nord du Pérou).
          stageCandidates(
            n,
            { countryCode: anchor!.countryCode, country: anchor!.country },
            anchor!.radiusKm <= STAGE_BIAS_MAX_KM ? anchor : null
          )
        );
        const byName = new Map(names.map((n, i) => [n, found[i]]));
        let last: { name: string; lat: number; lon: number } | null = null;
        /** Le nom proposé de la dernière étape trouvée (le titre peut venir de la carte). */
        let lastProposed: string | null = null;
        let dropped = 0;
        for (const p of proposed) {
          const candidates = byName.get(p.place) ?? [];
          let move = p.move;
          const walkLike = p.move === 'marche' || p.move === 'velo' || p.move === 'aucun';
          // Sortie de quelques heures : tout reste autour du départ (jamais la grande ville voisine).
          const legKm =
            ctx.scope === 'sortie' ? anchor.radiusKm : maxLegKm(p.move, last == null, anchor.radiusKm);
          // Destination à cheval sur une frontière (Patagonie, Alpes, Pyrénées) :
          // le lieu est cherché aussi chez le voisin, toujours à distance
          // plausible de l'étape d'avant (jamais un homonyme lointain).
          let across: CompasPlace[] | null = null;
          const acrossCandidates = async () =>
            (across ??= anchor!.countryCode
              ? (await stageCandidates(p.place, { countryCode: null, country: null })).filter(
                  (c) => c.countryCode !== anchor!.countryCode
                )
              : []);
          // Du plus sûr au moins sûr : le nom exact dans le pays, puis chez le
          // voisin, avant toute correspondance approchée (« Puerto Natales »
          // n'est pas « Puerto Madryn » à 1 100 km). « À pied » depuis la ville
          // d'arrivée jusqu'au départ du trek (Puerto Natales → Torres del
          // Paine, 100 km) : c'est un transfert, un lieu à moins de 250 km reste
          // l'étape, rejointe en véhicule.
          const attempts: Array<{ from: () => Promise<CompasPlace[]> | CompasPlace[]; strict: boolean; transfer: boolean }> = [
            { from: () => candidates, strict: true, transfer: false },
            { from: () => candidates, strict: true, transfer: true },
            { from: acrossCandidates, strict: true, transfer: false },
            { from: acrossCandidates, strict: true, transfer: true },
            { from: () => candidates, strict: false, transfer: false },
            { from: () => candidates, strict: false, transfer: true },
            { from: acrossCandidates, strict: false, transfer: false },
            { from: acrossCandidates, strict: false, transfer: true },
          ];
          let hit: CompasPlace | null = null;
          for (const a of attempts) {
            if (a.transfer && !(last && walkLike)) continue;
            const list = await a.from();
            if (!list.length) continue;
            const isAcross = list !== candidates;
            const maxKm = a.transfer ? TRANSFER_MAX_KM : legKm;
            hit = pickPlace(list, {
              near: a.transfer ? last : (last ?? anchor),
              // La première étape se mesure au rayon de la destination (une région
              // entière) ; les suivantes, à 300 km au plus de la veille.
              maxKm: isAcross && last ? Math.min(BORDER_MAX_KM, maxKm) : maxKm,
              query: p.place,
              strict: a.strict,
            });
            if (hit) {
              if (a.transfer) move = 'voiture';
              break;
            }
          }
          // Le titre garde le nom proposé (lisible) ; la position vient de la carte.
          if (hit) {
            last = { name: stageTitleFor(p.place, hit.name), lat: hit.lat, lon: hit.lon };
            lastProposed = p.place;
          } else if (lastProposed !== p.place) {
            dropped += 1;
            console.info('[compas] étape introuvable', {
              place: p.place,
              move: p.move,
              candidates: candidates.length,
            });
          }
          const at = last ?? { name: anchor.name, lat: anchor.lat, lon: anchor.lon };
          stagePlaces.push({ day: p.day, name: at.name, lat: at.lat, lon: at.lon, move: hit ? move : 'aucun', note: p.note });
        }
        if (!proposed.length && replacing.length) {
          // L'IA n'a pas répondu : on garde l'itinéraire d'avant plutôt qu'un moins bon.
          notes.push('Itinéraire gardé tel quel : la nouvelle proposition n’est pas arrivée à temps. Je réessaie à ta prochaine visite.');
          stagePlaces = [];
          stagesFallback = (carry?.stagesFallback ?? 0) + 1;
        } else if (!proposed.length) {
          notes.push('Itinéraire détaillé indisponible pour le moment : une étape par jour sur le lieu. Je réessaie à ta prochaine visite, ou affine-le dans Parcours.');
          stagesFallback = (carry?.stagesFallback ?? 0) + 1;
          stagePlaces = Array.from({ length: days }, (_, i) => ({
            day: i + 1,
            name: anchor!.name,
            lat: anchor!.lat,
            lon: anchor!.lon,
            move: 'aucun' as StageMove,
            note: null,
          }));
        } else {
          if (dropped) notes.push(`${dropped} lieu(x) proposé(s) introuvable(s) sur la carte : étape gardée au lieu précédent.`);
          // Circuit sur route qui zigzague : séjours remis dans l'ordre le plus court
          // (arrivée et départ inchangés). Un trek ou un circuit à vélo suit son tracé.
          // Un seul moyen de transport (hors arrivée) : le déplacement reste
          // juste quel que soit l'ordre ; un vol ou un ferry, lui, est lié à
          // l'étape d'avant et ne se déplace pas.
          const legModes = new Set(stagePlaces.slice(1).map((st) => st.move).filter((m) => m !== 'aucun'));
          const oneMode = legModes.size <= 1 && !legModes.has('vol') && !legModes.has('bateau');
          if (oneMode && !legModes.has('marche') && !legModes.has('velo')) {
            const tidy = untangleStages(stagePlaces);
            if (tidy.reordered) {
              stagePlaces = tidy.stages;
              notes.push(`Étapes remises dans un ordre plus direct : environ ${tidy.savedKm} km de route en moins.`);
            }
          }
        }

        // Distances réelles entre deux soirs (à pied, à vélo ou sur la route), en parallèle.
        const legs = await mapLimit(stagePlaces, 4, async (st, i) => {
          const prevPlace = i > 0 ? stagePlaces[i - 1] : null;
          if (!prevPlace || distanceKm(prevPlace, st) < 0.3) return null;
          const mode = st.move === 'marche' ? 'pieton' : st.move === 'velo' ? 'velo' : 'voiture';
          if (st.move === 'vol' || st.move === 'bateau') return { km: Math.round(distanceKm(prevPlace, st)), ascent: null, measured: false };
          // Mesure partagée : le même tronçon n'est routé qu'une fois pour tout le monde.
          const leg = await cached(
            'leg',
            `${mode}:${coordKey(prevPlace.lat, prevPlace.lon)}>${coordKey(st.lat, st.lon)}`,
            30 * 86_400,
            async () => {
              const r = await routeAttempt([prevPlace, st], mode);
              const total = r.legs?.reduce((t, l) => t + l.distanceKm, 0);
              if (total == null) return null;
              const up = r.legs?.every((l) => l.ascentM != null)
                ? r.legs.reduce((t, l) => t + (l.ascentM ?? 0), 0)
                : null;
              return { km: total, ascent: up };
            }
          );
          const km = leg?.km;
          const ascent = leg?.ascent ?? null;
          if (km == null) return null;
          // Une journée à pied ou à vélo hors de portée : distance non retenue plutôt que fausse.
          if ((st.move === 'marche' && km > 45) || (st.move === 'velo' && km > 180)) return null;
          return { km: Math.round(km * 10) / 10, ascent: ascent != null ? Math.round(ascent) : null, measured: true };
        });
        if (stagePlaces.length) await dropReplaced();
        // Sortie courte sur un seul lieu : la boucle visée (durée × allure, ou distance dite), annoncée comme estimation.
        const loopKm =
          ctx.scope === 'sortie' && stagePlaces.length === 1
            ? expectedKm(ctx, { hours: compas.durationHours, days, targetKm: compas.preferences?.targetKm ?? null })
            : null;
        const rows = stagePlaces.map((st, i) => ({
          trip_id: tripId,
          day_number: st.day,
          order_index: 0,
          title: `Jour ${st.day} · ${st.name}`,
          description: loopKm
            ? [st.note, `Boucle d’environ ${String(loopKm).replace('.', ',')} km (estimation selon la durée et l’allure).`].filter(Boolean).join(' ')
            : st.note,
          transport_mode: STEP_TRANSPORT[st.move],
          source: 'compas',
          latitude: Math.round(st.lat * 1e5) / 1e5,
          longitude: Math.round(st.lon * 1e5) / 1e5,
          distance_km: legs[i]?.km ?? (loopKm && i === 0 ? loopKm : null),
          elevation_gain_m: legs[i]?.ascent ?? null,
        }));
        if (rows.length) await supabase.from('trip_steps').insert(rows);
      }
      steps = await loadSteps(supabase, tripId);
      createdStepIds.push(...steps.map((s) => s.id));
      stepsCreated = steps.length;
    }

    if (phase === 'steps') {
      const run: PendingRun = { runId, stepIds: createdStepIds, routeSet, notes: notes.slice(0, 6), datesSet, stagesFallback };
      const metadata = await patchTripMetadata(supabase, tripId, (m) => ({
        ...m,
        compas: { ...compasMeta(m), autofill_pending: run },
      }));
      await supabase.from('trips').update({ metadata, updated_at: new Date().toISOString() }).eq('id', tripId);
      return { success: true, pending: true, stepsCreated };
    }

    lap('3');
    /* 3. Altitude réelle des étapes : acclimatation et kit en dépendent. */
    const geoSteps = steps.filter((s) => s.latitude != null && s.longitude != null);
    const altitudes =
      geoSteps.length > 0
        ? await terrainElevations(geoSteps.map((s) => [s.longitude as number, s.latitude as number] as const))
        : null;
    const maxStepAltitude = altitudes ? Math.max(0, ...altitudes.filter((a): a is number => a != null)) || null : null;

    lap('4');
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
    // Contexte revu avec l'altitude mesurée (hiver en altitude : un toit).
    const nightCtx = resolveProjectContext({
      activity,
      days,
      hours: compas.durationHours,
      partySize: party,
      month: trip.start_date ? Number(trip.start_date.slice(5, 7)) : null,
      maxAltitudeM: maxAltitude,
      project: compas.preferences,
      profile,
    });
    for (const a of nightCtx.adaptations) notes.push(adaptationText(a));
    const plan = ctx.modules.nights
      ? planNights({
          nights: nightsCount,
          pref: nightsPrefFor(activity, nightCtx.nights.value),
          autonomy: nightCtx.autonomy.value as Autonomy,
          // Le profil a déjà parlé dans `nights` : la priorité ne rejoue que si rien n'est décidé.
          priority: nightCtx.nights.value ? null : (nightCtx.priority.value as Priority),
          maxAltitudeM: maxAltitude,
          refugeNear: refugesByNight.map((r) => r.length > 0),
          outdoorNights: nightCtx.outdoorNights.value,
        })
      : [];
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

    lap('5');
    /* 5. Venir : route mesurée si c'est raisonnable, sinon avion (chiffré par le spécialiste). */
    let transport: CompasAutofillSummary['transport'] = null;
    let carFuel: ReturnType<typeof estimateCarTrip> = null;
    const start = dayStep(1);
    const target = start?.latitude != null && start.longitude != null ? { lat: start.latitude, lon: start.longitude } : anchor;
    const origin = from ? await lookupReverse(from.lat, from.lon) : null;
    const abroad =
      anchor.countryCode != null && (origin?.countryCode ?? 'FR') !== anchor.countryCode;
    let flightNeeded = false;
    // Sortie de quelques heures : pas de trajet à chiffrer (on part de chez soi).
    if (!from && ctx.modules.transport)
      notes.push('Position non partagée : le trajet jusqu’au départ est chiffré depuis la France, à ajuster.');
    const mode = !ctx.modules.transport
      ? 'aucun'
      : from
        ? approachMode({ straightKm: distanceKm(from, target) })
        : abroad
          ? 'avion'
          : 'route';
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
      } else if (distanceKm(from, target) <= FLIGHT_THRESHOLD_KM) {
        // Itinéraire non calculé (panne, débit, tracé qui n'arrive pas pile au
        // lieu) mais destination à portée de route : trajet estimé (vol
        // d'oiseau × 1,3 à 80 km/h), jamais un vol à 450 km.
        const km = Math.round(distanceKm(from, target) * 1.3);
        carFuel = estimateCarTrip({ oneWayKm: km, oneWayMin: Math.round((km / 80) * 60), partySize: party });
        if (carFuel) {
          transport = { mode: 'voiture', km: carFuel.oneWayKm, minutes: carFuel.oneWayMin, walkKm: 0, fuelEur: carFuel.fuelEur, basis: carFuel.basis };
          notes.push('Trajet en voiture estimé (itinéraire routier non calculé) : à vérifier, traversée en ferry éventuelle non comptée.');
        }
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

    lap('6');
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
    const shortOuting = days <= 1 && plan.length === 0;
    const analysis = generateTripContextualKit({
      countryCode: anchor.countryCode ?? trip.destination_country_code,
      activity,
      durationDays: days,
      seasonMonth: month,
      latitude: anchor.lat,
      currentItems: tripItemNames.map((item_name) => ({ item_name }) as unknown as TripItem),
      ...(maxAltitude ? { elevationProfile: { maxM: maxAltitude } as never } : {}),
    });
    const needs: GearNeed[] = [];
    const nightTypes = plan.map((n) => n.type);
    const ruleNeeds = [...analysis.vitalGaps, ...analysis.recommendedGaps]
      .filter((g) => keepRuleForNights(g.category, nightTypes) && keepRuleForActivity(g.key, activity, shortOuting))
      .map(needFromRule);
    for (const g of [...gearForActivity(activity), ...gearForNights(nightTypes), ...ruleNeeds])
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

    lap('7');
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
      `Matériel à se procurer (absent de la boutique de l’application) : ${picks.filter((p) => p.source === 'a_trouver').map((p) => p.need.name).join(', ') || 'aucun'}.`,
    ]
      .filter(Boolean)
      .join('\n');
    // Budget de temps : l'appel rapide peut durer jusqu'à 30 s ; au-delà de
    // 25 s déjà passées (carte ou IA lentes), le chiffrage passe par les règles
    // plutôt que de risquer la limite de 60 s du serveur. Sans raisonnement :
    // avec, Nemotron 3.5 Lightning met ~50 s (mesure du 2026-10-05).
    const lateRun = remaining() < 12_000;
    const rawAdvice = lateRun
      ? null
      : await askJson(
          userId,
          buildCompasAutofillSystem(),
          buildCompasAutofillPrompt(facts),
          1200,
          false,
          0,
          Math.min(25_000, remaining() - 6_000)
        );
    if (lateRun) notes.push('Préparation longue : chiffrage par les règles du Compas, relance « Tout préparer » pour l’avis du spécialiste.');
    const advice: AutofillAiAdvice = sanitizeAdvice(rawAdvice);
    const usedAi = rawAdvice != null;
    notes.push(...advice.notes);

    lap('8');
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
    let lines = budgetLines([
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
      // Une sortie de quelques heures ne compte pas de repas.
      ctx.scope === 'sortie'
        ? null
        : { category: 'nourriture', title: `Repas · ${days} jour(s) × ${party}`, amount: meals.amount, source: 'estimation', basis: meals.basis },
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
    // Une ligne de budget retouchée lors d'une réadaptation reste ; on ne la double pas.
    const keptTitles = new Set(carry?.expenseTitles ?? []);
    if (keptTitles.size) lines = lines.filter((l) => !keptTitles.has(l.title.slice(0, 100)));
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

    lap('9');
    /* 9. Trace pour l'annulation et la réadaptation, puis budget cible si aucun n'était fixé. */
    const merged = (a: string[], b: string[] | undefined) => [...new Set([...a, ...(b ?? [])])];
    const metadata = await patchTripMetadata(supabase, tripId, (m) => ({
      ...m,
      compas: {
        ...withoutPending(compasMeta(m)),
        autofill: {
          runId,
          at: new Date().toISOString(),
          // Ce que ce préremplissage a écrit, plus ce qu'une réadaptation a gardé du précédent.
          stepIds: merged(createdStepIds, carry?.stepIds),
          routeSet: routeSet || (carry?.routeSet ?? false),
          itemIds: merged(createdItemIds, carry?.itemIds),
          expenseIds: merged(createdExpenseIds, carry?.expenseIds),
          stays: [...stays, ...(carry?.stays ?? []).filter((s) => !stays.some((x) => x.stepId === s.stepId))],
          budgetSet: setBudget,
          datesSet,
          notes: notes.slice(0, 6),
          // Réglages qui ont produit ce préremplissage : un changement dit quoi refaire.
          basis: tripBasis(trip, activity),
          ...(stagesFallback ? { stagesFallback } : {}),
        },
      },
    }));
    await supabase
      .from('trips')
      .update({ metadata, ...(setBudget ? { estimated_budget: total } : {}), updated_at: new Date().toISOString() })
      .eq('id', tripId);

    lap('fin');
    console.info('[compas] préremplissage', { phase, ms: Date.now() - startedAt, laps });
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
    const tripMeta = (auth.trip.metadata ?? {}) as Record<string, unknown>;
    const done = compasMeta(tripMeta).autofill as { runId?: string } | undefined;
    // Une préparation interrompue après l'itinéraire s'annule aussi.
    const run = (done?.runId ? done : readPending(tripMeta)) as
      | {
          runId?: string;
          stepIds?: string[];
          routeSet?: boolean;
          itemIds?: string[];
          expenseIds?: string[];
          stays?: Array<{ stepId: string; name: string }>;
          budgetSet?: boolean;
          datesSet?: boolean;
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
      const next: Record<string, unknown> = {
        ...m,
        compas: { ...withoutPending(compasMeta(m)), autofill: { undone: true } },
      };
      if (run.routeSet) delete next.route_id;
      return next;
    });
    await supabase
      .from('trips')
      .update({
        metadata,
        ...(run.budgetSet ? { estimated_budget: null } : {}),
        ...(run.datesSet ? { start_date: null, end_date: null } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);
    return { success: true };
  } catch (err) {
    console.error('[compas] compasUndoAutofillAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const refreshSchema = z.object({ tripId: z.string().uuid(), tripSlug: z.string().min(1).max(200) });

export type CompasRefreshResult =
  | { success: true; parts: AutofillPart[]; kept: string[]; label: string }
  | { success: false; error: string };

/**
 * Réadapte le préremplissage après un changement du projet (durée,
 * destination, activité, nuits, personnes…) : seules les parties qui en
 * dépendent sont refaites. Ce que le préremplissage avait écrit et que
 * personne n'a retouché depuis est retiré ; ce qui a été retouché est gardé
 * (c'est devenu un choix). Le préremplissage repasse ensuite normalement et
 * ne réécrit que ce qui manque.
 */
export async function compasRefreshAutofillAction(
  input: z.input<typeof refreshSchema>
): Promise<CompasRefreshResult> {
  const parsed = refreshSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  const { tripId } = parsed.data;
  try {
    const auth = await requireEditor(tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const { supabase, userId, trip } = auth;
    const limited = await enforceRateLimit(userId, {
      scope: 'compas-refresh',
      limit: 10,
      windowMs: 10 * 60_000,
      failMode: 'closed',
    });
    if (limited) return { success: false, error: 'Beaucoup de changements d’affilée : patiente quelques minutes.' };
    const meta = (trip.metadata ?? {}) as Record<string, unknown>;
    if (readPending(meta)) return { success: false, error: 'Une préparation est déjà en cours.' };
    const run = compasMeta(meta).autofill as
      | {
          runId?: string;
          at?: string;
          stepIds?: string[];
          routeSet?: boolean;
          itemIds?: string[];
          expenseIds?: string[];
          stays?: Array<{ stepId: string; name: string }>;
          budgetSet?: boolean;
          basis?: Partial<ProjectBasis>;
          stagesFallback?: number;
        }
      | undefined;
    if (!run?.runId || !run.basis) return { success: true, parts: [], kept: [], label: '' };
    const { data: tripRow } = await supabase.from('trips').select('primary_activity').eq('id', tripId).maybeSingle();
    const activity = (tripRow as { primary_activity?: string } | null)?.primary_activity ?? null;
    let parts = unionParts(staleParts(run.basis, tripBasis(trip, activity)), retryParts(run.stagesFallback));
    if (!parts.length) return { success: true, parts: [], kept: [], label: '' };

    const kept: string[] = [];
    const carry: Carry = {
      stepIds: [],
      routeSet: false,
      itemIds: [],
      expenseIds: [],
      expenseTitles: [],
      stays: [],
      stagesFallback: Number.isInteger(run.stagesFallback) ? Number(run.stagesFallback) : 0,
    };
    const at = run.at ?? null;
    const now = new Date().toISOString();

    /* Itinéraire : refait seulement si personne n'a touché aux étapes du préremplissage. */
    const stepIds = run.stepIds ?? [];
    if (parts.includes('steps') && stepIds.length) {
      const { data } = await supabase.from('trip_steps').select('id, updated_at').eq('trip_id', tripId).in('id', stepIds);
      const rows = (data ?? []) as Array<{ id: string; updated_at: string | null }>;
      if (rows.every((r) => untouchedSince(r.updated_at, at))) {
        // Remplacées seulement si le nouvel itinéraire est exploitable (sinon gardées).
        carry.replaceStepIds = rows.map((r) => r.id);
        carry.replaceRoute = run.routeSet === true;
      } else {
        // Étapes retouchées : l'itinéraire est à toi, on garde tout et on refait le reste.
        parts = parts.filter((p) => p !== 'steps');
        carry.stepIds = stepIds;
        carry.routeSet = run.routeSet === true;
        kept.push('itinéraire retouché, gardé');
      }
    } else {
      carry.stepIds = stepIds;
      carry.routeSet = run.routeSet === true;
    }

    /* Nuits : un hébergement posé par le préremplissage et resté tel quel est libéré. */
    let staysKept = 0;
    for (const s of run.stays ?? []) {
      if (!parts.includes('nights')) {
        carry.stays.push(s);
        continue;
      }
      const { data } = await supabase
        .from('trip_steps')
        .update({ accommodation_name: null, updated_at: now })
        .eq('id', s.stepId)
        .eq('accommodation_name', s.name)
        .select('id');
      if (!data?.length) staysKept += 1;
    }
    if (staysKept) kept.push(`${staysKept} nuit${staysKept > 1 ? 's' : ''} choisie${staysKept > 1 ? 's' : ''} par toi, gardée${staysKept > 1 ? 's' : ''}`);

    /* Sac : objets ajoutés par le préremplissage et jamais touchés (ni cochés, ni modifiés). */
    const itemIds = run.itemIds ?? [];
    if (parts.includes('kit') && itemIds.length) {
      const { data } = await supabase.from('trip_items').select('id, updated_at').eq('trip_id', tripId).in('id', itemIds);
      const rows = (data ?? []) as Array<{ id: string; updated_at: string | null }>;
      const drop = rows.filter((r) => untouchedSince(r.updated_at, at)).map((r) => r.id);
      carry.itemIds = rows.filter((r) => !drop.includes(r.id)).map((r) => r.id);
      if (drop.length) await supabase.from('trip_items').delete().eq('trip_id', tripId).in('id', drop);
      if (carry.itemIds.length)
        kept.push(`${carry.itemIds.length} objet${carry.itemIds.length > 1 ? 's' : ''} du sac déjà touché${carry.itemIds.length > 1 ? 's' : ''}, gardé${carry.itemIds.length > 1 ? 's' : ''}`);
    } else carry.itemIds = itemIds;

    /* Budget : lignes estimées par le préremplissage, sauf celles modifiées depuis. */
    const expenseIds = run.expenseIds ?? [];
    if (parts.includes('budget') && expenseIds.length) {
      const { data } = await supabase
        .from('trip_expenses')
        .select('id, title, updated_at')
        .eq('trip_id', tripId)
        .in('id', expenseIds);
      const rows = (data ?? []) as Array<{ id: string; title: string; updated_at: string | null }>;
      const drop = rows.filter((r) => untouchedSince(r.updated_at, at));
      const keep = rows.filter((r) => !drop.includes(r));
      carry.expenseIds = keep.map((r) => r.id);
      carry.expenseTitles = keep.map((r) => r.title);
      if (drop.length) await supabase.from('trip_expenses').delete().eq('trip_id', tripId).in('id', drop.map((r) => r.id));
      if (keep.length) kept.push(`${keep.length} ligne${keep.length > 1 ? 's' : ''} de budget modifiée${keep.length > 1 ? 's' : ''}, gardée${keep.length > 1 ? 's' : ''}`);
    } else carry.expenseIds = expenseIds;

    const metadata = await patchTripMetadata(supabase, tripId, (m) => {
      const c = { ...compasMeta(m) };
      delete c.autofill; // le préremplissage repasse
      const next: Record<string, unknown> = { ...m, compas: { ...c, autofill_carry: carry } };
      return next;
    });
    await supabase
      .from('trips')
      .update({
        metadata,
        // Une enveloppe posée par le préremplissage se recalcule avec le reste.
        ...(run.budgetSet && parts.includes('budget') ? { estimated_budget: null } : {}),
        updated_at: now,
      })
      .eq('id', tripId);
    return { success: true, parts, kept, label: `${partsText(parts)} réadapté${parts.length > 1 ? 's' : ''}` };
  } catch (err) {
    console.error('[compas] compasRefreshAutofillAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

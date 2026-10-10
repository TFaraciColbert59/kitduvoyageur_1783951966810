'use server';
import type { InventoryStatus } from '@/features/materiel/domain/inventory';

import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { reportServerError } from '@/lib/observability/appErrors';
import { aiEnabled, askAI } from '@/lib/ai/askAI';
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
  backtrackShare,
  contextualReason,
  wantsTraverse,
  longestStay,
  budgetLines,
  budgetTotal,
  gearForNights,
  gearForActivity,
  keepRuleForNights,
  keepRuleForActivity,
  keepRuleForBrief,
  nightsPrefFor,
  needFromRule,
  sameNeed,
  planNights,
  sanitizeAdvice,
  sanitizeStages,
  sourceGear,
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
import { anchorFromOrigin, originOf, shortHoursOf, tripLengthDays } from '../engine/tripContext';
import { compasMeta, readProfile, requireEditor, resplitSteps, tripBasis, tripPartySize, updateTripMetadata, type Supa } from './compasServer';
import { readTraveller } from './traveller';
import { adaptationText, expectedKm, pickCatalogRoute, resolveProjectContext } from '../engine/projectContext';
import { bestPeriod, monthName, needsDryNormals } from '../engine/period';
import { partsText, retryParts, staleParts, unionParts, untouchedSince, type AutofillPart, type ProjectBasis } from '../engine/dependencies';
import { lookupDestination, lookupMassif, lookupNatural, lookupReverse, lookupRiver, stageAliasCandidates, stageCandidates } from './placeLookup';
import { lookupAreaPlaces, lookupRiverLine, lookupStagePois } from './stagePoiLookup';
import { buildTrack, simplifyLine, trackKey, type LngLat } from '../engine/track';
import { descentWindow, planRiverDescent } from '../engine/river';
import { keepAiNote, travelPapers } from '../engine/papers';
import { tutoyer } from '../engine/voice';
import { abroadCosts, originFact, planTravelLeg, travelOrigin, type TravelTransport } from '../engine/travel';
import { nearestAirport } from './airports';
import { trailRegion } from '../engine/intent';
import {
  dayStartVillage,
  fromPlace,
  isGenericName,
  isMountainActivity,
  keepAdminArea,
  keepHighlands,
  keepHomeCountry,
  planItinerary,
  toPlace,
  planningZoneKm,
  profileFor,
  shapeFor,
  type ItineraryShape,
} from '../engine/itinerary';
import {
  COSTS_VERSION,
  carRentalPerDay,
  entryFees,
  flightRoundTrip,
  insurance,
  localTripPerLeg,
  lodgingPerNight,
  mealsTotal,
  priceLevel,
  refugePerNight,
} from '../engine/costs';
import { after } from 'next/server';
import { bareAdminName, destinationRadiusKm, distanceKm, isAdminName, maxLegKm, pickPlace, sleepPlaceFix, stageTitleFor, type CompasPlace } from '../engine/places';
import { unifyStageNames, untangleStages } from '../engine/stageOrder';
import { travellerToday } from '../engine/zone';
import { getPrecipNormals } from './weather';
import { aiSuggestion, essentialAdvice, orderNotes, repeatsRule } from '../engine/advice';
import { preparationEventKind, recordPreparationEvent } from './opsEvents';
import { coarsePosition } from '../engine/privacy';
import { routeAscentM } from './elevation';
import { estimatedLegKm, estimationNote, stepDistanceMetadata, type LegDistanceSource, type LegMove } from '../engine/legDistance';
import {
  CLAIM_MS,
  pendingIsStale,
  readPending,
  resumableRun,
  withoutClaim,
  withoutPending,
  withStepsWritten,
  type PendingRun,
} from './autofillState';

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
  transport: TravelTransport | null;
  /** Aucun point de départ (ni « depuis X », ni position) : trajet non chiffré, dit à l'écran. */
  originUnknown?: boolean;
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
  /**
   * `retryInS` : limite de fréquence atteinte, l'écran relance seul après ce délai.
   * `already` : le voyage est déjà prérempli (lancement en double, écran remonté).
   */
  | { success: false; error: string; retryInS?: number; already?: true };

const point = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
const schema = z.object({
  tripId: z.string().uuid(),
  tripSlug: z.string().min(1).max(200),
  /**
   * Position actuelle de l'appareil (départ du trajet) ; null si refusée.
   * Arrondie à 0,01° (~1 km, plan 2.10) dès l'entrée : aucun service tiers
   * (routage, géocodage) ne reçoit la position exacte de la personne.
   */
  from: point
    .nullable()
    .transform(coarsePosition),
  /**
   * Deux appels courts plutôt qu'un long : « steps » écrit l'itinéraire,
   * « rest » les nuits, le trajet, le kit et le budget. Chaque appel garde
   * un budget de 48 s (hérité de l'ancienne limite de 60 s ; la fonction du
   * Compas va aujourd'hui jusqu'à 300 s), même quand l'IA est lente.
   */
  phase: z.enum(['steps', 'rest', 'all']).default('all'),
  /**
   * Fuseau du navigateur (IANA) : « aujourd'hui » du voyageur (meilleure
   * période, date des dépenses prévues). Rien n'est gardé pour une reprise :
   * chaque relance vient de l'écran, avec son fuseau.
   */
  timeZone: z.string().max(64).optional(),
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
  /** Temps maximal accordé à cet appel (ms), pris sur le budget de la passe. */
  timeoutMs?: number
): Promise<unknown | null> {
  if (timeoutMs != null && timeoutMs < 4000) return null;
  try {
    const res = await askAI({
      ...(timeoutMs != null ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
      feature: 'compas-autofill',
      tier: think ? COMPAS_AUTOFILL_SPEC.tier : 'fast',
      // Le modèle rapide répond, mais une préparation coûte un appel lourd (plan 2.5).
      quotaTier: COMPAS_AUTOFILL_SPEC.tier,
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
  /** Emprise [ouest, nord, est, sud] quand la carte la donne. */
  extent?: [number, number, number, number] | null;
}

/** Au-delà de ce rayon (un pays), l'itinéraire déterministe ne sait pas encore choisir les lieux marquants. */
const PLANNED_MAX_KM = 150;
/** Natures de lieux habités : une ancre de ce type est déjà une base où dormir. */
const SETTLEMENT_KINDS = new Set(['city', 'town', 'village', 'hamlet', 'suburb', 'municipality', 'borough', 'quarter', 'neighbourhood']);
/** Entités administratives qui peuvent porter le nom d'un massif. */
const ADMIN_ANCHOR_KINDS = new Set(['county', 'state', 'region', 'province', 'district']);
/** Activités de plein air : une destination y est un massif, un parc, un fleuve plutôt qu'un quartier. */
const OUTDOOR_ACTIVITIES = new Set(['hiking', 'trekking', 'trail', 'running', 'climbing', 'mountaineering', 'ski', 'bivouac', 'bushcraft', 'cycling', 'water']);
/** Lieux lus « administratifs » ou « urbains » qu'un lieu naturel du même nom remplace. */
const REPLACEABLE_ANCHOR_KINDS = new Set(['county', 'state', 'region', 'province', 'district', 'suburb', 'quarter', 'neighbourhood', 'city_district', 'borough']);
/** Natures OSM d'un lieu naturel : on en fait le tour plutôt que le traverser. */
const NATURAL_KINDS = new Set(['water', 'lake', 'peak', 'island', 'islet', 'bay', 'mountain_range', 'volcano', 'glacier', 'river']);
const LOOP_WISH = /\btour d(?:u|e|es|['’])|\bautour\b|\bboucle\b/i;

/** Distance d'un tronçon entre deux soirs, avec sa source (plan 1.5) et, estimée, son annonce. */
interface StageLeg {
  km: number;
  ascent: number | null;
  source: LegDistanceSource | null;
  note?: string;
}

interface StagePlace {
  day: number;
  name: string;
  lat: number;
  lon: number;
  move: StageMove;
  note: string | null;
  /** Descente de rivière : km d'eau du jour et tracé de la rivière (pas de calcul de route). */
  riverKm?: number | null;
  geometry?: LngLat[] | null;
}

/**
 * Itinéraire déterministe : lieux RÉELS de la zone (OpenStreetMap) choisis par
 * calcul (distance du jour selon l'activité, forme, altitude). null quand la
 * zone est un pays entier ou que la carte ne répond pas : l'appelant se replie.
 */
async function plannedStages(opts: {
  anchor: Anchor;
  activity: string;
  days: number;
  scope: string;
  wishes: string[];
  nights: string | null;
  deadline: number;
  /** Notes du préremplissage : un repli y est dit (descente de rivière impossible). */
  notes?: string[];
}): Promise<{ stages: StagePlace[]; note: string } | { fallback: string } | null> {
  const { activity, days } = opts;
  let anchor = opts.anchor;
  // Descente de rivière (canoë, kayak) : le tracé de l'eau fixe les soirs, vers
  // l'aval (« 3 jours de canoë sur la Dordogne » donnait Sarlat → Périgueux →
  // Sarlat). Avant le plafond de taille : une grande rivière dépasse 150 km.
  if (activity === 'water' && anchor.kind === 'river' && anchor.extent && days >= 2) {
    const line = await lookupRiverLine(anchor.name, anchor.extent, opts.deadline).catch(() => null);
    const win = line ? descentWindow(line, days, anchor) : null;
    const near = win ? await lookupAreaPlaces({ center: win.center, radiusKm: win.radiusKm, activity }, opts.deadline).catch(() => null) : null;
    const river = line && near ? planRiverDescent({ line, places: near, days, center: anchor }) : null;
    if (river) {
      const end = river.stages[river.stages.length - 1];
      return {
        stages: river.stages.map((st) => ({ ...st, move: st.move as StageMove })),
        note: `Descente de rivière (${anchor.name}) : ${String(river.sectionKm).replace('.', ',')} km d’eau en ${days} jours, ${fromPlace(river.start.name)} ${toPlace(end.name)}, un soir au bord de l’eau.`,
      };
    }
    // Tracé ou rives introuvables : séjour sur l'eau depuis une base, comme avant,
    // et dit (sans journaux, la note en base est le seul diagnostic).
    opts.notes?.push(
      `Descente de rivière impossible (${
        !line ? `tracé de « ${anchor.name} » introuvable sur la carte` : !near ? 'aucun lieu trouvé le long du tronçon' : 'aucun village au bord de l’eau sur le tronçon'
      }) : séjour sur l’eau depuis une base.`
    );
  }
  // Road trip et van : une région entière se parcourt en voiture ; à pied ou à
  // vélo, au-delà d'un massif, il faut savoir où sont les grands itinéraires.
  const roadScale = activity === 'roadtrip' || activity === 'vanlife';
  // Échelle réelle du lieu : son emprise ; sans emprise, un pays reste un pays,
  // mais une « région » nommée (Vercors, Pyrénées catalanes) est un massif.
  const scaleKm = anchor.extent
    ? anchor.radiusKm
    : anchor.kind === 'country'
      ? 1000
      : Math.min(anchor.radiusKm, 60);
  if (scaleKm > (roadScale ? 260 : PLANNED_MAX_KM)) return null;
  const base: StagePlace[] = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    name: anchor.name,
    lat: anchor.lat,
    lon: anchor.lon,
    move: 'aucun' as StageMove,
    note: i === 0 && days > 1 ? 'Base du séjour.' : null,
  }));
  // Sortie ou journée : tout se passe au lieu dit. Un lieu naturel (massif,
  // parc) n'est pas un point de départ : le village le plus important à moins
  // de 15 km de son centre (« Massif du Luberon » → un vrai village).
  if (opts.scope === 'sortie' || days === 1) {
    if (anchor.kind !== 'other' && !NATURAL_KINDS.has(anchor.kind ?? '')) return { stages: base, note: '' };
    const near = await lookupAreaPlaces({ center: anchor, radiusKm: 15, activity }, opts.deadline).catch(() => null);
    const start = dayStartVillage(near ?? [], anchor);
    if (!start) return { stages: base, note: '' };
    return {
      stages: base.map((st) => ({ ...st, name: start.place.name, lat: start.place.lat, lon: start.place.lon })),
      note: start.note,
    };
  }
  // À pied, un département ou une région qui porte le nom d'un massif (Vosges,
  // Jura) : on randonne dans le massif, pas dans la plaine administrative.
  if (profileFor(activity).move === 'marche' && ADMIN_ANCHOR_KINDS.has(anchor.kind ?? '')) {
    const massif = await lookupMassif(anchor.name, anchor).catch(() => null);
    if (massif)
      anchor = {
        ...anchor,
        lat: massif.lat,
        lon: massif.lon,
        kind: 'other',
        extent: massif.extent,
        radiusKm: destinationRadiusKm(massif),
      };
  }
  const natural = anchor.kind === 'other' || NATURAL_KINDS.has(anchor.kind ?? '');
  const settlement = SETTLEMENT_KINDS.has(anchor.kind ?? '');
  const halfExtentKm = anchor.extent
    ? distanceKm({ lat: anchor.extent[1], lon: anchor.extent[0] }, { lat: anchor.extent[3], lon: anchor.extent[2] }) / 2
    : null;
  // Autour d'un lac, d'une île : la zone est le lieu et ses rives (le tour s'y
  // adapte), pas une journée de vélo dans toutes les directions.
  const zoneKm =
    natural && halfExtentKm != null && halfExtentKm < 20
      ? Math.max(10, Math.round(halfExtentKm + 8))
      : planningZoneKm({ activity, days, halfExtentKm, settlement });
  const shape: ItineraryShape | null = wantsTraverse(opts.wishes)
    ? 'traverse'
    : opts.wishes.some((w) => LOOP_WISH.test(w))
      ? 'loop'
      : null;
  // Séjour sur place autour d'une ville ou d'un village : ce lieu est la base.
  if (shapeFor({ activity, days, radiusKm: zoneKm, shape, natural }) === 'base' && settlement)
    return { stages: base, note: '' };
  const diag: string[] = [];
  const found = await lookupAreaPlaces({ center: anchor, radiusKm: zoneKm, activity }, opts.deadline, diag);
  if (!found)
    return {
      fallback: `lieux de la zone indisponibles (service de carte injoignable${diag.length ? ` : ${diag.join(', ')}` : ''})`,
    };
  let places = keepHomeCountry(found, anchor.countryCode);
  if (anchor.kind === 'state' || anchor.kind === 'region') places = keepAdminArea(places, anchor.name, 'region');
  else if (anchor.kind === 'county') places = keepAdminArea(places, anchor.name, 'county');
  // Altitudes réelles (tuiles de relief, quelques tuiles pour toute la zone) :
  // acclimatation au-dessus de 3 000 m, et à pied, le massif plutôt que la plaine.
  // Le ski aussi : une station, pas le village de la vallée (Jura : Crotenay, 600 m) ;
  // l'escalade et l'alpinisme : une base d'altitude (Dolomites : Canazei, pas Brugnàch).
  const foot = profileFor(activity).move === 'marche' || isMountainActivity(activity);
  // Beaucoup de lieux (les Alpes suisses entières) : relief lu plus large
  // (moins de tuiles) plutôt que pas de filtre (Genève, Lausanne, Montreux).
  if (foot && places.length <= 3000) {
    const zoom = places.length <= 400 ? 12 : 10;
    const eles = await terrainElevations(places.map((p) => [p.lon, p.lat] as const), zoom).catch(() => null);
    if (eles) places = places.map((p, i) => (p.eleM == null && eles[i] != null ? { ...p, eleM: eles[i] } : p));
    places = keepHighlands(places);
  }
  // Lieux dits par la personne, cherchés sur la carte dans la zone (quatre au plus).
  const waypoints: Array<{ name: string; lat: number; lon: number }> = [];
  for (const w of opts.wishes.slice(0, 4)) {
    // Budget de la recherche d'itinéraire : un lieu dit de plus ne passe pas la limite.
    if (Date.now() > opts.deadline - 5_000) break;
    if (LOOP_WISH.test(w) || wantsTraverse([w])) continue;
    const found = await stageCandidates(w, { countryCode: anchor.countryCode, country: anchor.country }, anchor).catch(() => []);
    const hit = pickPlace(
      found.filter((f) => f.settlement || f.landmark),
      { near: anchor, maxKm: zoneKm * 1.1 + 5, query: w, strict: true }
    );
    if (hit) waypoints.push({ name: stageTitleFor(w, hit.name), lat: hit.lat, lon: hit.lon });
  }
  const plan = planItinerary({
    days,
    activity,
    center: anchor,
    radiusKm: zoneKm,
    places,
    waypoints,
    // Une ville dite (« 4 jours à Amsterdam à vélo ») : on en part, et sans
    // forme demandée la boucle y revient.
    shape: shape ?? (settlement ? 'loop' : null),
    startAt: settlement ? { name: anchor.name, lat: anchor.lat, lon: anchor.lon } : null,
    natural,
    // Une région (Bretagne, Jura) : les étapes restent dans son emprise ; un
    // lac ou un sommet n'en a pas d'utile (on dort autour).
    extent: anchor.extent && (halfExtentKm ?? 0) >= 15 ? anchor.extent : null,
    nights: opts.nights,
  });
  if (!plan) return { fallback: `trop peu de lieux où dormir dans la zone (${places.length} trouvés)` };
  // Itinérant figé sur un ou deux lieux : la carte n'en offre pas assez, on se replie.
  const minPlaces = ITINERANT_ACTIVITIES.has(activity) ? (days >= 4 ? 3 : 2) : 1;
  if (plan.distinct < minPlaces)
    return { fallback: `${plan.distinct} lieu(x) où dormir seulement à distance d’étape (${places.length} lieux dans la zone)` };
  const shapeText = plan.shape === 'traverse' ? 'en traversée' : plan.shape === 'loop' ? 'en boucle' : 'depuis une base';
  return {
    stages: plan.stages.map((st) => ({ day: st.day, name: st.name, lat: st.lat, lon: st.lon, move: st.move, note: st.note })),
    note: `Itinéraire ${shapeText} construit sur des lieux réels de la carte (${plan.distinct} lieu${plan.distinct > 1 ? 'x' : ''} où dormir)${waypoints.length ? `, en passant par ${waypoints.map((w) => w.name).join(', ')}` : ''}.`,
  };
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



/**
 * Prise d'une phase (« steps » ou « rest ») de façon atomique : l'écriture ne
 * passe que si le voyage n'a pas changé depuis la lecture (`updated_at`).
 * Deux onglets ou un F5 : un seul gagne, l'autre attend le résultat. Une prise
 * plus vieille que `CLAIM_MS` est morte (la fonction s'arrête à 300 s).
 */
async function claimPhase(supabase: Supa, tripId: string, phase: 'steps' | 'rest'): Promise<boolean> {
  const { data: row } = await supabase.from('trips').select('metadata, updated_at').eq('id', tripId).maybeSingle();
  if (!row) return false;
  const meta = ((row as { metadata: unknown }).metadata ?? {}) as Record<string, unknown>;
  const c = compasMeta(meta);
  const claims = (c.autofill_claim ?? {}) as Record<string, number>;
  // Une préparation dure au plus ~280 s : la prise reste valable ce temps-là.
  if (Date.now() - Number(claims[phase] ?? 0) < CLAIM_MS) return false;
  const metadata = { ...meta, compas: { ...c, autofill_claim: { ...claims, [phase]: Date.now() } } };
  const { data: won } = await supabase
    .from('trips')
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq('id', tripId)
    .eq('updated_at', (row as { updated_at: string }).updated_at)
    .select('id');
  return Boolean(won?.length);
}

/**
 * Limites d'une préparation (audit du 8 octobre), partagées par toutes les
 * instances (`src/lib/rate-limit`, compteur en base) :
 * - par personne : 6 lancements et 12 reprises par 10 min ;
 * - pour tout le site : 120 lancements et 240 reprises par heure. Les services
 *   gratuits (géocodage, routage, IA) ont des quotas par application, pas par
 *   personne : au-delà, chacun attendrait de toute façon un service qui refuse.
 *   Une reprise a son propre plafond : son état vit dans `trips.metadata`, une
 *   reprise forgée n'a donc jamais été comptée au lancement.
 */
const COMPAS_AUTOFILL_LIMITS = {
  start: { scope: 'compas-autofill', limit: 6, windowMs: 10 * 60_000 },
  resume: { scope: 'compas-autofill-resume', limit: 12, windowMs: 10 * 60_000 },
  startSite: { scope: 'compas-autofill-global', limit: 120, windowMs: 60 * 60_000 },
  resumeSite: { scope: 'compas-autofill-resume-global', limit: 240, windowMs: 60 * 60_000 },
} as const;

async function enforceCompasAutofillLimits(
  userId: string,
  resuming: boolean
): Promise<Extract<CompasAutofillResult, { success: false }> | null> {
  const personal = resuming ? COMPAS_AUTOFILL_LIMITS.resume : COMPAS_AUTOFILL_LIMITS.start;
  const siteWide = resuming ? COMPAS_AUTOFILL_LIMITS.resumeSite : COMPAS_AUTOFILL_LIMITS.startSite;
  const mine = await enforceRateLimit(userId, { ...personal, failMode: 'closed' });
  const site = mine ? null : await enforceRateLimit('site', { ...siteWide, failMode: 'closed' });
  const limited = mine ?? site;
  if (!limited) return null;
  const wait = Number(limited.headers.get('Retry-After'));
  const retryInS = limited.status === 429 && Number.isFinite(wait) && wait > 0 ? Math.min(wait, 900) : undefined;
  const minutes = retryInS ? Math.max(1, Math.ceil(retryInS / 60)) : null;
  if (limited.status !== 429) return { success: false, error: 'Préparation momentanément indisponible : réessaie dans quelques minutes.' };
  return {
    success: false,
    error: site
      ? `Le Compas prépare beaucoup de voyages en ce moment : je reprends seul dans ${minutes ?? 15} min.`
      : `Beaucoup de préparations d’affilée : je reprends seul dans ${minutes ?? 10} min.`,
    retryInS,
  };
}

/** Issue d'une préparation lancée en arrière-plan, relue par l'écran. */
export type CompasAutofillOutcome = CompasAutofillResult & { token: string; at: number };

/**
 * Lance la préparation et rend la main tout de suite : le travail (jusqu'à
 * 300 s) continue après la réponse (`after`), son issue est écrite sur le
 * voyage (`metadata.compas.autofill_result`, avec le jeton rendu ici). Aucune
 * requête n'est tenue ouverte : un réseau mobile qui coupe une longue requête
 * muette ne fait plus échouer une préparation que le serveur réussit.
 */
export async function compasAutofillStartAction(
  input: z.input<typeof schema>
): Promise<{ success: true; token: string; at: number } | { success: false; error: string; retryInS?: number }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  const { tripId } = parsed.data;
  try {
    const auth = await requireEditor(tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const token = randomUUID();
    after(async () => {
      const res: CompasAutofillResult = await compasAutofillAction(parsed.data).catch((err) => {
        console.error('[compas] préparation', err instanceof Error ? err.message : err);
        return { success: false as const, error: 'Erreur serveur' };
      });
      // Place prise par une autre préparation du même voyage : son issue fera foi.
      if (res.success && 'pending' in res && res.stepsCreated === 0) return;
      await recordPreparationEvent(preparationEventKind(res));
      const outcome: CompasAutofillOutcome = { ...res, token, at: Date.now() };
      try {
        const { supabase } = auth;
        const { error: writeError } = await updateTripMetadata(supabase, tripId, (m) => {
          // Lancement en double juste après une préparation réussie (écran
          // remonté, Ardennes du 8 oct.) : « déjà prérempli » écrasait l'issue
          // réussie et les deux écrans attendaient sans fin. L'issue réussie
          // vaut pour les deux : même résumé, sous ce jeton, à son heure.
          const prevOutcome = compasMeta(m).autofill_result as CompasAutofillOutcome | undefined;
          const kept =
            !res.success && 'already' in res && res.already && prevOutcome?.success && 'summary' in prevOutcome
              ? { ...prevOutcome, token }
              : outcome;
          return { ...m, compas: { ...compasMeta(m), autofill_result: kept } };
        });
        if (writeError) console.error('[compas] issue de la préparation non écrite', writeError.code, writeError.message);
      } catch (err) {
        console.error('[compas] issue de la préparation non écrite', err instanceof Error ? err.message : err);
      }
    });
    // Heure du serveur : l'écran la rend telle quelle (jamais son horloge à lui).
    return { success: true, token, at: Date.now() };
  } catch (err) {
    console.error('[compas] lancement de la préparation', err instanceof Error ? err.message : err);
    return { success: false, error: 'Erreur serveur' };
  }
}

const outcomeSchema = z.object({
  tripId: z.string().uuid(),
  token: z.string().uuid(),
  /** Heure (ms, serveur) du lancement : une préparation réussie depuis vaut aussi. */
  since: z.number().int().nonnegative().optional(),
});

/** Issue d'une préparation lancée par `compasAutofillStartAction` ; null tant qu'elle tourne. */
/** Ce que l'écran relit pendant une préparation. */
export interface CompasAutofillPoll {
  outcome: CompasAutofillOutcome | null;
  /**
   * Repère du voyage (`updated_at` et nombre d'étapes) : l'écran ne relit la
   * page entière que s'il a changé (plan 2.8), au lieu d'un rendu complet
   * toutes les 4 s.
   */
  stamp: string | null;
}

export async function compasAutofillOutcomeAction(
  input: z.input<typeof outcomeSchema>
): Promise<CompasAutofillPoll> {
  const none: CompasAutofillPoll = { outcome: null, stamp: null };
  const parsed = outcomeSchema.safeParse(input);
  if (!parsed.success) return none;
  const auth = await requireEditor(parsed.data.tripId).catch(() => null);
  if (!auth || 'error' in auth) return none;
  const [{ data }, { count }] = await Promise.all([
    auth.supabase.from('trips').select('metadata, updated_at').eq('id', parsed.data.tripId).maybeSingle(),
    auth.supabase.from('trip_steps').select('id', { count: 'exact', head: true }).eq('trip_id', parsed.data.tripId),
  ]);
  const row = data as { metadata?: unknown; updated_at?: string | null } | null;
  const stamp = row?.updated_at ? `${row.updated_at}|${count ?? 0}` : null;
  const r = compasMeta((row?.metadata ?? {}) as Record<string, unknown>).autofill_result as CompasAutofillOutcome | undefined;
  if (!r) return { outcome: null, stamp };
  if (r.token === parsed.data.token) return { outcome: r, stamp };
  // Deux préparations lancées ensemble (écran remonté) : celle qui a trouvé la
  // place prise n'écrit rien ; celle qui a réussi depuis notre lancement vaut.
  const since = parsed.data.since;
  const theirs = since != null && r.success && 'summary' in r && r.at >= since - 5_000;
  return { outcome: theirs ? r : null, stamp };
}

const stopSchema = z.object({ tripId: z.string().uuid() });

/**
 * « Arrêter » : la préparation lancée en arrière-plan relit ce signal avant
 * chaque écriture et saute celles qui restent (sans lui, elle continuait
 * d'écrire étapes, kit et budget pendant que l'écran disait « arrêtée »).
 */
export async function compasAutofillStopAction(input: z.input<typeof stopSchema>): Promise<{ success: boolean }> {
  const parsed = stopSchema.safeParse(input);
  if (!parsed.success) return { success: false };
  const auth = await requireEditor(parsed.data.tripId).catch(() => null);
  if (!auth || 'error' in auth) return { success: false };
  const { error } = await updateTripMetadata(auth.supabase, parsed.data.tripId, (m) => ({
    ...m,
    compas: { ...compasMeta(m), autofill_stop: Date.now() },
  }));
  return { success: !error };
}

export async function compasAutofillAction(
  input: z.input<typeof schema>
): Promise<CompasAutofillResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Requête invalide' };
  const { tripId, from, phase, timeZone } = parsed.data;
  try {
    const auth = await requireEditor(tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? 'Accès refusé' };
    const { supabase, userId, trip } = auth;
    const meta = (trip.metadata ?? {}) as Record<string, unknown>;
    const compas = readCompasMeta(meta);
    // Une seule règle pour les jours (dates, sinon durée retenue) : tripContext.
    const days = tripLengthDays(trip.start_date, trip.end_date, compasMeta(meta).planned_days);
    if (!days) return { success: false, error: 'Dis-moi combien de jours, ou choisis les dates.' };
    const nightsCount = Math.max(0, days - 1);
    const party = await tripPartySize(supabase, trip);
    const prev = compasMeta(meta).autofill as { runId?: string; stopped?: boolean } | undefined;
    // Un second appel « rest » (onglet rouvert, double déclenchement) arrive après la fin : rien à dire.
    if (prev?.runId && phase === 'rest') return { success: true, pending: true, stepsCreated: 0 };
    if (prev?.runId)
      return prev.stopped
        ? { success: false, error: 'Préparation arrêtée en cours de route : « Annuler » retire ce qui est fait, puis relance.' }
        : { success: false, error: 'Le voyage est déjà prérempli : annule d’abord pour relancer.', already: true };
    const pending = readPending(meta);
    const carry = readCarry(meta);
    // Une phase « steps » relancée alors qu'un itinéraire attend déjà : on le garde.
    if (phase === 'steps' && pending) return { success: true, pending: true, stepsCreated: pending.stepIds.length };
    // Itinéraire déjà écrit : la phase « reste », ou une passe unique relancée
    // après une coupure, le reprend (plan 2.6) au lieu d'en écrire un second.
    const resume = resumableRun(phase, pending);
    // La limite de fréquence ne compte qu'une préparation réellement lancée :
    // après les refus et retours ci-dessus (déjà prérempli, déjà en attente…).
    // Une reprise (un itinéraire déjà écrit attend le reste) a sa propre limite :
    // l'état de reprise vit dans `trips.metadata`, que l'éditeur peut écrire ;
    // sans limite, réécrire cet état relançait la préparation sans compter.
    // C'est l'itinéraire en attente qui fait la reprise, jamais la phase envoyée
    // par le navigateur : sans attente, une phase « rest » écrit tout un
    // itinéraire et compte comme un lancement (6 par 10 min, 120 par heure).
    const resuming = Boolean(pending);
    const limited = await enforceCompasAutofillLimits(userId, resuming);
    if (limited) return limited;

    // Un seul « steps » à la fois (deux onglets, F5) : prise atomique, sinon
    // deux itinéraires complets seraient écrits. Toute préparation sans
    // itinéraire en attente en écrit un, quelle que soit la phase demandée.
    if (!pending && !(await claimPhase(supabase, tripId, 'steps')))
      return { success: true, pending: true, stepsCreated: 0 };
    // Un seul « rest » à la fois : deux onglets, ou l'écran remonté pendant la
    // préparation, n'écrivent jamais deux fois les objets et les dépenses.
    if (resume && !(await claimPhase(supabase, tripId, 'rest')))
      return { success: true, pending: true, stepsCreated: 0 };
    const notes: string[] = [...(resume?.notes ?? [])];
    const runId = resume?.runId ?? randomUUID();
    const startedAt = Date.now();
    // « Arrêter » demandé après ce lancement : les écritures qui restent sont sautées.
    let halted = false;
    const stopAsked = async (): Promise<boolean> => {
      if (halted) return true;
      const { data } = await supabase.from('trips').select('metadata').eq('id', tripId).maybeSingle();
      halted = Number(compasMeta(((data as { metadata?: unknown } | null)?.metadata ?? {}) as Record<string, unknown>).autofill_stop ?? 0) >= startedAt;
      return halted;
    };
    // Durée de chaque étape (journal serveur) : la fonction s'arrête à 300 s.
    const laps: Record<string, number> = {};
    let lapAt = startedAt;
    // Ce qu'il reste du budget : 48 s par phase (« steps », « rest »), 270 s
    // pour une passe entière ; la fonction s'arrête à 300 s.
    const remaining = () => (phase === 'all' ? 270_000 : 48_000) - (Date.now() - startedAt);
    const lap = (name: string) => {
      const now = Date.now();
      laps[name] = now - lapAt;
      lapAt = now;
    };

    // Profil voyageur (PLAN-100 4.1) : la ligne de la personne qui lance, par la RLS ;
    // un essai sans compte n'en a pas (tout inconnu, sans requête).
    const [{ data: tripRow }, profile, traveller] = await Promise.all([
      supabase.from('trips').select('primary_activity, estimated_budget').eq('id', tripId).maybeSingle(),
      readProfile(supabase, userId),
      readTraveller(supabase, auth.anonymous ? null : userId),
    ]);
    // « Aujourd'hui » : le fuseau du navigateur (lot M) ; celui du profil seulement
    // quand le navigateur n'en envoie aucun de valable ; Paris en dernier.
    const today = travellerToday(timeZone, new Date(), traveller.timeZone);
    const activity = String((tripRow as { primary_activity?: string } | null)?.primary_activity ?? 'hiking');
    // Contexte projet : la phrase et les réglages du projet priment, le profil
    // n'est qu'un point de départ (adapté s'il ne tient pas pour CE projet).
    const ctx = resolveProjectContext({
      activity,
      days,
      hours: shortHoursOf(days, compas.durationHours),
      partySize: party,
      month: trip.start_date ? Number(trip.start_date.slice(5, 7)) : null,
      // Le lieu n'est retrouvé qu'ensuite : la destination déjà gardée sur le voyage, si elle existe.
      lat: readAnchor(meta)?.lat ?? null,
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
      const place = await lookupDestination(trailRegion(trip.destination_name) ?? trip.destination_name);
      if (place) anchor = { ...place, radiusKm: destinationRadiusKm(place) };
    }
    // Plein air, destination lue comme un quartier ou un département
    // (« Chartreuse » : un quartier de Toulouse ; « Loire » : le département de
    // Saint-Étienne pour un voyage à vélo le long du fleuve) : le lieu naturel
    // du même nom dans le pays (massif, parc, fleuve). Gardé sur le voyage :
    // carte, météo et trajet s'en servent aussi.
    // Sur l'eau, la rivière du même nom prime aussi sur un autre lieu naturel
    // (« kayak sur le Tarn » : un bois de 4 km près de Saint-Sulpice-la-Pointe,
    // pris pour la destination, 8 oct.).
    const replaceable = REPLACEABLE_ANCHOR_KINDS.has(anchor?.kind ?? '');
    const seekRiver =
      activity === 'water' && anchor != null && anchor.kind !== 'river' && !replaceable && !SETTLEMENT_KINDS.has(anchor.kind ?? '');
    if (anchor && OUTDOOR_ACTIVITIES.has(activity) && (replaceable || seekRiver)) {
      const isRiver = (p: CompasPlace | null) => /^waterway=/.test(p?.osmTag ?? '');
      const found = await lookupNatural(anchor.name, anchor.countryCode, activity === 'cycling' || activity === 'water').catch(() => null);
      let nat = found && (replaceable || isRiver(found)) ? found : null;
      // Sur l'eau, la rivière cherchée aussi sous son article (« Le Tarn »).
      if (activity === 'water' && !isRiver(nat)) nat = (await lookupRiver(anchor.name, anchor.countryCode)) ?? nat;
      if (nat) {
        // Une rivière le reste (« river ») : la descente en canoë suit son tracé.
        const kind = /^waterway=/.test(nat.osmTag ?? '') ? 'river' : 'other';
        anchor = { ...anchor, lat: nat.lat, lon: nat.lon, kind, extent: nat.extent, radiusKm: destinationRadiusKm(nat) };
        const fixed = anchor;
        await updateTripMetadata(supabase, tripId, (m) => ({
          ...m,
          compas: {
            ...compasMeta(m),
            anchor: {
              name: fixed.name,
              lat: Math.round(fixed.lat * 1e5) / 1e5,
              lon: Math.round(fixed.lon * 1e5) / 1e5,
              countryCode: fixed.countryCode,
              country: fixed.country,
              kind: fixed.kind,
              extent: fixed.extent,
            },
          },
        }));
        if (nat.name !== anchor.name)
          notes.push(`« ${nat.name} » retenu pour ${anchor.name} (lieu naturel, adapté à l’activité).`);
      }
    }
    // Aucun lieu dit mais un départ dit (« rando 3 jours depuis Lyon ») : la personne a
    // nommé un endroit, l'aventure est préparée autour de lui, avant toute position.
    const saidOrigin = originOf(compasMeta(meta).origin);
    if (!anchor && saidOrigin) {
      const around = anchorFromOrigin(saidOrigin, ctx.scope);
      anchor = around.anchor;
      if (around.note) notes.push(around.note);
    }
    // Aucun lieu dit : on part de la position partagée (une sortie autour de
    // soi, ou un voyage « près de chez toi »), et on le dit.
    if (!anchor && from) {
      const here = await lookupReverse(from.lat, from.lon);
      anchor = {
        name: here?.locality ?? here?.name ?? 'Autour de toi',
        lat: from.lat,
        lon: from.lon,
        countryCode: here?.countryCode ?? null,
        country: here?.country ?? null,
        radiusKm: ctx.scope === 'sortie' ? 15 : 60,
        kind: 'town',
      };
      if (ctx.scope !== 'sortie')
        notes.push(`Lieu non précisé : préparé près de chez toi (${anchor.name}). Change-le dans « Où » si tu pensais à un autre endroit.`);
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
      // Tropiques hors de la table des saisons sèches : le mois le plus sec des
      // normales NASA POWER (une demande par préparation, gardée 30 jours).
      // Service injoignable : aucune période, comme avant.
      const normals = needsDryNormals({ activity, lat: anchor.lat, countryCode: anchor.countryCode })
        ? await getPrecipNormals(anchor.lat, anchor.lon)
        : null;
      const period = bestPeriod({
        activity,
        lat: anchor.lat,
        countryCode: anchor.countryCode,
        today,
        days,
        normals,
      });
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
    let stagePlaces: StagePlace[] = [];
    // Réadaptation : l'ancien itinéraire n'est remplacé que par un meilleur.
    const replacing = !resume ? (carry?.replaceStepIds ?? []) : [];
    const dropReplaced = async () => {
      if (!replacing.length) return;
      await supabase.from('trip_steps').delete().eq('trip_id', tripId).in('id', replacing);
      if (carry?.replaceRoute) {
        await updateTripMetadata(supabase, tripId, (m) => {
          const next = { ...m };
          delete next.route_id;
          return next;
        });
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
          const { error } = await updateTripMetadata(supabase, tripId, (m) => ({ ...m, route_id: Number(best.route_id) }));
          if (!error) {
            await resplitSteps(supabase, tripId, Number(best.route_id), days);
            routeSet = true;
            notes.push(`Parcours du catalogue le plus proche choisi : ${best.name ?? `n° ${best.route_id}`}.`);
          }
        }
      }
      // Itinéraire déterministe d'abord : lieux réels de la zone, choisis par calcul.
      // L'IA n'est consultée que si la zone est un pays entier ou que la carte ne répond pas.
      const planned = routeSet
        ? null
        : await plannedStages({
            anchor,
            activity,
            days,
            scope: ctx.scope,
            wishes: compas.preferences?.wishes ?? [],
            nights: ctx.nights.value ?? null,
            // Passe unique (270 s) : l'itinéraire a le temps d'essayer toutes les
            // cartes (Photon, Overpass, Geoapify) même après une compréhension lente.
            deadline: startedAt + (phase === 'all' ? 120_000 : 30_000),
            notes,
          }).catch((err) => {
            // Le message interne reste dans le journal, jamais dans les notes (plan 2.9).
            console.error('[compas] itinéraire calculé', err instanceof Error ? err.message : err);
            return { fallback: 'erreur de calcul' };
          });
      const plannedOk = planned && 'stages' in planned ? planned : null;
      if (plannedOk) {
        stagePlaces = plannedOk.stages;
        if (plannedOk.note) notes.push(plannedOk.note);
      } else if (planned && 'fallback' in planned) {
        console.warn('[compas] itinéraire calculé : repli', planned.fallback);
        notes.push(`Itinéraire calculé impossible : ${planned.fallback}. Itinéraire proposé par le spécialiste, chaque lieu vérifié sur la carte.`);
      }
      if (!routeSet && !plannedOk) {
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
        // Itinérant : 3 lieux au moins sur 4 jours, 2 sur 2 jours (un week-end
        // à vélo autour du lac ne reste pas deux jours à Annecy).
        const minPlaces = ITINERANT_ACTIVITIES.has(activity) ? (days >= 4 ? 3 : days >= 2 ? 2 : 1) : 1;
        // Une semaine dans tout un pays (Costa Rica : San José puis six jours
        // à Arenal) : deux bases au moins, quatre jours au plus au même endroit.
        const wideStay = (anchor.kind === 'country' || anchor.radiusKm >= 300) && days >= 5;
        const usable = (st: ReturnType<typeof sanitizeStages>) =>
          st.length > 0 &&
          new Set(st.map((x) => x.place)).size >= Math.max(minPlaces, wideStay ? 2 : 1) &&
          // Un trek de 15 jours figé 8 jours au même refuge n'est pas un itinéraire.
          (minPlaces > 1 ? longestStay(st.map((x) => x.place)) <= 3 : !wideStay || longestStay(st.map((x) => x.place)) <= 4);
        const stagesKey = createHash('sha256').update(`${buildCompasStagesSystem()}\n${stagesPrompt}`).digest('hex');
        // Une reprise (itinéraire précédent jugé mauvais) ne relit pas le partagé :
        // elle redemande au spécialiste.
        let proposed: ReturnType<typeof sanitizeStages> =
          (carry?.stagesFallback ?? 0) > 0
            ? []
            : ((await readShared<ReturnType<typeof sanitizeStages>>('stages', stagesKey)) ?? []);
        if (!usable(proposed)) proposed = [];
        /** Proposition neuve du spécialiste : partagée seulement une fois vérifiée sur la carte. */
        let freshStages = false;
        for (let attempt = 0; attempt < 3 && !usable(proposed); attempt += 1) {
          if (attempt && Date.now() - startedAt > (phase === 'all' ? 120_000 : 20_000)) break;
          // La suite (carte, distances) a besoin d'environ 15 s : l'IA n'a que le reste.
          const next = sanitizeStages(
            await askJson(userId, buildCompasStagesSystem(), stagesPrompt, 2000, false, 0, Math.min(phase === 'all' ? 45_000 : 30_000, remaining() - 15_000)),
            days
          );
          if (usable(next)) {
            proposed = next;
            freshStages = true;
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
        let aliasLookups = 0;
        let townLookups = 0;
        // Recherches de secours (pays voisin, autres noms, commune) : seulement
        // s'il reste de quoi finir la préparation après (plan 2.6).
        const searchLeft = () => remaining() > (phase === 'all' ? 90_000 : 15_000);
        let dropped = 0;
        /** Étape posée sur un lieu trouvé (sinon : centre de la destination). */
        const located: boolean[] = [];
        for (const p of proposed) {
          const candidates = byName.get(p.place) ?? [];
          // Lieu nouveau mais déplacement « aucun » ou absent (l'IA l'omet
          // souvent) : le moyen de l'activité, jamais 25 km. « Van 2 semaines au
          // Portugal » perdait ainsi Sintra, Cascais, Porto… (13 étapes sur 14).
          const changesPlace = lastProposed != null && p.place !== lastProposed;
          const pMove: StageMove = p.move === 'aucun' && changesPlace ? (profileFor(activity).move as StageMove) : p.move;
          let move = pMove;
          const walkLike = pMove === 'marche' || pMove === 'velo' || pMove === 'aucun';
          // Sortie de quelques heures : tout reste autour du départ (jamais la grande ville voisine).
          const legKm =
            ctx.scope === 'sortie'
              ? anchor.radiusKm
              : maxLegKm(pMove, last == null, anchor.radiusKm, anchor.kind === 'country' && !!anchor.countryCode);
          // Destination à cheval sur une frontière (Patagonie, Alpes, Pyrénées) :
          // le lieu est cherché aussi chez le voisin, toujours à distance
          // plausible de l'étape d'avant (jamais un homonyme lointain).
          let across: CompasPlace[] | null = null;
          const acrossCandidates = async () =>
            (across ??= anchor!.countryCode && searchLeft()
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
            // Transfert en véhicule (jusqu'à 250 km) : seulement de la ville
            // d'arrivée au départ du trek (jour 2), jamais au milieu (Argentière →
            // Castellania Coppi, dans le Piémont, au jour 5 d'une traversée).
            if (a.transfer && !(last && walkLike && located.filter(Boolean).length <= 1)) continue;
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
          // Introuvable sous ce nom : ses autres noms (anglais, ancien, alternatif),
          // trois recherches au plus par préparation (Nominatim, 1 par seconde).
          if (!hit && lastProposed !== p.place && aliasLookups < 3 && searchLeft()) {
            aliasLookups += 1;
            const aliases = await stageAliasCandidates(p.place, anchor.countryCode);
            hit = pickPlace(aliases, {
              near: last ?? anchor,
              maxKm: last && walkLike && located.filter(Boolean).length <= 1 ? TRANSFER_MAX_KM : legKm,
            });
          }
          // Le titre garde le nom proposé (lisible) ; la position vient de la carte.
          if (hit) {
            let name = stageTitleFor(p.place, hit.name);
            let at = { lat: hit.lat, lon: hit.lon };
            // On dort dans une commune, pas dans un musée ni une province.
            const fix = sleepPlaceFix(hit);
            if (fix && 'locality' in fix) name = fix.locality;
            else if (fix && townLookups < 4 && searchLeft()) {
              townLookups += 1;
              const towns = await stageCandidates(fix.search, { countryCode: anchor.countryCode, country: anchor.country }, hit);
              // La circonscription elle-même revenait comme « ville » (« West Clare
              // Municipal District », trois nuits en Irlande, 8 oct.) : écartée.
              const town = pickPlace(
                towns.filter((t) => t.settlement && !isAdminName(t.name)),
                { near: hit, maxKm: 80, query: fix.search, strict: false }
              );
              // Sinon le bourg réel le plus proche du site (Cliffs of Moher → un village voisin).
              const around = town
                ? null
                : await lookupAreaPlaces({ center: hit, radiusKm: 15, activity }, Date.now() + Math.min(8_000, Math.max(0, remaining() - 20_000))).catch(() => null);
              const village = around ? dayStartVillage(around.filter((v) => !isGenericName(v.name) && !isAdminName(v.name)), hit, 15) : null;
              if (town) {
                name = town.name;
                at = { lat: town.lat, lon: town.lon };
              } else if (village) {
                name = village.place.name;
                at = { lat: village.place.lat, lon: village.place.lon };
              } else name = fix.search;
            }
            // Filet : jamais une circonscription comme nom d'étape.
            if (isAdminName(name)) name = bareAdminName(name) || name;
            last = { name, ...at };
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
          located.push(last != null);
          stagePlaces.push({ day: p.day, name: at.name, lat: at.lat, lon: at.lon, move: hit ? move : 'aucun', note: p.note });
        }
        // Premières étapes introuvables : elles partent de la première étape
        // trouvée, jamais du centre de la destination (« États-Unis », au Kansas).
        const firstFound = located.indexOf(true);
        if (firstFound > 0) {
          const f = stagePlaces[firstFound];
          for (let i = 0; i < firstFound; i += 1)
            stagePlaces[i] = { ...stagePlaces[i], name: f.name, lat: f.lat, lon: f.lon };
        }
        // « Malaga » puis « Málaga » : un même lieu, un seul nom.
        stagePlaces = unifyStageNames(stagePlaces);
        // IA éteinte (plan 1.7) : rien ne viendra à la prochaine visite, on le dit
        // et on dit quoi faire, au lieu de promettre un nouvel essai.
        const aiOff = !aiEnabled();
        const aiOffNote = `Sans IA, pas d’étapes détaillées pour « ${anchor.name} » : une étape par jour sur le lieu. Précise une région ou une ville dans « Où » pour des étapes sur des lieux réels.`;
        if (!proposed.length && replacing.length) {
          // L'IA n'a pas répondu : on garde l'itinéraire d'avant plutôt qu'un moins bon.
          notes.push(aiOff ? aiOffNote : 'Itinéraire gardé tel quel : la nouvelle proposition n’est pas arrivée à temps. Je réessaie à ta prochaine visite.');
          stagePlaces = [];
          if (!aiOff) stagesFallback = (carry?.stagesFallback ?? 0) + 1;
        } else if (!proposed.length) {
          notes.push(aiOff ? aiOffNote : 'Itinéraire détaillé indisponible pour le moment : une étape par jour sur le lieu. Je réessaie à ta prochaine visite, ou affine-le dans Parcours.');
          if (!aiOff) stagesFallback = (carry?.stagesFallback ?? 0) + 1;
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
          // Partagée une semaine seulement si chaque lieu existe sur la carte.
          else if (freshStages) await writeShared('stages', stagesKey, proposed, 7 * 86_400);
          // La moitié des lieux introuvables : itinéraire gardé mais redemandé à
          // la prochaine visite (lieux inventés par le modèle).
          if (dropped * 2 >= new Set(proposed.map((x) => x.place)).size) {
            stagesFallback = (carry?.stagesFallback ?? 0) + 1;
            notes.push('Plusieurs lieux de l’itinéraire n’existent pas sur la carte : je le redemande à ta prochaine visite.');
          } else if (
            wantsTraverse(compas.preferences?.wishes ?? []) &&
            stagePlaces.length >= 4 &&
            backtrackShare(stagePlaces) > 0.35
          ) {
            // Une traversée qui fait des allers-retours n'en est pas une.
            stagesFallback = (carry?.stagesFallback ?? 0) + 1;
            notes.push('Itinéraire en allers-retours pour une traversée : je le redemande à ta prochaine visite.');
          }
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
      }
      if (!routeSet) {
        // Distances réelles entre deux soirs (à pied, à vélo ou sur la route), en parallèle.
        const legGeometry: Array<Array<[number, number]> | null> = stagePlaces.map(() => null);
        const legs = await mapLimit(stagePlaces, 4, async (st, i): Promise<StageLeg | null> => {
          // Descente de rivière : la distance et le tracé de l'eau, déjà connus,
          // dès le premier soir (depuis la mise à l'eau, qui n'est pas une étape :
          // sans elle, Dordogne 8 oct. « 54,1 km d'eau » mais parcours de 36,1 km).
          if (st.move === 'pagaie') {
            legGeometry[i] = st.geometry ?? null;
            return st.riverKm != null ? { km: st.riverKm, ascent: null, source: 'riviere' } : null;
          }
          const prevPlace = i > 0 ? stagePlaces[i - 1] : null;
          if (!prevPlace || distanceKm(prevPlace, st) < 0.3) return null;
          const mode = st.move === 'marche' ? 'pieton' : st.move === 'velo' ? 'velo' : 'voiture';
          if (st.move === 'vol' || st.move === 'bateau') return { km: Math.round(distanceKm(prevPlace, st)), ascent: null, source: 'vol_oiseau' };
          // Mesure partagée : le même tronçon n'est routé qu'une fois pour tout le monde.
          // « v3 » (plan 1.5) : routeurs autorisés seulement, la source et le
          // dénivelé du relief gardés avec la mesure.
          const leg = await cached(
            'leg',
            `v3:${mode}:${coordKey(prevPlace.lat, prevPlace.lon)}>${coordKey(st.lat, st.lon)}`,
            30 * 86_400,
            async () => {
              const r = await routeAttempt([prevPlace, st], mode);
              const total = r.legs?.reduce((t, l) => t + l.distanceKm, 0);
              if (total == null || !r.legs) return null;
              const geometry = simplifyLine(r.legs.flatMap((l) => [...l.geometry]));
              // Le dénivelé d'une journée à pied ou à vélo, lu sur le relief le long du tracé.
              const up = r.legs.every((l) => l.ascentM != null)
                ? r.legs.reduce((t, l) => t + (l.ascentM ?? 0), 0)
                : mode !== 'voiture'
                  ? await routeAscentM(r.legs.flatMap((l) => [...l.geometry]))
                  : null;
              return { km: total, ascent: up, geometry, source: r.provider ?? null };
            }
          );
          const legMove: LegMove = st.move === 'marche' ? 'marche' : st.move === 'velo' ? 'velo' : 'voiture';
          const km = leg?.km ?? estimatedLegKm(distanceKm(prevPlace, st), legMove);
          if (km == null) return null;
          if (leg) legGeometry[i] = leg.geometry ?? null;
          // Une journée à pied ou à vélo hors de portée : distance non retenue plutôt que fausse.
          if ((st.move === 'marche' && km > 45) || (st.move === 'velo' && km > 180)) return null;
          if (!leg) {
            // Aucun routeur n'a mesuré ce tronçon : une distance quand même, annoncée.
            return { km, ascent: null, source: 'estimation', note: estimationNote(km, legMove) };
          }
          return {
            km: Math.round(km * 10) / 10,
            ascent: leg.ascent != null ? Math.round(leg.ascent) : null,
            source: leg.source ?? null,
          };
        });
        const estimated = legs.filter((l) => l?.source === 'estimation').length;
        if (estimated)
          notes.push(
            `${estimated} étape${estimated > 1 ? 's' : ''} avec une distance estimée (itinéraire non calculé) : à vérifier.`
          );
        // Arrêtée avant d'écrire l'itinéraire : rien n'est écrit, la place est rendue.
        if (stagePlaces.length && (await stopAsked())) {
          await updateTripMetadata(supabase, tripId, (m) => ({ ...m, compas: withoutClaim(compasMeta(m)) }));
          return { success: false, error: 'Préparation arrêtée : rien n’a été écrit.' };
        }
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
            : [st.note, legs[i]?.note].filter(Boolean).join(' ') || null,
          transport_mode: STEP_TRANSPORT[st.move],
          source: 'compas',
          latitude: Math.round(st.lat * 1e5) / 1e5,
          longitude: Math.round(st.lon * 1e5) / 1e5,
          distance_km: legs[i]?.km ?? (loopKm && i === 0 ? loopKm : null),
          elevation_gain_m: legs[i]?.ascent ?? null,
          // D'où vient la distance (plan 1.5) : le routeur qui l'a mesurée, ou « estimation ».
          metadata: stepDistanceMetadata(legs[i]?.source ?? (loopKm && i === 0 ? 'estimation' : null)),
        }));
        if (rows.length) {
          const { data: insertedSteps, error: stepsError } = await supabase.from('trip_steps').insert(rows).select('id');
          if (stepsError) {
            console.error('[compas] autofill étapes', stepsError.code, stepsError.message);
            return { success: false, error: 'Itinéraire non enregistré : réessaie dans un instant.' };
          }
          // Seulement les étapes écrites ici : l'annulation ne touche jamais celles de la personne.
          createdStepIds.push(...((insertedSteps ?? []) as Array<{ id: string }>).map((r) => r.id));
          // Tracé réel (routes, chemins) pour la carte, lié aux positions des étapes :
          // une étape déplacée ensuite le rend caduc, la carte revient aux segments.
          const track = buildTrack(
            rows.map((r) => ({ lat: r.latitude, lon: r.longitude })),
            legGeometry
          );
          if (track) {
            const key = trackKey(rows.map((r) => ({ lat: r.latitude, lon: r.longitude })));
            await updateTripMetadata(supabase, tripId, (m) => ({
              ...m,
              compas: { ...compasMeta(m), track: { key, geojson: track } },
            }));
          }
        }
      }
      steps = await loadSteps(supabase, tripId);
      stepsCreated = createdStepIds.length;
      // Passe unique : l'itinéraire écrit est inscrit tout de suite (plan 2.6).
      // Coupée plus loin, la préparation laisse un état qu'« Annuler » retrouve
      // et qu'une relance reprend, au lieu d'étapes orphelines.
      if (phase === 'all' && (createdStepIds.length > 0 || routeSet)) {
        const written = { runId, stepIds: createdStepIds, routeSet, notes: notes.slice(0, 6), datesSet, stagesFallback };
        await updateTripMetadata(supabase, tripId, (m) => withStepsWritten(m, written, Date.now()));
      }
    }

    if (phase === 'steps') {
      const run: PendingRun = { runId, stepIds: createdStepIds, routeSet, notes: notes.slice(0, 6), datesSet, stagesFallback };
      await updateTripMetadata(supabase, tripId, (m) => ({
        ...m,
        // Itinéraire écrit : la prise « steps » est rendue.
        compas: { ...withoutClaim(compasMeta(m)), autofill_pending: run },
      }));
      // Points sur place (restos, commerces, eau…) cherchés dès maintenant, après
      // la réponse : ils sont en cache quand l'écran s'ouvre. Trois appels au plus
      // (deux lieux chacun), arrêtés par la limite de la fonction sans rien casser.
      const points = steps
        .filter((st) => st.latitude != null && st.longitude != null)
        .map((st) => ({ lat: Number(st.latitude), lon: Number(st.longitude) }));
      if (points.length)
        after(async () => {
          for (let i = 0; i < 3; i += 1) {
            const found = await lookupStagePois(points).catch(() => null);
            if (!found || !found.partial) break;
          }
        });
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
      hours: shortHoursOf(days, compas.durationHours),
      partySize: party,
      month: trip.start_date ? Number(trip.start_date.slice(5, 7)) : null,
      lat: anchor.lat,
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
    if (await stopAsked())
      notes.unshift('Préparation arrêtée à ta demande : l’itinéraire est gardé, nuits, kit et budget ne sont pas faits. « Annuler » retire tout.');
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
      if (step && !step.accommodation_name && !halted) {
        const { error } = await supabase
          .from('trip_steps')
          .update({ accommodation_name: name.slice(0, 120), updated_at: new Date().toISOString() })
          .eq('id', step.id);
        if (!error) stays.push({ stepId: step.id, name: name.slice(0, 120) });
      }
    }

    lap('5');
    /* 5. Venir : d'où l'on part (« depuis X » dit, sinon le domicile du profil,
       sinon la position, jamais la France par défaut), puis la route mesurée, le
       train ou l'avion d'aéroport à aéroport (`engine/travel.ts`). Sans point de
       départ, rien n'est chiffré. */
    const start = dayStep(1);
    const target = start?.latitude != null && start.longitude != null ? { lat: start.latitude, lon: start.longitude } : anchor;
    // Domicile du profil (PLAN-100 4.3) : après le départ dit, avant la position ;
    // rangé à 0,01° au profil, jamais recherché ici.
    const home = saidOrigin ? null : traveller.home;
    // La commune, pas le lieu le plus proche du point (« depuis Chantier Hotel
    // de Ville » au lieu d'Annecy, 8 oct.) ; inutile quand le départ est dit ou le domicile connu.
    const near = !saidOrigin && !home && from ? await lookupReverse(from.lat, from.lon) : null;
    const travelLeg = await planTravelLeg(
      {
        origin: travelOrigin(
          saidOrigin,
          from
            ? {
                lat: from.lat,
                lon: from.lon,
                name: near ? (near.locality ?? near.name) : null,
                country: near?.country ?? null,
                countryCode: near?.countryCode ?? null,
              }
            : null,
          home
        ),
        target,
        destination: { name: anchor.name, countryCode: anchor.countryCode },
        days,
        party,
        transport: ctx.modules.transport,
      },
      {
        carRoute: async (a, b) => {
          const car = await routeAttempt([a, b], 'voiture');
          if (!car.legs?.length) {
            console.warn('[compas] trajet d’approche non calculé', car.reason ?? 'inconnu');
            return { failure: car.reason ?? null };
          }
          const last = car.legs[car.legs.length - 1].geometry.at(-1);
          return {
            km: car.legs.reduce((t, l) => t + l.distanceKm, 0),
            minutes: car.legs.reduce((t, l) => t + l.durationMin, 0),
            end: last ? { lat: last[1], lon: last[0] } : null,
          };
        },
        walkKm: async (end, to) => {
          if (haversineKm(end, to) * 1000 <= ARRIVAL_TOLERANCE_M) return 0;
          const walk = await routeAttempt([end, to], 'pieton');
          return walk.legs?.reduce((t, l) => t + l.distanceKm, 0) ?? haversineKm(end, to);
        },
        airport: (p, country) => nearestAirport(p.lat, p.lon, { country }),
      }
    );
    notes.push(...travelLeg.notes);
    const { origin, abroad, transport, carFuel } = travelLeg;
    const flightNeeded = travelLeg.flight != null;
    // Train plutôt qu'avion quand la route est trop longue mais le rail à portée (Ardennes, Bruges).
    const trainNeeded = travelLeg.train;
    const motorLegs = steps.filter((s, i) => i > 0 && s.distance_km != null && s.distance_km > 0).length;
    // Étapes proposées à l'instant, sinon celles déjà en place avec leur moyen de transport.
    const moves = stagePlaces.length ? stagePlaces : movesFromSteps(steps, activity);
    const localMoves = moves.filter((s, i) => i > 0 && ['bus', 'train', 'bateau', 'vol'].includes(s.move));
    // Road trip : kilomètres mesurés en voiture entre les étapes ; arrivé en avion, il faut louer.
    const carDays = moves.filter((s, i) => i > 0 && s.move === 'voiture');
    const carKmOnSite = steps
      .filter((st) => st.transport_mode === 'car' && st.distance_km != null)
      .reduce((t, st) => t + (st.distance_km ?? 0), 0);
    const rentalNeeded = carDays.length > 0 && (flightNeeded || trainNeeded != null);

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
    // Quelques heures (6 h au plus) : le kit d'une sortie, pas d'une expédition.
    const outingHours = shortHoursOf(days, compas.durationHours);
    const briefOuting = shortOuting && outingHours != null && outingHours <= 6;
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
      .filter(
        (g) =>
          keepRuleForNights(g.category, nightTypes) &&
          keepRuleForActivity(g.key, activity, shortOuting) &&
          (!briefOuting || keepRuleForBrief(g.key, maxAltitude ?? null))
      )
      .map((g) => needFromRule({ ...g, reason: contextualReason(g.key, g.reason, activity, shortOuting) }));
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
    if (picks.length && !(await stopAsked())) {
      const { data: inserted, error: itemsError } = await supabase
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
      if (itemsError) {
        console.error('[compas] autofill kit', itemsError.code, itemsError.message);
        notes.push('Kit non enregistré (erreur d’écriture) : relance « Tout préparer ».');
      }
      createdItemIds = ((inserted ?? []) as Array<{ id: string }>).map((r) => r.id);
    }
    const kitCount: Record<GearSource, number> = { inventaire: 0, pret: 0, location: 0, achat: 0, a_trouver: 0 };
    for (const p of picks) kitCount[p.source] += 1;

    lap('7');
    /* 7. Le spécialiste chiffre ce que la base ne connaît pas. */
    const hebergementNights = plan.filter((n) => n.type === 'hebergement').length;
    // Le moyen de chaque journée : sans lui, l'IA lisait les 18 km de pagaie
    // d'une descente de la Dordogne comme des « randonnées » (8 oct.).
    const BY: Record<string, string> = {
      foot: 'à pied',
      bike: 'à vélo',
      car: 'en voiture',
      bus: 'en bus',
      train: 'en train',
      plane: 'en avion',
      boat: activity === 'water' ? 'en canoë' : 'en bateau',
    };
    const stageLine = steps
      .map((s) => {
        const by = s.transport_mode ? BY[s.transport_mode] : undefined;
        const legText = s.distance_km ? ` (${s.distance_km} km${by ? ` ${by}` : ''})` : '';
        return `J${s.day_number} ${s.title.split(' · ').slice(1).join(' · ')}${legText}`;
      })
      .join(' ; ');
    const facts = [
      `Destination : ${anchor.name}${anchor.country ? `, ${anchor.country}` : ''} (code ${anchor.countryCode ?? 'inconnu'}).`,
      `Départ de la personne : ${originFact(origin)}.`,
      `${trip.start_date ? `Dates : ${trip.start_date} au ${trip.end_date ?? trip.start_date}` : 'Dates non choisies'} (${days} jour(s)), groupe de ${party}, activité ${activity}.`,
      abroad === true ? 'Voyage à l’étranger : oui.' : abroad === false ? 'Voyage à l’étranger : non.' : 'Voyage à l’étranger : inconnu.',
      flightNeeded
        ? 'Vol à prévoir : oui (aller-retour).'
        : trainNeeded
          ? `Train à prévoir : oui (aller-retour, environ ${trainNeeded.railKm} km de voie).`
          : transport?.mode === 'voiture' ? `Trajet d’approche mesuré : ${transport.km} km en voiture (${transport.minutes} min) puis ${transport.walkKm} km à pied.` : 'Trajet d’approche : non mesuré.',
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
    // plutôt que de risquer la fin du budget de la passe. Sans raisonnement :
    // avec, Nemotron 3.5 Lightning met ~50 s (mesure du 2026-10-05).
    // L'IA ne chiffre plus rien (barèmes du Compas) : elle ne donne que des conseils,
    // et seulement s'il reste du temps.
    const lateRun = remaining() < 12_000 || halted;
    const rawAdvice = lateRun
      ? null
      : await askJson(
          userId,
          buildCompasAutofillSystem(),
          buildCompasAutofillPrompt(facts),
          500,
          false,
          0,
          Math.min(phase === 'all' ? 30_000 : 15_000, remaining() - 6_000)
        );
    const advice: AutofillAiAdvice = sanitizeAdvice(rawAdvice);
    const usedAi = rawAdvice != null;
    // Papiers, change et prises : la règle parle, l'IA se tait sur ces sujets.
    // Le tutoiement aussi est une règle : un conseil qui vouvoie encore est écarté.
    const papers = travelPapers(anchor.countryCode, anchor.country);
    // L'essentiel (papiers, sécurité) vient des règles, avec ou sans IA (plan 4.11).
    const safety = essentialAdvice({
      activity,
      nights: plan.map((n) => n.type),
      maxAltitudeM: maxAltitude,
      party,
      startDate: trip.start_date ?? null,
      lat: anchor.lat ?? null,
      countryCode: anchor.countryCode ?? null,
    });
    const essential = [...papers.notes, ...safety];
    // L'IA n'ajoute que des suggestions facultatives, dites comme telles.
    const aiNotes = advice.notes
      .filter((n) => keepAiNote(n, papers))
      .map(tutoyer)
      .filter((n): n is string => n != null)
      .filter((n) => !repeatsRule(n, safety))
      .map(aiSuggestion);

    lap('8');
    /* 8. Budget complet, chaque ligne avec sa source. */
    // Barèmes du Compas : même voyage, même budget, chaque ligne avec sa base.
    const lvl = priceLevel(anchor.countryCode, anchor.country);
    const refugeCost = plan.reduce((t, n) => {
      const r = n.type === 'refuge' ? refugesByNight[n.night - 1][0] : null;
      return t + (r?.pricePerNight ?? 0) * party;
    }, 0);
    const unpricedRefuges = plan.filter(
      (n) => n.type === 'refuge' && refugesByNight[n.night - 1][0]?.pricePerNight == null
    ).length;
    // Vol : d'aéroport à aéroport (OurAirports), sinon du départ au lieu ; sans départ, aucun vol.
    const flight = travelLeg.flight ? flightRoundTrip(travelLeg.flight.km) : null;
    const rentalCars = fuelForKm(carKmOnSite, party).cars;
    const localTrips = localMoves.reduce((t, m) => t + localTripPerLeg(m.move, lvl.level), 0);
    // Formalités (barème pour un voyageur français) : gardées tant qu'on ne sait pas
    // que la personne est déjà dans le pays ; départ inconnu = pays de départ inconnu.
    const abroadFor = abroadCosts(abroad);
    const entry = abroadFor.formalities ? entryFees(anchor.countryCode) : null;
    const mealsAmount = mealsTotal({ days, party, nights: plan.map((n) => n.type), level: lvl.level });
    const rental = picks.filter((p) => p.source === 'location').reduce((t, p) => t + (p.costEur ?? 0), 0);
    // Le budget compte l'indispensable qui manque ; le conseillé (crème
    // solaire, poncho pour une course du soir : 103 €) reste au kit, facultatif.
    const toBuy = picks.filter((p) => p.source === 'achat');
    const purchase = toBuy.filter((p) => p.need.vital).reduce((t, p) => t + (p.costEur ?? 0), 0);
    const optionalBuy = toBuy.filter((p) => !p.need.vital).reduce((t, p) => t + (p.costEur ?? 0), 0);
    if (optionalBuy > 0)
      notes.push(`Matériel conseillé non compté au budget : ${Math.round(optionalBuy)} € à la boutique si tu ne l’as pas (facultatif).`);
    let lines = budgetLines([
      refugeCost
        ? { category: 'hébergement', title: 'Nuits en refuge', amount: refugeCost, source: 'base', basis: 'prix des refuges en base × personnes' }
        : null,
      unpricedRefuges
        ? {
            category: 'hébergement',
            title: `${unpricedRefuges} nuit(s) en refuge (prix à confirmer)`,
            amount: refugePerNight(lvl.level) * unpricedRefuges * party,
            source: 'estimation',
            basis: `${lvl.basis} · demi-pension en refuge gardé`,
          }
        : null,
      hebergementNights
        ? {
            category: 'hébergement',
            title: `${hebergementNights} nuit(s) en hébergement`,
            amount: lodgingPerNight(lvl.level) * hebergementNights * party,
            source: 'estimation',
            basis: `${lvl.basis} · chambre partagée à deux · vrais prix dans Résa · Nuits`,
          }
        : null,
      flight
        ? {
            category: 'transport',
            title: `Vol aller-retour × ${party}`,
            amount: flight.eur * party,
            source: 'estimation',
            basis: `${flight.basis} · ${transport?.basis ?? 'vol'} · vrai prix dans Résa · Vols`,
          }
        : null,
      trainNeeded
        ? {
            category: 'transport',
            title: `Train aller-retour × ${party}`,
            amount: trainNeeded.eurRoundTrip * party,
            source: 'estimation',
            basis: trainNeeded.basis,
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
      rentalNeeded
        ? {
            category: 'transport',
            title: `Location de voiture · ${days} jour(s)`,
            amount: carRentalPerDay(lvl.level) * days * rentalCars,
            source: 'estimation',
            basis: `${lvl.basis} · catégorie économique · à comparer dans Résa · Trajets`,
          }
        : null,
      localMoves.length
        ? {
            category: 'transport',
            title: `Transports sur place (${localMoves.length} trajet${localMoves.length > 1 ? 's' : ''})`,
            amount: localTrips * party,
            source: 'estimation',
            basis: `${lvl.basis} · ${localMoves.map((m) => m.move).join(', ')}`,
          }
        : null,
      // Une sortie de quelques heures ne compte pas de repas.
      ctx.scope === 'sortie'
        ? null
        : {
            category: 'nourriture',
            title: `Repas · ${days} jour(s) × ${party}`,
            amount: mealsAmount,
            source: 'estimation',
            basis: `${lvl.basis} · selon la nuit (bivouac, refuge, hébergement)`,
          },
      rental ? { category: 'matériel', title: 'Location de matériel', amount: rental, source: 'base', basis: 'prix par jour de la boutique × jours' } : null,
      purchase ? { category: 'matériel', title: 'Matériel à acheter', amount: purchase, source: 'base', basis: 'prix de la boutique' } : null,
      entry
        ? {
            category: 'divers',
            title: `Formalités : ${entry.detail}`,
            amount: entry.eur * party,
            source: 'estimation',
            basis: `barème Compas ${COSTS_VERSION} · tarif officiel connu, à vérifier avant de partir`,
          }
        : null,
      abroadFor.insurance || (maxAltitude ?? 0) >= 2500
        ? {
            category: 'divers',
            title: 'Assurance voyage et rapatriement',
            amount: insurance(days, { abroad: abroadFor.insurance, altitudeM: maxAltitude }) * party,
            source: 'estimation',
            basis: `barème Compas ${COSTS_VERSION} · forfait par jour${(maxAltitude ?? 0) >= 4000 ? ', haute altitude' : ''}`,
          }
        : null,
    ]);
    let createdExpenseIds: string[] = [];
    // Une ligne de budget retouchée lors d'une réadaptation reste ; on ne la double pas.
    const keptTitles = new Set(carry?.expenseTitles ?? []);
    if (keptTitles.size) lines = lines.filter((l) => !keptTitles.has(l.title.slice(0, 100)));
    // Arrêtée : aucun budget écrit, aucun total annoncé.
    if (await stopAsked()) lines = [];
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
      if (expenseError) {
        console.error('[compas] autofill dépenses', expenseError.code, expenseError.message);
        notes.push('Budget non enregistré (erreur d’écriture) : relance « Tout préparer ».');
        // Le résumé ne doit jamais annoncer un budget absent de la base.
        lines = [];
      }
      createdExpenseIds = ((inserted ?? []) as Array<{ id: string }>).map((r) => r.id);
    }
    const total = budgetTotal(lines);
    const setBudget = prevBudget == null && total > 0;

    lap('9');
    /* 9. Trace pour l'annulation et la réadaptation, puis budget cible si aucun n'était fixé. */
    const merged = (a: string[], b: string[] | undefined) => [...new Set([...a, ...(b ?? [])])];
    const { error: traceError } = await updateTripMetadata(
      supabase,
      tripId,
      (m) => ({
        ...m,
        compas: {
          ...withoutClaim(withoutPending(compasMeta(m))),
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
            // Arrêtée en cours : la relance demande d'abord « Annuler ».
            ...(halted ? { stopped: true } : {}),
            datesSet,
            notes: orderNotes(essential, notes, aiNotes),
            // Réglages qui ont produit ce préremplissage : un changement dit quoi refaire.
            // Lus sur les métadonnées à jour : le lieu naturel retenu en cours de route
            // (Ardennes, département → massif) ne passe pas pour un changement de lieu,
            // qui relançait aussitôt toute la préparation.
            basis: tripBasis({ ...trip, metadata: m }, activity),
            ...(stagesFallback ? { stagesFallback } : {}),
          },
        },
      }),
      { columns: setBudget ? { estimated_budget: total } : {} }
    );
    if (traceError) console.error('[compas] autofill trace', traceError.code, traceError.message);

    lap('fin');
    console.info('[compas] préremplissage', { phase, ms: Date.now() - startedAt, laps });
    return {
      success: true,
      summary: {
        nights: nightsOut,
        transport,
        ...(travelLeg.originUnknown ? { originUnknown: true } : {}),
        kit: kitCount,
        budget: lines,
        total,
        notes: orderNotes(essential, notes, aiNotes),
        usedAi,
        stepsCreated,
      },
    };
  } catch (err) {
    await reportServerError('compas.compasAutofillAction', err);
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
    const { error: undoError } = await updateTripMetadata(
      supabase,
      tripId,
      (m) => {
        const next: Record<string, unknown> = {
          ...m,
          compas: { ...withoutPending(compasMeta(m)), autofill: { undone: true } },
        };
        if (run.routeSet) delete next.route_id;
        return next;
      },
      {
        columns: {
          ...(run.budgetSet ? { estimated_budget: null } : {}),
          ...(run.datesSet ? { start_date: null, end_date: null } : {}),
        },
      }
    );
    if (undoError) console.error('[compas] annulation : métadonnées non écrites', undoError.code, undoError.message);
    return { success: true };
  } catch (err) {
    await reportServerError('compas.compasUndoAutofillAction', err);
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
    const pendingRun = readPending(meta);
    if (pendingRun)
      return {
        success: false,
        error: pendingIsStale(pendingRun, Date.now())
          ? 'Préparation coupée en cours de route : relance « Tout préparer » pour la finir, ou annule-la.'
          : 'Une préparation est déjà en cours.',
      };
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

    const { error: carryError } = await updateTripMetadata(
      supabase,
      tripId,
      (m) => {
        const c = { ...compasMeta(m) };
        delete c.autofill; // le préremplissage repasse
        const next: Record<string, unknown> = { ...m, compas: { ...c, autofill_carry: carry } };
        return next;
      },
      // Une enveloppe posée par le préremplissage se recalcule avec le reste.
      { columns: run.budgetSet && parts.includes('budget') ? { estimated_budget: null } : {} }
    );
    if (carryError) return { success: false, error: 'Réadaptation non enregistrée : réessaie.' };
    return { success: true, parts, kept, label: `${partsText(parts)} réadapté${parts.length > 1 ? 's' : ''}` };
  } catch (err) {
    await reportServerError('compas.compasRefreshAutofillAction', err);
    return { success: false, error: 'Erreur serveur' };
  }
}

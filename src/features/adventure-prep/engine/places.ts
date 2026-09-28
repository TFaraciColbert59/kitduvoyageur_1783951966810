/**
 * Lieux reels du preparateur.
 *
 * Une etape sans nom de lieu n est pas une etape : c est une intention. Ce
 * module rattache donc chaque intention a un point d interet REEL — issu de la
 * base du projet — plutot que de laisser « Pause nature » flotter sans lieu.
 *
 * Ce qu'il ne fait jamais : inventer un lieu, un prix ou une position. Un
 * candidat incomplet est refuse, un prix absent reste « a verifier », et le
 * modele d origine n est jamais modifie.
 */

import { haversineKm, type GeoPoint } from './routing';
import {
  PRICE_TO_CHECK,
  type DayNote,
  type ItineraryModel,
  type ItineraryStep,
  type ItineraryStepKind,
  type PlaceRef,
} from '../types';

/** Ce qu'on sait d'un point d'interet, et rien de plus. */
export interface PlaceCandidate {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly lat: number;
  readonly lon: number;
  readonly description: string | null;
  readonly region: string | null;
  readonly country: string | null;
  /** Prix par nuit tel que stocke ; `null` si la base n'en dit rien. */
  readonly pricePerNight: number | null;
  readonly phone: string | null;
  readonly website: string | null;
  readonly isVerifiable: boolean;
}

// L inventaire transmis au proposeur : le NOM et la CATEGORIE, rien d autre.
//
// Volontairement plus pauvre que `PlaceCandidate`. Le proposeur n a pas besoin
// de coordonnees — il ne les invente pas, il recopie — mais il a besoin de
// savoir que Lac Blanc est de l eau et Refuge du Gouter un refuge, sinon il
// les interchangeable et propose une nuit sur un lac.
export interface PlaceInventory {
  readonly name: string;
  readonly category: string;
}

const KNOWN_CATEGORIES = new Set([
  'refuge',
  'camping',
  'stay',
  'summit',
  'col',
  'viewpoint',
  'water',
  'waterfall',
  'food',
  'transport',
  'poi',
]);

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Convertit un point d'interet brut. Refuse ce qui n'a pas de nom ou pas de
 * position : un lieu non situe ne peut ni apparaitre sur la carte, ni recevoir
 * une distance.
 */
export function toCandidate(raw: unknown): PlaceCandidate | null {
  const poi = raw as Record<string, unknown> | null;
  if (!poi || typeof poi !== 'object') return null;

  const name = textOrNull(poi.name);
  const lat = numberOrNull(poi.lat);
  const lng = numberOrNull(poi.lng ?? poi.lon);
  if (name === null || lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const tags = (poi.tags ?? {}) as Record<string, unknown>;
  const category = textOrNull(poi.category);
  const price =
    numberOrNull(poi.price_per_night) ?? numberOrNull(tags.price_per_night);

  return {
    id: textOrNull(poi.id) ?? `${name}:${lat}:${lng}`,
    name,
    category: category && KNOWN_CATEGORIES.has(category) ? category : 'poi',
    lat,
    lon: lng,
    description: textOrNull(poi.description) ?? textOrNull(poi.details),
    region: textOrNull(poi.region),
    country: textOrNull(poi.country),
    pricePerNight: price,
    phone: textOrNull(poi.phone),
    website: textOrNull(poi.website),
    isVerifiable: poi.is_verified !== false,
  };
}

/** Categories compatibles avec chaque type d'etape. */
export function kindCategories(kind: ItineraryStepKind): readonly string[] {
  switch (kind) {
    case 'nuit':
      return ['refuge', 'camping', 'stay', 'poi'];
    case 'arret':
      return ['viewpoint', 'col', 'summit', 'waterfall', 'poi'];
    case 'ravitaillement':
      return ['water', 'food', 'poi'];
    case 'repos':
      // Une pause se fait quelque part : un belvedere, un col, un point de vue
      // rencontre sur le parcours. Laisser `repos` sans categorie rendait la
      // pause DEFINITIVEMENT introuvable, donc chaque journee portant une
      // pause restait « a verifier » — distance, denivele et duree compris.
      return ['viewpoint', 'col', 'poi'];
    case 'trajet':
      return [];
    default:
      return [];
  }
}

/* ------------------------------------------------------------------ */
/* Attribution                                                         */
/* ------------------------------------------------------------------ */

const point = (candidate: PlaceCandidate): GeoPoint => ({ lat: candidate.lat, lon: candidate.lon });

/**
 * Place le point le plus proche ET compatible, par rapport au dernier point
 * connu. Le parcours avance : on ne revient pas en arriere chercher un refuge
 * deja depasse.
 */
function nearestCompatible(
  candidates: readonly PlaceCandidate[],
  used: ReadonlySet<string>,
  from: GeoPoint,
  kind: ItineraryStepKind,
): PlaceCandidate | null {
  const allowed = new Set(kindCategories(kind));
  let best: PlaceCandidate | null = null;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (used.has(candidate.id)) continue;
    if (!allowed.has(candidate.category)) continue;
    const km = haversineKm(from, point(candidate));
    if (km < bestKm) {
      bestKm = km;
      best = candidate;
    }
  }
  return best;
}

function applyCandidate(
  step: ItineraryStep,
  candidate: PlaceCandidate,
): ItineraryStep {
  const priced = step.kind === 'nuit' && candidate.pricePerNight !== null;
  return {
    ...step,
    placeName: candidate.name,
    // Le titre affiche devient le nom du lieu reel. C'est ce qui supprime la
    // repetition « Eau et ravitaillement » / « Ravitaillement et eau » : deux
    // etapes qui portent le nom de leur lieu ne peuvent pas se confondre.
    title: candidate.name,
    lat: candidate.lat,
    lon: candidate.lon,
    price: priced
      ? { amount: candidate.pricePerNight, currency: 'EUR', state: 'propose' }
      : step.price,
  };
}

/**
 * Rattache les etapes compatibles a des lieux reels.
 *
 * Les deux trajets extremes gardent les lieux que la personne a choisis : on
 * ne remplace jamais sa destination par un point d'interet trouve plus proche.
 */
export function assignPlaces(
  model: ItineraryModel,
  candidates: readonly PlaceCandidate[],
  origin: PlaceRef | null,
  destination: PlaceRef | null,
): ItineraryModel {
  const ordered = [...model.steps].sort((a, b) => a.day - b.day || a.order - b.order);
  const trajets = ordered.filter((step) => step.kind === 'trajet');
  const firstTrajetId = trajets[0]?.id ?? null;
  const lastTrajetId = trajets[trajets.length - 1]?.id ?? null;

  const used = new Set<string>();
  let cursor: GeoPoint = origin
    ? { lat: origin.lat, lon: origin.lon }
    : { lat: NaN, lon: NaN };
  let hasCursor = origin !== null;

  const steps = ordered.map((step) => {
    if (step.kind === 'trajet') {
      if (step.id === firstTrajetId && origin) {
        cursor = { lat: origin.lat, lon: origin.lon };
        hasCursor = true;
        return { ...step, placeName: origin.name, lat: origin.lat, lon: origin.lon };
      }
      if (step.id === lastTrajetId && destination) {
        return {
          ...step,
          placeName: destination.name,
          lat: destination.lat,
          lon: destination.lon,
        };
      }
      return step;
    }

    if (!hasCursor) return step;
    const candidate = nearestCompatible(candidates, used, cursor, step.kind);
    if (!candidate) return step;
    used.add(candidate.id);
    cursor = point(candidate);
    return applyCandidate(step, candidate);
  });

  return demoteOrphans({ ...model, steps });
}

/**
 * Une etape sans position n est pas une etape : c est une intention.
 *
 * La laisser dans `steps` casse toute la journee : `routeItinerary` n accepte
 * un trajet que si TOUTES les etapes sont situees, et `applyActivityDurations`
 * n additionne que si TOUTES ont une duree. Une seule intention non rattachee
 * suffisait donc a faire passer distance, denivele et duree a « a verifier ».
 *
 * On la retire donc de la liste et on la garde en note : la personne voit ce
 * qu elle a demande, sans qu un lieu soit invente pour la faire exister.
 */
function demoteOrphans(model: ItineraryModel): ItineraryModel {
  const steps: ItineraryStep[] = [];
  const notes: DayNote[] = [];

  for (const step of model.steps) {
    if (step.lat !== null && step.lon !== null) {
      steps.push(step);
      continue;
    }
    notes.push({
      day: step.day,
      kind: step.kind,
      title: step.title,
      reason: step.reason,
    });
  }

  return { ...model, steps, notes: [...(model.notes ?? []), ...notes] };
}

/* ------------------------------------------------------------------ */
/* Budget                                                             */
/* ------------------------------------------------------------------ */

/**
 * Budget d'une journee. Volontairement strict : si une seule etape n'a pas de
 * prix connu, le total serait une somme partielle presentee comme le budget
 * du jour — ce que l'utilisateur lirait comme un nombre fiable.
 */
export function dayBudget(model: ItineraryModel, day: number): number | null {
  const steps = model.steps.filter((step) => step.day === day);
  if (steps.length === 0) return null;
  let total = 0;
  for (const step of steps) {
    if (step.price.amount === null) return null;
    total += step.price.amount;
  }
  return Math.round(total * 100) / 100;
}

export { PRICE_TO_CHECK };

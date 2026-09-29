/**
 * Les alternatives REELLES d une etape, et le rail des lieux d une journee.
 *
 * Deux actions de l etape 2 n avaient plus de contenu, et toutes les deux
 * promettaient une donnee qu elles n avaient pas :
 *
 *   - « Remplacer » : le bouton avait ete retire, l alternative jamais
 *     ajoutee. Il ne restait qu une intention.
 *   - « Ajouter » : le formulaire demandait un intitule libre. On inventait
 *     donc un nom d etape a la main — exactement ce que le preparateur
 *     refuse partout ailleurs.
 *
 * Ce module ne fabrique rien. Il RANGE des lieux que la base a reellement
 * rendus (`PlaceCandidate`), par distance orthodromique reelle a l etape (pour
 * une alternative) ou au parcours de la journee (pour le rail). Quand la base
 * n a rien rendu, il le DIT — il ne remplit pas.
 *
 * Le tri est toujours une mesure : la distance, ou le nom. Jamais un ordre
 * trie sur une suite de noms ecrits a la main.
 */

import { haversineKm, type GeoPoint } from './routing';
import {
  kindCategories,
  NEAREST_REACH_KM,
  normalizePlaceName,
  type PlaceCandidate,
  type ScoredPlace,
} from './places';
import { daySteps } from './itinerary';
import type { ItineraryModel, ItineraryStep, ItineraryStepKind } from '../types';

const KM_PER_DEGREE = 111;

function point(candidate: PlaceCandidate): GeoPoint {
  return { lat: candidate.lat, lon: candidate.lon };
}

function located(step: ItineraryStep): GeoPoint | null {
  if (step.lat === null || step.lon === null) return null;
  if (!Number.isFinite(step.lat) || !Number.isFinite(step.lon)) return null;
  return { lat: step.lat, lon: step.lon };
}

/** Les identifiants de catalogue deja portes par le programme. */
export function usedPlaceIds(model: ItineraryModel | null): ReadonlySet<string> {
  const used = new Set<string>();
  for (const step of model?.steps ?? []) {
    if (step.placeId) used.add(step.placeId);
  }
  return used;
}

/**
 * Le point de reference d une alternative.
 *
 * L ideal est l etape elle-meme. Sinon, le dernier point REELLEMENT localise
 * qui la precede dans la meme journee : sans lui, un gite non place ne
 * proposerait rien du tout, alors que le parcours, lui, sait ou il va.
 */
export function referenceFor(
  step: ItineraryStep,
  model: ItineraryModel | null,
): GeoPoint | null {
  const propre = located(step);
  if (propre) return propre;
  if (!model) return null;
  const jour = daySteps(model, step.day);
  const index = jour.findIndex((autre) => autre.id === step.id);
  const avant = index === -1 ? jour : jour.slice(0, index);
  for (let i = avant.length - 1; i >= 0; i -= 1) {
    const precedent = located(avant[i]);
    if (precedent) return precedent;
  }
  return null;
}

/** D ou vient le point de reference. L ecran le dit plutot que d afficher des coordonnees. */
export type ReferenceOrigin = 'lieu' | 'precedent' | null;

export function referenceOrigin(
  step: ItineraryStep,
  model: ItineraryModel | null,
): ReferenceOrigin {
  if (located(step)) return 'lieu';
  return referenceFor(step, model) === null ? null : 'precedent';
}

/** La formulation honnete de chaque point de reference possible. */
export const REFERENCE_LABELS: Readonly<Record<Exclude<ReferenceOrigin, null>, string>> = {
  lieu: "Ce point est celui de l'etape elle-meme.",
  precedent: "Ce point est le dernier lieu reellement localise avant l'etape.",
};

/** Pourquoi aucune alternative n est proposee. Jamais devine : toujours constate. */
export type AlternativesGap = 'type-sans-lieu-compatible' | 'reference-absente' | 'stock-vide';

export interface AlternativesResult {
  /** Les alternatives, de la plus proche a la plus eloignee. */
  readonly ranked: readonly ScoredPlace[];
  /** `null` quand il y a des alternatives ; sinon, la raison honnete. */
  readonly gap: AlternativesGap | null;
  /** Le point de reference mesure, quand il existe. */
  readonly reference: GeoPoint | null;
}

/** La formulation honnete de chaque absence. Aucun nombre, aucun exemple de lieu. */
export const GAP_LABELS: Readonly<Record<AlternativesGap, string>> = {
  'type-sans-lieu-compatible':
    "Un trajet ne se remplace pas par un lieu : il se mesure. Rien a proposer ici.",
  'reference-absente':
    "Aucun point reel n'est rattache a cette etape, et le parcours n'en a aucun avant elle : rien a comparer.",
  'stock-vide':
    "La base n'a rendu aucun autre etablissement de ce type autour de ce point. Rien n'est propose a la place.",
};

/**
 * Les etablissements REELS du meme type, autour du point de reference.
 *
 * Le lieu de l etape elle-meme est exclu : « remplacer » par le lieu qu on
 * remplace ne remplacerait rien. L exclusion se fait sur l identifiant de
 * catalogue ET sur le nom normalise — un lieu peut etre connu par une source
 * qui ne donne pas d identifiant.
 */
export function alternativesFor(
  step: ItineraryStep,
  candidates: readonly PlaceCandidate[],
  model: ItineraryModel | null = null,
  reachKm: number = NEAREST_REACH_KM,
): AlternativesResult {
  const allowed = kindCategories(step.kind);
  if (allowed.length === 0) {
    return { ranked: [], gap: 'type-sans-lieu-compatible', reference: null };
  }
  if (!Number.isFinite(reachKm) || reachKm <= 0) {
    return { ranked: [], gap: 'reference-absente', reference: null };
  }
  const reference = referenceFor(step, model);
  if (!reference) {
    return { ranked: [], gap: 'reference-absente', reference: null };
  }
  const categories = new Set(allowed);
  const nom = step.placeName === null ? null : normalizePlaceName(step.placeName);
  const retenus: ScoredPlace[] = [];
  for (const candidate of candidates) {
    if (!categories.has(candidate.category)) continue;
    if (step.placeId !== null && candidate.catalogId === step.placeId) continue;
    if (nom !== null && normalizePlaceName(candidate.name) === nom) continue;
    const km = haversineKm(reference, point(candidate));
    if (!Number.isFinite(km) || km > reachKm) continue;
    retenus.push({ candidate, distanceKm: km });
  }
  return {
    ranked: rankFrom(retenus),
    gap: retenus.length === 0 ? 'stock-vide' : null,
    reference,
  };
}

/* ------------------------------------------------------------------ */
/* Le rail des lieux d une journee (P2.7)                              */
/* ------------------------------------------------------------------ */

/** Les points REELS du parcours d une journee, dans l ordre. */
export function dayAnchors(model: ItineraryModel | null, day: number): readonly GeoPoint[] {
  if (!model) return [];
  return daySteps(model, day)
    .map(located)
    .filter((value): value is GeoPoint => value !== null);
}

/** La distance au point du parcours le plus proche. */
function closestToAnchors(candidate: PlaceCandidate, anchors: readonly GeoPoint[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    const km = haversineKm(anchor, point(candidate));
    if (Number.isFinite(km) && km < best) best = km;
  }
  return best;
}

/**
 * Les lieux du rail : ceux de la categorie demandee, autour du trace du jour,
 * tries par la distance reelle au point du parcours le plus proche.
 *
 * `used` est l ensemble des lieux deja portes par le programme : reproposer un
 * lieu deja dans la journee n est pas une alternative, c est un doublon.
 */
export function rankForDay(
  candidates: readonly PlaceCandidate[],
  anchors: readonly GeoPoint[],
  kind: ItineraryStepKind,
  used: ReadonlySet<string> = new Set(),
): readonly ScoredPlace[] {
  if (anchors.length === 0) return [];
  const allowed = new Set(kindCategories(kind));
  if (allowed.size === 0) return [];
  const retenus: ScoredPlace[] = [];
  for (const candidate of candidates) {
    // Le programme porte des identifiants de CATALOGUE ; le candidat a, lui, un
    // identifiant interne de deduplication qui neDesigne aucun lieu et ne
    // doit jamais etre publie. Comparer les deux ne rencontres donc jamais :
    // un lieu deja pose dans la journee revenait dans le rail. On teste donc
    // l'identifiant reel quand la source en fournit un, et l'interne sinon.
    if (used.has(candidate.id)) continue;
    if (candidate.catalogId != null && used.has(candidate.catalogId)) continue;
    if (!allowed.has(candidate.category)) continue;
    const km = closestToAnchors(candidate, anchors);
    if (!Number.isFinite(km)) continue;
    retenus.push({ candidate, distanceKm: km });
  }
  return rankFrom(retenus);
}

/** Deux tris, tous deux sur des donnees reelles : la distance, ou le nom. */
export type RailSort = 'distance' | 'nom';

/** Le tri du rail. `distance` range par la distance mesuree ; `nom`, par ordre alphabetique. */
export function sortRail(ranked: readonly ScoredPlace[], sort: RailSort): readonly ScoredPlace[] {
  return sort === 'nom' ? rankByName(ranked) : rankFrom(ranked);
}

function rankFrom(ranked: readonly ScoredPlace[]): readonly ScoredPlace[] {
  return [...ranked].sort(
    (a, b) => a.distanceKm - b.distanceKm || a.candidate.name.localeCompare(b.candidate.name, 'fr'),
  );
}

function rankByName(ranked: readonly ScoredPlace[]): readonly ScoredPlace[] {
  return [...ranked].sort((a, b) => a.candidate.name.localeCompare(b.candidate.name, 'fr'));
}

/* --- L elargissement du rail : la pagination est une question de rayon --- */

/** Le premier rayon demande : le meme que celui d un rattachement d etape. */
export const RAIL_FIRST_REACH_KM = NEAREST_REACH_KM;
/** A chaque page, on demande 60 % de plus loin. */
export const RAIL_GROWTH = 1.6;
/** Au-dela, on ne s eloigne plus : ce serait deja un autre voyage. */
export const RAIL_MAX_REACH_KM = 200;

/** Le rayon, en km, de la page demandee. Page 0 = le plus proche. */
export function reachForPage(page: number): number {
  if (!Number.isFinite(page) || page <= 0) return RAIL_FIRST_REACH_KM;
  const raw = RAIL_FIRST_REACH_KM * RAIL_GROWTH ** page;
  return Number.isFinite(raw) ? Math.min(raw, RAIL_MAX_REACH_KM) : RAIL_MAX_REACH_KM;
}

/**
 * Les points a interroger pour la page demandee.
 *
 * `loadBasePlacesNear` tire sa boite de SES points. Pour elargir une vraie
 * requete — et non une liste fabriquee — on ajoute quatre points a l
 * equateur du parcours, au rayon de la page. La boite englobante grossit
 * donc reellement, et la source repond sur une zone reellement plus grande.
 */
export function ringFor(anchors: readonly GeoPoint[], page: number): readonly GeoPoint[] {
  if (anchors.length === 0) return [];
  const lat = anchors.reduce((total, value) => total + value.lat, 0) / anchors.length;
  const lon = anchors.reduce((total, value) => total + value.lon, 0) / anchors.length;
  const delta = reachForPage(page) / KM_PER_DEGREE;
  return [
    ...anchors,
    { lat: Math.min(89.9, lat + delta), lon },
    { lat: Math.max(-89.9, lat - delta), lon },
    { lat, lon: Math.min(179.9, lon + delta) },
    { lat, lon: Math.max(-179.9, lon - delta) },
  ];
}
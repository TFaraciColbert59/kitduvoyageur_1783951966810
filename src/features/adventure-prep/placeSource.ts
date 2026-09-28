/**
 * La source des LIEUX, cote navigateur.
 *
 * Le moteur construit des etapes ; il ne peut pas leur inventer une position.
 * Cette source va chercher les points d interet REELS du depot autour du
 * trajet, et `assignPlaces` les accroche aux etapes compatibles.
 *
 * Un piege merite d etre ecrit ici : `/api/pois` lit sa boite en SNAKE_CASE
 * (`min_lat`, `max_lng`...). En camelCase elle ne signale aucune erreur, ignore
 * silencieusement le filtre et renvoie les points du monde entier - Kilimanjaro
 * et Everest pour une requete sur Chamonix. Le parcours aurait alors choisi un
 * sommet a 6000 km. Les cles sont donc explicites ici, et un test les verrouille.
 *
 * Deuxieme piege, lui aussi silencieux : la route fusionne `outdoor_points`,
 * `map_refuges` et `map_water_points`, qui se recouvrent. Un meme refuge y
 * revient sous deux identifiants differents, a la meme position. Dedupliquer
 * sur le seul `id` les laisse passer, et le moteur pose alors deux etapes sur
 * le meme point. Sur le corridor Chamonix, 8 des 18 lignes etaient des
 * doublons : `Lac Blanc` servait a la fois de ravitaillement et d'arret.
 */

import { assignPlaces, toCandidate, type PlaceCandidate, type PlaceInventory } from './engine/places';
import type { PlaceInventoryLoader, PlaceResolver } from './engine/itineraryPhases';
import type { AdventurePrepDraft, ItineraryModel } from './types';

const ENDPOINT = '/api/pois';

/** Marge autour du trajet, en degres : de quoi couvrir les detoures. */
const MARGIN_DEG = 0.12;

/** Au-dela, la boite est recentree par la route : inutile d en demander plus. */
const MAX_SPAN_DEG = 20;

/** Plafond de la route : 300 est son maximum accepte. */
const LIMIT = 300;

export interface PlaceBbox {
  readonly minLat: number;
  readonly maxLat: number;
  readonly minLng: number;
  readonly maxLng: number;
}

type Fetcher = typeof fetch;

function round4(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

function usable(point: { lat: number; lon: number }): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lon >= -180 &&
    point.lon <= 180
  );
}

/**
 * La boite qui contient tous les points du trajet, elargie.
 *
 * Une boite trop etroite cutterait les etapes reelles situees le long du
 * trajet ; une boite trop large rapporterait des lieux d une autre region.
 */
export function bboxForTrip(points: readonly { lat: number; lon: number }[]): PlaceBbox | null {
  if (points.length === 0) return null;
  if (!points.every(usable)) return null;
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lon);
  return {
    minLat: round4(Math.max(-90, Math.min(...lats) - MARGIN_DEG)),
    maxLat: round4(Math.min(90, Math.max(...lats) + MARGIN_DEG)),
    minLng: round4(Math.max(-180, Math.min(...lngs) - MARGIN_DEG)),
    maxLng: round4(Math.min(180, Math.max(...lngs) + MARGIN_DEG)),
  };
}

/** La boite n est utile que si elle ne couvre pas un autre hemisphere. */
function isSane(box: PlaceBbox): boolean {
  return box.maxLat - box.minLat <= MAX_SPAN_DEG && box.maxLng - box.minLng <= MAX_SPAN_DEG;
}

/** L URL de la route, ou `null` quand la requete n a pas de sens. */
export function placeQuery(box: PlaceBbox | null): string | null {
  if (!box || !isSane(box)) return null;
  const params = new URLSearchParams({
    min_lat: String(box.minLat),
    max_lat: String(box.maxLat),
    min_lng: String(box.minLng),
    max_lng: String(box.maxLng),
    limit: String(LIMIT),
  });
  return `${ENDPOINT}?${params.toString()}`;
}

/**
 * La reponse de la route, lue sans invention.
 *
 * Un point sans nom ou sans position ne peut ni figurer sur la carte, ni
 * recevoir une distance : il est ecarte. Ce qui reste est ce que la base
 * contient, tel quel.
 */
function identityKey(candidate: PlaceCandidate): string {
  const lat = Math.round(candidate.lat * 1e4) / 1e4;
  const lon = Math.round(candidate.lon * 1e4) / 1e4;
  return `${candidate.name}@${lat},${lon}`;
}

function richer(kept: PlaceCandidate, incoming: PlaceCandidate): PlaceCandidate {
  if (kept.pricePerNight !== null) return kept;
  if (incoming.pricePerNight === null) return kept;
  return { ...kept, pricePerNight: incoming.pricePerNight };
}

export function readPlaceResponse(payload: unknown): PlaceCandidate[] {
  if (!Array.isArray(payload)) return [];
  const byIdentity = new Map<string, PlaceCandidate>();
  for (const raw of payload) {
    const candidate = toCandidate(raw);
    if (!candidate) continue;
    const key = identityKey(candidate);
    const kept = byIdentity.get(key);
    byIdentity.set(key, kept ? richer(kept, candidate) : candidate);
  }
  return [...byIdentity.values()];
}

/**
 * Les lieux reels autour du trajet, ou `[]`.
 *
 * Une panne, un 500, un corps illisible : la liste est vide. Le moteur gardera
 * alors ses etapes sans position, et l ecran affichera « a verifier » plutot
 * qu un lieu invente.
 */
export async function searchPlacesNear(
  points: readonly { lat: number; lon: number }[],
  fetchImpl: Fetcher = fetch,
  signal?: AbortSignal,
): Promise<PlaceCandidate[]> {
  const query = placeQuery(bboxForTrip(points));
  if (!query) return [];
  let response: Response;
  try {
    response = await fetchImpl(query, { signal, headers: { Accept: 'application/json' } });
  } catch {
    return [];
  }
  if (!response.ok) return [];
  try {
    return readPlaceResponse((await response.json()) as unknown);
  } catch {
    return [];
  }
}

/**
 * Le resolveur de lieux, pret a etre passe a `runItineraryGeneration`.
 *
 * Il vit ici plutot que dans le composant pour deux raisons : il est
 * verifiable sans rendre React, et l'ecran n'a plus qu'a le brancher. Un
 * resolveur non branche ne casse aucune compilation - il rend seulement
 * l'ecran faux, en silence. Lui donner une adresse, c'est lui donner un test.
 *
 * On cherche dans la boite englobante du depart ET de l arrivee, elargie.
 * Sans l'un des deux, on cherche autour du seul lieu connu ; sans aucun, on
 * ne demande rien plutot que de faire deviner une region a la base.
 */
export function resolvePlacesFor(fetchImpl: Fetcher = fetch): PlaceResolver {
  return async (draft: AdventurePrepDraft, model: ItineraryModel, signal: AbortSignal) => {
    const anchors = [draft.route.origin, draft.route.destination]
      .filter((place) => place !== null)
      .map((place) => ({ lat: place.lat, lon: place.lon }));
    if (anchors.length === 0) return model;
    const candidates = await searchPlacesNear(anchors, fetchImpl, signal);
    if (candidates.length === 0) return model;
    return assignPlaces(model, candidates, draft.route.origin, draft.route.destination);
  };
}

// L inventaire lu par le PROPOSEUR, avant qu il redige quoi que ce soit.
//
// Meme source, meme dedoublonnage, meme boite que le resolveur : deux lectures
 // de `/api/pois` sur le meme trajet ne peuvent pas diverger, sinon le
// proposeur nommerait un lieu que `assignPlaces` ne retrouverait ensuite pas.
// La deduplication est faite ici, et non sur le `id` seul : `/api/pois` fusionne
// `outdoor_points`, `map_refuges` et `map_water_points`, qui se recouvrent, donc
// un meme refuge revient sous deux identifiants a la meme position.
export function loadPlaceInventoryFor(fetchImpl: Fetcher = fetch): PlaceInventoryLoader {
  return async (draft, signal) => {
    const anchors = [draft.route.origin, draft.route.destination]
      .filter((place) => place !== null)
      .map((place) => ({ lat: place.lat, lon: place.lon }));
    if (anchors.length === 0) return [];
    const candidates = await searchPlacesNear(anchors, fetchImpl, signal);
    const seen = new Set<string>();
    const inventory: PlaceInventory[] = [];
    for (const candidate of candidates) {
      const key = `${candidate.name.trim().toLowerCase()}|${candidate.lat.toFixed(4)}|${candidate.lon.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      inventory.push({ name: candidate.name, category: candidate.category });
    }
    return inventory;
  };
}

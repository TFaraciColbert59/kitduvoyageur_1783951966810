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

// Deuxieme source, ajoutee apres la premiere : `/api/pois` ne couvre que
// l outdoor (refuges, sommets, eau, cols, points de vue). Sur le corridor
// Chamonix Argentiere il rend 10 lieux uniques et ZERO repas, hebergement ou
// commerce, alors qu une journee en consomme un de chaque. La liste de base
// est donc trop courte pour trois jours, et le dernier jour se vide. Les
// amenites OSM replenissent ce spectre avec des lieux REELS.
const AMENITIES_ENDPOINT = '/api/amenities';

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
 * Les amenites, lues comme les lieux de base.
 *
 * Elles repassent par `toCandidate` : le meme garde-fou s applique donc
 * (nom obligatoire, position obligatoire, categorie valide) et le vocabulaire
 * reste celui de `places.ts`. Sans cela, `assignPlaces` ne reconnaitrait
 * aucune d entre elles et le gain serait nul.
 */
export function readAmenityResponse(payload: unknown): PlaceCandidate[] {
  const rows = (payload as { amenities?: unknown } | null)?.amenities;
  if (!Array.isArray(rows)) return [];
  const out: PlaceCandidate[] = [];
  for (const raw of rows) {
    const candidate = toCandidate(raw);
    if (candidate) out.push(candidate);
  }
  return out;
}

async function fetchJson(url: string, fetchImpl: Fetcher, signal?: AbortSignal): Promise<unknown> {
  try {
    const response = await fetchImpl(url, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

/**
 * Les points qui cadrent la recherche : depart et arrivee, quand ils sont connus.
 *
 * C est le seul calcul partage par les trois entrees — rechauffement,
 * inventaire, resolution. Le dupliquer trois fois finirait par divergir, et
 * le parcours chercherait alors ses lieux ailleurs que la ou on les avait demandes.
 */
export function anchorsOf(draft: AdventurePrepDraft): { lat: number; lon: number }[] {
  return [draft.route.origin, draft.route.destination]
    .filter((place): place is NonNullable<typeof place> => place !== null)
    .map((place) => ({ lat: place.lat, lon: place.lon }));
}

/**
 * La source de base seule : `/api/pois`, en quelques dizaines de ms.
 *
 * Elle est separee de `searchPlacesNear` pour une raison de LATENCE, pas de
 * gout. L inventaire lu par le proposeur doit etre sur l ecran avant l appel
 * au modele ; s il attendait Overpass (5 a 25 s), la redaction demarrerait
 * apres, et le recouvrement annonce par le rechauffement n existerait pas.
 */
export async function loadBasePlacesNear(
  points: readonly { lat: number; lon: number }[],
  fetchImpl: Fetcher = fetch,
  signal?: AbortSignal,
): Promise<PlaceCandidate[]> {
  const query = placeQuery(bboxForTrip(points));
  if (!query) return [];
  return fetchJson(query, fetchImpl, signal).then(readPlaceResponse);
}

/**
 * Les requetes d amenites, par boite, avec leur resultat.
 *
 * Overpass met 5 a 25 s. L attendre avant l appel au modele allongerait la
 * generation d autant. `warmAmenitiesFor` demarre donc la requete sans
 * l attendre, et le `searchPlacesNear` qui suit — plusieurs secondes plus tard,
 * une fois le modele repondu — vient consommer cette requete deja resolue au
 * lieu d en ouvrir une seconde.
 *
 * L entree est conservee `MEMO_TTL_MS` apres resolution : la fenetre utile
 * est la phase de redaction, pas toute la session. Sans ce delai, la promesse
 * disparaitrait a l instant ou elle devient justement reutilisable.
 */
const MEMO_TTL_MS = 120_000;
interface MemoEntry {
  readonly at: number;
  readonly promise: Promise<PlaceCandidate[]>;
}
const amenityMemo = new Map<string, MemoEntry>();

/** Reserve aux tests : vide le memo des amenites. */
export function __resetAmenityMemo(): void {
  amenityMemo.clear();
}

function memoAmenities(key: string, promise: Promise<PlaceCandidate[]>): Promise<PlaceCandidate[]> {
  amenityMemo.set(key, { at: Date.now(), promise });
  if (amenityMemo.size > 8) {
    const plusVieille = amenityMemo.keys().next();
    if (!plusVieille.done) amenityMemo.delete(plusVieille.value);
  }
  return promise;
}

function memoAmenitiesIfFresh(key: string): Promise<PlaceCandidate[]> | null {
  const hit = amenityMemo.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > MEMO_TTL_MS) {
    amenityMemo.delete(key);
    return null;
  }
  return hit.promise;
}

function boxKey(box: PlaceBbox): string {
  return `${box.minLat},${box.minLng},${box.maxLat},${box.maxLng}`;
}

function amenityQuery(box: PlaceBbox | null): string | null {
  if (!box || !isSane(box)) return null;
  const params = new URLSearchParams({
    min_lat: String(box.minLat),
    max_lat: String(box.maxLat),
    min_lng: String(box.minLng),
    max_lng: String(box.maxLng),
  });
  return `${AMENITIES_ENDPOINT}?${params.toString()}`;
}

/**
 * Demarre la lecture des amenites sans l attendre.
 *
 * A appeler juste AVANT l appel au modele : le cout se retrouve alors masque
 * par la redaction. La promesse resolue est reutilisee par le
 * `searchPlacesNear` de la phase des lieux.
 */
export function warmAmenitiesFor(
  points: readonly { lat: number; lon: number }[],
  fetchImpl: Fetcher = fetch,
  signal?: AbortSignal,
): Promise<PlaceCandidate[]> {
  const box = bboxForTrip(points);
  const query = amenityQuery(box);
  if (!query || !box) return Promise.resolve([]);

  const key = boxKey(box);
  const dejaEnCours = memoAmenitiesIfFresh(key);
  if (dejaEnCours) return dejaEnCours;

  return memoAmenities(
    key,
    fetchJson(query, fetchImpl, signal).then((payload) => readAmenityResponse(payload)),
  );
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
  const box = bboxForTrip(points);
  const query = placeQuery(box);
  if (!query) return [];

  // Les deux sources partent EN PARALLELE : `/api/pois` repond en quelques
  // dizaines de ms, Overpass met 5 a 25 s. Les attendre l une apres l autre
  // additionnerait les deux delais ; en parallele, seul le plus lent compte.
  const amenitiesQuery = amenityQuery(box);
  const dejaEnCours = box ? memoAmenitiesIfFresh(boxKey(box)) : null;

  const [lieux, amenites] = await Promise.all([
    fetchJson(query, fetchImpl, signal).then(readPlaceResponse),
    dejaEnCours ?? (amenitiesQuery ? fetchJson(amenitiesQuery, fetchImpl, signal).then(readAmenityResponse) : []),
  ]);

  // Une source muete ne doit jamais retirer ce que l autre a livre.
  return [...lieux, ...amenites];
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
    const anchors = anchorsOf(draft);
    if (anchors.length === 0) return model;
    const candidates = await searchPlacesNear(anchors, fetchImpl, signal);
    if (candidates.length === 0) return model;
    return assignPlaces(model, candidates, draft.route.origin, draft.route.destination);
  };
}

// L inventaire lu par le PROPOSEUR, avant qu il redige quoi que ce soit.
//
// Meme dedoublonnage et meme boite que le resolveur, mais sur la SOURCE DE BASE
// seule. Les amenites sont lues par le resolveur, qui a le temps d attendre.
 // de `/api/pois` sur le meme trajet ne peuvent pas diverger, sinon le
// proposeur nommerait un lieu que `assignPlaces` ne retrouverait ensuite pas.
// La deduplication est faite ici, et non sur le `id` seul : `/api/pois` fusionne
// `outdoor_points`, `map_refuges` et `map_water_points`, qui se recouvrent, donc
// un meme refuge revient sous deux identifiants a la meme position.
export function loadPlaceInventoryFor(fetchImpl: Fetcher = fetch): PlaceInventoryLoader {
  return async (draft, signal) => {
    const anchors = anchorsOf(draft);
    if (anchors.length === 0) return [];
    const candidates = await loadBasePlacesNear(anchors, fetchImpl, signal);
    const seen = new Set<string>();
    const inventory: PlaceInventory[] = [];
    for (const candidate of candidates) {
      const key = `${candidate.name.trim().toLowerCase()}|${candidate.lat.toFixed(4)}|${candidate.lon.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      inventory.push({
        name: candidate.name,
        category: candidate.category,
        lat: candidate.lat,
        lon: candidate.lon,
      });
    }
    return inventory;
  };
}

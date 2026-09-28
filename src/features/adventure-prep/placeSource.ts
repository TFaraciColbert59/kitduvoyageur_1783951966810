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

import { assignPlaces, matchNamedPlace, normalizePlaceName, toCandidate, type PlaceCandidate, type PlaceInventory } from './engine/places';
import { geocodeCandidateFor, type GeocodeMatch } from './engine/placeGeocode';
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

// La marchabilite se mesure sur le reseau de PIETON, toujours : c est le seul qui
// dit si un lieu est atteignable sans voiture. Le mode du trajet ne suffit pas,
// on peut chercher des lieux autour d un trajet en voiture.
const ROUTE_ENDPOINT = '/api/route';
const GEOCODE_ENDPOINT = '/api/geocode';

/**
 * Combien de lieux on verifie par lot. Au-dela, on ne demande pas plus : on
 * ne veut pas inonder un service gratuit, ni retarder la generation de
 * plusieurs minutes sur un itineraire de dix jours.
 */
const WALK_CHECK_BATCH = 24;

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
/**
 * Ce qu une sonde `/api/route` permet reellement d affirmer sur un lieu.
 *
 * `mesuree` : le fournisseur a repondu, et sa trace existe.
 * `hors_reseau` : le fournisseur a repondu, et sa trace n arrive pas au lieu.
 * `inconnue` : le fournisseur n a rien dit d exploitable.
 *
 * Ces trois etats etaient condenses en un seul booleen. C est ce losange, et
 * lui seul, qui a fait naitre P0.25 : un sommet et un hotel etaient tous deux
 * `provider_unavailable`, donc tous deux « joignables », donc tous deux
 * acceptes comme position mesuree.
 */
export type WalkReachability = 'mesuree' | 'hors_reseau' | 'inconnue';

/**
 * Duree pendant laquelle une panne de fournisseur est tenue pour acquise.
 *
 * Mesure le 2026-09-28 : 36 sondes a 8 s de timeout = 64,8 s cumules pour un
 * resultat qui ne peut pas changer. La panne est donc retenue, mais pas
 * eternalement : au-dela de cette fenetre on reprobe, parce qu un cache sans
 * expiration servirait une panne de mars pendant des mois.
 */
export const PAUSE_FOURNISSEUR_MS = 30_000;

let fournisseurTombeJusqua = 0;

/** Reserve aux tests : oublie la panne memorisee. */
export function __resetWalkabilityMemo(): void {
  fournisseurTombeJusqua = 0;
}

/**
 * Un lieu est-il ATTEIGNABLE a pied depuis l ancre du trajet ?
 *
 * On ne le devine pas. `/api/route` en mode `pieton` applique le meme
 * garde-fou d arrivee que tout le reste : si la trace ne finit pas au lieu
 * demande, le serveur repond 503 `off_network`. C est une MESURE, et la
 * seule qui autorise a ecarter un lieu.
 *
 * `provider_unavailable` et les erreurs reseau, eux, ne disent RIEN du lieu.
 * La reponse est donc `inconnue`, et c est aux deux appelants de trancher :
 * l inventaire garde le nom, la position, non. Voir `keepWalkableFrom` et
 * `keepMeasuredFrom`.
 */
async function reachabilityFrom(
  anchor: { lat: number; lon: number },
  candidate: PlaceCandidate,
  fetchImpl: Fetcher,
  signal?: AbortSignal,
): Promise<WalkReachability> {
  // Une panne deja vue ne se reprobe pas : c est la difference entre 8 s et
  // 64,8 s d attente sur le meme ecran.
  if (Date.now() < fournisseurTombeJusqua) return 'inconnue';
  try {
    const params = new URLSearchParams({
      points: `${round4(candidate.lon)},${round4(candidate.lat)};${round4(anchor.lon)},${round4(anchor.lat)}`,
      mode: 'pieton',
    });
    const response = await fetchImpl(`${ROUTE_ENDPOINT}?${params.toString()}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (response.ok) return 'mesuree';
    if (response.status !== 503) return 'inconnue';
    const body = (await response.json()) as { reason?: unknown } | null;
    if (body?.reason === 'off_network') return 'hors_reseau';
    // Le fournisseur a repondu « je ne sais pas ». C est le SEUL cas ou la
    // panne est retenue : un 500 ou une erreur reseau ne prouve rien sur
    // l etat du service, seulement sur cette requete.
    fournisseurTombeJusqua = Date.now() + PAUSE_FOURNISSEUR_MS;
    return 'inconnue';
  } catch {
    return 'inconnue';
  }
}

/** Les verdicts, par lots, dans l ordre des candidats. */
async function probeReachability(
  anchor: { lat: number; lon: number },
  candidates: readonly PlaceCandidate[],
  fetchImpl: Fetcher,
  signal?: AbortSignal,
): Promise<{ candidate: PlaceCandidate; reachability: WalkReachability }[]> {
  const verdicts: { candidate: PlaceCandidate; reachability: WalkReachability }[] = [];
  for (let index = 0; index < candidates.length; index += WALK_CHECK_BATCH) {
    const lot = candidates.slice(index, index + WALK_CHECK_BATCH);
    verdicts.push(
      ...(await Promise.all(
        lot.map(async (candidate) => ({
          candidate,
          reachability: await reachabilityFrom(anchor, candidate, fetchImpl, signal),
        })),
      )),
    );
  }
  return verdicts;
}

/**
 * Ne garde que les lieux que l on peut JOINRE A PIED, mesure.
 *
 * Par LOTS de 24, et tous les lots d un coup : la latence ajoutee est celle
 * du lot le plus lent, pas la somme de chaque appel. Sans le plafond, une
 * region qui rend 300 points inonderait un service gratuit.
 *
 * La liste garde son ordre d origine : le filtre ne fait que retirer.
 *
 * ECHEC OUVERT, et c est deliberé : c est le filtre de l INVENTAIRE lu par le
 * proposeur. Une panne de Valhalla ne doit pas effacer les noms, sinon le
 * proposeur ecrirait une journee a l aveugle. Un `inconnue` reste donc here.
 */
export async function keepWalkableFrom(
  anchor: { lat: number; lon: number },
  candidates: readonly PlaceCandidate[],
  fetchImpl: Fetcher = fetch,
  signal?: AbortSignal,
): Promise<PlaceCandidate[]> {
  const verdicts = await probeReachability(anchor, candidates, fetchImpl, signal);
  return verdicts.filter((v) => v.reachability !== 'hors_reseau').map((v) => v.candidate);
}

/**
 * Ne garde que les lieux dont la marche est REELLEMENT MESUREE.
 *
 * C est le filtre de la POSITION, celui qui alimente `assignPlaces`. La
 * distinction avec `keepWalkableFrom` est le correctif de P0.25 :
 *
 * · l INVENTAIRE peut echouer ouvert — un nom non verifie est un nom, rien
 *   de plus, et il ne produit aucune distance affichee ;
 * · la POSITION, elle, ne peut pas echouer ouvert. Un lieu non mesure ne
 *   recoit AUCUNE coordonnee, sinon l ecran affiche une distance « reelle »
 *   vers un sommet que personne ne peut rejoindre a pied. Dans ce cas la
 *   journee reste honnete : les etapes sans position affichent « a verifier ».
 *
 * C est aussi ce qui rend la panne visible au lieu de la maquiller : zero
 * lieu mesure, donc zero distance inventee.
 */
export async function keepMeasuredFrom(
  anchor: { lat: number; lon: number },
  candidates: readonly PlaceCandidate[],
  fetchImpl: Fetcher = fetch,
  signal?: AbortSignal,
): Promise<PlaceCandidate[]> {
  const verdicts = await probeReachability(anchor, candidates, fetchImpl, signal);
  return verdicts.filter((v) => v.reachability === 'mesuree').map((v) => v.candidate);
}

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
 *
 * LE FILTRE DE MARCHABILITE S Y APPLIQUE AUSSI, et c est indispensable :
 * c est CET inventaire que le modele lit. Sans le filtre, le modele voit Mont
 * Blanc et l Aiguille du Midi, il les ecrit dans la journee, et le garde-fou
 * d arrivee les refuse ensuite. Filtrer apres la redaction serait trop tard :
 * le modele aurait deja ecrit.
 */
export async function loadBasePlacesNear(
  points: readonly { lat: number; lon: number }[],
  fetchImpl: Fetcher = fetch,
  signal?: AbortSignal,
): Promise<PlaceCandidate[]> {
  const query = placeQuery(bboxForTrip(points));
  if (!query) return [];
  const anchor = points[0];
  const candidats = await fetchJson(query, fetchImpl, signal).then(readPlaceResponse);
  if (!anchor || candidats.length === 0) return candidats;
  return keepWalkableFrom(anchor, candidats, fetchImpl, signal);
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
  const tous = [...lieux, ...amenites];

  // Puis on ne garde que ce qu on peut rejoindre a pied, MESURE. Sur le
  // corridor de Chamonix, l inventaire est presque entierement compose de
  // sommets et de refuges a plus de 3 000 m : hors reseau pieton, ils sont
  // inatteignables, et le parcours proposait donc des etapes que personne ne
  // pouvait rejoindre. Chaque etape tombait en « a verifier ».
  const anchor = points[0];
  if (!anchor || tous.length === 0) return tous;
  return keepMeasuredFrom(anchor, tous, fetchImpl, signal);
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
/**
 * Les noms de lieu que l'inventaire local ne sait pas placer.
 *
 * Seul `placeName` est retenu, jamais `title` : un titre est de la prose
 * (« Depart vers le refuge ») et la faire geocoder produirait un lieu qui
 * n existe pas. Un nom cite, lui, est une intention de lieu, et c est
 * exactement ce que le geocodeur sait placer.
 */
function missingPlaceNames(
  model: ItineraryModel,
  candidates: readonly PlaceCandidate[],
): string[] {
  const manquants: string[] = [];
  const vus = new Set<string>();
  for (const step of model.steps) {
    const cite = step.placeName;
    if (cite === null || cite.trim() === '') continue;
    const cle = normalizePlaceName(cite);
    if (vus.has(cle)) continue;
    if (matchNamedPlace(candidates, cite) !== null) continue;
    vus.add(cle);
    manquants.push(cite);
  }
  return manquants;
}

/** La premiere correspondance du geocodeur, lue sans invention. */
function readGeocodeMatch(payload: unknown): GeocodeMatch | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const body = payload as { status?: unknown; matches?: unknown };
  if (body.status !== 'ok' || !Array.isArray(body.matches)) return null;
  for (const raw of body.matches) {
    if (typeof raw !== 'object' || raw === null) continue;
    const m = raw as {
      id?: unknown; name?: unknown; lat?: unknown; lon?: unknown;
      country?: unknown; precision?: unknown;
    };
    const name = typeof m.name === 'string' ? m.name.trim() : '';
    const lat = typeof m.lat === 'number' ? m.lat : Number.NaN;
    const lon = typeof m.lon === 'number' ? m.lon : Number.NaN;
    if (name === '' || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    return {
      id: typeof m.id === 'string' && m.id !== '' ? m.id : `geo-${cleDeNom(name)}`,
      name,
      lat,
      lon,
      country: typeof m.country === 'string' ? m.country : null,
      precision: typeof m.precision === 'string' ? m.precision : null,
    };
  }
  return null;
}

function cleDeNom(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Au-dela, on cesse de/geocoder : chaque appel est une requete de service
 * gratuit, et un programme de dix etapes ne doit pas en用户的化领 dix fois le
 * meme toponyme. Le refus est preferable a une attente qui n arrive pas.
 */
const GEOCODE_MAX_APPELS = 6;

/**
 * Les candidats que le geocodeur autorise pour ces noms, ou `[]`.
 *
 * Echec ouvert, comme le reste du module : une panne, un 500, un corps
 * illisible rendent une liste vide. Le modele garde alors ses etapes sans
 * position et l ecran affiche « a verifier » - jamais un lieu invente.
 */
async function geocodeCandidates(
  names: readonly string[],
  anchor: { lat: number; lon: number },
  fetchImpl: Fetcher,
  signal?: AbortSignal,
): Promise<PlaceCandidate[]> {
  const cibles = names.slice(0, GEOCODE_MAX_APPELS);
  const resultats = await Promise.all(
    cibles.map(async (name) => {
      const params = new URLSearchParams({ q: name });
      const payload = await fetchJson(`${GEOCODE_ENDPOINT}?${params.toString()}`, fetchImpl, signal);
      if (payload === null) return null;
      return geocodeCandidateFor(name, readGeocodeMatch(payload), anchor);
    }),
  );
  return resultats.filter((candidat): candidat is PlaceCandidate => candidat !== null);
}
export function resolvePlacesFor(fetchImpl: Fetcher = fetch): PlaceResolver {
  return async (draft: AdventurePrepDraft, model: ItineraryModel, signal: AbortSignal) => {
    const anchors = anchorsOf(draft);
    if (anchors.length === 0) return model;
    const base = await searchPlacesNear(anchors, fetchImpl, signal);
    // Les noms que le depot ne sait pas placer sont demandes au geocodeur. La
    // garde de distance vit dans geocodeCandidateFor : un sommet mal place
    // a 45 km est refuse la, donc il ne peut pas finir sur la carte.
    const geocodes = await geocodeCandidates(
      missingPlaceNames(model, base),
      anchors[0],
      fetchImpl,
      signal,
    );
    const candidates = [...base, ...geocodes];
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

/**
 * Service de routage cote serveur — le point de controle avant les routeurs.
 *
 * Deux fournisseurs, tous deux autorises pour un usage commercial (plan 1.5,
 * conditions verifiees le 8 octobre, `docs/compas/SERVICES-GRATUITS.md`) :
 *   - Geoapify Routing (cle `GEOAPIFY_API_KEY`, offre gratuite) : le premier ;
 *   - Valhalla FOSSGIS `valhalla1.openstreetmap.de` (sans cle, identifie par
 *     `X-Client-Id`) : le repli sur panne, credits epuises ou cle absente.
 *   - (altitudes : servies par /api/elevation, relief libre Terrain Tiles)
 *
 * Retires le 8 octobre : le serveur de demonstration d'OSRM (« non-commercial
 * use-cases »), `routing.openstreetmap.de` et `brouter.de` (aucune condition
 * d'usage publiee). Leurs mesures deja en cache restent lisibles, avec leur
 * vrai nom de source.
 *
 * Regle unique, identique a celle du geocodage : une reponse malformee, trop
 * courte ou incoherente vaut `null`. Aucune distance approchee ne se glisse
 * a la place d'une mesure : l'estimation, quand il en faut une, se fait chez
 * l'appelant et se dit estimation.
 */

import { haversineKm } from './engine/routing';
import { TRAVEL_MODES } from './engine/routing';
import type { RouteLeg, TravelMode } from './engine/routing';
import type { RouteProvider } from './engine/provenance';
import { rateLimit, type RateLimitResult } from '@/lib/rate-limit';

/**
 * Geoapify Routing : un appel pour tout le trajet, un troncon par paire de
 * points (`legs`), une ligne par troncon (`MultiLineString`). Le mode de
 * Geoapify qui correspond a chacun des notres : `hike` suit les sentiers (et
 * pas seulement la voirie pietonne), `bicycle` le reseau cyclable, `drive` la
 * route.
 */
const GEOAPIFY_ROUTING_URL = 'https://api.geoapify.com/v1/routing';

export const GEOAPIFY_MODE: Readonly<Record<TravelMode, string>> = {
  pieton: 'hike',
  velo: 'bicycle',
  voiture: 'drive',
};

/**
 * Budget du site pour le routage Geoapify, par jour.
 *
 * L'offre gratuite donne 3 000 credits par jour pour TOUT Geoapify (lieux,
 * geocodage, routage), et `/api/route` est public : sans plafond, une seule
 * personne pourrait vider les credits du jour et priver le Compas de ses lieux.
 * Le routage en prend donc au plus la moitie ; au-dela, Valhalla repond.
 * Compteur partage en base (toutes les instances Vercel), ouvert en cas de
 * panne du compteur : Geoapify refuse alors lui-meme (429) et Valhalla prend
 * le relais.
 */
export const GEOAPIFY_ROUTING_DAILY_BUDGET = 1500;

const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';

/**
 * L'identification demandee par FOSSGIS pour son Valhalla public : un
 * `X-Client-Id` qui nomme l'application, et un User-Agent joignable.
 */
const CLIENT_ID = 'koosmoweb.fr';
const USER_AGENT = 'kitduvoyageur/1.0 (Compas, preparation de voyage; koosmoweb.fr)';

/**
 * Tolerance d'accrochage, en metres.
 *
 * Valhalla accroche une demande sur le point du graphe le plus proche. Quand
 * la demande est hors reseau - un refuge a 3 817 m, qu'on ne peut pas atteindre
 * a pied - le trace se termine des kilometres plus loin, et sa distance ne
 * mene nulle part. Publier « 8,275 km / 2 h 07 » pretendrait avoir marche
 * jusqu'au refuge.
 *
 * Ecarts d'arrivee MESURES sur `valhalla1.openstreetmap.de` (28-09, Chamonix) :
 *     Les Houches       12 m   accepte
 *     Servoz            16 m   accepte
 *     Argentiere     1 862 m   refuse
 *     Vallorcine      2 728 m   refuse
 *     refuge du Gouter 4 321 m  refuse
 *
 * Passer de 16 m a 1 862 m n'est pas une imprecision de mesure : c'est un autre
 * lieu. 500 m garde la marge de l'accrochage normal sans jamais laisser passer
 * un trace qui ne va pas au lieu demande.
 */
export const ARRIVAL_TOLERANCE_M = 500;

/**
 * Le vocabulaire exact du produit, strictement verifie.
 *
 * Un mode inconnu doit etre refuse, jamais remplace par un defaut : c'est
 * precisement le defaut silencieux qui affichait des kilometres de voiture
 * pour une randonnee.
 */
export function isTravelMode(value: unknown): value is TravelMode {
  return typeof value === 'string' && (TRAVEL_MODES as readonly string[]).includes(value);
}

/** Le `costing` de chaque mode chez Valhalla. Noms exacts de son API. */
export const VALHALLA_COSTING: Readonly<Record<TravelMode, string>> = {
  pieton: 'pedestrian',
  velo: 'bicycle',
  voiture: 'auto',
};

/** Au-dela, les routeurs refusent la requete : on refuse aussi, proprement. */
export const MAX_ROUTE_POINTS = 12;

const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60 * 60 * 1000;
/** La Route Handler qui relaie le cache persistant. Le SEUL pont vers la base. */
const CACHE_ROUTE = '/api/route/cache';
const CACHE_MAX = 200;

const cache = new Map<string, { at: number; value: unknown }>();

/** Reserve aux tests : vide le cache en memoire. */
export function __resetRouteCache(): void {
  cache.clear();
}

/**
 * Le cache MEMOIRE, seul, ne survit pas a un redeploiement.
 *
 * Mesure du 29/09/2026 : `new Map`, TTL 1 h, max 200 — donc tout disparait au
 * redemarrage. Consequence mesuree : a chaque deploiement toutes les distances
 * doivent etre RE-MESUREES. C est lent, couteux en appels vers des services
 * publics sans cle, et un « Reessayer » sur une etape deja connue repart de
 * zero alors que la mesure existe deja.
 *
 * La base prend donc le relais du `Map`, avec le meme contrat :
 *   - CLE = les parametres de route (mode + points + profil), jamais la
 *     reponse : deux demandes identiques tombent sur la meme entree.
 *   - VALEUR = la reponse MESUREE + son `provider` + `expires_at`.
 *
 * Le `provider` est stocke AVEC la reponse, et c est deliberé : c est la base
 * de H5, le credit de la source de la donnee. Le perdre au redemarrage serait
 * une regression de tracabilite — exactement ce que le `Map` faisait deja.
 *
 * DEGRADE, JAMAIS CASSANT. Si la base est injoignable, absente ou configuree
 * sans cle, ce service doit continuer a repondre exactement comme avant. Un
 * cache est une ACCELERATION, jamais une dependance fonctionnelle : le faire
 * tomber ferait perdre des mesures, ce qui est le seul echec que ce module
 * n a pas le droit de produire.
 */

/**
 * Ou poser la lecture du cache persistant.
 *
 * La base ne se touche QUE par `POST/GET /api/route/cache`, une Route Handler
 * — jamais par un import. Raison, MESUREE le 29/09/2026 : ce module est
 * PARTAGE, `/api/route` (serveur) et `browserMeasurements` ('use client') l
 * importent tous les deux. La base se touche par `lib/ai/serviceClient.ts`,
 * qui commence par `import 'server-only'` : l inclure dans ce graphe fait
 * tomber TOUTES les routes en 500 (`ModuleBuildError` sur `/`, `/hub`,
 * `/prepare`).
 *
 * Un `import()` PARSEUX ne sauve rien. C est le piege : webpack resout un
 * litteral de chaine dans le graphe STATIQUE, donc `serviceClient` y entrait
 * quand meme et le 500 revenait. Il n existe aucun import, meme dynamique,
 * qui sorte un module `server-only` d un bundle client. D ou la Route Handler.
 *
 * Le point d arrivee, lui, se choisit a l appel :
 *   - le NAVIGATEUR donne une URL relative, resolue par le navigateur ;
 *   - le SERVEUR doit donner une URL ABSOLUE, car `fetch('/api/…')` y est une
 *     URL invalide. `/api/route` la tire de la requete (`request.nextUrl.origin`),
 *     donc elle est toujours juste, y compris en local et en apercu.
 *
 * Sans point d arrivee, on ne fait rien : repli memoire, jamais une erreur.
 */
function cacheEndpoint(cacheBaseUrl?: string): string | null {
  if (cacheBaseUrl) return new URL(CACHE_ROUTE, cacheBaseUrl).toString();
  if (typeof window !== 'undefined') return CACHE_ROUTE;
  return null;
}

/**
 * La reponse relue de la base, ou `undefined` — jamais un `legs: null`.
 *
 * Ce filtre n est pas une defense cosmétique, c est la garantie centrale de
 * I4 : une entree en ERREUR ne doit JAMAIS etre servie depuis le cache. Une
 * panne de cinq minutes serait sinon republiée comme une MESURE pendant toute
 * la duree du TTL. Le contrat est donc verifie ici, a la lecture, et pas
 * seulement a l'ecriture.
 *
 * Il s'applique a TOUTE source, y compris une entree plantee a la main en
 * base : c est ici, cote service, que la garantie est tenue, pas dans le SQL
 * ni dans la Route Handler.
 */
function decodeStoredRoute(stored: unknown): RouteAttempt | undefined {
  if (!stored || typeof stored !== 'object') return undefined;
  const candidate = stored as {
    legs?: unknown;
    reason?: unknown;
    provider?: unknown;
  };
  // `legs` DOIT etre un tableau non vide : une trace mesuree a au moins un
  // troncon. Ni `null`, ni absent, ni vide ne sont des mesures.
  if (!Array.isArray(candidate.legs) || candidate.legs.length === 0) return undefined;
  // `osrm` et `brouter` ne sont plus interroges, mais une mesure deja en
  // cache garde le nom du moteur qui l'a faite.
  const provider =
    candidate.provider === 'geoapify' ||
    candidate.provider === 'valhalla' ||
    candidate.provider === 'osrm' ||
    candidate.provider === 'brouter'
      ? candidate.provider
      : undefined;
  return {
    legs: candidate.legs as RouteLeg[],
    // Une entree reussie porte toujours `reason: null`. On le Reinstalle
    // plutot que de lire la colonne : la mesure est vraie, son echec ne l est
    // pas, et un `reason` incoherent la trahirait en aval.
    reason: null,
    ...(provider ? { provider } : {}),
  };
}

/**
 * La LECTURE du cache persistant, ou `undefined`.
 *
 * Un 404 est un MISS, pas une panne : la cle n existe pas encore, on mesure.
 * Toute autre reponse — 503, 500, reseau coupe, corps illisible — est une
 * panne, et se replie sans bruit sur le `Map`.
 */
async function readRouteCacheRemote(
  endpoint: string,
  key: string,
  signature?: string,
): Promise<RouteAttempt | undefined> {
  try {
    // Signée par le serveur : la route ne la compte pas sur l'adresse de sortie
    // de Vercel, commune à tous les voyageurs (sinon 300/min pour tout le site).
    const reponse = await fetch(`${endpoint}?key=${encodeURIComponent(key)}`, {
      headers: signature
        ? { accept: 'application/json', 'x-route-cache-signature': signature }
        : { accept: 'application/json' },
    });
    if (reponse.status === 404) return undefined;
    if (!reponse.ok) {
      console.warn('[routing] cache base indisponible (repli memoire) :', reponse.status);
      return undefined;
    }
    const corps = (await reponse.json()) as { status?: unknown; payload?: unknown };
    return decodeStoredRoute(corps?.payload);
  } catch (err) {
    console.warn(
      '[routing] lecture du cache base impossible (repli memoire) :',
      err instanceof Error ? err.message : err,
    );
    return undefined;
  }
}

/**
 * L'ECRITURE, attendue.
 *
 * En runtime serverless la fonction peut etre gelee des que la reponse est
 * renvoyee, et une ecriture non attendue n'arrive jamais au disque. Le cout
 * est nul en pratique : une ecriture par MESURE NOUVELLE, donc deja bornee
 * par le limiteur de debit.
 *
 * L'echec reste SANS CONSEQUENCE : la reponse existe, elle est vraie, elle
 * vient d etre mesuree. Seul l acceleration future est perdue.
 */
async function writeRouteCacheRemote(
  endpoint: string,
  key: string,
  mode: TravelMode,
  value: RouteAttempt,
  signature: string,
): Promise<void> {
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-route-cache-signature': signature },
      body: JSON.stringify({
        key,
        mode,
        provider: value.provider ?? null,
        legs: value.legs,
      }),
    });
  } catch (err) {
    console.warn(
      '[routing] ecriture du cache base impossible (repli memoire) :',
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * La reponse connue, d ou qu elle vienne — et DANS QUEL ORDRE.
 *
 * L ordre est le contrat, pas un detail :
 *
 *   1. le `Map` d'abord. Il est synchrone, gratuit, et c est lui qui absorbe
 *      la regeneneration d un itineraire qu on ajuste en boucle.
 *   2. la base ENSUITE : une entree trouvee est rappelee dans le `Map` pour que
 *      les appels suivants redemarrent au point 1.
 *
 * La base est donc interrogee AVANT le reseau, jamais apres : une reponse deja
 * connue ne coute toujours rien, et le limiteur de debit ne voit que les
 * vraies mesures manquantes.
 *
 * Sans point d arrivee — pas de navigateur, pas d URL d origine fournie — on ne
 * consulte que la memoire. C est le comportement d avant I4, jamais une panne.
 */
async function readRouteCache(
  endpoint: string | null,
  key: string,
  sign?: (key: string) => string,
): Promise<RouteAttempt | undefined> {
  const memoire = readCache(key) as RouteAttempt | undefined;
  if (memoire !== undefined) return memoire;
  if (endpoint === null) return undefined;

  const persistee = await readRouteCacheRemote(endpoint, key, sign?.(key) || undefined);
  if (persistee !== undefined) {
    // On la remet en memoire : le prochain appel ne paie meme plus le
    // aller-retour vers la base.
    writeCache(key, persistee);
  }
  return persistee;
}

/**
 * La trace, avec son `provider`, cote memoire ET cote base.
 *
 * L'ECRITURE en base est ATTENDUE, et c est un choix, pas une coincidence.
 *
 * fire-and-forget parait naturel — la reponse est deja mesuree, on n attend
 * rien pour la servir — et c est FAUX ici. En runtime serverless, la fonction
 * peut etre gelee des que la reponse est renvoyee : une ecriture non attendue
 * n arrive jamais au disque. Le cache perdrait alors sa raison d etre, et
 * surtout on ne le SAURAIT pas : le service fonctionnerait, les tests
 * passeraient, et la persistance disparaitrait a la premiere vague de
 * redemarrages. C est exactement le defaut qu I4 vient corriger.
 *
 * Le cout est nul en pratique : une seule ecriture par MESURE NOUVELLE, donc
 * deja bornee par le limiteur de debit, face a une requete dont le delai
 * admissible est de plusieurs secondes.
 *
 * L'echec d'ecriture reste SANS CONSEQUENCE : la reponse existe, elle est
 * vraie, elle vient d etre mesuree. Seul l acceleration future est perdue.
 */
async function writeRouteCache(
  endpoint: string | null,
  key: string,
  mode: TravelMode,
  value: RouteAttempt,
  sign?: (key: string) => string,
): Promise<void> {
  writeCache(key, value);
  // Seul le serveur, qui vient de mesurer, écrit en base : la route refuse une
  // écriture non signée (audit du 8 octobre : écriture ouverte à tous). Le
  // navigateur garde sa mesure en mémoire et lit toujours la base.
  if (endpoint === null || !sign) return;
  const signature = sign(key);
  if (!signature) return;
  await writeRouteCacheRemote(endpoint, key, mode, value, signature);
}

function readCache(key: string): unknown {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function writeCache(key: string, value: unknown): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { at: Date.now(), value });
}
/* ------------------------------------------------------------------ */
/* Limite de debit                                                    */
/* ------------------------------------------------------------------ */

/**
 * `MAX_ROUTE_POINTS = 12` borne la TAILLE d une requete. Rien ne bornait le
 * NOMBRE de requetes, et c est la le vrai risque : Valhalla est un service
 * public partage avec tous les autres, et les credits Geoapify sont comptes
 * (voir aussi `GEOAPIFY_ROUTING_DAILY_BUDGET`, partage par le site). Une journee
 * de N etapes, regeneree apres chaque ajustement, peut faire partir des
 * dizaines d appels en quelques secondes et epuiser un quota qui n est pas le
 * notre. Le symptome n est pas une donnee fausse : c est une panne, et une panne
 * se propage en `a_verifier` - donc l utilisateur voit ses distances disparaitre.
 *
 * D ou vient ce debit, et pourquoi ces deux nombres.
 *
 * La taille n est pas un quota mesure - aucun fournisseur publie de plafond
 * exploitable - mais une borne de BON SENS, dimensionnee sur ce que le produit
 * fait reellement. Un sejour de sept jours compte huit segments par jour, soit
 * environ 56 troncons ; deux regenerations successives pourComparer ou
 * ajuster, plus les retries de chaque phase, donnent une pointe de l ordre de
 * 120. En dessous, un utilisateur voit ses distances DISPARAITRE alors que rien
 * ne le justifie : le limiteur prot gerait le service public, il ne doit
 * jamais servir d excuse pour perdre une mesure.
 *
 *   - `RATE_BURST = 120` : deux itineraires complets a regenerer d un trait.
 *   - `RATE_REFILL_PER_SEC = 20` : de quoi soutenir une rafale de regeneration
 *     apres un long inactivite, sans jamais autoriser une boucle serree.
 *
 * Au-dela de 120 appels sans recharge, le refus est LOCAL et nomme
 * (`rate_limited`) : il se distingue donc d une panne de fournisseur, qui se
 * propage en `provider_unavailable`. Un depassement se voit, il ne se confon
 * d pas avec un itineraire impossible.
 *
 * Un seau a jetons, et non une fenetre glissante : il plafonne le debit MOYEN
 * sans interdire un elan bref et legitime. Une fenetre aurait refuse une salve
 * courte alors qu elle est parfaitement normale.
 */
export const RATE_BURST = 120;
export const RATE_REFILL_PER_SEC = 20;

let rateJetsons = RATE_BURST;
let rateDernier = Date.now();

/** Reserve aux tests : rend le plein budget. */
export function __resetRouteLimiter(): void {
  rateJetsons = RATE_BURST;
  rateDernier = Date.now();
}

/**
 * Un jeton, ou rien.
 *
 * Le temps qui s ecoule remet des jetons ; le gaspillage n en remet pas. Le
 * refill est borne a la capacite pour qu une longue inactivite ne stocke pas un
 * credit que personne ne pourra depenser ensuite.
 */
function consumeRateToken(): boolean {
  const maintenant = Date.now();
  const ecoule = Math.max(0, maintenant - rateDernier);
  rateDernier = maintenant;
  if (ecoule > 0) {
    rateJetsons = Math.min(RATE_BURST, rateJetsons + (ecoule / 1000) * RATE_REFILL_PER_SEC);
  }
  if (rateJetsons < 1) return false;
  rateJetsons -= 1;
  return true;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Le corps JSON, meme quand le statut HTTP est mauvais.
 *
 * `if (!response.ok) return null` jetterait avec le statut le corps qui dit
 * pourquoi : c'est lui qui distingue un fait mesure d'une panne. Une page
 * d'erreur HTML — un 502 de nginx — n'est pas du JSON : `null`, ce qui reste
 * une panne. Rien n'est invente.
 */
async function fetchJson(
  url: string,
  signal: AbortSignal,
  headers: Record<string, string> = {},
): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      signal,
      cache: 'no-store',
      headers: { Accept: 'application/json', ...headers },
    });
    const raw = await response.text();
    if (raw.length === 0) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Normalisation pure                                                  */
/* ------------------------------------------------------------------ */

type Pair = readonly [number, number];

function readPair(value: unknown): Pair | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = finite(value[0]);
  const lat = finite(value[1]);
  if (lon === null || lat === null) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return [lon, lat] as const;
}

function readGeometry(value: unknown): Pair[] | null {
  const raw = (value as { coordinates?: unknown } | null)?.coordinates;
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const out: Pair[] = [];
  for (const entry of raw) {
    const pair = readPair(entry);
    if (!pair) return null;
    out.push(pair);
  }
  return out;
}

/**
 * Un varint de polyligne : 5 bits utiles par octet, bit haut a 0x20 pour
 * dire « il en reste ». `null` des qu'un octet n'est pas un caractere
 * d'encodage ou que la valeur deborde : mieux vaut aucun point qu'un point
 * invente.
 */
function readVarint(shape: string, start: number): { value: number; next: number } | null {
  let value = 0;
  let shift = 0;
  let index = start;
  while (index < shape.length) {
    const byte = shape.charCodeAt(index) - 63;
    if (byte < 0) return null;
    value |= (byte & 0x1f) << shift;
    shift += 5;
    index += 1;
    if (byte < 0x20) return { value, next: index };
    if (shift > 30) return null;
  }
  return null;
}

/**
 * Decode la polyligne Valhalla en points `[lon, lat]`.
 *
 * Encodage PROPRE a Valhalla : un varint par composante, signe porte par le
 * bit de poids faible, SANS la graine `+ 1` de l'algorithme Google. C'est
 * exactement cette difference qui inversait les latitudes dans un premier
 * essai. Precision 6 decimales.
 */
export function decodeValhallaShape(shape: unknown): Pair[] {
  if (typeof shape !== 'string' || shape.length === 0) return [];
  const out: Pair[] = [];
  let lat = 0;
  let lon = 0;
  let index = 0;
  while (index < shape.length) {
    const first = readVarint(shape, index);
    if (!first) return [];
    lat += first.value & 1 ? ~(first.value >> 1) : first.value >> 1;
    const second = readVarint(shape, first.next);
    if (!second) return [];
    lon += second.value & 1 ? ~(second.value >> 1) : second.value >> 1;
    index = second.next;
    const point: Pair = [round6(lon / 1e6), round6(lat / 1e6)];
    if (point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90) return [];
    out.push(point);
  }
  return out;
}

/** L extremite du trace est-elle bien le lieu demande ? */
function reaches(
  point: readonly [number, number],
  target: { readonly lat: number; readonly lon: number },
): boolean {
  const gapKm = haversineKm({ lat: point[1], lon: point[0] }, target);
  return gapKm * 1000 <= ARRIVAL_TOLERANCE_M;
}

/**
 * La reponse Valhalla, lue sans invention.
 *
 * Exigences, toutes issues de reponses REELLES :
 *   - `trip.status` a 0 ; sinon aucun trace n'existe, et un zero mentirait ;
 *   - un troncon par paire de points consecutive, donc `n - 1` ;
 *   - chaque extremite de trace a moins de `ARRIVAL_TOLERANCE_M` du lieu
 *     demande. C'est ce garde-fou qui refuse les lieux hors reseau : sans lui,
 *     une reponse parfaitement valide du fournisseur devient un chiffre qui
 *     ne va nulle part.
 */
/**
 * Pourquoi une reponse de trace est refusee.
 *
 * `off_network` : le fournisseur a repondu, et sa trace n'arrive pas au lieu
 * demande. C'est une MESURE — le garde-fou d'arrivee l'a verifiee.
 * `provider_unavailable` : le fournisseur n'a rien dit d'exploitable.
 *
 * Aucun appelant ne peut deduire l'un de l'autre, et les confondre rendait toute
 * la preparation inexploitable : un sommet et une panne repondaient pareil, donc
 * le meme "503" recouvrait un fait et une absence de fait. Le tri se fait ici,
 * une fois, plutot que dans chaque appelant.
 */
export type RouteFailure =
  | 'off_network'
  | 'provider_unavailable'
  | 'points_expected'
  | 'mode_expected'
  | 'rate_limited';

export interface RouteAttempt {
  readonly legs: RouteLeg[] | null;
  readonly reason: RouteFailure | null;
  /**
   * Le moteur qui a REELLEMENT repondu, absent des qu il refuse.
   *
   * C est ce qui permet a l ecran de nommer la source d une distance
   * au lieu de la deviner. Un refus n en porte pas : personne n a mesure,
   * donc personne n a de source a nommer. Sans cette distinction, un
   * repli Valhalla apres une panne Geoapify serait affiche comme une mesure
   * Geoapify — une provenance inventee, soit le meme vice qu un repli de
   * temperature code en dur.
   */
  readonly provider?: RouteProvider;
}

/**
 * Meme lecture que `normalizeValhallaRoute`, mais en disant POURQUOI elle
 * refuse. Les refus de forme — corps illisible, statut non nul, trace trop
 * courte — sont `provider_unavailable`. Le seul refus mesure est
 * `off_network`, et il porte sur l'ecart d'arrivee.
 */
export function normalizeValhallaRouteDetailed(
  payload: unknown,
  points: readonly RoutePoint[],
): RouteAttempt {
  const trip = (payload as { trip?: { status?: unknown; legs?: unknown } } | null)?.trip;
  if (!trip || trip.status !== 0 || !Array.isArray(trip.legs)) {
    return { legs: null, reason: 'provider_unavailable' };
  }
  if (trip.legs.length !== Math.max(0, points.length - 1)) {
    return { legs: null, reason: 'provider_unavailable' };
  }
  const legs: RouteLeg[] = [];
  for (let index = 0; index < trip.legs.length; index += 1) {
    const entry = trip.legs[index] as { summary?: unknown; shape?: unknown } | null;
    const summary = entry?.summary as { time?: unknown; length?: unknown } | undefined;
    const seconds = finite(summary?.time);
    const km = finite(summary?.length);
    if (seconds === null || km === null) return { legs: null, reason: 'provider_unavailable' };
    if (!(seconds > 0) || km < 0) return { legs: null, reason: 'provider_unavailable' };
    const geometry = decodeValhallaShape(entry?.shape);
    if (geometry.length < 2) return { legs: null, reason: 'provider_unavailable' };
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to) return { legs: null, reason: 'provider_unavailable' };
    if (!reaches(geometry[0], from)) return { legs: null, reason: 'off_network' };
    if (!reaches(geometry[geometry.length - 1], to)) return { legs: null, reason: 'off_network' };
    legs.push({ distanceKm: km, durationMin: seconds / 60, geometry });
  }
  return { legs, reason: null, provider: 'valhalla' };
}

/** Forme historique : la trace, ou `null`. La raison reste dans `routeAttempt`. */
export function normalizeValhallaRoute(
  payload: unknown,
  points: readonly RoutePoint[],
): RouteLeg[] | null {
  return normalizeValhallaRouteDetailed(payload, points).legs;
}

/** Les lignes d'une geometrie GeoJSON, une par troncon ; `null` des qu'un point manque. */
function readLines(value: unknown): Pair[][] | null {
  const geometry = value as { type?: unknown; coordinates?: unknown } | null;
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  const raw =
    geometry.type === 'MultiLineString'
      ? geometry.coordinates
      : geometry.type === 'LineString'
        ? [geometry.coordinates]
        : null;
  if (!raw) return null;
  const lines: Pair[][] = [];
  for (const line of raw) {
    const read = readGeometry({ coordinates: line });
    if (!read) return null;
    lines.push(read);
  }
  return lines;
}

/**
 * La reponse Geoapify, lue sans invention — et en disant POURQUOI elle refuse.
 *
 * Forme : une `FeatureCollection` d'une seule `Feature`, dont la geometrie
 * porte une ligne par troncon (`MultiLineString`) et les proprietes un
 * troncon par paire de points (`legs[i].distance` en metres, `legs[i].time`
 * en secondes).
 *
 * Memes exigences que Valhalla, et surtout MEME GARDE-FOU D'ARRIVEE : Geoapify
 * accroche lui aussi une demande hors reseau au point le plus proche de son
 * graphe, et sa distance ne mene alors pas au lieu demande. Un zero kilometre
 * dirait « vous y etes deja » : refuse aussi.
 *
 * Une reponse d'erreur (cle refusee, credits epuises, `statusCode` 4xx ou 5xx)
 * n'est pas une mesure : `provider_unavailable`, et Valhalla est consulte.
 */
export function normalizeGeoapifyRouteDetailed(
  payload: unknown,
  points: readonly RoutePoint[],
): RouteAttempt {
  const unavailable: RouteAttempt = { legs: null, reason: 'provider_unavailable' };
  const features = (payload as { features?: unknown } | null)?.features;
  if (!Array.isArray(features) || features.length === 0) return unavailable;
  const feature = features[0] as { geometry?: unknown; properties?: unknown } | null;
  const rawLegs = (feature?.properties as { legs?: unknown } | undefined)?.legs;
  const expected = Math.max(0, points.length - 1);
  if (!Array.isArray(rawLegs) || rawLegs.length !== expected) return unavailable;
  const lines = readLines(feature?.geometry);
  if (!lines || lines.length !== expected) return unavailable;

  const legs: RouteLeg[] = [];
  for (let index = 0; index < expected; index += 1) {
    const leg = rawLegs[index] as { distance?: unknown; time?: unknown } | null;
    const meters = finite(leg?.distance);
    const seconds = finite(leg?.time);
    if (meters === null || seconds === null || seconds < 0) return unavailable;
    if (!(meters > 0)) return { legs: null, reason: 'off_network' };
    const geometry = lines[index];
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to) return unavailable;
    if (!reaches(geometry[0], from)) return { legs: null, reason: 'off_network' };
    if (!reaches(geometry[geometry.length - 1], to)) return { legs: null, reason: 'off_network' };
    legs.push({ distanceKm: meters / 1000, durationMin: seconds / 60, geometry });
  }
  return { legs, reason: null, provider: 'geoapify' };
}

/** Aligne les altitudes sur les points demandes ; un trou reste un trou. */
export function normalizeElevation(payload: unknown, expected: number): (number | null)[] | null {
  const body = payload as { elevation?: unknown } | null;
  if (!body || !Array.isArray(body.elevation) || body.elevation.length !== expected) {
    return null;
  }
  return body.elevation.map((value) => (value === null ? null : finite(value)));
}

/* ------------------------------------------------------------------ */
/* Appels fournisseurs                                                 */
/* ------------------------------------------------------------------ */

export interface RoutePoint {
  readonly lat: number;
  readonly lon: number;
}

function coord(pair: readonly [number, number] | [number, number]): string {
  return `${round6(pair[0])},${round6(pair[1])}`;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function withTimeout(signal?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  return { signal: controller.signal, done: () => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  } };
}

function geoapifyKey(env: Record<string, string | undefined> = process.env): string | null {
  const key = env.GEOAPIFY_API_KEY?.trim();
  return key ? key : null;
}

/**
 * L URL Geoapify du trajet entier. Les points se donnent `lat,lon`, separes
 * par `|` ; le mode est nomme (jamais un defaut) et les unites explicites.
 * Elle porte la cle : jamais journalisee.
 */
export function geoapifyRouteUrl(points: readonly RoutePoint[], mode: TravelMode, key: string): string {
  const params = new URLSearchParams({
    waypoints: points.map((p) => `${round6(p.lat)},${round6(p.lon)}`).join('|'),
    mode: GEOAPIFY_MODE[mode],
    units: 'metric',
    apiKey: key,
  });
  return `${GEOAPIFY_ROUTING_URL}?${params.toString()}`;
}

type GeoapifyBudget = () => Promise<Pick<RateLimitResult, 'allowed'>>;

const defaultGeoapifyBudget: GeoapifyBudget = () =>
  rateLimit({
    key: 'geoapify:routing:day',
    limit: GEOAPIFY_ROUTING_DAILY_BUDGET,
    windowMs: 86_400_000,
    failMode: 'open',
  });

let geoapifyBudget: GeoapifyBudget = defaultGeoapifyBudget;

/** Reserve aux tests : remplace (ou rend, avec `null`) le compteur du site. */
export function __setGeoapifyBudgetForTests(budget: GeoapifyBudget | null): void {
  geoapifyBudget = budget ?? defaultGeoapifyBudget;
}

/** Un credit Geoapify pour ce trajet ? Un compteur en panne ne bloque rien. */
async function geoapifyAllowed(): Promise<boolean> {
  try {
    return (await geoapifyBudget()).allowed;
  } catch {
    return true;
  }
}

/** Un appel fournisseur, avec son propre delai : une lenteur ne prive pas le repli du sien. */
async function callProvider(
  url: string,
  signal: AbortSignal | undefined,
  headers: Record<string, string>,
): Promise<unknown | null> {
  const { signal: local, done } = withTimeout(signal);
  try {
    return await fetchJson(url, local, headers);
  } finally {
    done();
  }
}

/**
 * L URL Valhalla du mode demande.
 *
 * `units: kilometers` est explicite : sans lui, Valhalla repond en milles, et
 * un trajet de 8,275 km s'afficherait 5,1 miles. L'instance publique ignore
 * par ailleurs `shape_format`, d'ou le besoin de decoder la polyligne.
 */
function valhallaUrl(key: string, mode: TravelMode): string {
  const locations = key.split(';').map((pair) => {
    const [lonText, latText] = pair.split(',');
    return { lon: Number(lonText), lat: Number(latText) };
  });
  const body = JSON.stringify({
    locations,
    costing: VALHALLA_COSTING[mode],
    directions_options: { units: 'kilometers' },
  });
  return `${VALHALLA_URL}?json=${encodeURIComponent(body)}`;
}

/**
 * Trace reelle, sur le reseau du mode demande, avec la RAISON d un eventuel refus.
 *
 * `legs: null` ne dit rien par lui-meme : un sommet hors reseau et une panne
 * du fournisseur se ressemblent. `reason` les separe, et c est ce qui permet
 * a l appelant d ECARTER un lieu irrattrapable a pied au lieu de l abandonner
 * pour une panne passagere.
 *
 * Ordre, plan 1.5 : cache (memoire puis base) → Geoapify (cle et credits du
 * jour) → Valhalla FOSSGIS. Valhalla ne repond QUE sur une panne de Geoapify
 * (ou sans cle, ou credits epuises) : `off_network` est une mesure, et une
 * mesure ne se remplace pas par une seconde opinion sur les memes donnees
 * OpenStreetMap. Le mode ne se negocie jamais : `pieton` sur un graphe routier
 * afficherait des kilometres exacts pour un trajet que personne ne fera.
 */
export async function routeAttempt(
  points: readonly RoutePoint[],
  mode: TravelMode,
  signal?: AbortSignal,
  cacheBaseUrl?: string,
  /** Signature serveur d'une clé de cache (`signRouteCacheKey`) : sans elle, rien n'est écrit en base. */
  signCacheKey?: (key: string) => string,
): Promise<RouteAttempt> {
  // Un mode inconnu et une liste de points inexploitable sont des REFUS de
  // l appelant, pas une panne du fournisseur : ils se distinguent, parce
  // qu ils se corrigent chez l appelant.
  if (!isTravelMode(mode)) return { legs: null, reason: 'mode_expected' };
  if (points.length < 2 || points.length > MAX_ROUTE_POINTS) {
    return { legs: null, reason: 'points_expected' };
  }
  const key = points.map((p) => coord([p.lon, p.lat])).join(';');
  const cacheKey = `route:${mode}:${key}`;
  // Memoire PUIS base, toutes deux avant le debit et avant le reseau. Une
  // reponse deja connue ne coute rien, quel que soit l endroit ou elle a ete
  // mesuree — et c est ce qui survit au redeploiement.
  const cached = await readRouteCache(cacheEndpoint(cacheBaseUrl), cacheKey, signCacheKey);
  if (cached !== undefined) return cached;
  // Apres le cache, avant le reseau : une reponse qu on a deja ne coute rien,
  // et un budget epuise doit s arreter AVANT de partir, pas en revenant.
  if (!consumeRateToken()) return { legs: null, reason: 'rate_limited' };

  const apiKey = geoapifyKey();
  const fromGeoapify =
    apiKey && (await geoapifyAllowed())
      ? normalizeGeoapifyRouteDetailed(
          await callProvider(geoapifyRouteUrl(points, mode, apiKey), signal, { 'User-Agent': USER_AGENT }),
          points,
        )
      : null;
  const attempt =
    fromGeoapify && (fromGeoapify.legs !== null || fromGeoapify.reason === 'off_network')
      ? fromGeoapify
      : normalizeValhallaRouteDetailed(
          await callProvider(valhallaUrl(key, mode), signal, {
            'User-Agent': USER_AGENT,
            'X-Client-Id': CLIENT_ID,
          }),
          points,
        );
  // Seule une trace REUSSIE est memorisee — cote memoire ET cote base. Un
  // echec ne doit pas etre fige : une panne de cinq minutes finirait par etre
  // servie comme une reponse mesuree pendant toute la duree du TTL.
  if (attempt.legs) {
    await writeRouteCache(cacheEndpoint(cacheBaseUrl), cacheKey, mode, attempt, signCacheKey);
  }
  return attempt;
}

/**
 * La trace, ou `null`. La forme historique : quand le refus importe, passer par
 * `routeAttempt` pour savoir POURQUOI il est refuse.
 */
export async function routeThrough(
  points: readonly RoutePoint[],
  mode: TravelMode,
  signal?: AbortSignal,
): Promise<RouteLeg[] | null> {
  return (await routeAttempt(points, mode, signal)).legs;
}

/*
 * L'altitude des points n'est plus servie ici : `/api/elevation` lit le relief
 * libre (Terrain Tiles) cote serveur via `@/lib/geo/terrainElevation`. Ce
 * module reste chargeable dans le navigateur, sans decodeur d'image.
 */

/**
 * Service de routage cote serveur — le point de controle avant OSRM.
 *
 * Deux fournisseurs libres, sans cle :
 *   - OSRM       `router.project-osrm.org` : distance, duree et trace routiers ;
 *   - (altitudes : servies par /api/elevation, relief libre Terrain Tiles)
 *
 * Regle unique, identique a celle du geocodage : une reponse malformee, trop
 * courte ou incoherentente vaut `null`. Aucune distance approchee ne se glisse
 * a la place d'une mesure.
 */

import { haversineKm } from './engine/routing';
import { TRAVEL_MODES } from './engine/routing';
import type { RouteLeg, TravelMode } from './engine/routing';
import type { RouteProvider } from './engine/provenance';

/**
 * Deux serveurs OSRM, et pourquoi.
 *
 * La VOITURE reste sur le serveur de demonstration d'OSRM (FOSSGIS e.V.) :
 * c'est lui qui fait autorite depuis le debut, et son graphe routier est le
 * plus complet.
 *
 * La MARCHE et le VELO ne peuvent PAS y aller : ce serveur n'expose que le
 * graphe routier. Un trajet de marche calcule sur des routes mesurees n'est
 * pas un trajet de marche, c'est un trajet de voiture deguise. Ils vont donc
 * sur FOSSGIS, sous le prefixe de PROFIL — un graphe construit pour ce mode
 * la :
 *
 *   `routed-foot` reseau pieton, `routed-bike` reseau cyclable.
 *
 * MESURE du 2026-09-28, c'est ce qui a ouvert P1.9 :
 *   - `routing.openstreetmap.de`    : **HTTP 200, 132 ms** (7 385 m / 98,5 min
 *     pour Chamonix -> Les Houches a pied, arrivee a 7 m du but)
 *
 * CORRECTION DU 2026-09-28, meme jour : les deux Valhalla, notes plus tot
 * comme INJOIGNABLES, repondent de nouveau en `200` (252 ms). La note est donc
 * FAUSE et ne doit plus etre reprise. Valhalla reste le repli sur panne, mais
 * il ne sauve pas P0.23 : son graphe pieton s'arrete a 2 875 m du refuge des
 * Grands Mulets, exactement comme celui de FOSSGIS a 2 878 m. Deux graphes
 * incomplets ne se rattrapent pas l'un l'autre. C'est BRouter, moteur de
 * randonnee, qui couvre enfin l'altitude - voir P1.10.
 *
 * Un service qui tombe ne doit pas supprimer les distances, et un service qui
 * repond sans atteindre le lieu ne doit pas en inventer une.
 */
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const OSRM_PROFIL_BASE = 'https://routing.openstreetmap.de';

/**
 * Le prefixe de profil de chaque mode qui n'a pas de graphe routier.
 *
 * Le chemin se lit `routed-foot/route/v1/driving/<points>` : le mot `driving`
 * est le format de l'API OSRM, pas le mode demande. C'est le PREFIXE qui
 * choisit le graphe, et c'est lui qui fait toute la difference entre une
 * reponse correcte et une reponse qui parle d'un autre trajet.
 */
const OSRM_PROFIL: Readonly<Partial<Record<TravelMode, string>>> = {
  pieton: 'routed-foot',
  velo: 'routed-bike',
};

const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';

/**
 * BRouter : le seul des trois fournisseurs qui sache monter.
 *
 * OSRM et Valhalla sont des graphes de voirie. Ils s accrochent au point le
 * plus proche de leur reseau, qui peut etre 2,9 km plus bas qu un refuge
 * d altitude. BRouter est un moteur de randonnee, avec son propre modele
 * d elevation, et il monte jusqu au lieu demande.
 *
 * Mesure du 2026-09-28, Chamonix -> refuge des Grands Mulets :
 *   - `routed-foot`    :  8 718 m, arrivee a 2 878 m, refuse
 *   - Valhalla         :  9 128 m, arrivee a 2 875 m, refuse
 *   - BRouter trekking : 14 424 m, D+ 2 100 m, arrivee a 18 m, accepte
 *
 * Il est donc le DERNIER recours du mode `pieton`, jamais un substitut : un
 * seul appel par troncon, et seulement quand les deux autres ont refuse.
 */
const BROUTER_URL = 'https://brouter.de/brouter';
const BROUTER_PROFILE = 'trekking';

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

/** Au-dela, OSRM refuse la requete : on refuse aussi, proprement. */
export const MAX_ROUTE_POINTS = 12;

/** Open-Meteo n'accepte que 100 coordonnees par requete d altitude. */

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
  const provider =
    candidate.provider === 'osrm' ||
    candidate.provider === 'valhalla' ||
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
 * NOMBRE de requetes, et c est la le vrai risque : les trois fournisseurs sont
 * des services publics et sans cle, partages avec tous les autres. Une journee
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
 * `if (!response.ok) return null` etait un raccourci pratique, mais il
 * jettait avec le statut l'information la plus utile : `NoRoute`. Sur une
 * reponse 400 d'OSRM, le statut est constant et sans valeur, alors que le
 * corps dit pourquoi. C'est ce corps qui distingue un fait mesure d'une
 * panne, et l'ignorer revenait a traiter les deux de la meme facon.
 *
 * Une page d'erreur HTML — un 502 de nginx — n'a pas de `code` : `JSON.parse`
 * echoue, donc `null`, ce qui reste une panne. Rien n'est invente.
 */
async function fetchJson(url: string, signal: AbortSignal): Promise<unknown | null> {
  try {
    const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
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
 * Longueurs cumulees (en km) le long d une polyligne `[lon, lat]`.
 *
 * Sert a couper le trace au bon endroit : couper par index reviendrait a
 * revenir a faire la densite de points, qui est un choix de simplification d OSRM,
 * alors que la distance routiere mesuree est elle seule geographique.
 */
function cumulativeKm(geometry: readonly Pair[]): number[] {
  const out: number[] = [0];
  for (let index = 1; index < geometry.length; index += 1) {
    const previous = geometry[index - 1];
    const current = geometry[index];
    out.push(
      out[index - 1] +
        haversineKm({ lon: previous[0], lat: previous[1] }, { lon: current[0], lat: current[1] }),
    );
  }
  return out;
}

/**
 * Decoupe le trace d une route en une portion par troncon.
 *
 * OSRM ne livre la geometrie qu au niveau de la route : c est sa reponse
 * reelle, verifiee sur `router.project-osrm.org`. Chaque troncon ne portant
 * donc AUCUN trace propre, on repartit la ligne globale selon la distance
 * routiere mesuree de chaque troncon.
 *
 * `null` quand la coupure est impossible sans inventer un point : mieux vaut
 * aucun trace qu un trace qui ne passe pas par les etapes demandees.
 */
export function splitGeometryByLegs(
  geometry: readonly Pair[],
  legDistancesM: readonly number[],
): Pair[][] | null {
  const legCount = legDistancesM.length;
  if (legCount === 0) return null;
  if (legCount === 1) return [[...geometry]];
  // Un point de raccord par troncon : il en faut au moins legCount + 1.
  if (geometry.length < legCount + 1) return null;

  const cum = cumulativeKm(geometry);
  const totalGeom = cum[cum.length - 1];
  const totalMeasured = legDistancesM.reduce((sum, value) => sum + value, 0);
  if (!(totalGeom > 0) || !(totalMeasured > 0)) return null;

  const pieces: Pair[][] = [];
  let startIndex = 0;
  let measured = 0;
  for (let leg = 0; leg < legCount; leg += 1) {
    measured += legDistancesM[leg];
    const isLast = leg === legCount - 1;
    // Cible proportionnelle a la distance routiere du troncon, convertie dans
    // l unite du trace (km) plutot que dans une fraction de points.
    const targetKm = (measured / totalMeasured) * totalGeom;
    let endIndex = cum.length - 1;
    if (!isLast) {
      endIndex = startIndex + 1;
      while (endIndex < cum.length - 1 && cum[endIndex] < targetKm) endIndex += 1;
      // Il doit rester un point pour le troncon suivant.
      if (endIndex > cum.length - 2) endIndex = cum.length - 2;
      if (endIndex < startIndex + 1) endIndex = startIndex + 1;
    }
    pieces.push(geometry.slice(startIndex, endIndex + 1) as Pair[]);
    startIndex = endIndex;
  }
  return pieces;
}

/**
 * Convertit une reponse OSRM en troncons. Le nombre de troncons doit
 * correspondre au nombre de points, sinon la reponse ne decrit pas le trajet
 * demande et n'est pas utilisee.
 *
 * La geometrie est lue la ou OSRM la place vraiment : sur la route. Certains
 * appels (segments demandes explicitement) la repliquent sur chaque troncon ;
 * ce cas reste accepte, mais il n est plus le cas nominal.
 */
export function normalizeOsrmRoute(payload: unknown, pointCount: number): RouteLeg[] | null {
  const body = payload as { code?: unknown; routes?: unknown } | null;
  if (!body || body.code !== 'Ok' || !Array.isArray(body.routes) || body.routes.length === 0) {
    return null;
  }
  const raw = body.routes[0] as { legs?: unknown; geometry?: unknown };
  if (!Array.isArray(raw.legs)) return null;
  if (raw.legs.length !== Math.max(0, pointCount - 1)) return null;

  const measured: { distanceKm: number; durationMin: number }[] = [];
  for (const entry of raw.legs) {
    const leg = entry as { distance?: unknown; duration?: unknown };
    const distanceM = finite(leg.distance);
    const durationS = finite(leg.duration);
    if (distanceM === null || durationS === null) return null;
    measured.push({ distanceKm: distanceM / 1000, durationMin: durationS / 60 });
  }

  // Cas nominal : une geometrie pour toute la route, a decouper.
  const routeGeometry = readGeometry(raw.geometry);
  if (routeGeometry) {
    const pieces = splitGeometryByLegs(routeGeometry, measured.map((leg) => leg.distanceKm * 1000));
    if (!pieces || pieces.length !== measured.length) return null;
    return measured.map((leg, index) => ({ ...leg, geometry: pieces[index] }));
  }

  // Cas secondaire : chaque troncon porte son propre trace.
  const legs: RouteLeg[] = [];
  for (const entry of raw.legs) {
    const leg = entry as { geometry?: unknown };
    const geometry = readGeometry(leg.geometry);
    if (!geometry) return null;
    legs.push({ ...measured[legs.length], geometry });
  }
  return legs;
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

/**
 * Une reponse OSRM qui dit explicitement « pas de chemin ».
 *
 * C'est la seule reponse de fournisseur qui soit un FAIT sur le reseau plutot
 * qu'un etat du service. Mesure le 2026-09-28 :
 * `routing.openstreetmap.de` repond `HTTP 400 {"code":"NoRoute"}` pour deux
 * points du Pacifique. Le service va bien, il repond ; il dit que son
 * graphe ne relie pas ces deux points.
 *
 * Le confondre avec une panne serait une erreur de sens : on jetterait des
 * lieux parfaitement valides parce qu'un serveur a eu un souci. Et l'inverse
 * serait plus grave : on accepterait des lieux qu'aucun chemin pieton ne
 * dessert.
 */
const OSRM_NO_ROUTE = 'NoRoute';

export interface RouteAttempt {
  readonly legs: RouteLeg[] | null;
  readonly reason: RouteFailure | null;
  /**
   * Le moteur qui a REELLEMENT repondu, absent des qu il refuse.
   *
   * C est ce qui permet a l ecran de nommer la source d une distance
   * au lieu de la deviner. Un refus n en porte pas : personne n a mesure,
   * donc personne n a de source a nommer. Sans cette distinction, un
   * repli Valhalla apres une panne OSRM serait affiche comme une mesure
   * OSRM — une provenance inventee, soit le meme vice qu un repli de
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

/**
 * La reponse OSRM, lue sans invention — et en disant POURQUOI elle refuse.
 *
 * Meme exigence que `normalizeValhallaRouteDetailed`, pour une raison qui
 * compte plus encore : **le garde-fou d'arrivee s'applique ici aussi**.
 *
 * C'etait le piege de ce lot. Un OSRM de profil pied ACCROCHE une demande sur
 * le point le plus proche de son graphe. Sur le sommet du Mont Blanc, il
 * repond `Ok`, avec un trace de 115 km et une arrivee a 5 065 m du but — la
 * mesure est parfaitement valide, elle ne parle simplement pas du lieu
 * demande. Sans le garde-fou, l'ecran aurait affiche « 115 km, 26 h de
 * marche » vers un sommet : le mensonge exact que P0.23 combat, et pire que
 * le 503 muet d'avant, parce qu'il aurait eu l'air d'une reponse.
 *
 * `NoRoute` passe avant ce garde-fou : quand le reseau affirme qu'il n'existe
 * aucun chemin, il n'y a pas de trace a examiner, et c'est deja une mesure.
 */
export function normalizeOsrmRouteDetailed(
  payload: unknown,
  points: readonly RoutePoint[],
): RouteAttempt {
  const body = payload as { code?: unknown; routes?: unknown } | null;
  if (!body) return { legs: null, reason: 'provider_unavailable' };
  if (body.code === OSRM_NO_ROUTE) return { legs: null, reason: 'off_network' };
  if (body.code !== 'Ok' || !Array.isArray(body.routes) || body.routes.length === 0) {
    return { legs: null, reason: 'provider_unavailable' };
  }
  const raw = body.routes[0] as { legs?: unknown; geometry?: unknown };
  if (!Array.isArray(raw.legs) || raw.legs.length !== Math.max(0, points.length - 1)) {
    return { legs: null, reason: 'provider_unavailable' };
  }

  const measured: { distanceKm: number; durationMin: number }[] = [];
  for (const entry of raw.legs) {
    const leg = entry as { distance?: unknown; duration?: unknown };
    const distanceM = finite(leg.distance);
    const durationS = finite(leg.duration);
    if (distanceM === null || durationS === null) {
      return { legs: null, reason: 'provider_unavailable' };
    }
    // Un zero kilometre n'est pas un trajet reussi : c'est ce que rend le
    // fournisseur pour deux points hors reseau. L'afficher, ce serait dire
    // « vous etes deja arrive » — le mensonge le plus discret du lot, parce
    // qu'il a l'air d'une bonne nouvelle.
    if (!(distanceM > 0)) return { legs: null, reason: 'off_network' };
    measured.push({ distanceKm: distanceM / 1000, durationMin: durationS / 60 });
  }

  // Cas nominal : une geometrie pour toute la route, a decouper.
  const routeGeometry = readGeometry(raw.geometry);
  if (!routeGeometry) return { legs: null, reason: 'provider_unavailable' };
  const pieces = splitGeometryByLegs(
    routeGeometry,
    measured.map((leg) => leg.distanceKm * 1000),
  );
  if (!pieces || pieces.length !== measured.length) {
    return { legs: null, reason: 'provider_unavailable' };
  }

  // LE GARDE-FOU D'ARRIVEE. Chaque extremite de troncon doit etre le lieu
  // demande, a `ARRIVAL_TOLERANCE_M` pres. Meme regle, meme constante, meme
  // raison `off_network` que pour Valhalla : un seul vocabulaire pour
  // decrire « inatteignable », quel que soit le fournisseur qui l'a vu.
  for (let index = 0; index < pieces.length; index += 1) {
    const geometry = pieces[index];
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to) return { legs: null, reason: 'provider_unavailable' };
    if (!reaches(geometry[0], from)) return { legs: null, reason: 'off_network' };
    if (!reaches(geometry[geometry.length - 1], to)) return { legs: null, reason: 'off_network' };
  }

  return {
    legs: measured.map((leg, index) => ({ ...leg, geometry: pieces[index] })),
    reason: null,
    provider: 'osrm',
  };
}

/**
 * Un nombre mesure, lu dans une chaine si besoin.
 *
 * BRouter rend ses chiffres en texte : `"track-length": "14424"`. Lire cette
 * chaine, c est lire une mesure. La remplacer par une estimation serait
 * exactement ce que ce service interdit.
 */
function mesureNumerique(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * La reponse BRouter d UN troncon, lue sans invention.
 *
 * Meme exigence que les deux autres fournisseurs, et surtout MEME GARDE-FOU
 * D ARRIVEE. Il est indispensable ici plus qu ailleurs : BRouter est le
 * dernier ressort, et un dernier ressort qui ne verifie pas ce qu il recoit
 * n est pas un ressort. Le refuge du Gouter en donne la mesure : BRouter y
 * aboutit a 870 m du lieu demande, et le parcours est refuse.
 *
 * Le provider nomme le moteur qui a repondu, pas celui qu on aurait
 * aime interroger. C est ce que l appelant affiche a cote de la distance :
 * nommer le moteur PREVU aurait ete nommer une source inventee.
 */
export function normalizeBrouterLegDetailed(
  payload: unknown,
  from: RoutePoint,
  to: RoutePoint,
): RouteAttempt {
  const features = (payload as { features?: unknown } | null)?.features;
  if (!Array.isArray(features) || features.length === 0) {
    return { legs: null, reason: 'provider_unavailable' };
  }
  const feature = features[0] as { geometry?: unknown; properties?: unknown } | null;
  const properties = feature?.properties as Record<string, unknown> | undefined;
  const meters = mesureNumerique(properties?.['track-length']);
  const seconds = mesureNumerique(properties?.['total-time']);
  // Un zero kilometre dirait « vous y etes deja ». Refus, comme partout ailleurs.
  if (meters === null || seconds === null || !(meters > 0) || !(seconds > 0)) {
    return { legs: null, reason: 'off_network' };
  }
  const geometry = readGeometry(feature?.geometry);
  if (!geometry) return { legs: null, reason: 'provider_unavailable' };
  if (!reaches(geometry[0], from)) return { legs: null, reason: 'off_network' };
  if (!reaches(geometry[geometry.length - 1], to)) return { legs: null, reason: 'off_network' };
  const ascent = mesureNumerique(properties?.['filtered ascend']);
  const leg: RouteLeg = {
    distanceKm: meters / 1000,
    durationMin: seconds / 60,
    geometry,
    ...(ascent !== null && ascent >= 0 ? { ascentM: ascent } : {}),
  };
  return { legs: [leg], reason: null, provider: 'brouter' };
}

/**
 * L URL BRouter d UN troncon, en profil de randonnee.
 *
 * Le profil se nomme explicitement : sans lui BRouter applique son profil par
 * defaut, qui n est pas le notre. `lonlats` separe les deux points par `|`.
 */
function brouterUrl(from: RoutePoint, to: RoutePoint): string {
  const lonlats = `${round6(from.lon)},${round6(from.lat)}|${round6(to.lon)},${round6(to.lat)}`;
  const query = `lonlats=${encodeURIComponent(lonlats)}&profile=${BROUTER_PROFILE}&alternativeidx=0&format=geojson`;
  return `${BROUTER_URL}?${query}`;
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

function osrmUrl(key: string, mode: TravelMode): string {
  const profil = OSRM_PROFIL[mode];
  if (profil === undefined) return `${OSRM_BASE}/${key}?overview=full&geometries=geojson`;
  return `${OSRM_PROFIL_BASE}/${profil}/route/v1/driving/${key}?overview=full&geometries=geojson`;
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
 * Le dernier recours : un moteur de randonnee, pour le mode pieton seulement.
 *
 * Il n est consulte QUE sur un `off_network`, jamais apres une reponse deja
 * reussie : le chemin courant ne paye donc aucun aller-retour supplementaire.
 *
 * Deux regles, toutes deux mesurees :
 *   - un seul appel par TRONCON. BRouter ne renvoie aucun index de jalon, donc
 *     un appel multi-points ne permettrait pas d attribuer une distance a chaque
 *     etape, et l ecran a besoin du denivele par jour ;
 *   - si un seul troncon echoue, on rend le `off_network` d origine. Perdre une
 *     mesure deja obtenue parce qu un second fournisseur n a pas su afficherait
 *     « service indisponible » la ou l on sait que le lieu est hors reseau.
 */
async function avecRandonnee(
  points: readonly RoutePoint[],
  mode: TravelMode,
  signal: AbortSignal,
  refuse: RouteAttempt,
): Promise<RouteAttempt> {
  if (mode !== 'pieton' || refuse.reason !== 'off_network') return refuse;
  const legs: RouteLeg[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to) return refuse;
    const un = normalizeBrouterLegDetailed(
      await fetchJson(brouterUrl(from, to), signal),
      from,
      to,
    );
    const leg = un.legs?.[0];
    if (!leg) return refuse;
    legs.push(leg);
  }
  return legs.length > 0 ? { legs, reason: null } : refuse;
}

/**
 * Trace reelle, sur le reseau du mode demande, avec la RAISON d un eventuel refus.
 *
 * `legs: null` ne dit rien par lui-meme : un sommet hors reseau et une panne
 * du fournisseur se ressemblent. `reason` les separe, et c est ce qui permet
 * a l appelant de STDYER un lieu irrattrapable a pied au lieu de l abandonner
 * pour une panne passagere.
 *
 * Choix des fournisseurs, mesure : OSRM ne sert que `voiture` (c est son
 * serveur de demonstration, et son graphe pedestre n existe pas), donc
 * `pieton` et `velo` passent par Valhalla. Pour `voiture`, OSRM reste la
 * reference et Valhalla ne sert qu en repli.
 */
export async function routeAttempt(
  points: readonly RoutePoint[],
  mode: TravelMode,
  signal?: AbortSignal,
  cacheBaseUrl?: string,
  /** Signature serveur d'une clé de cache (`signRouteCacheKey`) : sans elle, rien n'est écrit en base. */
  signCacheKey?: (key: string) => string,
): Promise<RouteAttempt> {
  // Un mode inconnu et une liste de points inexploitable sont des REFAUX de
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
  const { signal: local, done } = withTimeout(signal);
  try {
    // Le mode ne se negotiate jamais : `pieton` sur un graphe routier afficherait
    // des kilometres exacts pour un trajet que personne ne fera.
    const byOsrm = async (): Promise<RouteAttempt> =>
      normalizeOsrmRouteDetailed(await fetchJson(osrmUrl(key, mode), local), points);
    const byValhalla = async (): Promise<RouteAttempt> =>
      normalizeValhallaRouteDetailed(await fetchJson(valhallaUrl(key, mode), local), points);

    // Trois fournisseurs, trois roles, et une regle par role.
    //
    // OSRM d'abord pour les trois modes. Valhalla ensuite, mais UNIQUEMENT sur
    // une panne : `off_network` est une mesure, et une mesure ne se remplace pas
    // par une seconde opinion sur le meme graphe.
    //
    // Cette regle etait juste tant que les deux fournisseurs partagent le meme
    // terrain. Elle ne l'est plus : `off_network` prouve que LE GRAPHE de celui
    // qui repond ne dessert pas le lieu, pas que le lieu est injoignable. La
    // suite ne demande donc pas une seconde opinion, elle demande le juge
    // COMPETENT - et `avecRandonnee` ne rend jamais la main sur une mesure
    // deja obtenue, seulement sur une panne.
    const fromOsrm = await byOsrm();
    const apresValhalla =
      fromOsrm.legs !== null || fromOsrm.reason === 'off_network' ? fromOsrm : await byValhalla();
    const attempt = await avecRandonnee(points, mode, local, apresValhalla);
    // Seule une trace REUSSIE est memorisee — cote memoire ET cote base. Un
    // echec ne doit pas etre fige : une panne de cinq minutes finirait par etre
    // servie comme une reponse Mesuree pendant toute la duree du TTL.
    if (attempt.legs) {
      await writeRouteCache(cacheEndpoint(cacheBaseUrl), cacheKey, mode, attempt, signCacheKey);
    }
    return attempt;
  } finally {
    done();
  }
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

/**
 * Le raccordement des mesures reelles, cote navigateur.
 *
 * Le moteur (`engine/measurements.ts`) sait mesurer : il ne fait aucun appel
 * reseau, il recoit des dependances. C etait la que le filament manquait -
 * l ecran appelait `runItineraryGeneration` sans rien injecter, donc le defaut
 * `NO_MEASUREMENTS` laissait le modele intact et chaque tuile affichait
 * « a verifier » alors que `/api/route` et `/api/weather` repondent.
 *
 * Ce module est le seul endroit ou le navigateur touche ces deux routes. Il
 * abide la regle du projet : on passe par la route Next, jamais par le
 * fournisseur en direct, donc le cache, le rate limit et la validation
 * restent en un point.
 */

import { measurementRunners, type MeasurementRunners } from './engine/measurements';
import type { RouteProvider } from './engine/provenance';
import type { GeoPoint, RouteLeg, RoutingDeps, TravelMode } from './engine/routing';
import { isTravelMode, MAX_ROUTE_POINTS } from './routingService';
import { fetchWeatherThroughApi } from './weatherClient';

const ROUTE_ENDPOINT = '/api/route';
const ELEVATION_ENDPOINT = '/api/elevation';

// Plafond de `/api/elevation`. Un trace OSRM complet le depasse largement : on
// echantillonne plutot que de tronquer, parce qu'un trace coupe au milieu
// perdrait le denivele des extremites.
const MAX_ELEVATION_POINTS = 100;

type Fetcher = typeof fetch;

/**
 * Ouvert chaque fois qu une reponse nomme le moteur qui a repondu.
 *
 * C est le seul endroit du navigateur ou la provenance d une distance est
 * connue : `/api/route` l a mesuree, et personne d autre ne peut la
 * reconstituer apres coup. L ecran s y abonne pour l afficher a cote du
 * kilometre ; s il ne s y abonne pas, la mesure reste affichee sans nom,
 * ce qui est l etat actuel du preparateur.
 */
export type RouteProviderListener = (provider: RouteProvider) => void;

/**
 * Le moteur nomme par `/api/route`, ou `null` quand la reponse n en nomme
 * aucun — une reponse plus ancienne, ou un corps bricole. On ne devine
 * jamais a partir du mode : le mode dit quel graphe on VISEE, pas lequel
 * a repondu.
 */
export function readRouteProvider(payload: unknown): RouteProvider | null {
  const body = payload as { provider?: unknown } | null;
  const value = body?.provider;
  if (value === 'osrm' || value === 'valhalla' || value === 'brouter') return value;
  return null;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function isFinitePoint(point: GeoPoint): boolean {
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
 * L URL de la route, ou `null` quand la requete n a pas de sens.
 * La liste blanche de `/api/route` n attend que `points` et `mode` : on
 * n invente rien. Un mode invalide ne retombe sur aucun defaut, il ne produit
 * pas d'URL.
 */
export function routeQuery(points: readonly GeoPoint[], mode: TravelMode): string | null {
  if (!isTravelMode(mode)) return null;
  if (points.length < 2 || points.length > MAX_ROUTE_POINTS) return null;
  if (!points.every(isFinitePoint)) return null;
  const key = points.map((point) => `${round6(point.lon)},${round6(point.lat)}`).join(';');
  return `${ROUTE_ENDPOINT}?points=${key}&mode=${mode}`;
}

function readGeometry(raw: unknown): RouteLeg['geometry'] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const out: Array<[number, number]> = [];
  for (const pair of raw) {
    if (!Array.isArray(pair) || pair.length < 2) return null;
    const lon = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    out.push([lon, lat]);
  }
  return out;
}

// L'URL du profil altimetrique, ou `null` quand la requete n'a pas de sens.
//
// Meme convention que le routage : `lon,lat;lon,lat`. Un trace plus long que la
// limite du fournisseur est echantillonne a pas regulier - les deux extremites
// sont conservees, car ce sont elles qui portent les arrivees et les departs.
export function elevationQuery(geometry: readonly (readonly [number, number])[]): string | null {
  if (geometry.length < 2) return null;
  if (!geometry.every((pair) => isFinitePoint({ lat: pair[1], lon: pair[0] }))) return null;
  const stride = Math.max(1, Math.ceil(geometry.length / (MAX_ELEVATION_POINTS - 1)));
  const sampled: string[] = [];
  for (let index = 0; index < geometry.length; index += stride) {
    const [lon, lat] = geometry[index];
    sampled.push(`${round6(lon)},${round6(lat)}`);
  }
  const last = geometry[geometry.length - 1];
  const tail = `${round6(last[0])},${round6(last[1])}`;
  if (sampled[sampled.length - 1] !== tail) sampled.push(tail);
  if (sampled.length > MAX_ELEVATION_POINTS) sampled.length = MAX_ELEVATION_POINTS;
  return `${ELEVATION_ENDPOINT}?points=${sampled.join(';')}`;
}

// La reponse d'`/api/elevation`. Une altitude manquante est RENVOYEE telle
// quelle : c'est `elevationProfile` qui invalide le profil entier plutot que
// de sous-estimer le denivele.
export function readElevationResponse(payload: unknown, pointCount: number): (number | null)[] | null {
  const body = payload as { status?: unknown; elevations?: unknown } | null;
  if (!body || body.status !== 'ok' || !Array.isArray(body.elevations)) return null;
  if (body.elevations.length !== pointCount) return null;
  const out: (number | null)[] = [];
  for (const raw of body.elevations) {
    if (raw === null) {
      out.push(null);
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    out.push(value);
  }
  return out;
}

/**
 * La reponse de `/api/route`, lue sans invention.
 *
 * Exigee : un troncon par paire de points consecutive, donc `n - 1`. Une serie
 * plus courte est un decalage : la recoller ferait dire au kilometres une
 * mesure qui ne correspond a aucun trajet. On refuse la serie entiere.
 */
export function readRouteResponse(payload: unknown, pointCount: number): RouteLeg[] | null {
  const body = payload as { status?: unknown; legs?: unknown } | null;
  if (!body || body.status !== 'ok' || !Array.isArray(body.legs)) return null;
  if (body.legs.length !== pointCount - 1) return null;
  const legs: RouteLeg[] = [];
  for (const raw of body.legs) {
    const leg = raw as { distanceKm?: unknown; durationMin?: unknown; geometry?: unknown };
    const distanceKm = Number(leg?.distanceKm);
    const durationMin = Number(leg?.durationMin);
    const geometry = readGeometry(leg?.geometry);
    if (!Number.isFinite(distanceKm) || !Number.isFinite(durationMin) || !geometry) return null;
    legs.push({ distanceKm, durationMin, geometry });
  }
  return legs;
}

/**
 * Une chaine trop longue pour le fournisseur, decoupee en fenetres qui se
 * CHEVAUCHENT d un point.
 *
 * Le chevauchement est la jointure : sans lui, le dernier point d une fenetre
 * et le premier de la suivante ne seraient pas relies, et le kilometrage
 * afficherait un trou invisible. Les points ne sont jamais modifies.
 */
export function splitForProvider(
  points: readonly GeoPoint[],
  size: number,
): GeoPoint[][] {
  if (points.length <= size) return [points.slice()];
  const windows: GeoPoint[][] = [];
  for (let index = 0; index < points.length - 1; index += size - 1) {
    windows.push(points.slice(index, index + size));
    if (index + size >= points.length) break;
  }
  return windows;
}

/**
 * Les troncons de toutes les fenetres, recolles.
 *
 * Le premier point de chaque fenetre SAUF la premiere est la derniere extremite
 * de la precedente : il ne doit pas apparaitre deux fois, sinon la carte trace
 * un aller-retour d un point et le denivele compte ce pic deux fois.
 */
export function stitchLegs(batches: readonly (readonly RouteLeg[])[]): RouteLeg[] {
  const out: RouteLeg[] = [];
  batches.forEach((batch, batchIndex) => {
    batch.forEach((leg, legIndex) => {
      if (batchIndex > 0 && legIndex === 0) {
        const geometry = leg.geometry.slice(1);
        if (geometry.length < 2) return;
        out.push({ ...leg, geometry });
        return;
      }
      out.push({ ...leg, geometry: leg.geometry.slice() });
    });
  });
  return out;
}

/**
 * Les dependances de routage pour un navigateur.
 *
 * `elevation` n est pas branchee ici : le denivele exige une grille d altitude
 * point par point, et `/api/elevation` n est pas interroge par le preparateur.
 * Le denivele reste donc `null` - affiche « a verifier » - plutot que simule.
 */
export function browserRoutingDeps(
  fetchImpl: Fetcher = fetch,
  onProvider?: RouteProviderListener,
): RoutingDeps {
  return {
    route: async (points, mode, signal) => {
      const windows = splitForProvider(points, MAX_ROUTE_POINTS);
      const batches: RouteLeg[][] = [];
      for (const window of windows) {
        const query = routeQuery(window, mode);
        if (!query) return null;
        let response: Response;
        try {
          response = await fetchImpl(query, { signal, headers: { Accept: 'application/json' } });
        } catch {
          return null;
        }
        if (!response.ok) return null;
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          return null;
        }
        const legs = readRouteResponse(body, window.length);
        if (!legs) return null;
        // La provenance se lit ICI, sur la reponse qui porte la mesure, et
        // nulle part ailleurs : apres le collage des fenetres, la trace
        // seule ne dit plus quel moteur l a produite.
        const provider = readRouteProvider(body);
        if (provider && onProvider) onProvider(provider);
        batches.push(legs);
      }
      const stitched = stitchLegs(batches);
      return stitched.length > 0 ? stitched : null;
    },
    // L'altitude reelle du trace, via la route Next : c'est elle qui donne le
    // denivele. Le moteur l'aligne sur la geometrie, point par point.
    elevation: async (geometry, signal) => {
      // `elevationQuery` echantillonne deja un trace plus long que la limite
      // du fournisseur : il n'y a donc qu'une seule fenetre a interroger, et
      // aucune jointure a recoudre.
      const query = elevationQuery(geometry);
      if (!query) return null;
      const sent = query.split('points=')[1].split(';').length;
      let response: Response;
      try {
        response = await fetchImpl(query, { signal, headers: { Accept: 'application/json' } });
      } catch {
        return null;
      }
      if (!response.ok) return null;
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return null;
      }
      return readElevationResponse(body, sent);
    },
  };
}

/**
 * Les deux phases de mesure, branchees sur les vrais fournisseurs.
 *
 * La meteo passe par `/api/weather` et par le filtre anti-decalage du client :
 * une serie decalee est refusee entiere plutot que d attribuer a un jour la
 * meteo d un autre.
 */
export function browserMeasurementRunners(
  fetchImpl: Fetcher = fetch,
  onProvider?: RouteProviderListener,
): MeasurementRunners {
  const routing = browserRoutingDeps(fetchImpl, onProvider);
  return measurementRunners({
    route: routing,
    weather: async (dates, signal, anchor) => fetchWeatherThroughApi(anchor, dates, signal),
  });
}

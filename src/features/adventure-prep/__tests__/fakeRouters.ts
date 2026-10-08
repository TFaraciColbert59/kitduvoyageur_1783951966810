/**
 * Doubles des deux routeurs du plan 1.5 (Geoapify, Valhalla FOSSGIS), au
 * format REEL de leurs reponses : Geoapify en GeoJSON (une ligne par troncon,
 * `properties.legs[i].distance` en metres, `.time` en secondes), Valhalla en
 * `trip.legs[i].summary` (km, secondes) avec sa polyligne a 6 decimales.
 *
 * La geometrie est RECONSTITUEE depuis les points demandes : un routeur rend
 * toujours la trace du trajet qu'on lui demande. Une geometrie figee ferait
 * tomber chaque appel decale en `off_network` pour une raison qui n'existe pas.
 */
import type { RoutePoint } from '../routingService';

type LonLat = [number, number];

export function isGeoapify(url: string): boolean {
  return url.startsWith('https://api.geoapify.com/v1/routing');
}

export function isValhalla(url: string): boolean {
  return url.startsWith('https://valhalla1.openstreetmap.de/route');
}

/** Les points d'une requete Geoapify (`waypoints=lat,lon|lat,lon`). */
export function geoapifyWaypoints(url: string): RoutePoint[] {
  const raw = new URL(url).searchParams.get('waypoints') ?? '';
  return raw
    .split('|')
    .map((pair) => pair.split(',').map(Number))
    .filter((p) => p.length === 2 && p.every((n) => Number.isFinite(n)))
    .map(([lat, lon]) => ({ lat, lon }));
}

/** Le mode Geoapify demande (`hike`, `bicycle`, `drive`). */
export function geoapifyMode(url: string): string | null {
  return new URL(url).searchParams.get('mode');
}

/** Les points d'une requete Valhalla (`json={"locations":[...]}`). */
export function valhallaLocations(url: string): RoutePoint[] {
  const json = new URL(url).searchParams.get('json');
  const body = json ? (JSON.parse(json) as { locations?: Array<{ lat: number; lon: number }> }) : {};
  return (body.locations ?? []).map((l) => ({ lat: l.lat, lon: l.lon }));
}

/** Le `costing` Valhalla demande. */
export function valhallaCosting(url: string): string | null {
  const json = new URL(url).searchParams.get('json');
  return json ? ((JSON.parse(json) as { costing?: string }).costing ?? null) : null;
}

function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface FakeLegOptions {
  /** Vitesse du mode, en km/h (la duree en decoule). */
  speedKmh?: number;
  /** Detour du reseau par rapport au vol d'oiseau. */
  detour?: number;
  /** La trace s'arrete avant l'arrivee : decalage vers le sud, en degres. */
  stopShortDeg?: number;
  /** Distance forcee par troncon, en metres (0 : « vous y etes deja »). */
  meters?: number;
}

function legsFor(points: readonly RoutePoint[], options: FakeLegOptions) {
  const speed = options.speedKmh ?? 4;
  const detour = options.detour ?? 1.25;
  return points.slice(1).map((to, index) => {
    const from = points[index];
    const end: RoutePoint = { lat: to.lat - (options.stopShortDeg ?? 0), lon: to.lon };
    const meters = options.meters ?? Math.round(haversineKm(from, to) * detour * 1000);
    const seconds = Math.round((meters / 1000 / speed) * 3600);
    const line: LonLat[] = [
      [from.lon, from.lat],
      [(from.lon + end.lon) / 2, (from.lat + end.lat) / 2],
      [end.lon, end.lat],
    ];
    return { meters, seconds, line };
  });
}

/** Une reponse Geoapify pour la requete donnee. */
export function geoapifyReply(url: string, options: FakeLegOptions = {}): unknown {
  const points = geoapifyWaypoints(url);
  const legs = legsFor(points, options);
  return {
    type: 'FeatureCollection',
    properties: { mode: geoapifyMode(url), waypoints: points, units: 'metric' },
    features: [
      {
        type: 'Feature',
        properties: {
          mode: geoapifyMode(url),
          units: 'metric',
          distance: legs.reduce((t, l) => t + l.meters, 0),
          time: legs.reduce((t, l) => t + l.seconds, 0),
          legs: legs.map((l) => ({ distance: l.meters, time: l.seconds, steps: [] })),
        },
        geometry: { type: 'MultiLineString', coordinates: legs.map((l) => l.line) },
      },
    ],
  };
}

function encodeSigned(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

/** La polyligne Valhalla (latitude puis longitude, 6 decimales) d'une ligne `[lon, lat]`. */
export function encodeValhallaShape(line: readonly LonLat[]): string {
  let lat = 0;
  let lon = 0;
  let out = '';
  for (const [x, y] of line) {
    const ly = Math.round(y * 1e6);
    const lx = Math.round(x * 1e6);
    out += encodeSigned(ly - lat) + encodeSigned(lx - lon);
    lat = ly;
    lon = lx;
  }
  return out;
}

/** Une reponse Valhalla pour la requete donnee. */
export function valhallaReply(url: string, options: FakeLegOptions = {}): unknown {
  const legs = legsFor(valhallaLocations(url), options);
  return {
    trip: {
      status: 0,
      legs: legs.map((l) => ({
        summary: { length: l.meters / 1000, time: l.seconds },
        shape: encodeValhallaShape(l.line),
      })),
    },
  };
}

/** Une reponse `fetch` minimale : `text()` et `json()` sur le meme corps. */
export function jsonResponse(body: unknown, status = 200): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => JSON.parse(text),
  } as unknown as Response;
}

/**
 * Compas — géométrie des zones d'alerte au format CAP (fonctions pures).
 *
 * Les flux Meteoalarm (feeds.meteoalarm.org, relus le 2026-10-10) décrivent la
 * zone d'une alerte de trois façons selon le pays : un nom, un code
 * géographique, ou un CONTOUR. Seul le contour permet de dire, sans
 * référentiel de zones, si un point GPS est dedans :
 * - `polygon` : « lat,lon lat,lon … » (premier point répété à la fin) ;
 * - `circle` : « lat,lon rayon », rayon en kilomètres.
 * Un contour illisible est ignoré : jamais une zone devinée.
 */

/** Contour fermé : points à plat [lat0, lon0, lat1, lon1, …] et boîte [minLat, minLon, maxLat, maxLon]. */
export interface CapRing {
  pts: number[];
  bbox: [number, number, number, number];
}

export interface CapCircle {
  lat: number;
  lon: number;
  km: number;
}

export interface CapGeometry {
  rings: CapRing[];
  circles: CapCircle[];
}

const validLat = (v: number) => Number.isFinite(v) && Math.abs(v) <= 90;
const validLon = (v: number) => Number.isFinite(v) && Math.abs(v) <= 180;

/** Un contour CAP, ou null s'il est illisible (moins de 3 points, coordonnée hors du globe). */
export function parsePolygon(text: unknown): CapRing | null {
  if (typeof text !== 'string') return null;
  const pts: number[] = [];
  let minLat = Infinity;
  let minLon = Infinity;
  let maxLat = -Infinity;
  let maxLon = -Infinity;
  for (const pair of text.trim().split(/\s+/)) {
    const [a, b] = pair.split(',');
    const lat = Number(a);
    const lon = Number(b);
    if (a === undefined || b === undefined || a === '' || b === '' || !validLat(lat) || !validLon(lon)) return null;
    pts.push(lat, lon);
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  if (pts.length < 6) return null;
  return { pts, bbox: [minLat, minLon, maxLat, maxLon] };
}

/** Un cercle CAP (« lat,lon rayon »), ou null. */
export function parseCircle(text: unknown): CapCircle | null {
  if (typeof text !== 'string') return null;
  const m = /^\s*(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  const km = Number(m[3]);
  return validLat(lat) && validLon(lon) && km > 0 ? { lat, lon, km } : null;
}

/** Lancer de rayon : le point est-il dans le contour ? (x = longitude, y = latitude) */
function inRing(ring: CapRing, lat: number, lon: number): boolean {
  const [minLat, minLon, maxLat, maxLon] = ring.bbox;
  if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) return false;
  const p = ring.pts;
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const yi = p[i];
    const xi = p[i + 1];
    const yj = p[j];
    const xj = p[j + 1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const toRad = (d: number) => (d * Math.PI) / 180;

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const h =
    Math.sin(toRad(bLat - aLat) / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(toRad(bLon - aLon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Le point est-il dans l'un des contours ou cercles de la zone ? */
export function covers(geo: CapGeometry, lat: number, lon: number): boolean {
  if (!validLat(lat) || !validLon(lon)) return false;
  return (
    geo.rings.some((r) => inRing(r, lat, lon)) ||
    geo.circles.some((c) => distanceKm(c.lat, c.lon, lat, lon) <= c.km)
  );
}

/**
 * Géométrie pure de la carte de l'itinéraire (catégorie 2) : projection d'un geste sur le tracé,
 * insertion dans le tronçon voisin, jours, lentilles Pente / Surface, écart d'une position au tracé.
 * Aucune I/O ni DOM : tout est testé à part. Coordonnées `[lon, lat]` (GeoJSON).
 */
import type { CollaborativeRoutePoint, CollaborativeRouteSection, CollaborativeStage, SurfaceSegment } from './types';

export type LonLat = readonly [number, number];

const EARTH_M = 6_371_008.8;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: LonLat, b: LonLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Mètres par pixel d'écran à une latitude et un zoom MapLibre (tuiles de 512 px). */
export function metersPerPixel(lat: number, zoom: number): number {
  return (40_075_016.686 * Math.cos(toRad(lat))) / (512 * 2 ** zoom);
}

/** Distances cumulées en mètres le long d'une ligne (premier élément 0). */
export function cumulativeMeters(coords: readonly LonLat[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < coords.length; i += 1) out.push(out[i - 1] + haversineM(coords[i - 1], coords[i]));
  return out;
}

export interface PolylineProjection {
  /** Index du segment [index, index+1] le plus proche. */
  readonly index: number;
  /** Position dans ce segment, 0..1. */
  readonly t: number;
  readonly point: [number, number];
  /** Distance du geste au tracé (mètres). */
  readonly distanceM: number;
  /** Distance le long du tracé depuis son début (mètres). */
  readonly alongM: number;
}

/** Projette `p` sur la ligne : plan local équirectangulaire autour de `p` (juste à l'échelle d'un tracé). */
export function projectOnPolyline(coords: readonly LonLat[], p: LonLat): PolylineProjection | null {
  if (coords.length === 0) return null;
  if (coords.length === 1) {
    const d = haversineM(coords[0], p);
    return { index: 0, t: 0, point: [coords[0][0], coords[0][1]], distanceM: d, alongM: 0 };
  }
  const kx = Math.cos(toRad(p[1])) * 111_320;
  const ky = 110_540;
  let best: PolylineProjection | null = null;
  let acc = 0;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i];
    const b = coords[i + 1];
    const ax = (a[0] - p[0]) * kx;
    const ay = (a[1] - p[1]) * ky;
    const bx = (b[0] - p[0]) * kx;
    const by = (b[1] - p[1]) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : -(ax * dx + ay * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t * dx;
    const qy = ay + t * dy;
    const dist = Math.hypot(qx, qy);
    const segLen = haversineM(a, b);
    if (!best || dist < best.distanceM) {
      best = {
        index: i,
        t,
        point: [Number((a[0] + (b[0] - a[0]) * t).toFixed(6)), Number((a[1] + (b[1] - a[1]) * t).toFixed(6))],
        distanceM: dist,
        alongM: acc + segLen * t,
      };
    }
    acc += segLen;
  }
  return best;
}

/** Coupe la ligne au point projeté : [début..point] et [point..fin], sans doublon ni segment nul. */
export function splitPolylineAt(
  coords: readonly LonLat[],
  projection: Pick<PolylineProjection, 'index' | 'point'>,
): { first: Array<[number, number]>; second: Array<[number, number]> } {
  const head = coords.slice(0, projection.index + 1).map((c) => [c[0], c[1]] as [number, number]);
  const tail = coords.slice(projection.index + 1).map((c) => [c[0], c[1]] as [number, number]);
  const pt: [number, number] = [projection.point[0], projection.point[1]];
  const same = (a: LonLat, b: LonLat) => a[0] === b[0] && a[1] === b[1];
  const first = head.length > 0 && same(head[head.length - 1], pt) ? head : [...head, pt];
  const second = tail.length > 0 && same(tail[0], pt) ? tail : [pt, ...tail];
  return { first, second };
}

/** Point à `distanceM` du début de la ligne (interpolation), borné aux extrémités. */
export function pointAtDistance(coords: readonly LonLat[], cumM: readonly number[], distanceM: number): [number, number] | null {
  if (coords.length === 0) return null;
  if (distanceM <= 0) return [coords[0][0], coords[0][1]];
  const total = cumM[cumM.length - 1] ?? 0;
  if (distanceM >= total) {
    const last = coords[coords.length - 1];
    return [last[0], last[1]];
  }
  let lo = 0;
  let hi = cumM.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumM[mid] <= distanceM) lo = mid;
    else hi = mid;
  }
  const span = cumM[hi] - cumM[lo];
  const r = span === 0 ? 0 : (distanceM - cumM[lo]) / span;
  return [coords[lo][0] + (coords[hi][0] - coords[lo][0]) * r, coords[lo][1] + (coords[hi][1] - coords[lo][1]) * r];
}

/** Sous-ligne comprise entre deux ratios (0..1) de la longueur. */
export function sliceByRatio(coords: readonly LonLat[], from: number, to: number): Array<[number, number]> {
  if (coords.length < 2) return coords.map((c) => [c[0], c[1]] as [number, number]);
  const cum = cumulativeMeters(coords);
  const total = cum[cum.length - 1];
  if (total === 0) return coords.map((c) => [c[0], c[1]] as [number, number]);
  const a = Math.max(0, Math.min(1, from)) * total;
  const b = Math.max(0, Math.min(1, to)) * total;
  const out: Array<[number, number]> = [];
  const start = pointAtDistance(coords, cum, a);
  if (start) out.push(start);
  for (let i = 0; i < coords.length; i += 1) {
    if (cum[i] > a && cum[i] < b) out.push([coords[i][0], coords[i][1]]);
  }
  const end = pointAtDistance(coords, cum, b);
  if (end) out.push(end);
  return out;
}

/* ---------- Insertion dans le tronçon voisin (2.3) ---------- */

export interface InsertionTarget {
  /** Le nouveau point s'insère après celui-ci. */
  readonly afterPointId: string;
  readonly sectionId: string;
  readonly mode: CollaborativeRouteSection['mode'];
  /** Projection du geste sur le tronçon (le point posé y est ramené si le tronçon est gardé tel quel). */
  readonly projection: PolylineProjection;
}

/**
 * Le tronçon voisin d'un geste : le plus proche, à moins de `maxDistanceM`. `null` si aucun ne l'est
 * (le point s'ajoute alors en fin de liste). Seuls comptent les tronçons qui relient deux points consécutifs.
 */
export function findInsertionTarget(
  orderedPoints: readonly Pick<CollaborativeRoutePoint, 'id'>[],
  sections: readonly CollaborativeRouteSection[],
  lat: number,
  lon: number,
  maxDistanceM: number,
): InsertionTarget | null {
  const indexOf = new Map(orderedPoints.map((p, i) => [p.id, i]));
  let best: InsertionTarget | null = null;
  for (const s of sections) {
    const a = indexOf.get(s.fromPointId);
    const b = indexOf.get(s.toPointId);
    if (a == null || b == null || b !== a + 1) continue;
    const proj = projectOnPolyline(s.geometry.coordinates, [lon, lat]);
    if (!proj || proj.distanceM > maxDistanceM) continue;
    if (!best || proj.distanceM < best.projection.distanceM) {
      best = { afterPointId: s.fromPointId, sectionId: s.id, mode: s.mode, projection: proj };
    }
  }
  return best;
}

/* ---------- Jours (2.5) ---------- */

/** Numéro de jour de chaque tronçon : les tronçons entre le départ et l'arrivée de chaque étape. */
export function sectionDayMap(
  orderedPoints: readonly Pick<CollaborativeRoutePoint, 'id'>[],
  sections: readonly CollaborativeRouteSection[],
  stages: readonly CollaborativeStage[],
): Map<string, number> {
  const indexOf = new Map(orderedPoints.map((p, i) => [p.id, i]));
  const out = new Map<string, number>();
  const ordered = stages.slice().sort((a, b) => a.dayNumber - b.dayNumber);
  for (const s of sections) {
    const a = indexOf.get(s.fromPointId);
    if (a == null) continue;
    for (const st of ordered) {
      const from = indexOf.get(st.startPointId);
      const to = indexOf.get(st.endPointId);
      if (from == null || to == null) continue;
      if (a >= from && a < to) {
        out.set(s.id, st.dayNumber);
        break;
      }
    }
  }
  return out;
}

/** Couleur de jour : cycle sur la palette (jeton `--lkv-*`), le jour 1 prend la première. */
export function dayColorIndex(day: number, paletteSize: number): number {
  if (paletteSize <= 0) return 0;
  const d = Number.isFinite(day) && day >= 1 ? Math.floor(day) : 1;
  return (d - 1) % paletteSize;
}

/* ---------- Lentilles Pente et Surface (2.5, expert) ---------- */

export type SlopeBucket = 'flat' | 'moderate' | 'sustained' | 'steep' | 'unknown';

/** Seuils de pente (|%|) : même découpage que `slopeBuckets` de l'analyse (5, 10, 15 %). */
export function slopeBucketOf(slopePct: number | null): SlopeBucket {
  if (slopePct == null || !Number.isFinite(slopePct)) return 'unknown';
  const a = Math.abs(slopePct);
  if (a < 5) return 'flat';
  if (a < 10) return 'moderate';
  if (a < 15) return 'sustained';
  return 'steep';
}

export interface LensSegment {
  readonly sectionId: string;
  readonly coordinates: Array<[number, number]>;
  /** Pente (%) ou surface selon la lentille. */
  readonly value: number | string | null;
  readonly bucket: string;
}

/**
 * Pente par intervalle d'échantillons d'altitude. Les échantillons sont répartis par indice de coordonnée
 * (comme `buildElevationProfile`) ; un échantillon absent rend l'intervalle « inconnu », jamais plat.
 */
export function slopeLensSegments(sections: readonly CollaborativeRouteSection[]): LensSegment[] {
  const out: LensSegment[] = [];
  for (const s of sections) {
    const coords = s.geometry.coordinates;
    const ele = s.elevationSamples;
    if (coords.length < 2) continue;
    if (!ele || ele.length < 2) {
      out.push({ sectionId: s.id, coordinates: coords.map((c) => [c[0], c[1]] as [number, number]), value: null, bucket: 'unknown' });
      continue;
    }
    const idx = (k: number) => Math.min(coords.length - 1, Math.round((k / (ele.length - 1)) * (coords.length - 1)));
    for (let k = 0; k < ele.length - 1; k += 1) {
      const i0 = idx(k);
      const i1 = idx(k + 1);
      if (i1 <= i0) continue;
      const seg = coords.slice(i0, i1 + 1).map((c) => [c[0], c[1]] as [number, number]);
      const lenM = cumulativeMeters(seg).pop() ?? 0;
      const e0 = ele[k];
      const e1 = ele[k + 1];
      const pct = e0 != null && e1 != null && lenM > 0 ? ((e1 - e0) / lenM) * 100 : null;
      out.push({ sectionId: s.id, coordinates: seg, value: pct == null ? null : Number(pct.toFixed(1)), bucket: slopeBucketOf(pct) });
    }
  }
  return out;
}

/** Surface par tronçon : les segments déclarés (ratios de longueur) ; sans déclaration, « inconnue ». */
export function surfaceLensSegments(sections: readonly CollaborativeRouteSection[]): LensSegment[] {
  const out: LensSegment[] = [];
  for (const s of sections) {
    const coords = s.geometry.coordinates;
    if (coords.length < 2) continue;
    const segs: readonly SurfaceSegment[] = s.surfaceSegments.length > 0 ? s.surfaceSegments : [{ fromRatio: 0, toRatio: 1, surface: 'unknown' }];
    for (const seg of segs) {
      const part = sliceByRatio(coords, seg.fromRatio, seg.toRatio);
      if (part.length < 2) continue;
      out.push({ sectionId: s.id, coordinates: part, value: seg.surface, bucket: seg.surface });
    }
  }
  return out;
}

/* ---------- Position en direct (2.9) ---------- */

export const OFF_TRACK_THRESHOLD_M = 50;

export interface TrackDeviation {
  readonly distanceM: number;
  readonly offTrack: boolean;
  readonly alongKm: number;
}

/** Écart d'une position au tracé. `null` s'il n'y a pas de tracé : on ne dit rien plutôt que 0 m. */
export function deviationFromTrack(coords: readonly LonLat[], position: LonLat, thresholdM = OFF_TRACK_THRESHOLD_M): TrackDeviation | null {
  if (coords.length < 2) return null;
  const proj = projectOnPolyline(coords, position);
  if (!proj) return null;
  return { distanceM: Math.round(proj.distanceM), offTrack: proj.distanceM > thresholdM, alongKm: Number((proj.alongM / 1000).toFixed(2)) };
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const;

/** Cap en degrés → « NE » ; `null` si le capteur n'en donne pas (immobile, pas de boussole). */
export function headingLabel(deg: number | null | undefined): string | null {
  if (deg == null || !Number.isFinite(deg)) return null;
  const norm = ((deg % 360) + 360) % 360;
  return COMPASS[Math.round(norm / 45) % 8];
}

/**
 * Compas — descente de rivière (canoë, kayak) : un soir au bord de l'eau, vers l'aval.
 *
 * « 3 jours de canoë sur la Dordogne » donnait Sarlat, Périgueux, Sarlat : un
 * séjour sur une base, dont une ville loin de la rivière. Ici, le tracé de la
 * rivière (OpenStreetMap, tronçons dans le sens du courant) fixe la descente :
 * un tronçon de 18 km par jour environ, centré sur la destination, et chaque
 * soir le lieu réel le plus proche du point visé, à moins de 2,5 km de l'eau.
 * Même entrée → même descente. Aucune I/O ici.
 */

import { distanceKm } from './places';
import { isGenericName, type AreaPlace } from './itinerary';
import type { LngLat } from './track';

/** Distance de pagaie d'une journée (km), randonnée nautique en eau calme à vive. */
export const RIVER_DAY_KM = 18;
/** Un lieu « au bord de l'eau » : à moins de cette distance du tracé (km). */
const BANK_KM = 2.5;

const key = (c: LngLat) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`;
const pt = (c: LngLat) => ({ lat: c[1], lon: c[0] });

/** Tronçons d'une réponse Overpass (`out geom`) : [lon, lat] dans le sens du tracé OSM (le courant). */
export function parseRiverWays(payload: unknown): LngLat[][] {
  const els = (payload as { elements?: unknown[] } | null)?.elements;
  if (!Array.isArray(els)) return [];
  const out: LngLat[][] = [];
  for (const raw of els) {
    const e = raw as { type?: string; geometry?: Array<{ lat?: number; lon?: number }> };
    if (e.type !== 'way' || !Array.isArray(e.geometry)) continue;
    const line = e.geometry
      .map((g) => [Number(g.lon), Number(g.lat)] as LngLat)
      .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
    if (line.length >= 2) out.push(line);
  }
  return out;
}

function lengthKm(line: readonly LngLat[]): number {
  let t = 0;
  for (let i = 1; i < line.length; i += 1) t += distanceKm(pt(line[i - 1]), pt(line[i]));
  return t;
}

/**
 * Tronçons OSM (orientés vers l'aval) → la plus longue chaîne continue, de
 * l'amont vers l'aval. Un bras secondaire (île, défluent) est laissé de côté.
 */
export function chainRiver(ways: readonly LngLat[][]): LngLat[] {
  if (!ways.length) return [];
  const startsAt = new Map<string, number[]>();
  const endKeys = new Set<string>();
  ways.forEach((w, i) => {
    const k = key(w[0]);
    startsAt.set(k, [...(startsAt.get(k) ?? []), i]);
    endKeys.add(key(w[w.length - 1]));
  });
  const heads = ways.map((_, i) => i).filter((i) => !endKeys.has(key(ways[i][0])));
  const seeds = heads.length ? heads : [ways.map((w, i) => [lengthKm(w), i]).sort((a, b) => b[0] - a[0])[0][1]];
  let bestLine: LngLat[] = [];
  let bestKm = -1;
  for (const seed of seeds) {
    const used = new Set<number>([seed]);
    const line: LngLat[] = [...ways[seed]];
    for (;;) {
      const next = (startsAt.get(key(line[line.length - 1])) ?? [])
        .filter((i) => !used.has(i))
        .sort((a, b) => lengthKm(ways[b]) - lengthKm(ways[a]) || a - b)[0];
      if (next == null) break;
      used.add(next);
      line.push(...ways[next].slice(1));
    }
    const km = lengthKm(line);
    if (km > bestKm) {
      bestKm = km;
      bestLine = line;
    }
  }
  return bestLine;
}

export interface RiverStage {
  day: number;
  name: string;
  lat: number;
  lon: number;
  /** Pagaie ce jour-là, sinon une journée sur place. */
  move: 'pagaie' | 'aucun';
  note: string | null;
  placeId: string | null;
  /** Kilomètres de rivière parcourus ce jour-là. */
  riverKm: number | null;
  /** Le tracé de la rivière de la veille à ce soir. */
  geometry: LngLat[] | null;
}

export interface RiverPlan {
  start: { name: string; lat: number; lon: number };
  stages: RiverStage[];
  /** Longueur de la descente (km de rivière). */
  sectionKm: number;
}

const KIND_SCORE: Partial<Record<AreaPlace['kind'], number>> = { town: 1.2, village: 1, camp: 1, hamlet: 0.6, city: 0.8 };

/**
 * Descente de `days` jours sur `line` (amont → aval), centrée sur le point du
 * tracé le plus proche de `center`. Null si la rivière est trop courte ou
 * qu'aucun lieu réel ne la borde.
 */
export function planRiverDescent(input: {
  line: readonly LngLat[];
  places: readonly AreaPlace[];
  days: number;
  center: { lat: number; lon: number };
  dayKm?: number;
}): RiverPlan | null {
  const { line, days } = input;
  if (line.length < 2 || !Number.isInteger(days) || days < 1) return null;
  const cum = [0];
  for (let i = 1; i < line.length; i += 1) cum.push(cum[i - 1] + distanceKm(pt(line[i - 1]), pt(line[i])));
  const total = cum[cum.length - 1];
  if (total < 5) return null;
  const step = Math.min(input.dayKm ?? RIVER_DAY_KM, total / days);
  const section = step * days;

  const nearest = (p: { lat: number; lon: number }) => {
    let idx = 0;
    let d = Infinity;
    line.forEach((c, i) => {
      const x = distanceKm(p, pt(c));
      if (x < d) {
        d = x;
        idx = i;
      }
    });
    return { idx, off: d };
  };
  // Lieux au bord de l'eau, avec leur kilomètre de rivière.
  const bank = input.places
    .filter((p) => KIND_SCORE[p.kind] != null && !isGenericName(p.name))
    .map((p) => ({ p, ...nearest(p) }))
    .filter((b) => b.off <= BANK_KM)
    .map((b) => ({ ...b, km: cum[b.idx] }));
  if (!bank.length) return null;

  // Tronçon centré sur la destination, dans la rivière.
  const kc = cum[nearest(input.center).idx];
  const s0 = Math.min(Math.max(0, kc - section / 2), Math.max(0, total - section));
  const score = (b: (typeof bank)[number], target: number) =>
    -2 * (Math.abs(b.km - target) / step) + (KIND_SCORE[b.p.kind] ?? 0) - b.off / 2;
  const pick = (list: typeof bank, target: number) =>
    list.reduce<(typeof bank)[number] | null>(
      (top, b) => (!top || score(b, target) > score(top, target) + 1e-9 || (Math.abs(score(b, target) - score(top, target)) <= 1e-9 && b.p.id < top.p.id) ? b : top),
      null
    );

  const first = pick(bank.filter((b) => Math.abs(b.km - s0) <= step * 0.6), s0);
  if (!first) return null;
  const used = new Set<string>([first.p.id]);
  let prev = first;
  const stages: RiverStage[] = [];
  for (let day = 1; day <= days; day += 1) {
    const target = first.km + day * step;
    const next = pick(
      bank.filter((b) => !used.has(b.p.id) && b.km > prev.km + step * 0.4 && b.km <= target + step * 0.5),
      target
    );
    if (!next) {
      stages.push({
        day,
        name: prev.p.name,
        lat: prev.p.lat,
        lon: prev.p.lon,
        move: 'aucun',
        note: 'Aucun lieu au bord de l’eau à distance d’une journée de pagaie : journée sur place, ou bivouac à vérifier sur place.',
        placeId: prev.p.id,
        riverKm: null,
        geometry: null,
      });
      continue;
    }
    used.add(next.p.id);
    stages.push({
      day,
      name: next.p.name,
      lat: next.p.lat,
      lon: next.p.lon,
      move: 'pagaie',
      note: day === 1 ? `Mise à l’eau à ${first.p.name}.` : null,
      placeId: next.p.id,
      riverKm: Math.round((next.km - prev.km) * 10) / 10,
      geometry: line.slice(prev.idx, next.idx + 1) as LngLat[],
    });
    prev = next;
  }
  return {
    start: { name: first.p.name, lat: first.p.lat, lon: first.p.lon },
    stages,
    sectionKm: Math.round((prev.km - first.km) * 10) / 10,
  };
}

/**
 * Zone où chercher les lieux de la descente : le milieu du tronçon visé et
 * un rayon qui le couvre (avant de connaître les lieux).
 */
export function descentWindow(
  line: readonly LngLat[],
  days: number,
  center: { lat: number; lon: number },
  dayKm = RIVER_DAY_KM
): { center: { lat: number; lon: number }; radiusKm: number } | null {
  if (line.length < 2 || days < 1) return null;
  const cum = [0];
  for (let i = 1; i < line.length; i += 1) cum.push(cum[i - 1] + distanceKm(pt(line[i - 1]), pt(line[i])));
  const total = cum[cum.length - 1];
  const section = Math.min(total, dayKm * days);
  let idx = 0;
  let d = Infinity;
  line.forEach((c, i) => {
    const x = distanceKm(center, pt(c));
    if (x < d) {
      d = x;
      idx = i;
    }
  });
  const s0 = Math.min(Math.max(0, cum[idx] - section / 2), Math.max(0, total - section));
  const midKm = s0 + section / 2;
  const mid = cum.findIndex((k) => k >= midKm);
  const at = line[mid < 0 ? line.length - 1 : mid];
  // Une rivière serpente : le tronçon tient dans un cercle plus petit que sa longueur.
  return { center: pt(at), radiusKm: Math.round(Math.min(60, section / 2 + 8)) };
}

/**
 * Compas — grand itinéraire de randonnée suivi sur son tracé (plan 3.7 et 4.5).
 *
 * « GR20 en 8 jours », « Tour du Mont-Blanc » donnaient un séjour en étoile autour d'un
 * point, ou une proposition de l'IA. Ici, le tracé de la relation OpenStreetMap (ODbL,
 * réseaux international et national) fixe la marche : une longueur de tracé par jour selon
 * le barème de l'activité, et chaque soir le lieu réel le plus proche du point visé, à
 * moins de 3 km du tracé. Même entrée → même itinéraire. Aucune I/O ici.
 *
 * Rien d'inventé : un soir sans lieu réel à portée du tracé n'a pas de nom de lieu, il
 * est posé SUR le tracé (point calculé), sans identifiant, avec une note qui dit que
 * l'emplacement est à choisir sur place. Le tracé est simplifié : les variantes et les
 * boucles secondaires sont écartées (la plus longue chaîne continue est suivie).
 */

import { distanceKm } from './places';
import { extentBoxes, isGenericName, type AreaPlace, type AreaPlaceKind } from './itinerary';
import { normalizeTrailRef } from './geoTrails';
import type { LngLat } from './track';

/** Un lieu « sur le tracé » : à moins de cette distance de la ligne (km). */
export const TRAIL_OFF_KM = 3;

const key = (c: LngLat) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`;
const pt = (c: LngLat) => ({ lat: c[1], lon: c[0] });

/** « GR20 » → motif Overpass qui accepte « GR20 », « GR 20 » et « GR-20 » (sans casse). */
export function trailRefPattern(ref: string): string | null {
  const norm = normalizeTrailRef(ref);
  if (!norm) return null;
  const m = /^(\p{L}*)(\p{N}*)(\p{L}*)$/u.exec(norm);
  if (!m || (!m[1] && !m[2])) return null;
  const sep = ' ?-?';
  const parts = [m[1], m[2], m[3]].filter(Boolean);
  return `^${parts.join(sep)}$`;
}

/** Nom d'un itinéraire → motif Overpass (« Tour du Mont-Blanc »), null si trop court. */
export function trailNamePattern(name: string): string | null {
  const bare = name.trim().replace(/["\\]/g, '');
  if (bare.length < 4) return null;
  const escaped = bare.replace(/[.^$*+?()[\]{}|]/g, (c) => `\\\\${c}`).replace(/[-\s]+/g, '[- ]');
  return `^${escaped}$`;
}

/**
 * La requête Overpass d'un itinéraire (relation `route=hiking`) dans l'emprise
 * [ouest, nord, est, sud]. Par référence (réseaux international ou national) ou par nom.
 * Null sans référence ni nom exploitables, ou pour une emprise qui ne dit rien (globe entier).
 */
export function trailLineQuery(input: {
  ref?: string | null;
  name?: string | null;
  extent: readonly [number, number, number, number];
}): string | null {
  const boxes = extentBoxes(input.extent);
  if (!boxes) return null;
  const refPattern = input.ref ? trailRefPattern(input.ref) : null;
  const namePattern = !refPattern && input.name ? trailNamePattern(input.name) : null;
  if (!refPattern && !namePattern) return null;
  const rels = boxes.map(([w, s, e, n]) => {
    const bbox = `(${s.toFixed(3)},${w.toFixed(3)},${n.toFixed(3)},${e.toFixed(3)})`;
    return refPattern
      ? `rel["route"="hiking"]["network"~"^(iwn|nwn)$"]["ref"~"${refPattern}",i]${bbox};`
      : `rel["route"="hiking"]["name"~"${namePattern}",i]${bbox};`;
  });
  return `[out:json][timeout:25];(${rels.join('')});out geom;`;
}

/** Une relation lue : ses tronçons ([lon, lat]) et ce qu'OSM en dit. */
export interface TrailRelation {
  ref: string | null;
  name: string | null;
  ways: LngLat[][];
}

/** Réponse Overpass (`out geom` sur des relations) → relations et tronçons. Rien d'autre n'est lu. */
export function parseTrailRelations(payload: unknown): TrailRelation[] {
  const els = (payload as { elements?: unknown[] } | null)?.elements;
  if (!Array.isArray(els)) return [];
  const out: TrailRelation[] = [];
  for (const raw of els) {
    const e = raw as {
      type?: string;
      tags?: Record<string, string>;
      members?: Array<{ type?: string; role?: string; geometry?: Array<{ lat?: number; lon?: number }> }>;
    };
    if (e.type !== 'relation' || !Array.isArray(e.members)) continue;
    if (e.tags?.route !== 'hiking') continue;
    const ways: LngLat[][] = [];
    for (const m of e.members) {
      if (m.type !== 'way' || !Array.isArray(m.geometry)) continue;
      // Variantes, alternatives, approches : pas le tracé principal.
      if (m.role && /alternative|approach|excursion|connection|spur/i.test(m.role)) continue;
      const line = m.geometry
        .map((g) => [Number(g.lon), Number(g.lat)] as LngLat)
        .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
      if (line.length >= 2) ways.push(line);
    }
    if (ways.length) out.push({ ref: e.tags?.ref ?? null, name: e.tags?.['name:fr'] || e.tags?.name || null, ways });
  }
  return out;
}

function lengthKm(line: readonly LngLat[]): number {
  let t = 0;
  for (let i = 1; i < line.length; i += 1) t += distanceKm(pt(line[i - 1]), pt(line[i]));
  return t;
}

/**
 * Tronçons OSM (dans un ordre et un sens quelconques) → la plus longue chaîne continue.
 * On part d'un bout libre (un nœud qu'un seul tronçon touche), sinon du plus long tronçon
 * (boucle) ; à chaque nœud on continue par le plus long tronçon non utilisé.
 */
export function chainTrail(ways: readonly LngLat[][]): LngLat[] {
  if (!ways.length) return [];
  const touch = new Map<string, number[]>();
  ways.forEach((w, i) => {
    for (const end of [w[0], w[w.length - 1]]) {
      const k = key(end);
      const list = touch.get(k) ?? [];
      if (!list.includes(i)) list.push(i);
      touch.set(k, list);
    }
  });
  const lens = ways.map(lengthKm);
  const ends = ways.flatMap((w, i) => [
    { i, rev: false, node: key(w[0]) },
    { i, rev: true, node: key(w[w.length - 1]) },
  ]);
  const free = ends.filter((e) => (touch.get(e.node)?.length ?? 0) === 1);
  const longest = lens.map((l, i) => [l, i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1])[0][1];
  const seeds = free.length ? free : [{ i: longest, rev: false, node: key(ways[longest][0]) }];
  let best: LngLat[] = [];
  let bestKm = -1;
  for (const seed of seeds) {
    const used = new Set<number>([seed.i]);
    const line: LngLat[] = seed.rev ? [...ways[seed.i]].reverse() : [...ways[seed.i]];
    for (;;) {
      const at = key(line[line.length - 1]);
      const next = (touch.get(at) ?? []).filter((i) => !used.has(i)).sort((a, b) => lens[b] - lens[a] || a - b)[0];
      if (next == null) break;
      used.add(next);
      const w = ways[next];
      line.push(...(key(w[0]) === at ? w.slice(1) : [...w].reverse().slice(1)));
    }
    const km = lengthKm(line);
    if (km > bestKm + 1e-9) {
      bestKm = km;
      best = line;
    }
  }
  return best;
}

/** Parmi plusieurs relations (variantes, doublons), la plus longue ; sa chaîne continue. */
export function pickTrailLine(relations: readonly TrailRelation[]): { line: LngLat[]; ref: string | null; name: string | null } | null {
  let top: { line: LngLat[]; km: number; rel: TrailRelation } | null = null;
  for (const rel of relations) {
    const line = chainTrail(rel.ways);
    const km = lengthKm(line);
    if (line.length >= 2 && (!top || km > top.km)) top = { line, km, rel };
  }
  return top ? { line: top.line, ref: top.rel.ref, name: top.rel.name } : null;
}

export interface TrailStage {
  day: number;
  name: string;
  lat: number;
  lon: number;
  move: 'marche' | 'aucun';
  note: string | null;
  /** Identifiant du lieu réel, null pour un point calculé sur le tracé. */
  placeId: string | null;
  /** Kilomètres de tracé parcourus ce jour-là, sinon null. */
  trailKm: number | null;
  /** Le tracé de la veille à ce soir. */
  geometry: LngLat[] | null;
}

export interface TrailPlan {
  start: { name: string; lat: number; lon: number };
  stages: TrailStage[];
  /** Longueur de tracé parcourue (km). */
  sectionKm: number;
  /** Longueur du tracé entier (km). */
  totalKm: number;
  /** Le tracé entier est parcouru (sinon un tronçon, centré sur le lieu visé). */
  whole: boolean;
}

const KIND_SCORE: Partial<Record<AreaPlaceKind, number>> = { hut: 1.3, camp: 1.1, village: 1, town: 0.9, hamlet: 0.8, city: 0.3 };

function cumulative(line: readonly LngLat[]): number[] {
  const cum = [0];
  for (let i = 1; i < line.length; i += 1) cum.push(cum[i - 1] + distanceKm(pt(line[i - 1]), pt(line[i])));
  return cum;
}

/** Point du tracé au kilomètre `km` (interpolation sur le segment). */
function pointAt(line: readonly LngLat[], cum: readonly number[], km: number): { lat: number; lon: number; idx: number } {
  const k = Math.min(Math.max(km, 0), cum[cum.length - 1]);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < k) i += 1;
  const seg = cum[i] - cum[i - 1];
  const f = seg > 0 ? (k - cum[i - 1]) / seg : 0;
  const a = line[i - 1];
  const b = line[i];
  return { lat: a[1] + (b[1] - a[1]) * f, lon: a[0] + (b[0] - a[0]) * f, idx: f >= 0.5 ? i : i - 1 };
}

/**
 * La longueur de tracé d'une journée : le tracé entier réparti sur les jours s'il tient dans la
 * borne haute du barème, sinon la journée typique sur un tronçon centré.
 */
function stepFor(total: number, days: number, dayKm: readonly [number, number, number]): { step: number; whole: boolean } {
  const [, typ, max] = dayKm;
  if (total <= days * max) return { step: total / days, whole: true };
  return { step: typ, whole: false };
}

/**
 * Zone où chercher les lieux de la marche : le milieu du tronçon visé et un rayon qui le couvre
 * (avant de connaître les lieux). Null si le tracé ou la durée ne permettent rien.
 */
export function trailWindow(
  line: readonly LngLat[],
  days: number,
  center: { lat: number; lon: number },
  dayKm: readonly [number, number, number]
): { center: { lat: number; lon: number }; radiusKm: number } | null {
  if (line.length < 2 || !Number.isInteger(days) || days < 1) return null;
  const cum = cumulative(line);
  const total = cum[cum.length - 1];
  if (total < 3) return null;
  const { step, whole } = stepFor(total, days, dayKm);
  const section = step * days;
  const kc = whole ? total / 2 : nearestOn(line, center).idx >= 0 ? cum[nearestOn(line, center).idx] : total / 2;
  const s0 = whole ? 0 : Math.min(Math.max(0, kc - section / 2), Math.max(0, total - section));
  const mid = pointAt(line, cum, s0 + section / 2);
  let r = 0;
  for (let i = 0; i < line.length; i += 1) {
    if (cum[i] < s0 - step || cum[i] > s0 + section + step) continue;
    r = Math.max(r, distanceKm(mid, pt(line[i])));
  }
  return { center: { lat: mid.lat, lon: mid.lon }, radiusKm: Math.min(Math.ceil(r) + TRAIL_OFF_KM + 2, 200) };
}

function nearestOn(line: readonly LngLat[], p: { lat: number; lon: number }): { idx: number; off: number } {
  let idx = -1;
  let d = Infinity;
  line.forEach((c, i) => {
    const x = distanceKm(p, pt(c));
    if (x < d) {
      d = x;
      idx = i;
    }
  });
  return { idx, off: d };
}

/**
 * Marche de `days` jours sur `line` (début → fin du tracé tel que chaîné). Un tracé qui tient dans
 * la borne haute du barème est parcouru en entier ; un tracé plus long est parcouru sur un tronçon
 * d'une journée typique par jour, centré sur le point du tracé le plus proche de `center`.
 * Null si le tracé ou la durée ne le permettent pas (moins de 3 km, ou aucune journée de marche
 * posée). Un soir sans lieu réel à portée du tracé est un point calculé sur le tracé, dit.
 */
export function planTrailTrek(input: {
  line: readonly LngLat[];
  places: readonly AreaPlace[];
  days: number;
  center: { lat: number; lon: number };
  /** Barème de l'activité : [minimum, typique, maximum] km par jour. */
  dayKm: readonly [number, number, number];
  /** « GR20 », « Tour du Mont-Blanc » : le nom donné aux points calculés sur le tracé. */
  label: string;
}): TrailPlan | null {
  const { line, days, dayKm, label } = input;
  if (line.length < 2 || !Number.isInteger(days) || days < 1) return null;
  const cum = cumulative(line);
  const total = cum[cum.length - 1];
  if (total < 3) return null;
  const { step, whole } = stepFor(total, days, dayKm);
  const section = step * days;
  const kc = cum[Math.max(0, nearestOn(line, input.center).idx)];
  const s0 = whole ? 0 : Math.min(Math.max(0, kc - section / 2), Math.max(0, total - section));

  const bank = input.places
    .filter((p) => KIND_SCORE[p.kind] != null && !isGenericName(p.name))
    .map((p) => ({ p, ...nearestOn(line, p) }))
    .filter((b) => b.off <= TRAIL_OFF_KM)
    .map((b) => ({ ...b, km: cum[b.idx] }));

  const score = (b: (typeof bank)[number], target: number) =>
    -2 * (Math.abs(b.km - target) / step) + (KIND_SCORE[b.p.kind] ?? 0) - b.off / 2;
  const pick = (list: typeof bank, target: number) =>
    list.reduce<(typeof bank)[number] | null>((top, b) => {
      if (!top) return b;
      const d = score(b, target) - score(top, target);
      return d > 1e-9 || (Math.abs(d) <= 1e-9 && b.p.id < top.p.id) ? b : top;
    }, null);

  // Départ : un lieu réel près du début du tronçon, sinon le point du tracé (dit).
  const first = pick(bank.filter((b) => Math.abs(b.km - s0) <= step * 0.6), s0);
  const startPt = pointAt(line, cum, s0);
  const start = first
    ? { name: first.p.name, lat: first.p.lat, lon: first.p.lon }
    : { name: `${label} · départ du tracé (km ${Math.round(s0)})`, lat: startPt.lat, lon: startPt.lon };
  let prevKm = first ? first.km : s0;
  let prevIdx = first ? first.idx : startPt.idx;
  const used = new Set<string>(first ? [first.p.id] : []);

  const stages: TrailStage[] = [];
  for (let day = 1; day <= days; day += 1) {
    const target = s0 + day * step;
    const last = day === days;
    // Un soir ne peut pas être en arrière ni à moins de 40 % d'une journée de la veille.
    const next = pick(
      bank.filter((b) => !used.has(b.p.id) && b.km > prevKm + step * 0.4 && b.km <= target + step * 0.5 && (!last || b.km >= target - step * 0.5)),
      target
    );
    if (next) {
      used.add(next.p.id);
      stages.push({
        day,
        name: next.p.name,
        lat: next.p.lat,
        lon: next.p.lon,
        move: 'marche',
        note: day === 1 && first ? `Départ du tracé à ${first.p.name}.` : null,
        placeId: next.p.id,
        trailKm: Math.round((next.km - prevKm) * 10) / 10,
        geometry: line.slice(prevIdx, next.idx + 1) as LngLat[],
      });
      prevKm = next.km;
      prevIdx = next.idx;
      continue;
    }
    // Aucun lieu réel à portée du tracé : un point calculé sur le tracé, jamais un nom de lieu.
    const spot = pointAt(line, cum, Math.min(target, total));
    if (spot.idx <= prevIdx || target - prevKm < step * 0.4) {
      stages.push({
        day,
        name: stages.length ? stages[stages.length - 1].name : start.name,
        lat: stages.length ? stages[stages.length - 1].lat : start.lat,
        lon: stages.length ? stages[stages.length - 1].lon : start.lon,
        move: 'aucun',
        note: 'Journée sur place : fin du tracé atteinte ou aucun lieu plus loin à portée du tracé.',
        placeId: null,
        trailKm: null,
        geometry: null,
      });
      continue;
    }
    stages.push({
      day,
      name: `${label} · km ${Math.round(Math.min(target, total))}`,
      lat: spot.lat,
      lon: spot.lon,
      move: 'marche',
      note: `Aucun village, refuge ni camping connu à moins de ${TRAIL_OFF_KM} km du tracé à cette distance : point calculé sur le tracé, emplacement de la nuit à choisir sur place (refuge hors des données ou bivouac : règles locales à vérifier).`,
      placeId: null,
      trailKm: Math.round((Math.min(target, total) - prevKm) * 10) / 10,
      geometry: line.slice(prevIdx, spot.idx + 1) as LngLat[],
    });
    prevKm = Math.min(target, total);
    prevIdx = spot.idx;
  }
  if (!stages.some((s) => s.move === 'marche')) return null;
  return {
    start,
    stages,
    sectionKm: Math.round((prevKm - (first ? first.km : s0)) * 10) / 10,
    totalKm: Math.round(total * 10) / 10,
    whole,
  };
}

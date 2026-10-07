import { distanceKm } from './places';

/**
 * Remise en ordre des étapes proposées par l'IA.
 *
 * Le modèle propose parfois un circuit qui zigzague (Rennes → Brest → Saint-Malo
 * → Quimper) : des centaines de kilomètres en trop sur la route. Ici on garde
 * les séjours tels quels (un lieu et ses nuits consécutives, avec leurs notes),
 * le premier et le dernier à leur place (arrivée, départ), et on cherche
 * l'ordre des séjours intermédiaires qui parcourt le moins de distance.
 *
 * L'ordre n'est changé que si le gain est net (au moins 20 % et 15 km) : un
 * itinéraire déjà sensé n'est jamais retouché. Les jours sont renumérotés de
 * 1 à N dans le nouvel ordre ; rien n'est ajouté ni retiré.
 */

export interface OrderableStage {
  day: number;
  name: string;
  lat: number;
  lon: number;
}

const MIN_GAIN_RATIO = 0.2;
const MIN_GAIN_KM = 15;
/** Jusqu'à 7 séjours intermédiaires, toutes les permutations (5 040) ; au-delà, 2-opt. */
const EXHAUSTIVE_MAX = 7;

type Point = { lat: number; lon: number };

function pathKm(points: Point[]): number {
  let t = 0;
  for (let i = 1; i < points.length; i += 1) t += distanceKm(points[i - 1], points[i]);
  return t;
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const out: T[][] = [];
  items.forEach((it, i) => {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) out.push([it, ...p]);
  });
  return out;
}

function bestMiddle(first: Point, middle: Point[], last: Point): number[] {
  const idx = middle.map((_, i) => i);
  const cost = (order: number[]) => pathKm([first, ...order.map((i) => middle[i]), last]);
  if (middle.length <= EXHAUSTIVE_MAX) {
    let best = idx;
    let bestCost = cost(idx);
    for (const p of permutations(idx)) {
      const c = cost(p);
      if (c < bestCost - 1e-9) {
        best = p;
        bestCost = c;
      }
    }
    return best;
  }
  // 2-opt : on retourne un segment tant que ça raccourcit.
  let order = idx;
  let improved = true;
  let guard = 0;
  while (improved && guard < 200) {
    improved = false;
    guard += 1;
    for (let i = 0; i < order.length - 1; i += 1) {
      for (let k = i + 1; k < order.length; k += 1) {
        const next = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
        if (cost(next) < cost(order) - 1e-9) {
          order = next;
          improved = true;
        }
      }
    }
  }
  return order;
}

/** Les étapes, éventuellement réordonnées (jours renumérotés), et si l'ordre a changé. */
export function untangleStages<T extends OrderableStage>(stages: T[]): { stages: T[]; reordered: boolean; savedKm: number } {
  const sorted = [...stages].sort((a, b) => a.day - b.day);
  // Séjours : jours consécutifs au même endroit.
  const groups: T[][] = [];
  for (const st of sorted) {
    const g = groups[groups.length - 1];
    if (g && g[0].name === st.name && distanceKm(g[0], st) < 0.5) g.push(st);
    else groups.push([st]);
  }
  const unchanged = { stages: sorted, reordered: false, savedKm: 0 };
  if (groups.length < 4) return unchanged;

  const first = groups[0][0];
  const last = groups[groups.length - 1][0];
  const middle = groups.slice(1, -1);
  const before = pathKm(groups.map((g) => g[0]));
  const order = bestMiddle(first, middle.map((g) => g[0]), last);
  const after = pathKm([first, ...order.map((i) => middle[i][0]), last]);
  const saved = before - after;
  if (saved < MIN_GAIN_KM || saved < before * MIN_GAIN_RATIO) return unchanged;

  const regrouped = [groups[0], ...order.map((i) => middle[i]), groups[groups.length - 1]];
  let day = 0;
  const out = regrouped.flat().map((st) => {
    day += 1;
    return { ...st, day };
  });
  return { stages: out, reordered: true, savedKm: Math.round(saved) };
}

const plain = (v: string) =>
  v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Un même lieu porte un seul nom d'un bout à l'autre du voyage : « Seville »
 * puis « Séville », « Malaga » puis « Málaga » (Andalousie, 7 octobre) se
 * lisaient comme deux étapes. Même nom aux accents près, ou même point (moins
 * de 300 m) : le premier nom reste, avec sa position.
 */
export function unifyStageNames<T extends OrderableStage>(stages: T[]): T[] {
  const seen: T[] = [];
  return stages.map((st) => {
    const twin = seen.find((s) => plain(s.name) === plain(st.name) || distanceKm(s, st) < 0.3);
    if (!twin) {
      seen.push(st);
      return st;
    }
    return twin.name === st.name && twin.lat === st.lat && twin.lon === st.lon ? st : { ...st, name: twin.name, lat: twin.lat, lon: twin.lon };
  });
}

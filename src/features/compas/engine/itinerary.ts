/**
 * Itinéraire déterministe — des calculs et des choix, jamais un lieu inventé.
 *
 * Entrée : la zone (centre + rayon), l'activité, le nombre de jours, et les
 * lieux RÉELS de la zone lus sur OpenStreetMap (villes, villages, hameaux,
 * refuges). Sortie : où l'on dort chaque soir, choisi par calcul :
 * - distance par jour selon l'activité (trek 12–20 km, vélo 50–90 km, road trip
 *   150–250 km sur route ; ramenées à vol d'oiseau par un coefficient) ;
 * - forme : traversée (on avance sur l'axe de la zone), boucle (retour au
 *   départ), ou base fixe (ski, escalade, plage, ville…) ;
 * - lieux dits par la personne (étapes voulues) visités dans l'ordre le plus court ;
 * - jours d'acclimatation au-dessus de 3 000 m (un tous les trois jours,
 *   montée de nuit limitée à ~500 m).
 * Même entrée → même itinéraire, au mètre près. Aucune I/O ici.
 */

import { distanceKm } from './places';
import type { StageMove } from './autofill';

export type AreaPlaceKind = 'city' | 'town' | 'village' | 'hamlet' | 'hut' | 'camp';

export interface AreaPlace {
  /** Identifiant OSM stable (« n123 », « w456 ») : sert aussi à départager. */
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: AreaPlaceKind;
  population: number | null;
  eleM: number | null;
}

export type ItineraryShape = 'base' | 'traverse' | 'loop';

export interface ItineraryInput {
  days: number;
  activity: string;
  center: { lat: number; lon: number };
  radiusKm: number;
  places: AreaPlace[];
  /** Lieux dits par la personne, déjà trouvés sur la carte (visités, dans l'ordre le plus court). */
  waypoints?: Array<{ name: string; lat: number; lon: number }>;
  /** Forme demandée (« traversée », « tour du… ») ; sinon déduite. */
  shape?: ItineraryShape | null;
  /** Nuits voulues : les refuges passent devant pour « refuge » ou « mixte ». */
  nights?: string | null;
  /** Distance du jour dite (km), prioritaire sur le barème de l'activité. */
  targetKmPerDay?: number | null;
  /** La destination est un lieu naturel (lac, sommet, île) : boucle par défaut. */
  natural?: boolean;
}

export interface PlannedStage {
  day: number;
  name: string;
  lat: number;
  lon: number;
  move: StageMove;
  /** Pourquoi ce soir-là ici (repos, acclimatation, base…), sinon null. */
  note: string | null;
  placeId: string | null;
}

export interface ItineraryPlan {
  shape: ItineraryShape;
  stages: PlannedStage[];
  /** Lieux différents où l'on dort. */
  distinct: number;
}

interface Profile {
  move: StageMove;
  /** Distance du jour sur le terrain (km) : min, cible, max. */
  dayKm: [number, number, number];
  /** Vol d'oiseau ≈ terrain × ce coefficient (sentiers et routes serpentent). */
  crow: number;
  /** Préférence de nature de lieu (plus haut = mieux). */
  prefer: Partial<Record<AreaPlaceKind, number>>;
  itinerant: boolean;
}

const FOOT: Profile = {
  move: 'marche',
  dayKm: [10, 16, 22],
  crow: 0.65,
  prefer: { village: 3, hamlet: 2.5, hut: 2.5, town: 2, camp: 1.5, city: 0.5 },
  itinerant: true,
};
const PROFILES: Record<string, Profile> = {
  trekking: FOOT,
  hiking: FOOT,
  bivouac: { ...FOOT, prefer: { ...FOOT.prefer, camp: 3, hut: 3 } },
  mixed: FOOT,
  bushcraft: { ...FOOT, dayKm: [6, 10, 15] },
  cycling: {
    move: 'velo',
    dayKm: [45, 70, 95],
    crow: 0.75,
    prefer: { town: 3, village: 2.5, city: 2, hamlet: 1 },
    itinerant: true,
  },
  roadtrip: {
    move: 'voiture',
    dayKm: [120, 200, 280],
    crow: 0.75,
    prefer: { town: 3, city: 3, village: 1.5 },
    itinerant: true,
  },
  vanlife: {
    move: 'voiture',
    dayKm: [80, 150, 230],
    crow: 0.75,
    prefer: { town: 2.5, village: 2.5, city: 1.5, camp: 3 },
    itinerant: true,
  },
};
const BASE: Profile = {
  move: 'voiture',
  dayKm: [100, 200, 300],
  crow: 0.75,
  prefer: { town: 3, city: 3, village: 2 },
  itinerant: false,
};
/** Base dans un village (ski, escalade, alpinisme) plutôt qu'en ville. */
const MOUNTAIN_BASE = new Set(['ski', 'climbing', 'mountaineering', 'trail', 'running']);

export function profileFor(activity: string): Profile {
  const p = PROFILES[activity];
  if (p) return p;
  if (MOUNTAIN_BASE.has(activity)) return { ...BASE, prefer: { village: 3, town: 2.5, hamlet: 1.5, city: 1, hut: 1 } };
  return BASE;
}

/** Jours passés au même endroit avant de changer de base (séjour sur place). */
function baseStay(activity: string): number {
  if (activity === 'citytrip' || activity === 'cultural') return 3;
  if (activity === 'roadtrip' || activity === 'vanlife') return 2;
  return 4;
}

const RANK: Record<AreaPlaceKind, number> = { city: 5, town: 4, village: 3, hamlet: 2, hut: 1, camp: 1 };

function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Point à `km` de `p` dans la direction `deg` (approximation locale, suffisante à l'échelle d'une étape). */
function offset(p: { lat: number; lon: number }, deg: number, km: number): { lat: number; lon: number } {
  const rad = (deg * Math.PI) / 180;
  const dLat = (km * Math.cos(rad)) / 111;
  const dLon = (km * Math.sin(rad)) / (111 * Math.max(0.1, Math.cos((p.lat * Math.PI) / 180)));
  return { lat: p.lat + dLat, lon: p.lon + dLon };
}

/** Ordre stable : score décroissant, puis identifiant (jamais de hasard). */
function best<T extends { id: string }>(list: T[], score: (t: T) => number): T | null {
  let top: T | null = null;
  let topScore = -Infinity;
  for (const t of list) {
    const s = score(t);
    if (!Number.isFinite(s)) continue;
    if (s > topScore + 1e-9 || (Math.abs(s - topScore) <= 1e-9 && top && t.id < top.id)) {
      top = t;
      topScore = s;
    }
  }
  return top;
}

/** Axe principal de la zone (vers l'est par défaut) : direction d'une traversée. */
export function mainAxis(points: ReadonlyArray<{ lat: number; lon: number }>): { lat: number; lon: number; dx: number; dy: number } {
  const n = points.length || 1;
  const lat0 = points.reduce((t, p) => t + p.lat, 0) / n;
  const lon0 = points.reduce((t, p) => t + p.lon, 0) / n;
  const k = Math.cos((lat0 * Math.PI) / 180);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of points) {
    const x = (p.lon - lon0) * k;
    const y = p.lat - lat0;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let dx = Math.cos(theta);
  let dy = Math.sin(theta);
  // Sens fixé (ouest → est, sinon sud → nord) : déterministe.
  if (dx < -1e-9 || (Math.abs(dx) <= 1e-9 && dy < 0)) {
    dx = -dx;
    dy = -dy;
  }
  return { lat: lat0, lon: lon0, dx, dy };
}

function along(axis: ReturnType<typeof mainAxis>, p: { lat: number; lon: number }): number {
  const k = Math.cos((axis.lat * Math.PI) / 180);
  // En km (1° de latitude ≈ 111 km).
  return ((p.lon - axis.lon) * k * axis.dx + (p.lat - axis.lat) * axis.dy) * 111;
}

/** Forme par défaut : base pour les activités sur place ; traversée si la zone est longue ; sinon boucle. */
export function shapeFor(
  input: Pick<ItineraryInput, 'activity' | 'days' | 'radiusKm' | 'shape' | 'targetKmPerDay' | 'natural'>
): ItineraryShape {
  const prof = profileFor(input.activity);
  if (!prof.itinerant) return 'base';
  if (input.shape) return input.shape;
  // Autour d'un lieu naturel (lac, sommet, île) : on en fait le tour.
  if (input.natural) return 'loop';
  const crowDay = (input.targetKmPerDay ?? prof.dayKm[1]) * prof.crow;
  // La zone peut contenir le trajet en ligne : traversée ; sinon on tourne.
  return input.radiusKm * 2 >= crowDay * Math.max(1, input.days - 1) * 0.6 ? 'traverse' : 'loop';
}

function sleepOk(p: AreaPlace, nights: string | null | undefined): boolean {
  // Hors bivouac, un camping ne fait pas une étape ; un refuge oui si la personne en veut.
  if (p.kind === 'camp') return nights === 'bivouac' || nights === 'mixte';
  return true;
}

function kindScore(p: AreaPlace, prof: Profile, nights: string | null | undefined): number {
  let s = prof.prefer[p.kind] ?? 0;
  if (p.kind === 'hut' && (nights === 'refuge' || nights === 'mixte')) s += 1;
  if (p.kind === 'hut' && nights === 'hebergement') s -= 1.5;
  // Un lieu peuplé a de quoi dormir et manger ; plafonné pour ne pas tout aspirer vers la capitale.
  if (p.population && p.population > 0) s += Math.min(1, Math.log10(p.population) / 6);
  return s;
}

/** Base(s) d'un séjour : le meilleur lieu près du centre, ou plusieurs bases espacées sur un grand pays. */
function planBase(input: ItineraryInput, prof: Profile): PlannedStage[] {
  const pool = input.places.filter((p) => p.kind !== 'camp' && p.kind !== 'hut');
  const stay = baseStay(input.activity);
  const count =
    input.radiusKm > 150 && input.days >= stay * 2 ? Math.min(6, Math.ceil(input.days / stay)) : 1;
  const bases: Array<{ name: string; lat: number; lon: number; id: string | null }> = [];
  for (const w of input.waypoints ?? []) {
    if (bases.length >= count) break;
    bases.push({ name: w.name, lat: w.lat, lon: w.lon, id: null });
  }
  const spacing = Math.max(60, input.radiusKm / 3);
  while (bases.length < count) {
    const pick = best(pool, (p) => {
      if (bases.some((b) => distanceKm(b, p) < spacing)) return -Infinity;
      const fromCenter = distanceKm(input.center, p) / Math.max(1, input.radiusKm);
      if (fromCenter > 1.1) return -Infinity;
      // Une seule base : la plus proche du centre. Plusieurs : les lieux les plus importants.
      return count === 1 ? kindScore(p, prof, input.nights) - 3 * fromCenter : RANK[p.kind] + Math.min(2, Math.log10(p.population ?? 1) / 3);
    });
    if (!pick) break;
    bases.push({ name: pick.name, lat: pick.lat, lon: pick.lon, id: pick.id });
  }
  if (!bases.length) return [];
  // Ordre le plus court entre les bases (plus proche voisin depuis la plus à l'ouest/sud de l'axe).
  const axis = mainAxis(bases);
  const ordered = [bases.reduce((a, b) => (along(axis, b) < along(axis, a) ? b : a))];
  const rest = bases.filter((b) => b !== ordered[0]);
  while (rest.length) {
    const cur = ordered[ordered.length - 1];
    rest.sort((a, b) => distanceKm(cur, a) - distanceKm(cur, b) || (a.name < b.name ? -1 : 1));
    ordered.push(rest.shift()!);
  }
  const per = input.days / ordered.length;
  return Array.from({ length: input.days }, (_, i) => {
    const b = ordered[Math.min(ordered.length - 1, Math.floor(i / per))];
    const prev = i > 0 ? ordered[Math.min(ordered.length - 1, Math.floor((i - 1) / per))] : null;
    const moved = prev != null && prev !== b;
    return {
      day: i + 1,
      name: b.name,
      lat: b.lat,
      lon: b.lon,
      move: moved ? prof.move : 'aucun',
      note: i === 0 ? (ordered.length > 1 ? 'Première base du séjour.' : 'Base du séjour.') : null,
      placeId: b.id,
    };
  });
}

const HIGH_M = 3000;
const MAX_NIGHT_GAIN_M = 500;

/** Itinéraire itinérant (trek, vélo, road trip) : un lieu réel par soir, choisi par calcul. */
function planMoving(input: ItineraryInput, prof: Profile, shape: 'traverse' | 'loop'): PlannedStage[] {
  const [minKm, targetKm, maxKm] = input.targetKmPerDay
    ? [input.targetKmPerDay * 0.6, input.targetKmPerDay, input.targetKmPerDay * 1.4]
    : prof.dayKm;
  const crowMin = minKm * prof.crow;
  const crowTarget = targetKm * prof.crow;
  const crowMax = maxKm * prof.crow;
  const inZone = input.places.filter(
    (p) => sleepOk(p, input.nights) && distanceKm(input.center, p) <= input.radiusKm * 1.15
  );
  if (inZone.length < 2) return [];
  const axis = mainAxis(inZone);

  // Départ : un lieu habité (accès), au bout de l'axe pour une traversée, près du centre pour une boucle.
  const starts = inZone.filter((p) => p.kind !== 'hut' && p.kind !== 'camp');
  const first = input.waypoints?.[0];
  const start =
    (first && best(starts, (p) => -distanceKm(first, p))) ??
    best(starts.length ? starts : inZone, (p) =>
      shape === 'traverse'
        ? -along(axis, p) / Math.max(1, input.radiusKm) * 4 + RANK[p.kind] * 0.3
        : -distanceKm(input.center, p) / Math.max(1, input.radiusKm) * 4 + RANK[p.kind] * 0.5
    );
  if (!start) return [];

  // Étapes voulues : dans l'ordre le plus court depuis le départ.
  const pending = [...(input.waypoints ?? [])].filter((w) => distanceKm(w, start) > crowMin);
  const orderedWays: Array<{ name: string; lat: number; lon: number }> = [];
  let probe: { lat: number; lon: number } = start;
  while (pending.length) {
    pending.sort((a, b) => distanceKm(probe, a) - distanceKm(probe, b) || (a.name < b.name ? -1 : 1));
    probe = pending.shift()!;
    orderedWays.push(probe as { name: string; lat: number; lon: number });
  }

  const stages: PlannedStage[] = [
    { day: 1, name: start.name, lat: start.lat, lon: start.lon, move: 'aucun', note: 'Départ.', placeId: start.id },
  ];
  const used = new Set<string>([start.id]);
  const moves = input.days - 1;
  // Cercle de la boucle : périmètre ≈ distance totale, tourné vers le centre de la zone.
  const loopCircle =
    shape === 'loop' && moves >= 2
      ? (() => {
          const r = (crowTarget * moves) / (2 * Math.PI);
          const toCenter = distanceKm(start, input.center) > 1 ? bearing(start, input.center) : 0;
          const c = offset(start, toCenter, r);
          const a0 = bearing(c, start);
          return (k: number) => offset(c, a0 + (360 * k) / moves, r);
        })()
      : null;
  let cur: AreaPlace = start;
  let highStreak = (start.eleM ?? 0) >= HIGH_M ? 1 : 0;
  for (let day = 2; day <= input.days; day += 1) {
    const left = input.days - day; // déplacements restants après celui-ci
    // Acclimatation : au-dessus de 3 000 m, un jour sur place tous les trois.
    if (prof.move === 'marche' && (cur.eleM ?? 0) >= HIGH_M && highStreak >= 3) {
      stages.push({ day, name: cur.name, lat: cur.lat, lon: cur.lon, move: 'aucun', note: 'Journée d’acclimatation (au-dessus de 3 000 m).', placeId: cur.id });
      highStreak = 0;
      continue;
    }
    const goal = orderedWays[0] ?? null;
    const ideal = loopCircle ? loopCircle(day - 1) : null;
    const pickWith = (lo: number, hi: number) =>
      best(inZone, (p) => {
        if (used.has(p.id)) return -Infinity;
        const d = distanceKm(cur, p);
        if (d < lo || d > hi) return -Infinity;
        let s = 2 * (1 - Math.abs(d - crowTarget) / crowTarget) + kindScore(p, prof, input.nights);
        if (goal) {
          // Vers la prochaine étape voulue.
          const gain = distanceKm(cur, goal) - distanceKm(p, goal);
          s += 3 * (gain / crowTarget);
        } else if (shape === 'traverse') {
          const gain = along(axis, p) - along(axis, cur);
          if (gain <= 0) return -Infinity;
          s += 2 * Math.min(1, gain / crowTarget);
        } else {
          // Boucle : on suit un cercle idéal passant par le départ, et l'on peut toujours rentrer.
          if (ideal) s -= 2 * (distanceKm(p, ideal) / crowTarget);
          if (distanceKm(p, start) > crowMax * Math.max(1, left)) return -Infinity;
        }
        // Montée de nuit limitée en altitude.
        if (prof.move === 'marche' && (cur.eleM ?? 0) >= 2500 && p.eleM != null && cur.eleM != null && p.eleM - cur.eleM > MAX_NIGHT_GAIN_M)
          s -= 3;
        return s;
      });
    // Dernier soir d'une boucle : retour au départ.
    let next: AreaPlace | null =
      shape === 'loop' && left === 0 && !goal ? start : pickWith(crowMin, crowMax) ?? pickWith(crowMin * 0.5, crowMax * 1.4);
    if (goal && distanceKm(cur, goal) <= crowMax) {
      // L'étape voulue est à portée : on y dort (le lieu réel le plus proche, sinon le point lui-même).
      const at = best(inZone, (p) => (used.has(p.id) ? -Infinity : -distanceKm(goal, p)));
      next = at && distanceKm(goal, at) <= 3 ? at : { id: `w:${goal.name}`, name: goal.name, lat: goal.lat, lon: goal.lon, kind: 'village', population: null, eleM: null };
      orderedWays.shift();
    }
    if (!next) {
      stages.push({ day, name: cur.name, lat: cur.lat, lon: cur.lon, move: 'aucun', note: 'Journée sur place : aucun lieu où dormir à distance d’une étape.', placeId: cur.id });
      continue;
    }
    used.add(next.id);
    stages.push({ day, name: next.name, lat: next.lat, lon: next.lon, move: prof.move, note: null, placeId: next.id.startsWith('w:') ? null : next.id });
    highStreak = (next.eleM ?? 0) >= HIGH_M ? highStreak + 1 : 0;
    cur = next;
  }
  return stages;
}

/** Itinéraire complet ; null si la zone ne fournit pas assez de lieux réels (l'appelant se replie). */
export function planItinerary(input: ItineraryInput): ItineraryPlan | null {
  if (!Number.isInteger(input.days) || input.days < 1) return null;
  const prof = profileFor(input.activity);
  const shape = shapeFor(input);
  const stages = shape === 'base' ? planBase(input, prof) : planMoving(input, prof, shape);
  if (!stages.length) return null;
  const distinct = new Set(stages.map((s) => s.placeId ?? s.name)).size;
  return { shape, stages, distinct };
}

/* ---------- Lecture d'OpenStreetMap (Overpass), pure ---------- */

export interface AreaQuery {
  center: { lat: number; lon: number };
  radiusKm: number;
  /** Emprise [ouest, nord, est, sud] quand la carte la donne (pays, régions). */
  extent?: [number, number, number, number] | null;
  activity: string;
}

/** Natures cherchées : plus la zone est grande, moins on descend dans les petits lieux. */
export function areaKinds(q: AreaQuery): AreaPlaceKind[] {
  const foot = profileFor(q.activity).move === 'marche';
  if (q.radiusKm > 250) return ['city', 'town'];
  if (q.radiusKm > 90) return foot ? ['town', 'village', 'hut'] : ['city', 'town', 'village'];
  // Hameaux et campings : seulement sur une petite zone (sinon la requête est trop lourde).
  if (q.radiusKm > 25) return foot ? ['town', 'village', 'hut'] : ['city', 'town', 'village'];
  return foot ? ['town', 'village', 'hamlet', 'hut', 'camp'] : ['city', 'town', 'village', 'hamlet'];
}

/** Plafond de la zone d'itinéraire selon le moyen de progression (km autour du centre). */
const ZONE_CAP: Record<string, number> = { marche: 45, velo: 120, voiture: 250 };

/**
 * Zone où chercher les lieux de l'itinéraire : l'emprise réelle du lieu (un lac,
 * un massif), élargie juste assez pour que le voyage y tienne, bornée selon
 * l'activité. Jamais le rayon de recherche (60 km au moins), trop large pour un
 * week-end autour d'un lac.
 */
export function planningZoneKm(input: {
  activity: string;
  days: number;
  /** Demi-diagonale de l'emprise du lieu, si la carte la donne. */
  halfExtentKm: number | null;
  /** Le lieu est une ville ou un village (sinon un massif, une région…). */
  settlement: boolean;
}): number {
  const prof = profileFor(input.activity);
  const own0 = input.halfExtentKm ?? (input.settlement ? 10 : 25);
  // Séjour sur une base (ski, escalade, alpinisme, ville) : on ne voyage pas,
  // la base se cherche tout près (une vallée, un village au pied du sommet).
  if (!prof.itinerant) return Math.round(Math.min(40, Math.max(12, own0 + 10)));
  const crowDay = prof.dayKm[1] * prof.crow;
  const span = crowDay * Math.max(1, input.days - 1);
  const own = input.halfExtentKm ?? (input.settlement ? 10 : 25);
  const cap = ZONE_CAP[prof.move] ?? 150;
  return Math.round(Math.min(cap, Math.max(8, own, span * 0.5) + crowDay * 0.25));
}

export function buildAreaQuery(q: AreaQuery): string {
  const kinds = areaKinds(q);
  const places = kinds.filter((k) => k !== 'hut' && k !== 'camp');
  const r = Math.round(Math.min(q.radiusKm, 400) * 1000);
  const where = q.extent
    ? `(${q.extent[3].toFixed(3)},${q.extent[0].toFixed(3)},${q.extent[1].toFixed(3)},${q.extent[2].toFixed(3)})`
    : `(around:${r},${q.center.lat.toFixed(4)},${q.center.lon.toFixed(4)})`;
  const parts = [`node[place~"^(${places.join('|')})$"][name]${where};`];
  if (kinds.includes('hut')) parts.push(`nwr[tourism~"^(alpine_hut|wilderness_hut)$"][name]${where};`);
  if (kinds.includes('camp')) parts.push(`nwr[tourism=camp_site][name]${where};`);
  return `[out:json][timeout:25];(${parts.join('')});out center tags 4000;`;
}

/** Nom lisible : français, sinon anglais, sinon le nom local. */
function readableName(tags: Record<string, string>): string | null {
  const n = tags['name:fr'] || tags['name:en'] || tags.name || '';
  return n.trim() || null;
}

export function parseAreaPlaces(payload: unknown): AreaPlace[] {
  const els = (payload as { elements?: unknown[] } | null)?.elements;
  if (!Array.isArray(els)) return [];
  const out: AreaPlace[] = [];
  const seen = new Set<string>();
  for (const raw of els) {
    const e = raw as { type?: string; id?: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
    const tags = e.tags ?? {};
    const lat = Number(e.lat ?? e.center?.lat);
    const lon = Number(e.lon ?? e.center?.lon);
    const name = readableName(tags);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const kind: AreaPlaceKind | null =
      tags.tourism === 'alpine_hut' || tags.tourism === 'wilderness_hut'
        ? 'hut'
        : tags.tourism === 'camp_site'
          ? 'camp'
          : (['city', 'town', 'village', 'hamlet'] as const).find((k) => k === tags.place) ?? null;
    if (!kind) continue;
    const id = `${(e.type ?? 'node')[0]}${e.id ?? `${lat},${lon}`}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const pop = Number(String(tags.population ?? '').replace(/[\s,.]/g, ''));
    const ele = Number.parseFloat(String(tags.ele ?? ''));
    out.push({
      id,
      name,
      lat: Math.round(lat * 1e5) / 1e5,
      lon: Math.round(lon * 1e5) / 1e5,
      kind,
      population: Number.isFinite(pop) && pop > 0 ? pop : null,
      eleM: Number.isFinite(ele) ? Math.round(ele) : null,
    });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

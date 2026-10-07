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
  /** Code pays ISO alpha-2 quand la source le donne. */
  countryCode?: string | null;
  /** Région et département (Photon : `state`, `county`), quand la source les donne. */
  region?: string | null;
  county?: string | null;
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
  /** Emprise réelle de la destination [ouest, nord, est, sud] : les étapes y restent. */
  extent?: [number, number, number, number] | null;
  /**
   * La destination est une ville (« 4 jours à Amsterdam à vélo ») : on en part
   * et une boucle y revient. Sans cela, l'itinéraire partait d'un bout de la
   * zone (Brielle → Schagen) sans jamais passer par Amsterdam.
   */
  startAt?: { name: string; lat: number; lon: number } | null;
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
  /** Point de départ d'un itinéraire itinérant (null pour un séjour sur base). */
  start: { name: string; lat: number; lon: number } | null;
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
// « mixed » (aucune activité dite) n'est pas ici : un séjour sans activité se
// fait depuis une base (une ville, une région), jamais en randonnée d'étape en étape.
const PROFILES: Record<string, Profile> = {
  trekking: FOOT,
  hiking: FOOT,
  bivouac: { ...FOOT, prefer: { ...FOOT.prefer, camp: 3, hut: 3 } },
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

/** Activité de montagne : l'altitude des lieux compte (base, hauteurs). */
export function isMountainActivity(activity: string): boolean {
  return MOUNTAIN_BASE.has(activity);
}

/** Bonus d'altitude d'une base de montagne : 0 sous 400 m, plafonné à 1 400 m. */
function altitudeBonus(eleM: number | null): number {
  return eleM == null ? 0 : Math.min(2, Math.max(0, (eleM - 400) / 500));
}

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

/** Rayon réel d'une zone : 90 % de ses lieux sont à moins de ce rayon de leur centre. */
export function zoneSpreadKm(places: ReadonlyArray<{ lat: number; lon: number }>): number {
  if (!places.length) return 0;
  const c = {
    lat: places.reduce((t, p) => t + p.lat, 0) / places.length,
    lon: places.reduce((t, p) => t + p.lon, 0) / places.length,
  };
  const d = places.map((p) => distanceKm(c, p)).sort((a, b) => a - b);
  return d[Math.min(d.length - 1, Math.floor(d.length * 0.9))];
}

/** Facteur (0,4 à 1) qui ramène la distance du jour à ce que la zone peut contenir. */
function fitScale(places: AreaPlace[], shape: 'traverse' | 'loop', crowTarget: number, moves: number, adjustable: boolean): number {
  if (!adjustable) return 1;
  const r = zoneSpreadKm(places);
  if (r <= 0) return 1;
  // Boucle : périmètre ≤ celui d'un cercle de 60 % du rayon ; traversée : longueur ≤ 1,6 rayon.
  const room = shape === 'loop' ? 2 * Math.PI * 0.6 * r : 1.6 * r;
  const need = crowTarget * Math.max(1, moves);
  return need > room ? Math.max(0.4, room / need) : 1;
}

/** Dans l'emprise de la destination (marge de 10 %), quand on la connaît. */
function withinExtent(p: { lat: number; lon: number }, extent: ItineraryInput['extent']): boolean {
  if (!extent) return true;
  const [w, n, e, s] = extent;
  const mx = Math.abs(e - w) * 0.1;
  const my = Math.abs(n - s) * 0.1;
  return p.lon >= Math.min(w, e) - mx && p.lon <= Math.max(w, e) + mx && p.lat >= Math.min(s, n) - my && p.lat <= Math.max(s, n) + my;
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

/** Longueur d'un ensemble de lieux le long de son axe principal (km). */
function axisSpan(points: ReadonlyArray<{ lat: number; lon: number }>): number {
  if (points.length < 2) return 0;
  const axis = mainAxis(points);
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of points) {
    const v = along(axis, p);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return hi - lo;
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
      // Une seule base : la plus proche du centre. Dans un grand lieu naturel, le
      // centre de l'emprise ne dit rien (Dolomites : près de Belluno, en plaine) :
      // il pèse moins, et en montagne l'altitude compte (Canazei, pas Brugnàch).
      // Plusieurs bases : les lieux les plus importants.
      if (count > 1) return RANK[p.kind] + Math.min(2, Math.log10(p.population ?? 1) / 3);
      const mountain = MOUNTAIN_BASE.has(input.activity) ? altitudeBonus(p.eleM) : 0;
      return kindScore(p, prof, input.nights) + mountain - (input.natural ? 1 : 3) * fromCenter;
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
function planMoving(
  input: ItineraryInput,
  prof: Profile,
  shape: 'traverse' | 'loop'
): { stages: PlannedStage[]; start: AreaPlace | null } {
  const [minKm, targetKm, maxKm] = input.targetKmPerDay
    ? [input.targetKmPerDay * 0.6, input.targetKmPerDay, input.targetKmPerDay * 1.4]
    : prof.dayKm;
  const reachable = input.places.filter((p) => sleepOk(p, input.nights) && distanceKm(input.center, p) <= input.radiusKm * 1.15);
  let inZone = reachable.filter((p) => withinExtent(p, input.extent));
  // Traversée plus longue que l'emprise (« traversée du Jura » à vélo en
  // 5 jours dans le seul Parc du Haut-Jura, 80 km : bloquée au 3e soir) : on
  // en sort, dans la zone du voyage, quand celle-ci va plus loin.
  if (input.extent && shape === 'traverse' && !input.targetKmPerDay) {
    const need = prof.dayKm[0] * prof.crow * input.days;
    if (axisSpan(inZone) < need && axisSpan(reachable) > axisSpan(inZone)) inZone = reachable;
  }
  if (inZone.length < 2) return { stages: [], start: null };
  // La distance du jour s'adapte à la taille réelle de la zone (mesurée sur ses
  // lieux) : une boucle doit y tenir, une traversée ne pas la dépasser. Jamais
  // sous 40 % du barème (un road trip reste un road trip).
  const fit = fitScale(inZone, shape, targetKm * prof.crow, input.days, !input.targetKmPerDay);
  const crowMin = minKm * prof.crow * fit;
  const crowTarget = targetKm * prof.crow * fit;
  const crowMax = maxKm * prof.crow * fit;
  const axis = mainAxis(inZone);

  // Départ : un lieu habité (accès), au bout de l'axe pour une traversée, près du centre pour une boucle.
  const starts = inZone.filter((p) => p.kind !== 'hut' && p.kind !== 'camp');
  const fixed = input.startAt;
  const start: AreaPlace | null = fixed
    ? (starts.find((p) => p.name === fixed.name && distanceKm(p, fixed) <= 3) ?? {
        id: `start:${fixed.lat.toFixed(4)},${fixed.lon.toFixed(4)}`,
        name: fixed.name,
        lat: fixed.lat,
        lon: fixed.lon,
        kind: 'city',
        population: null,
        eleM: null,
      })
    : best(starts.length ? starts : inZone, (p) =>
        shape === 'traverse'
          ? (-along(axis, p) / Math.max(1, input.radiusKm)) * 4 + RANK[p.kind] * 0.3
          : (-distanceKm(input.center, p) / Math.max(1, input.radiusKm)) * 4 + RANK[p.kind] * 0.5
      );
  if (!start) return { stages: [], start: null };

  // Étapes voulues : dans l'ordre le plus court depuis le départ.
  const pending = [...(input.waypoints ?? [])].filter((w) => distanceKm(w, start) > crowMin);
  const orderedWays: Array<{ name: string; lat: number; lon: number }> = [];
  let probe: { lat: number; lon: number } = start;
  while (pending.length) {
    pending.sort((a, b) => distanceKm(probe, a) - distanceKm(probe, b) || (a.name < b.name ? -1 : 1));
    probe = pending.shift()!;
    orderedWays.push(probe as { name: string; lat: number; lon: number });
  }

  // Chaque jour finit ailleurs : le jour 1 part du point de départ (dit en note),
  // une boucle finit le dernier jour au départ.
  const stages: PlannedStage[] = [];
  const used = new Set<string>([start.id]);
  const moves = input.days;
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
  // Traversée qui a fait demi-tour (bout de la zone) : la note n'est dite qu'une fois.
  let returning = false;
  for (let day = 1; day <= input.days; day += 1) {
    const left = input.days - day; // déplacements restants après celui-ci
    // Acclimatation : au-dessus de 3 000 m, un jour sur place tous les trois.
    if (prof.move === 'marche' && (cur.eleM ?? 0) >= HIGH_M && highStreak >= 3) {
      stages.push({ day, name: cur.name, lat: cur.lat, lon: cur.lon, move: 'aucun', note: 'Journée d’acclimatation (au-dessus de 3 000 m).', placeId: cur.id });
      highStreak = 0;
      continue;
    }
    const goal = orderedWays[0] ?? null;
    const ideal = loopCircle ? loopCircle(day) : null;
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
    let back = false;
    if (!next && shape === 'traverse' && !goal) {
      // Bout de la zone atteint : on revient vers le départ par d'autres lieux,
      // plutôt que de rester sur place les jours qui restent.
      next = best(inZone, (p) => {
        if (used.has(p.id)) return -Infinity;
        const d = distanceKm(cur, p);
        if (d < crowMin * 0.5 || d > crowMax * 1.4) return -Infinity;
        const gain = distanceKm(cur, start) - distanceKm(p, start);
        if (gain <= 0) return -Infinity;
        return 2 * (1 - Math.abs(d - crowTarget) / crowTarget) + kindScore(p, prof, input.nights);
      });
      back = next != null;
    }
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
    stages.push({
      day,
      name: next.name,
      lat: next.lat,
      lon: next.lon,
      move: prof.move,
      note: day === 1 ? `Départ ${fromPlace(start.name)}.` : back && !returning ? 'Retour par un autre chemin : la zone s’arrête ici.' : null,
      placeId: next.id.startsWith('w:') ? null : next.id,
    });
    highStreak = (next.eleM ?? 0) >= HIGH_M ? highStreak + 1 : 0;
    returning = returning || back;
    cur = next;
  }
  return { stages, start };
}

/** « de Beaufort », « d'Albertville » (élision devant une voyelle). */
export function fromPlace(name: string): string {
  return /^[aeiouyàâäéèêëîïôöùûü]/i.test(name.trim()) ? `d’${name}` : `de ${name}`;
}

/**
 * Départ d'une journée dans un lieu naturel (massif, parc) : un village
 * proche du centre, la notoriété comptant moins que la distance (5 km coûtent
 * un facteur 10). Albertville (19 000 hab., 13 km) n'est pas « au cœur » du
 * Beaufortain : Beaufort (2 000 hab., 1 km) l'est.
 */
export function dayStartVillage(
  places: AreaPlace[],
  center: { lat: number; lon: number },
  maxKm = 15
): { place: AreaPlace; km: number; note: string } | null {
  const pick = best(
    places.filter((p) => (p.kind === 'town' || p.kind === 'village' || p.kind === 'city') && distanceKm(center, p) <= maxKm),
    (p) => Math.log10(Math.max(10, p.population ?? 10)) - distanceKm(center, p) / 5
  );
  if (!pick) return null;
  const km = distanceKm(center, pick);
  return {
    place: pick,
    km,
    note: km <= 5 ? `Départ ${fromPlace(pick.name)}, au cœur du lieu.` : `Départ ${fromPlace(pick.name)}, à ${Math.round(km)} km du centre du lieu.`,
  };
}

/** Itinéraire complet ; null si la zone ne fournit pas assez de lieux réels (l'appelant se replie). */
export function planItinerary(input: ItineraryInput): ItineraryPlan | null {
  if (!Number.isInteger(input.days) || input.days < 1) return null;
  const prof = profileFor(input.activity);
  const shape = shapeFor(input);
  const moving = shape === 'base' ? null : planMoving(input, prof, shape);
  const stages = moving ? moving.stages : planBase(input, prof);
  if (!stages.length) return null;
  const distinct = new Set(stages.map((s) => s.placeId ?? s.name)).size;
  const start = moving?.start ? { name: moving.start.name, lat: moving.start.lat, lon: moving.start.lon } : null;
  return { shape, start, stages, distinct };
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

/**
 * Un nom qui n'est qu'un nom commun (« shanty », « Cabane », « Refuge 2 ») :
 * OSM en porte, ce n'est pas un lieu qu'on peut nommer comme étape.
 */
const GENERIC_NAME =
  /^(?:the |l['’] ?|la |le )?(?:shanty|shack|shed|shelter|hut|cabin|cottage|barn|bothy|cabane|cabanon|abri|refuge|refugio|rifugio|bivouac|bivacco|baita|hutte|h[uü]tte|schutzh[uü]tte|unterstand|bergerie|buron|grange|chalet|camping|campsite|camp site|camp|aire de bivouac|ruine|ruines|maison|house|lieu-dit|hameau|village)(?:\s*\d+)?$/i;

export function isGenericName(name: string): boolean {
  return GENERIC_NAME.test(name.trim());
}

/** Nom lisible : français, sinon anglais, sinon le nom local ; jamais un nom commun. */
function readableName(tags: Record<string, string>): string | null {
  const n = (tags['name:fr'] || tags['name:en'] || tags.name || '').trim();
  return n && !isGenericName(n) ? n : null;
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

/* ---------- Lecture de Photon (lieux d'une emprise par catégorie), pure ---------- */

/** Emprises à interroger : une seule pour une petite zone, quatre tuiles au-delà de 25 km (50 lieux par tuile). */
export function areaTiles(center: { lat: number; lon: number }, radiusKm: number): Array<[number, number, number, number]> {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.max(0.1, Math.cos((center.lat * Math.PI) / 180)));
  const [w, s, e, n] = [center.lon - dLon, center.lat - dLat, center.lon + dLon, center.lat + dLat];
  if (radiusKm <= 25) return [[w, s, e, n]];
  const mx = center.lon;
  const my = center.lat;
  return [
    [w, s, mx, my],
    [mx, s, e, my],
    [w, my, mx, n],
    [mx, my, e, n],
  ];
}

const PHOTON_KIND: Record<string, AreaPlaceKind> = {
  'place:city': 'city',
  'place:town': 'town',
  'place:village': 'village',
  'place:hamlet': 'hamlet',
  'tourism:alpine_hut': 'hut',
  'tourism:wilderness_hut': 'hut',
  'tourism:camp_site': 'camp',
};

/** Catégories Photon (`include=`) pour les natures voulues. */
export function photonIncludes(kinds: AreaPlaceKind[]): { places: string; shelters: string | null } {
  const places = kinds.filter((k) => k !== 'hut' && k !== 'camp').map((k) => `osm.place.${k}`);
  const shelters = [
    ...(kinds.includes('hut') ? ['osm.tourism.alpine_hut', 'osm.tourism.wilderness_hut'] : []),
    ...(kinds.includes('camp') ? ['osm.tourism.camp_site'] : []),
  ];
  return { places: places.join(','), shelters: shelters.length ? shelters.join(',') : null };
}

/**
 * Lieux d'une réponse Photon (GeoJSON). Photon les classe par notoriété : le
 * rang sert de population approchée (un bourg connu passe devant un village
 * perdu), jamais affichée.
 */
export function parsePhotonArea(payload: unknown): AreaPlace[] {
  const fs = (payload as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(fs)) return [];
  const out: AreaPlace[] = [];
  fs.forEach((raw, i) => {
    const f = raw as { geometry?: { coordinates?: [number, number] }; properties?: Record<string, unknown> };
    const p = f.properties ?? {};
    const kind = PHOTON_KIND[`${String(p.osm_key ?? '')}:${String(p.osm_value ?? '')}`];
    const name = typeof p.name === 'string' ? latinName(p.name) : '';
    const [lon, lat] = f.geometry?.coordinates ?? [NaN, NaN];
    if (!kind || !name || isGenericName(name) || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    out.push({
      id: `${String(p.osm_type ?? 'N').toLowerCase()[0]}${String(p.osm_id ?? `${lat},${lon}`)}`,
      name,
      lat: Math.round(lat * 1e5) / 1e5,
      lon: Math.round(lon * 1e5) / 1e5,
      kind,
      // Rang de notoriété dans la tuile → ordre de grandeur (jamais montré).
      population: Math.round(20000 / (1 + i)),
      eleM: null,
      countryCode: typeof p.countrycode === 'string' ? p.countrycode.toUpperCase() : null,
      region: typeof p.state === 'string' ? p.state : null,
      county: typeof p.county === 'string' ? p.county : null,
    });
  });
  return out;
}

/**
 * Nom lisible : au Maroc, OSM écrit « Imlil ⵉⵎⵍⵉⵍ إمليل » (latin, tifinagh,
 * arabe). Quand le nom a une partie en alphabet latin, seule celle-ci reste.
 */
export function latinName(raw: string): string {
  const name = raw.trim();
  if (!/\p{Script=Latin}/u.test(name)) return name;
  return name
    .split(/\s+/)
    .filter((w) => !/[\p{Script=Tifinagh}\p{Script=Arabic}\p{Script=Cyrillic}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Greek}\p{Script=Hebrew}\p{Script=Thai}\p{Script=Devanagari}]/u.test(w))
    .join(' ')
    .trim() || name;
}

/** Natures du Compas → catégories Geoapify Places. */
const GEOAPIFY_CATEGORY: Record<AreaPlaceKind, string> = {
  city: 'populated_place.city',
  town: 'populated_place.town',
  village: 'populated_place.village',
  hamlet: 'populated_place.hamlet',
  hut: 'accommodation.hut',
  camp: 'camping.camp_site',
};
export function geoapifyCategories(kinds: AreaPlaceKind[]): string {
  return kinds.map((k) => GEOAPIFY_CATEGORY[k]).join(',');
}

/**
 * Lieux d'une zone lus dans Geoapify Places (secours de Photon et d'Overpass,
 * mêmes données OpenStreetMap) : nature, population et altitude quand OSM
 * les donne, sinon le rang dans la réponse comme ordre de grandeur.
 */
export function parseGeoapifyArea(payload: unknown): AreaPlace[] {
  const fs = (payload as { features?: unknown[] } | null)?.features;
  if (!Array.isArray(fs)) return [];
  const out: AreaPlace[] = [];
  fs.forEach((raw, i) => {
    const p = ((raw as { properties?: Record<string, unknown> }).properties ?? {}) as Record<string, unknown>;
    const cats = Array.isArray(p.categories) ? p.categories.map(String) : [];
    const kind = (Object.keys(GEOAPIFY_CATEGORY) as AreaPlaceKind[]).find((k) => cats.includes(GEOAPIFY_CATEGORY[k]));
    const name = typeof p.name === 'string' ? latinName(p.name) : '';
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    if (!kind || !name || isGenericName(name) || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const osm = ((p.datasource as { raw?: Record<string, unknown> } | undefined)?.raw ?? {}) as Record<string, unknown>;
    const pop = Number(osm.population);
    const ele = Number(osm.ele);
    out.push({
      id: osm.osm_id != null ? `${String(osm.osm_type ?? 'n').toLowerCase()[0]}${String(osm.osm_id)}` : `g${lat.toFixed(5)},${lon.toFixed(5)}`,
      name,
      lat: Math.round(lat * 1e5) / 1e5,
      lon: Math.round(lon * 1e5) / 1e5,
      kind,
      population: Number.isFinite(pop) && pop > 0 ? pop : Math.round(20000 / (1 + i)),
      eleM: Number.isFinite(ele) ? ele : null,
      countryCode: typeof p.country_code === 'string' ? p.country_code.toUpperCase() : null,
      region: typeof p.state === 'string' ? p.state : null,
      county: typeof p.county === 'string' ? p.county : null,
    });
  });
  return out;
}

/** Fusionne plusieurs listes sans doublon, ordre stable par identifiant. */
export function mergeAreaPlaces(lists: AreaPlace[][]): AreaPlace[] {
  const byId = new Map<string, AreaPlace>();
  for (const list of lists) for (const p of list) if (!byId.has(p.id)) byId.set(p.id, p);
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Garder le voyage dans le pays de la destination quand la zone y est presque
 * entière (≥ 70 % des lieux) : un tour du Jura ne finit pas à Morges. Une zone
 * frontalière (Pyrénées, Alpes) garde les deux versants.
 */
export function keepHomeCountry(places: AreaPlace[], countryCode: string | null): AreaPlace[] {
  if (!countryCode) return places;
  const known = places.filter((p) => p.countryCode);
  if (known.length < 5) return places;
  const home = known.filter((p) => p.countryCode === countryCode).length;
  return home / known.length >= 0.7 ? places.filter((p) => !p.countryCode || p.countryCode === countryCode) : places;
}

const plainAdmin = (v: string) =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Destination administrative (une région, un département) : les étapes restent
 * dedans (« Bretagne » ne passe pas par Saint-Lô). Seulement si assez de lieux
 * portent ce nom de région ou de département ; sinon la liste est gardée.
 */
export function keepAdminArea(places: AreaPlace[], name: string, level: 'region' | 'county'): AreaPlace[] {
  const want = plainAdmin(name);
  if (!want) return places;
  const inside = places.filter((p) => {
    const v = level === 'region' ? p.region : p.county;
    return v != null && plainAdmin(v) === want;
  });
  return inside.length >= 5 ? inside : places;
}

/**
 * À pied dans une zone qui mêle plaine et montagne (plus de 600 m d'écart) :
 * on randonne dans la moitié haute (le massif des Vosges, pas la plaine du
 * département). Altitudes inconnues : liste inchangée.
 */
export function keepHighlands(places: AreaPlace[]): AreaPlace[] {
  const eles = places.map((p) => p.eleM).filter((e): e is number => e != null).sort((a, b) => a - b);
  if (eles.length < 10) return places;
  const median = eles[Math.floor(eles.length / 2)];
  const top = eles[Math.floor(eles.length * 0.9)];
  if (top - median < 600) return places;
  const high = places.filter((p) => p.eleM == null || p.eleM > median);
  return high.length >= 5 ? high : places;
}

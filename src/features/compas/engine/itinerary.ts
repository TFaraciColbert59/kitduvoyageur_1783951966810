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
import type { NightPlan, StageMove } from './autofill';
import {
  ACCLIMATISATION_FROM_M,
  MAX_SLEEP_GAIN_M,
  REST_AFTER_NIGHTS,
  sleepOvershootM,
} from './acclimatisation';
import {
  extentIsWorldwide,
  extentWidthDeg,
  lonDelta,
  lonInExtent,
  meanLon,
  splitLonRange,
  wrapLon,
} from './longitude';
import { along, mainAxis } from './axis';
import { MOUNTAIN_BASE, RANK, altitudeBonus, profileFor, type Profile } from './activityProfile';
import { COUNTRY_SCALE_KM, pickCountryBases, type CountryBasesPlan } from './countryBases';

// Le barème des activités et l'axe d'une zone vivent à part (`activityProfile.ts`, `axis.ts`) ;
// ils restent lisibles d'ici, comme avant.
export { isMountainActivity, profileFor } from './activityProfile';
export { mainAxis } from './axis';

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

function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Point à `km` de `p` dans la direction `deg` (approximation locale, suffisante à l'échelle d'une étape). */
function offset(
  p: { lat: number; lon: number },
  deg: number,
  km: number
): { lat: number; lon: number } {
  const rad = (deg * Math.PI) / 180;
  const dLat = (km * Math.cos(rad)) / 111;
  const dLon = (km * Math.sin(rad)) / (111 * Math.max(0.1, Math.cos((p.lat * Math.PI) / 180)));
  return { lat: p.lat + dLat, lon: wrapLon(p.lon + dLon) };
}

/** Rayon réel d'une zone : 90 % de ses lieux sont à moins de ce rayon de leur centre. */
export function zoneSpreadKm(places: ReadonlyArray<{ lat: number; lon: number }>): number {
  if (!places.length) return 0;
  const c = {
    lat: places.reduce((t, p) => t + p.lat, 0) / places.length,
    lon: meanLon(places.map((p) => p.lon)),
  };
  const d = places.map((p) => distanceKm(c, p)).sort((a, b) => a - b);
  return d[Math.min(d.length - 1, Math.floor(d.length * 0.9))];
}

/** Facteur (0,4 à 1) qui ramène la distance du jour à ce que la zone peut contenir. */
function fitScale(
  places: AreaPlace[],
  shape: 'traverse' | 'loop',
  crowTarget: number,
  moves: number,
  adjustable: boolean
): number {
  if (!adjustable) return 1;
  const r = zoneSpreadKm(places);
  if (r <= 0) return 1;
  // Boucle : périmètre ≤ celui d'un cercle de 60 % du rayon ; traversée : longueur ≤ 1,6 rayon.
  const room = shape === 'loop' ? 2 * Math.PI * 0.6 * r : 1.6 * r;
  const need = crowTarget * Math.max(1, moves);
  return need > room ? Math.max(0.4, room / need) : 1;
}

/**
 * Dans l'emprise de la destination (marge de 10 %), quand on la connaît. Une
 * emprise qui franchit l'antiméridien (ouest > est) se lit de part et d'autre
 * de la coupure ; la boîte d'un globe entier (Fidji, Taveuni : [-180, 180]) ne
 * dit rien de la largeur, seule la latitude filtre.
 */
function withinExtent(p: { lat: number; lon: number }, extent: ItineraryInput['extent']): boolean {
  if (!extent) return true;
  const [, n, , s] = extent;
  const my = Math.abs(n - s) * 0.1;
  if (!(p.lat >= Math.min(s, n) - my && p.lat <= Math.max(s, n) + my)) return false;
  if (extentIsWorldwide(extent)) return true;
  return lonInExtent(p.lon, extent, extentWidthDeg(extent) * 0.1);
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
  input: Pick<
    ItineraryInput,
    'activity' | 'days' | 'radiusKm' | 'shape' | 'targetKmPerDay' | 'natural'
  >
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

function sleepOk(p: AreaPlace, nights: string | null | undefined, wild = false): boolean {
  // Hors bivouac, un camping ne fait pas une étape ; un refuge oui si la personne en veut.
  // Sauf dans un espace sauvage (peu de lieux habités) : le camping y est l'un des
  // rares endroits où dormir, tant que la personne ne demande ni toit ni refuge.
  if (p.kind === 'camp')
    return (
      nights === 'bivouac' ||
      nights === 'mixte' ||
      (wild && nights !== 'hebergement' && nights !== 'refuge')
    );
  return true;
}

/** Nom d'un bivouac calculé entre deux lieux réels (voir `planMoving`) : sert aussi à le reconnaître. */
export const BIVOUAC_PREFIX = 'Bivouac entre ';

/** Cette étape est-elle un bivouac calculé (aucun lieu réel où dormir) ? */
export function isBivouacStage(name: string): boolean {
  return name.startsWith(BIVOUAC_PREFIX);
}

/**
 * La nuit d'un bivouac calculé est un bivouac : un « hébergement à réserver » à
 * un point qui n'est aucun lieu serait faux, quel que soit le profil qui a posé
 * le type des nuits. `stageNameOfNight` : le nom de l'étape de ce soir-là.
 */
export function markComputedBivouacs(
  plan: NightPlan[],
  stageNameOfNight: (night: number) => string | null | undefined
): NightPlan[] {
  return plan.map((n) => {
    const name = stageNameOfNight(n.night);
    return name && isBivouacStage(name)
      ? {
          night: n.night,
          type: 'bivouac' as const,
          reason: 'aucun lieu où dormir à une journée de marche : bivouac annoncé',
        }
      : n;
  });
}

/**
 * Nuits de bivouac calculées, au plus, d'affilée entre deux lieux réels : trois
 * nuits, donc quatre journées de marche d'un lieu à l'autre. Le décompte
 * « (k/3) » affiché ne dépasse jamais cette borne.
 */
const MAX_BIVOUAC_GAP_NIGHTS = 3;

function kindScore(p: AreaPlace, prof: Profile, nights: string | null | undefined): number {
  let s = prof.prefer[p.kind] ?? 0;
  if (p.kind === 'hut' && (nights === 'refuge' || nights === 'mixte')) s += 1;
  if (p.kind === 'hut' && nights === 'hebergement') s -= 1.5;
  // Un lieu peuplé a de quoi dormir et manger ; plafonné pour ne pas tout aspirer vers la capitale.
  if (p.population && p.population > 0) s += Math.min(1, Math.log10(p.population) / 6);
  return s;
}

/**
 * Séjour sur base(s). Un pays entier (rayon au-delà de `COUNTRY_SCALE_KM`) : plusieurs
 * bases, une par groupe de jours, choisies parmi les lieux réels par `pickCountryBases`
 * (notoriété, trajet raisonnable pour l'activité, sans retour en arrière). Sinon une
 * seule base : le lieu dit par la personne, ou le meilleur lieu près du centre.
 */
function planBase(input: ItineraryInput, prof: Profile): PlannedStage[] {
  if (input.radiusKm > COUNTRY_SCALE_KM) {
    const multi = pickCountryBases({
      places: input.places,
      days: input.days,
      activity: input.activity,
      anchor: { lat: input.center.lat, lon: input.center.lon, radiusKm: input.radiusKm },
      waypoints: input.waypoints,
    });
    if (multi) return stagesOfBases(multi, prof);
  }
  const pool = input.places.filter((p) => p.kind !== 'camp' && p.kind !== 'hut');
  const wanted = input.waypoints?.[0];
  const pick = wanted
    ? null
    : best(pool, (p) => {
        const fromCenter = distanceKm(input.center, p) / Math.max(1, input.radiusKm);
        if (fromCenter > 1.1) return -Infinity;
        // La plus proche du centre. Dans un grand lieu naturel, le centre de
        // l'emprise ne dit rien (Dolomites : près de Belluno, en plaine) : il
        // pèse moins, et en montagne l'altitude compte (Canazei, pas Brugnàch).
        const mountain = MOUNTAIN_BASE.has(input.activity) ? altitudeBonus(p.eleM) : 0;
        return kindScore(p, prof, input.nights) + mountain - (input.natural ? 1 : 3) * fromCenter;
      });
  const base = wanted
    ? { name: wanted.name, lat: wanted.lat, lon: wanted.lon, id: null }
    : pick
      ? { name: pick.name, lat: pick.lat, lon: pick.lon, id: pick.id }
      : null;
  if (!base) return [];
  return Array.from({ length: input.days }, (_, i) => ({
    day: i + 1,
    name: base.name,
    lat: base.lat,
    lon: base.lon,
    move: 'aucun' as StageMove,
    note: i === 0 ? 'Base du séjour.' : null,
    placeId: base.id,
  }));
}

/** Les jours d'un séjour à bases multiples : un changement de base, dit, le premier jour de chaque base. */
function stagesOfBases(plan: CountryBasesPlan, prof: Profile): PlannedStage[] {
  // À pied ou à vélo, le trajet entre deux bases n'est ni une marche ni une étape de vélo : on le dit.
  const byVehicle = prof.move === 'marche' || prof.move === 'velo' ? ' en véhicule' : '';
  const stages: PlannedStage[] = [];
  plan.bases.forEach((b, k) => {
    for (let d = 0; d < b.days; d += 1) {
      const first = d === 0;
      stages.push({
        day: stages.length + 1,
        name: b.name,
        lat: b.lat,
        lon: b.lon,
        move: first && k > 0 ? plan.move : 'aucun',
        note:
          first && k === 0
            ? plan.bases.length > 1
              ? 'Première base du séjour.'
              : 'Base du séjour.'
            : first
              ? `Changement de base${byVehicle} (environ ${b.legKm} km à vol d’oiseau).`
              : null,
        placeId: b.placeId,
      });
    }
  });
  return stages;
}

/** Itinéraire itinérant (trek, vélo, road trip) : un lieu réel par soir, choisi par calcul. */
function planMoving(
  input: ItineraryInput,
  prof: Profile,
  shape: 'traverse' | 'loop'
): { stages: PlannedStage[]; start: AreaPlace | null } {
  const [minKm, targetKm, maxKm] = input.targetKmPerDay
    ? [input.targetKmPerDay * 0.6, input.targetKmPerDay, input.targetKmPerDay * 1.4]
    : prof.dayKm;
  // Espace sauvage : moins de lieux habités (ou refuges) dans la zone que de jours à dormir.
  const wild =
    prof.move === 'marche' &&
    isWildZone({
      places: input.places,
      center: input.center,
      radiusKm: input.radiusKm,
      days: input.days,
      extent: input.extent,
    });
  const reachable = input.places.filter(
    (p) => sleepOk(p, input.nights, wild) && distanceKm(input.center, p) <= input.radiusKm * 1.15
  );
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
    pending.sort(
      (a, b) => distanceKm(probe, a) - distanceKm(probe, b) || (a.name < b.name ? -1 : 1)
    );
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
  // Nuits d'affilée au-dessus de 2 500 m (règle UIAA, `acclimatisation.ts`).
  let highStreak = (start.eleM ?? 0) >= ACCLIMATISATION_FROM_M ? 1 : 0;
  // Lieu où une nuit de plus vient d'être posée : on n'y reste pas deux fois pour la même raison.
  let restedAt: string | null = null;
  // Bivouacs calculés d'affilée (même trou entre deux lieux réels) et dernier lieu réel quitté.
  let bivouacNights = 0;
  let gapFrom = start.name;
  let gapTo: AreaPlace | null = null;
  // Journées de marche qui restent jusqu'à `gapTo`, celle du jour comprise (comptées à l'ouverture du trou, jamais ré-estimées).
  let gapDays = 0;
  // Traversée qui a fait demi-tour (bout de la zone) : la note n'est dite qu'une fois.
  let returning = false;
  for (let day = 1; day <= input.days; day += 1) {
    const left = input.days - day; // déplacements restants après celui-ci
    // Acclimatation : au-dessus de 2 500 m, une nuit de plus au même lieu après trois nuits de montée.
    if (
      prof.move === 'marche' &&
      (cur.eleM ?? 0) >= ACCLIMATISATION_FROM_M &&
      highStreak >= REST_AFTER_NIGHTS
    ) {
      stages.push({
        day,
        name: cur.name,
        lat: cur.lat,
        lon: cur.lon,
        move: 'aucun',
        note: 'Journée d’acclimatation (au-dessus de 2 500 m) : une nuit de plus à la même altitude, comme le conseille la commission médicale de l’UIAA.',
        placeId: cur.id,
      });
      highStreak = 0;
      restedAt = cur.id;
      continue;
    }
    const goal = orderedWays[0] ?? null;
    const ideal = loopCircle ? loopCircle(day) : null;
    // `strict` : la nuit ne monte jamais de plus de 500 m au-dessus de 2 500 m (UIAA) ; sinon l'excès coûte cher mais reste possible.
    const pickWith = (lo: number, hi: number, strict: boolean) =>
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
        // Montée de couchage limitée en altitude (altitudes inconnues : rien n'est déduit).
        if (prof.move === 'marche') {
          const over = sleepOvershootM(cur.eleM, p.eleM);
          if (over > 0) {
            if (strict) return -Infinity;
            s -= 3 + 2 * (over / MAX_SLEEP_GAIN_M);
          }
        }
        return s;
      });
    const choose = (strict: boolean) =>
      pickWith(crowMin, crowMax, strict) ?? pickWith(crowMin * 0.5, crowMax * 1.4, strict);
    // Dernier soir d'une boucle : retour au départ.
    // Une fois le demi-tour fait, on continue de revenir (pas de zigzag).
    // En plein trou entre deux lieux réels (bivouacs calculés) : on y va droit, journées égales.
    const midGap: AreaPlace | null =
      gapTo && !used.has(gapTo.id) && shape === 'traverse' && !goal && !returning ? gapTo : null;
    let next: AreaPlace | null =
      shape === 'loop' && left === 0 && !goal
        ? start
        : returning
          ? null
          : midGap
            ? gapDays <= 1
              ? midGap
              : null
            : choose(true);
    // Aucun lieu sans saut de couchage trop grand, mais il y en a avec : une nuit
    // de plus ici d'abord (acclimatation), puis l'étape, dite, si rien d'autre n'existe.
    let climbM = 0;
    if (
      !next &&
      !returning &&
      !midGap &&
      prof.move === 'marche' &&
      !(goal && distanceKm(cur, goal) <= crowMax)
    ) {
      const risky = choose(false);
      if (risky) {
        if (restedAt !== cur.id) {
          stages.push({
            day,
            name: cur.name,
            lat: cur.lat,
            lon: cur.lon,
            move: 'aucun',
            note: 'Journée d’acclimatation : le prochain lieu est à plus de 500 m plus haut que cette nuit (altitudes repères). Une nuit de plus ici avant de monter.',
            placeId: cur.id,
          });
          restedAt = cur.id;
          highStreak = 0;
          continue;
        }
        next = risky;
        climbM = sleepOvershootM(cur.eleM, risky.eleM) + MAX_SLEEP_GAIN_M;
      }
    }
    // Aucun lieu à une journée de marche, mais un lieu réel plus loin vers l'avant
    // (jusqu'à quatre journées) : un bivouac calculé sur la ligne, annoncé comme tel.
    // Jamais pour qui veut un toit ou un refuge (comme pour les campings, `sleepOk`) :
    // faute de lieu, on reste sur place et on le dit. Jamais non plus si le lieu réel
    // n'est pas atteint avant la fin du voyage (le décompte « (k/total) » promettrait
    // des nuits que le voyage n'a pas).
    let bivouacNote: string | null = null;
    if (
      !next &&
      !returning &&
      shape === 'traverse' &&
      !goal &&
      prof.move === 'marche' &&
      input.nights !== 'hebergement' &&
      input.nights !== 'refuge'
    ) {
      // Journées de marche jusqu'à `p`. Le lieu est atteignable si les nuits de bivouac tiennent dans la borne et dans les jours qui restent.
      const walkDaysTo = (p: AreaPlace) => Math.max(2, Math.ceil(distanceKm(cur, p) / crowTarget));
      const fits = (walkDays: number) =>
        walkDays - 1 <= MAX_BIVOUAC_GAP_NIGHTS && walkDays - 1 <= left;
      const ahead: AreaPlace | null =
        midGap ??
        best(inZone, (p) => {
          if (used.has(p.id)) return -Infinity;
          const d = distanceKm(cur, p);
          if (d <= crowMax * 1.4 || !fits(walkDaysTo(p))) return -Infinity;
          if (along(axis, p) - along(axis, cur) <= 0) return -Infinity;
          return -d;
        });
      // En plein trou, les journées qui restent ont été comptées à l'ouverture : le décompte « (k/total) » ne bouge plus.
      const walkDays = ahead ? (midGap ? gapDays : walkDaysTo(ahead)) : 0;
      if (ahead && fits(walkDays)) {
        gapTo = ahead;
        gapDays = walkDays - 1;
        const d = distanceKm(cur, ahead);
        const f = 1 / walkDays;
        const total = bivouacNights + walkDays - 1;
        next = {
          id: `b:${day}`,
          name: `${BIVOUAC_PREFIX}${gapFrom} et ${ahead.name}${total > 1 ? ` (${bivouacNights + 1}/${total})` : ''}`,
          lat: cur.lat + (ahead.lat - cur.lat) * f,
          lon: wrapLon(cur.lon + lonDelta(cur.lon, ahead.lon) * f),
          kind: 'camp',
          population: null,
          eleM: null,
        };
        bivouacNote = `Bivouac : aucun lieu où dormir à une journée de marche (${ahead.name} est à ${Math.round(d)} km à vol d’oiseau) ; emplacement à choisir sur place, après avoir vérifié les règles du lieu (bivouac souvent limité ou interdit dans les parcs et les réserves).`;
      }
    }
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
      next =
        at && distanceKm(goal, at) <= 3
          ? at
          : {
              id: `w:${goal.name}`,
              name: goal.name,
              lat: goal.lat,
              lon: goal.lon,
              kind: 'village',
              population: null,
              eleM: null,
            };
      orderedWays.shift();
    }
    if (!next) {
      stages.push({
        day,
        name: cur.name,
        lat: cur.lat,
        lon: cur.lon,
        move: 'aucun',
        note: 'Journée sur place : aucun lieu où dormir à distance d’une étape.',
        placeId: cur.id,
      });
      continue;
    }
    used.add(next.id);
    stages.push({
      day,
      name: next.name,
      lat: next.lat,
      lon: next.lon,
      move: prof.move,
      note:
        [
          day === 1
            ? `Départ ${fromPlace(start.name)}.`
            : back && !returning
              ? 'Retour par un autre chemin : la zone s’arrête ici.'
              : null,
          bivouacNote,
          climbM > 0
            ? `Nuit environ ${Math.round(climbM / 10) * 10} m plus haut que la veille, plus que les 300 à 500 m conseillés au-dessus de 2 500 m (altitudes repères) : aucun lieu intermédiaire dans la zone.`
            : null,
        ]
          .filter(Boolean)
          .join(' ') || null,
      placeId: next.id.startsWith('w:') || next.id.startsWith('b:') ? null : next.id,
    });
    if (bivouacNote) bivouacNights += 1;
    else {
      bivouacNights = 0;
      gapFrom = next.name;
      gapTo = null;
      gapDays = 0;
    }
    highStreak = (next.eleM ?? 0) >= ACCLIMATISATION_FROM_M ? highStreak + 1 : 0;
    returning = returning || back;
    cur = next;
  }
  return { stages, start };
}

/** « de Beaufort », « d'Albertville » (élision devant une voyelle). */
export function fromPlace(name: string): string {
  const n = name.trim();
  // « Le Truel » → « du Truel », « Les Vans » → « des Vans ».
  if (/^le\s/i.test(n)) return `du ${n.slice(3)}`;
  if (/^les\s/i.test(n)) return `des ${n.slice(4)}`;
  return /^[aeiouyàâäéèêëîïôöùûü]/i.test(n) ? `d’${n}` : `de ${n}`;
}

/** « à Sampzon », « au Truel », « aux Vans ». */
export function toPlace(name: string): string {
  const n = name.trim();
  if (/^le\s/i.test(n)) return `au ${n.slice(3)}`;
  if (/^les\s/i.test(n)) return `aux ${n.slice(4)}`;
  return `à ${n}`;
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
    places.filter(
      (p) =>
        (p.kind === 'town' || p.kind === 'village' || p.kind === 'city') &&
        distanceKm(center, p) <= maxKm
    ),
    (p) => Math.log10(Math.max(10, p.population ?? 10)) - distanceKm(center, p) / 5
  );
  if (!pick) return null;
  const km = distanceKm(center, pick);
  return {
    place: pick,
    km,
    note:
      km <= 5
        ? `Départ ${fromPlace(pick.name)}, au cœur du lieu.`
        : `Départ ${fromPlace(pick.name)}, à ${Math.round(km)} km du centre du lieu.`,
  };
}

/** Itinéraire complet ; null si la zone ne fournit pas assez de lieux réels (l'appelant se replie). */
export function planItinerary(raw: ItineraryInput): ItineraryPlan | null {
  if (!Number.isInteger(raw.days) || raw.days < 1) return null;
  // Aussi ici : les lieux d'une zone sont gardés un mois en cache, lus avant ce filtre.
  const input = { ...raw, places: raw.places.filter((p) => !isGenericName(p.name)) };
  const prof = profileFor(input.activity);
  const shape = shapeFor(input);
  const moving = shape === 'base' ? null : planMoving(input, prof, shape);
  const stages = moving ? moving.stages : planBase(input, prof);
  if (!stages.length) return null;
  const distinct = new Set(stages.map((s) => s.placeId ?? s.name)).size;
  const start = moving?.start
    ? { name: moving.start.name, lat: moving.start.lat, lon: moving.start.lon }
    : null;
  return { shape, start, stages, distinct };
}

/* ---------- Lecture d'OpenStreetMap (Overpass), pure ---------- */

export interface AreaQuery {
  center: { lat: number; lon: number };
  radiusKm: number;
  /** Emprise [ouest, nord, est, sud] quand la carte la donne (pays, régions). */
  extent?: [number, number, number, number] | null;
  activity: string;
  /** Espace sauvage (`isWildZone`) : peu de lieux habités, on descend aux hameaux et aux campings. */
  wild?: boolean;
}

/**
 * Espace sauvage : moins de lieux habités (ou refuges) dans la zone que de jours
 * à dormir (quatre au moins). Les campings ne comptent pas : ils ne remplacent
 * pas un lieu où ravitailler. Sert au planificateur (campings permis, bivouac
 * annoncé) et à la recherche (hameaux et campings demandés).
 */
export function isWildZone(input: {
  places: ReadonlyArray<AreaPlace>;
  center: { lat: number; lon: number };
  radiusKm: number;
  days: number;
  extent?: ItineraryInput['extent'];
}): boolean {
  const habitable = input.places.filter(
    (p) =>
      p.kind !== 'camp' &&
      distanceKm(input.center, p) <= input.radiusKm * 1.15 &&
      withinExtent(p, input.extent)
  );
  return habitable.length < Math.max(4, input.days);
}

/** Natures cherchées : plus la zone est grande, moins on descend dans les petits lieux. */
export function areaKinds(q: AreaQuery): AreaPlaceKind[] {
  const foot = profileFor(q.activity).move === 'marche';
  // Espace sauvage à pied : les hameaux et les campings sont parmi les seuls endroits où dormir.
  if (q.wild && foot && q.radiusKm <= 90) return ['town', 'village', 'hamlet', 'hut', 'camp'];
  if (q.radiusKm > 250) return ['city', 'town'];
  if (q.radiusKm > 90) return foot ? ['town', 'village', 'hut'] : ['city', 'town', 'village'];
  // Hameaux et campings : seulement sur une petite zone (sinon la requête est trop lourde).
  if (q.radiusKm > 25) return foot ? ['town', 'village', 'hut'] : ['city', 'town', 'village'];
  return foot
    ? ['town', 'village', 'hamlet', 'hut', 'camp']
    : ['city', 'town', 'village', 'hamlet'];
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

/**
 * Les boîtes [ouest, sud, est, nord] à interroger pour une emprise : une seule
 * en général, deux quand elle franchit l'antiméridien (ouest > est). La boîte
 * d'un globe entier ([-180, 180], Fidji) n'en est pas une : la zone est alors
 * le rayon autour du centre (null ici).
 */
export function extentBoxes(
  extent: Readonly<NonNullable<AreaQuery['extent']>>
): Array<[number, number, number, number]> | null {
  if (extentIsWorldwide(extent)) return null;
  const [w, n, e, s] = extent;
  return splitLonRange(w, e).map(([a, b]) => [a, Math.min(s, n), b, Math.max(s, n)]);
}

export function buildAreaQuery(q: AreaQuery): string {
  const kinds = areaKinds(q);
  const places = kinds.filter((k) => k !== 'hut' && k !== 'camp');
  const r = Math.round(Math.min(q.radiusKm, 400) * 1000);
  const boxes = q.extent ? extentBoxes(q.extent) : null;
  const wheres = boxes
    ? boxes.map(
        ([w, s, e, n]) => `(${s.toFixed(3)},${w.toFixed(3)},${n.toFixed(3)},${e.toFixed(3)})`
      )
    : [`(around:${r},${q.center.lat.toFixed(4)},${q.center.lon.toFixed(4)})`];
  const parts: string[] = [];
  for (const where of wheres) {
    parts.push(`node[place~"^(${places.join('|')})$"][name]${where};`);
    if (kinds.includes('hut'))
      parts.push(`nwr[tourism~"^(alpine_hut|wilderness_hut)$"][name]${where};`);
    if (kinds.includes('camp')) parts.push(`nwr[tourism=camp_site][name]${where};`);
  }
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
    const e = raw as {
      type?: string;
      id?: number;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    };
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
          : ((['city', 'town', 'village', 'hamlet'] as const).find((k) => k === tags.place) ??
            null);
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

/**
 * Emprises à interroger : une seule pour une petite zone, quatre tuiles au-delà
 * de 25 km (50 lieux par tuile). Les tuiles restent dans [-180, 180] et [-90, 90] :
 * une tuile qui franchit l'antiméridien (Fidji, 179,9° E) est scindée en deux.
 */
export function areaTiles(
  center: { lat: number; lon: number },
  radiusKm: number
): Array<[number, number, number, number]> {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.max(0.1, Math.cos((center.lat * Math.PI) / 180)));
  const [w, e] = [center.lon - dLon, center.lon + dLon];
  const s = Math.max(-90, center.lat - dLat);
  const n = Math.min(90, center.lat + dLat);
  const tiles: Array<[number, number, number, number]> =
    radiusKm <= 25
      ? [[w, s, e, n]]
      : [
          [w, s, center.lon, center.lat],
          [center.lon, s, e, center.lat],
          [w, center.lat, center.lon, n],
          [center.lon, center.lat, e, n],
        ];
  return tiles.flatMap(([a, south, b, north]) =>
    splitLonRange(a, b).map(([x, y]) => [x, south, y, north] as [number, number, number, number])
  );
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
export function photonIncludes(kinds: AreaPlaceKind[]): {
  places: string;
  shelters: string | null;
} {
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
    const f = raw as {
      geometry?: { coordinates?: [number, number] };
      properties?: Record<string, unknown>;
    };
    const p = f.properties ?? {};
    const kind = PHOTON_KIND[`${String(p.osm_key ?? '')}:${String(p.osm_value ?? '')}`];
    const name = typeof p.name === 'string' ? latinName(p.name) : '';
    const [lon, lat] = f.geometry?.coordinates ?? [NaN, NaN];
    if (!kind || !name || isGenericName(name) || !Number.isFinite(lat) || !Number.isFinite(lon))
      return;
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
  return (
    name
      .split(/\s+/)
      .filter(
        (w) =>
          !/[\p{Script=Tifinagh}\p{Script=Arabic}\p{Script=Cyrillic}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Greek}\p{Script=Hebrew}\p{Script=Thai}\p{Script=Devanagari}]/u.test(
            w
          )
      )
      .join(' ')
      .trim() || name
  );
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
    const p = ((raw as { properties?: Record<string, unknown> }).properties ?? {}) as Record<
      string,
      unknown
    >;
    const cats = Array.isArray(p.categories) ? p.categories.map(String) : [];
    const kind = (Object.keys(GEOAPIFY_CATEGORY) as AreaPlaceKind[]).find((k) =>
      cats.includes(GEOAPIFY_CATEGORY[k])
    );
    const name = typeof p.name === 'string' ? latinName(p.name) : '';
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    if (!kind || !name || isGenericName(name) || !Number.isFinite(lat) || !Number.isFinite(lon))
      return;
    const osm = ((p.datasource as { raw?: Record<string, unknown> } | undefined)?.raw ??
      {}) as Record<string, unknown>;
    const pop = Number(osm.population);
    const ele = Number(osm.ele);
    out.push({
      id:
        osm.osm_id != null
          ? `${String(osm.osm_type ?? 'n').toLowerCase()[0]}${String(osm.osm_id)}`
          : `g${lat.toFixed(5)},${lon.toFixed(5)}`,
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
  return home / known.length >= 0.7
    ? places.filter((p) => !p.countryCode || p.countryCode === countryCode)
    : places;
}

const plainAdmin = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Destination administrative (une région, un département) : les étapes restent
 * dedans (« Bretagne » ne passe pas par Saint-Lô). Seulement si assez de lieux
 * portent ce nom de région ou de département ; sinon la liste est gardée.
 */
export function keepAdminArea(
  places: AreaPlace[],
  name: string,
  level: 'region' | 'county'
): AreaPlace[] {
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
  const eles = places
    .map((p) => p.eleM)
    .filter((e): e is number => e != null)
    .sort((a, b) => a - b);
  if (eles.length < 10) return places;
  const median = eles[Math.floor(eles.length / 2)];
  const top = eles[Math.floor(eles.length * 0.9)];
  if (top - median < 600) return places;
  const high = places.filter((p) => p.eleM == null || p.eleM > median);
  return high.length >= 5 ? high : places;
}

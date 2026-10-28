/**
 * Dérivation des jours d'un carnet — côté serveur, aucune migration.
 *
 * Un carnet se vit sur plusieurs jours : la fiche se balaie J1 → Jn. Les jours
 * ne sont pas stockés, ils se calculent à partir de deux sources réelles :
 *
 * - les **moments** (`carnet_moments.jour_numero`) : ils nomment leur jour ;
 * - les **points GPS** des `hike_sessions` du carnet : chaque point porte une
 *   heure, donc chaque point tombe dans un jour.
 *
 * Le jour d'un point se calcule depuis la date du carnet
 * (`start_date + jour_numero - 1`) ; sans `start_date`, depuis la date du point
 * elle-même. Plusieurs sorties le même jour fusionnent : leurs points sont
 * recousus dans l'ordre chronologique.
 *
 * Aucune valeur n'est inventée : un jour sans GPS garde `distanceKm: null`, un
 * carnet sans date garde `date: null`, une sortie sans durée ne fabrique pas de
 * durée. Une distance ne relie jamais deux sorties distinctes : le saut entre
 * la fin d'un relevé et le début d'un autre n'est pas un segment parcouru.
 *
 * Le D+ d'un jour vient d'abord des sorties : `hike_sessions.elevation_gain_m`
 * est le dénivelé réel de la sortie, rattaché au jour où elle a commencé (même
 * règle que la durée). Les altitudes des points GPS ne prennent le relais que
 * si aucune sortie du jour ne porte de gain non nul. Sans l'une ni l'autre, le
 * jour garde `elevationM: null` : aucun D+ n'est réparti depuis le total.
 */

import { parsePositions } from '@/features/compte/map/geometry';
import { haversineDistanceKm } from '@/features/explorer-osm/domain/geometry';
import { toNumber } from './format';
import type {
  CarnetDay,
  CarnetDayPoint,
  CarnetMomentItem,
  CarnetSummary,
  HikeSessionRow,
  MomentRow,
} from './types';

const DAY_MS = 86_400_000;
const DAY_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Point GPS interne : la coordonnée, l'heure réelle qui le date, et l'altitude
 * quand le relevé en porte une (seule source du D+).
 */
interface TimedPoint extends CarnetDayPoint {
  elevationM: number | null;
}

/** Une suite continue de points d'une même sortie : jamais recousue à une autre. */
interface DayRun {
  sessionId: string;
  points: TimedPoint[];
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Minuit UTC du jour d'un horodatage ISO, en millisecondes. `null` si illisible. */
function dayStamp(at: string): number | null {
  const match = DAY_PREFIX.exec(at);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** `YYYY-MM-DD` d'une minuit UTC — même format que `carnets.start_date`. */
function isoDate(stamp: number): string {
  return new Date(stamp).toISOString().slice(0, 10);
}

/** Échantillons horodatés (`positions_timed`) : la seule heure propre au point. */
function timedPoints(value: unknown): TimedPoint[] {
  if (!Array.isArray(value)) return [];
  const points: TimedPoint[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as { lat?: unknown; lng?: unknown; timestamp?: unknown; elevationM?: unknown };
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    const at = asText(row.timestamp);
    if (!at || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const elevationM = Number(row.elevationM);
    points.push({ lat, lng, at, elevationM: Number.isFinite(elevationM) ? elevationM : null });
  }
  return points;
}

/**
 * Géométrie seule (`positions_geojson`) : les coordonnées sont réelles, l'heure
 * ne l'est pas — on date chaque point du début réel de la sortie. Sans
 * `started_at`, les points ne peuvent être placés sur un jour et sont écartés.
 */
function geometryPoints(session: HikeSessionRow): TimedPoint[] {
  const at = asText(session.started_at);
  if (!at) return [];
  return parsePositions(session.positions_geojson).map((point) => ({
    lat: point.lat,
    lng: point.lng,
    at,
    elevationM: null,
  }));
}

/** Points d'une sortie, horodatés quand le relevé le permet. */
function sessionPoints(session: HikeSessionRow): TimedPoint[] {
  const timed = timedPoints(session.positions_timed);
  return timed.length > 0 ? timed : geometryPoints(session);
}

/**
 * Jour d'un point : `start_date + jour_numero - 1`, ou la date du point quand le
 * carnet n'a pas de date de départ (les dates distinctes sont alors numérotées
 * dans l'ordre chronologique). Un point antérieur au départ reste sur J1.
 */
function dayIndexOf(
  at: string,
  startDayStamp: number | null,
  dateRanks: Map<string, number>,
): number | null {
  const stamp = dayStamp(at);
  if (stamp === null) return null;
  if (startDayStamp !== null) {
    return Math.max(1, Math.round((stamp - startDayStamp) / DAY_MS) + 1);
  }
  return dateRanks.get(isoDate(stamp)) ?? null;
}

function runDistanceKm(points: TimedPoint[]): number | null {
  if (points.length < 2) return null;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    total += haversineDistanceKm([from.lng, from.lat], [to.lng, to.lat]);
  }
  return total;
}

function runElevationM(points: TimedPoint[]): number | null {
  let total = 0;
  let pairs = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1].elevationM;
    const to = points[index].elevationM;
    if (from === null || to === null) continue;
    pairs += 1;
    if (to > from) total += to - from;
  }
  return pairs > 0 ? total : null;
}

function sumOf(runs: DayRun[], pick: (run: DayRun) => number | null): number | null {
  let total: number | null = null;
  for (const run of runs) {
    const value = pick(run);
    if (value === null) continue;
    total = (total ?? 0) + value;
  }
  return total;
}

/** Moments du carnet, dans l'ordre reçu : seule conversion `MomentRow` → fiche. */
export function toMomentItems(rows: MomentRow[]): CarnetMomentItem[] {
  return rows.map((row) => ({
    id: row.id,
    dayNumber: row.jour_numero ?? 1,
    time: row.heure ?? null,
    caption: row.citation?.trim() || null,
    authorName: row.auteur_nom?.trim() || null,
    place: row.lieu?.trim() || null,
    imageUrl: row.image_url?.trim() || null,
  }));
}

/**
 * Jours du carnet, du plus ancien au plus récent.
 *
 * @param input.moments  lignes `carnet_moments` du carnet ;
 * @param input.sessions `hike_sessions` du carnet, chacune portant ses points ;
 * @param input.startDate `carnets.start_date`, ou `null`.
 */
export function buildDays(input: {
  moments: MomentRow[];
  sessions: HikeSessionRow[];
  startDate: string | null;
}): CarnetDay[] {
  const startDayStamp = input.startDate ? dayStamp(input.startDate) : null;

  /* Tous les points du carnet, sortie par sortie : l'ordre interne d'un relevé
     est conservé, c'est lui qui donne les segments. */
  const sessions = input.sessions.map((session) => ({ session, points: sessionPoints(session) }));

  /* Sans date de départ, les dates réelles des points numérotent les jours. */
  const dateRanks = new Map<string, number>();
  if (startDayStamp === null) {
    const dates = new Set<string>();
    for (const { points } of sessions) {
      for (const point of points) {
        const stamp = dayStamp(point.at);
        if (stamp !== null) dates.add(isoDate(stamp));
      }
    }
    [...dates].sort().forEach((date, index) => dateRanks.set(date, index + 1));
  }

  const runsByDay = new Map<number, DayRun[]>();
  const durationsByDay = new Map<number, number>();
  const momentsByDay = new Map<number, CarnetMomentItem[]>();
  /* D+ porté par les sorties du jour : `real` dit qu'au moins une sortie donne
     un gain non nul, `total` additionne les gains connus (zéro compris). */
  const elevationsByDay = new Map<number, { total: number; real: boolean }>();

  for (const { session, points } of sessions) {
    /* Une sortie peut chevaucher minuit : ses points sont répartis par heure,
       mais son relevé n'est jamais recousu à celui d'une autre sortie. */
    const runs = new Map<number, TimedPoint[]>();
    for (const point of points) {
      const index = dayIndexOf(point.at, startDayStamp, dateRanks);
      if (index === null) continue;
      const run = runs.get(index) ?? [];
      run.push(point);
      runs.set(index, run);
    }
    for (const [index, run] of runs) {
      const list = runsByDay.get(index) ?? [];
      list.push({ sessionId: session.id, points: run });
      runsByDay.set(index, list);
    }

    /* La durée est celle de la sortie : elle va au jour où elle a commencé,
       même quand la sortie ne porte aucun point GPS. */
    const duration = session.duration_seconds;
    if (typeof duration === 'number' && Number.isFinite(duration) && duration >= 0) {
      const startedAt = asText(session.started_at) ?? points[0]?.at ?? null;
      const index = startedAt ? dayIndexOf(startedAt, startDayStamp, dateRanks) : null;
      if (index !== null) durationsByDay.set(index, (durationsByDay.get(index) ?? 0) + duration);
    }

    /* Le D+ de la sortie suit le même jour que sa durée : `elevation_gain_m`
       est le gain réel du relevé, jamais une valeur déduite des points. */
    const gain = toNumber(session.elevation_gain_m);
    if (gain !== null) {
      const startedAt = asText(session.started_at) ?? points[0]?.at ?? null;
      const index = startedAt ? dayIndexOf(startedAt, startDayStamp, dateRanks) : null;
      if (index !== null) {
        const entry = elevationsByDay.get(index) ?? { total: 0, real: false };
        entry.total += gain;
        if (gain !== 0) entry.real = true;
        elevationsByDay.set(index, entry);
      }
    }
  }

  for (const moment of toMomentItems(input.moments)) {
    const index = Math.max(1, Math.round(moment.dayNumber));
    const list = momentsByDay.get(index) ?? [];
    list.push(moment);
    momentsByDay.set(index, list);
  }

  const indexes = [...new Set([...runsByDay.keys(), ...momentsByDay.keys()])].sort((a, b) => a - b);

  return indexes.map((index) => {
    const runs = (runsByDay.get(index) ?? []).sort((a, b) => {
      const left = dayStamp(a.points[0]?.at ?? '') ?? 0;
      const right = dayStamp(b.points[0]?.at ?? '') ?? 0;
      if (left !== right) return left - right;
      return (a.points[0]?.at ?? '').localeCompare(b.points[0]?.at ?? '');
    });
    const merged = runs.flatMap((run) => run.points);
    const first = merged[0];
    const firstStamp = first ? dayStamp(first.at) : null;
    const sessionGain = elevationsByDay.get(index);

    return {
      index,
      date:
        startDayStamp !== null
          ? isoDate(startDayStamp + (index - 1) * DAY_MS)
          : firstStamp !== null
            ? isoDate(firstStamp)
            : null,
      distanceKm: sumOf(runs, (run) => runDistanceKm(run.points)),
      /* Sorties d'abord : leur gain est réel ; les altitudes des points ne
         prennent le relais que si aucune sortie du jour n'en porte. */
      elevationM:
        sessionGain?.real === true
          ? sessionGain.total
          : sumOf(runs, (run) => runElevationM(run.points)),
      durationS: durationsByDay.get(index) ?? null,
      moments: momentsByDay.get(index) ?? [],
      points: merged.map((point) => ({ lat: point.lat, lng: point.lng, at: point.at })),
    };
  });
}

/**
 * Totaux du carnet : la somme exacte des jours, et rien d'autre.
 * Une somme n'existe que si au moins un jour porte la valeur.
 */
export function buildSummary(days: CarnetDay[]): CarnetSummary {
  let distanceKm: number | null = null;
  let elevationM: number | null = null;
  let moments = 0;

  for (const day of days) {
    if (day.distanceKm !== null) distanceKm = (distanceKm ?? 0) + day.distanceKm;
    if (day.elevationM !== null) elevationM = (elevationM ?? 0) + day.elevationM;
    moments += day.moments.length;
  }

  return { distanceKm, elevationM, days: days.length, moments };
}

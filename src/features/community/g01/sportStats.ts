/**
 * G01 — sélection des statistiques et records adaptés au sport publié.
 *
 * Aucune statistique n'est inventée : une valeur absente, négative ou non
 * finie est simplement omise. Le module ne reçoit que des agrégats ; les
 * positions, traces, fichiers GPX et coordonnées ne font pas partie du contrat
 * et `redactSessionForShare` ne recopie que la liste blanche ci-dessous.
 */

import {
  finiteNumber,
  formatDuration,
  formatNumber,
  isUuid,
  nonEmptyString,
  normalizeActivityVisibility,
  normalizeSport,
  sportLabel,
  type SportKey,
} from './contracts';

export type SportStatKey =
  | 'distance'
  | 'elevation'
  | 'duration'
  | 'pace'
  | 'speed'
  | 'altitude';

export interface SportSessionMetrics {
  id: string;
  ownerId: string;
  sport: SportKey;
  title: string | null;
  startedAt: string | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  elevationGainM: number | null;
  maxAltitudeM: number | null;
  visibility: string | null;
  coverUrl: string | null;
}

export interface SportStat {
  key: SportStatKey;
  label: string;
  unit: string;
  /** Valeur déjà localisée, sans unité (l'UI affiche `formatted` + `unit`). */
  formatted: string;
  /** Valeur canonique pour les tests et les tris, jamais la trace. */
  value: number;
}

export interface SportRecordCandidate {
  id: string;
  sport: unknown;
  sessionId: string;
  stat: SportStatKey | string;
  value: unknown;
  visibility?: unknown;
  achievedAt?: string | null;
}

export interface SportRecordChip {
  id: string;
  label: string;
  formatted: string;
}

const RECORD_LABELS: Record<SportStatKey, string> = {
  distance: 'Plus longue distance',
  elevation: 'Plus grand dénivelé',
  duration: 'Plus longue durée',
  pace: 'Meilleure allure',
  speed: 'Meilleure vitesse',
  altitude: 'Altitude max',
};

const STAT_LABELS: Record<SportStatKey, string> = {
  distance: 'Distance',
  elevation: 'Dénivelé',
  duration: 'Durée',
  pace: 'Allure',
  speed: 'Vitesse',
  altitude: 'Altitude max',
};

interface StatSpec {
  key: SportStatKey;
}

/**
 * Ordre de lecture par sport : les chiffres qui caractérisent réellement la
 * pratique passent devant (allure en trail, vitesse à vélo, altitude en ski).
 */
const SPORT_STAT_ORDER: Record<SportKey, StatSpec[]> = {
  rando: [{ key: 'distance' }, { key: 'elevation' }, { key: 'duration' }, { key: 'altitude' }],
  trail: [{ key: 'distance' }, { key: 'elevation' }, { key: 'pace' }, { key: 'duration' }],
  ski: [{ key: 'elevation' }, { key: 'altitude' }, { key: 'distance' }, { key: 'duration' }],
  velo: [{ key: 'distance' }, { key: 'elevation' }, { key: 'speed' }, { key: 'duration' }],
  escalade: [{ key: 'duration' }, { key: 'elevation' }, { key: 'altitude' }],
  autre: [{ key: 'distance' }, { key: 'duration' }, { key: 'elevation' }],
};

function paceSecondsPerKm(durationSeconds: number | null, distanceKm: number | null): number | null {
  if (durationSeconds === null || distanceKm === null) return null;
  if (durationSeconds <= 0 || distanceKm < 0.1) return null;
  const pace = durationSeconds / 60 / distanceKm;
  if (!Number.isFinite(pace) || pace <= 0 || pace > 60) return null;
  return pace;
}

function speedKmh(durationSeconds: number | null, distanceKm: number | null): number | null {
  if (durationSeconds === null || distanceKm === null) return null;
  if (durationSeconds <= 0 || distanceKm <= 0) return null;
  const speed = distanceKm / (durationSeconds / 3600);
  if (!Number.isFinite(speed) || speed <= 0 || speed > 120) return null;
  return speed;
}

export function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm);
  const seconds = Math.round((secondsPerKm - minutes) * 60);
  const safeMinutes = seconds === 60 ? minutes + 1 : minutes;
  const safeSeconds = seconds === 60 ? 0 : seconds;
  return `${safeMinutes}:${String(safeSeconds).padStart(2, '0')}`;
}

function buildStat(
  key: SportStatKey,
  metrics: Pick<
    SportSessionMetrics,
    'distanceKm' | 'durationSeconds' | 'elevationGainM' | 'maxAltitudeM'
  >,
  values: { pace: number | null; speed: number | null }
): SportStat | null {
  switch (key) {
    case 'distance':
      if (metrics.distanceKm === null) return null;
      return {
        key,
        label: STAT_LABELS[key],
        unit: 'km',
        formatted: formatNumber(metrics.distanceKm, 1),
        value: metrics.distanceKm,
      };
    case 'elevation':
      if (metrics.elevationGainM === null) return null;
      return {
        key,
        label: STAT_LABELS[key],
        unit: 'm D+',
        formatted: formatNumber(metrics.elevationGainM, 0),
        value: metrics.elevationGainM,
      };
    case 'duration':
      if (metrics.durationSeconds === null) return null;
      return {
        key,
        label: STAT_LABELS[key],
        unit: '',
        formatted: formatDuration(metrics.durationSeconds),
        value: metrics.durationSeconds,
      };
    case 'altitude':
      if (metrics.maxAltitudeM === null) return null;
      return {
        key,
        label: STAT_LABELS[key],
        unit: 'm',
        formatted: formatNumber(metrics.maxAltitudeM, 0),
        value: metrics.maxAltitudeM,
      };
    case 'pace':
      if (values.pace === null) return null;
      return {
        key,
        label: STAT_LABELS[key],
        unit: 'min/km',
        formatted: formatPace(values.pace),
        value: values.pace,
      };
    case 'speed':
      if (values.speed === null) return null;
      return {
        key,
        label: STAT_LABELS[key],
        unit: 'km/h',
        formatted: formatNumber(values.speed, 1),
        value: values.speed,
      };
    default:
      return null;
  }
}

/**
 * Chiffres clés d'une séance, dans l'ordre du sport. `maxStats` borne la carte
 * (4 par défaut) ; un sport sans donnée exploitable renvoie `[]`.
 */
export function selectSportStats(
  session: SportSessionMetrics | null | undefined,
  options: { maxStats?: number } = {}
): SportStat[] {
  if (!session) return [];
  const sport = normalizeSport(session.sport);
  if (!sport) return [];
  const maxStats = Math.max(0, Math.min(options.maxStats ?? 4, 6));
  const durationSeconds = finiteNumber(session.durationSeconds, { min: 0 });
  const distanceKm = finiteNumber(session.distanceKm, { min: 0 });
  const elevationGainM = finiteNumber(session.elevationGainM, { min: 0 });
  const maxAltitudeM = finiteNumber(session.maxAltitudeM);
  const normalized = {
    distanceKm,
    durationSeconds,
    elevationGainM,
    maxAltitudeM,
  };
  const values = {
    pace: paceSecondsPerKm(durationSeconds, distanceKm),
    speed: speedKmh(durationSeconds, distanceKm),
  };

  const stats: SportStat[] = [];
  for (const spec of SPORT_STAT_ORDER[sport]) {
    if (stats.length >= maxStats) break;
    const stat = buildStat(spec.key, normalized, values);
    if (stat) stats.push(stat);
  }
  return stats;
}

export function formatSportRecordValue(
  key: SportStatKey,
  value: number
): { formatted: string; unit: string } {
  switch (key) {
    case 'distance':
      return { formatted: `${formatNumber(value, 1)} km`, unit: 'km' };
    case 'elevation':
      return { formatted: `${formatNumber(value, 0)} m D+`, unit: 'm D+' };
    case 'duration':
      return { formatted: formatDuration(value), unit: '' };
    case 'pace':
      return { formatted: `${formatPace(value)} min/km`, unit: 'min/km' };
    case 'speed':
      return { formatted: `${formatNumber(value, 1)} km/h`, unit: 'km/h' };
    case 'altitude':
      return { formatted: `${formatNumber(value, 0)} m`, unit: 'm' };
    default:
      return { formatted: formatNumber(value, 1), unit: '' };
  }
}

const RECORD_KEYS: readonly SportStatKey[] = [
  'distance',
  'elevation',
  'duration',
  'pace',
  'speed',
  'altitude',
];

/**
 * Records réellement attachés à cette séance, du même sport, et dont la
 * visibilité n'est pas privée. Un record inconnu ou mal formé est ignoré.
 */
export function selectSportRecords(
  session: Pick<SportSessionMetrics, 'id' | 'sport'> | null | undefined,
  records: readonly SportRecordCandidate[] | null | undefined,
  options: { maxRecords?: number } = {}
): SportRecordChip[] {
  if (!session || !Array.isArray(records)) return [];
  const sport = normalizeSport(session.sport);
  if (!sport) return [];
  const maxRecords = Math.max(0, Math.min(options.maxRecords ?? 2, 4));
  const chips: SportRecordChip[] = [];

  for (const record of records) {
    if (chips.length >= maxRecords) break;
    if (!record || typeof record !== 'object') continue;
    if (normalizeSport(record.sport) !== sport) continue;
    if (record.sessionId !== session.id) continue;
    if (normalizeActivityVisibility(record.visibility) === 'private') continue;
    const key = RECORD_KEYS.find((candidate) => candidate === record.stat);
    if (!key) continue;
    const value = finiteNumber(record.value, { min: 0 });
    if (value === null) continue;
    const formatted = formatSportRecordValue(key, value);
    chips.push({
      id: nonEmptyString(record.id) ?? `${session.id}:${key}`,
      label: RECORD_LABELS[key],
      formatted: formatted.formatted,
    });
  }

  return chips;
}

/**
 * Records personnels calculés à partir des séances du propriétaire. Cette
 * fonction ne lit que des agrégats ; elle sert à préparer la liste que
 * `selectSportRecords` filtrera ensuite pour une carte publiée.
 */
export function computePersonalRecords(
  sessions: readonly SportSessionMetrics[] | null | undefined,
  sport: SportKey
): SportRecordCandidate[] {
  if (!Array.isArray(sessions)) return [];
  const best = new Map<SportStatKey, { value: number; session: SportSessionMetrics }>();

  for (const session of sessions) {
    if (!session || normalizeSport(session.sport) !== sport) continue;
    const distance = finiteNumber(session.distanceKm, { min: 0 });
    const elevation = finiteNumber(session.elevationGainM, { min: 0 });
    const duration = finiteNumber(session.durationSeconds, { min: 0 });
    const altitude = finiteNumber(session.maxAltitudeM);
    const pace = paceSecondsPerKm(duration, distance);
    const speed = speedKmh(duration, distance);
    const candidates: Array<[SportStatKey, number | null]> = [
      ['distance', distance],
      ['elevation', elevation],
      ['duration', duration],
      ['altitude', altitude],
      ['pace', pace],
      ['speed', speed],
    ];

    for (const [key, value] of candidates) {
      if (value === null) continue;
      const current = best.get(key);
      const better =
        current === undefined ||
        (key === 'pace' ? value < current.value : value > current.value);
      if (better) best.set(key, { value, session });
    }
  }

  const records: SportRecordCandidate[] = [];
  for (const [key, entry] of best) {
    records.push({
      id: `${sport}:${key}:${entry.session.id}`,
      sport,
      sessionId: entry.session.id,
      stat: key,
      value: entry.value,
      visibility: entry.session.visibility,
      achievedAt: entry.session.startedAt,
    });
  }
  return records;
}

/**
 * Liste blanche de la projection partageable. Tout ce qui n'est pas un agrégat
 * connu (positions, trace, GPX, coordonnées, notes libres) est écarté.
 */
export function redactSessionForShare(input: unknown): SportSessionMetrics | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  const id = nonEmptyString(row.id);
  const ownerId = nonEmptyString(row.owner_id ?? row.ownerId);
  const sport = normalizeSport(row.sport);
  if (!id || !isUuid(id) || !ownerId || !isUuid(ownerId) || !sport) return null;

  return {
    id,
    ownerId,
    sport,
    title: nonEmptyString(row.title, 120),
    startedAt: nonEmptyString(row.started_at ?? row.startedAt),
    distanceKm: finiteNumber(row.distance_km ?? row.distanceKm, { min: 0 }),
    durationSeconds: finiteNumber(row.duration_seconds ?? row.durationSeconds, { min: 0 }),
    elevationGainM: finiteNumber(row.elevation_gain_m ?? row.elevationGainM, { min: 0 }),
    maxAltitudeM: finiteNumber(row.max_altitude_m ?? row.maxAltitudeM),
    visibility: nonEmptyString(row.visibility),
    coverUrl: nonEmptyString(row.cover_url ?? row.coverUrl),
  };
}

/** Libellé de repli d'une carte quand la séance n'a pas de titre. */
export function activityTitle(session: Pick<SportSessionMetrics, 'sport' | 'title'>): string {
  return session.title?.trim() || `Sortie ${sportLabel(session.sport).toLowerCase()}`;
}

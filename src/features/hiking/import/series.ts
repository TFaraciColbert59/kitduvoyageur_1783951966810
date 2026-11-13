/**
 * Métriques de séance et séries de mesures lues dans un fichier FIT/TCX.
 *
 * Le parseur normalisait déjà ces valeurs dans `NormalizedTraceImport` :
 * résumé `session` FIT (calories, FC, cadence, vitesses, puissance) et mesures
 * par point (FC, cadence, puissance, température, distance source). Aucun
 * contrat ne les conservait : après enregistrement, seuls la trace, les laps et
 * la provenance survivaient.
 *
 * Ce module recopie les valeurs réellement présentes, sans dériver ni compléter
 * aucune mesure :
 *   - `null` reste `null` (absence) et n'est jamais remplacé par `0` ;
 *   - `0` est une mesure valide et reste `0` ;
 *   - une série n'est créée que pour une métrique effectivement lue ;
 *   - aucune moyenne, aucun total et aucune calorie ne sont calculés ici.
 *
 * Les unités sont portées par les noms de champs (`M`, `Mps`, `Bpm`, `Rpm`,
 * `Spm`, `W`, `C`, `Kcal`). L'origine est explicite : `fit_session` pour le
 * résumé de session FIT, `device` pour un point lu dans le fichier.
 */

import type {
  NormalizedTraceImport,
  NormalizedTrackPoint,
  TraceSessionSummary,
} from './model';

/**
 * Plafond des mesures de point envoyées par requête. Le parseur accepte
 * 100 000 points ; la projection réseau reste bornée pour ne pas dépasser les
 * limites de charge de la plateforme. Les extrémités sont conservées.
 */
export const TRACE_IMPORT_MAX_PAYLOAD_SAMPLES = 10_000;

export const TRACE_IMPORT_SERIES_LIMITS = Object.freeze({
  sampleIndexMax: TRACE_IMPORT_MAX_PAYLOAD_SAMPLES - 1,
  lapIndexMax: 9_999,
  elapsedSecondsMax: 31_536_000,
  distanceMMax: 100_000_000,
  altitudeMMin: -1_000,
  altitudeMMax: 10_000,
  speedMpsMax: 1_000,
  heartRateBpmMax: 300,
  cadenceMax: 500,
  powerWMax: 10_000,
  temperatureCMin: -100,
  temperatureCMax: 100,
  caloriesKcalMax: 1_000_000,
  activityTimerSecondsMax: 31_536_000,
});

export type TraceImportSummaryOrigin = 'fit_session';

/**
 * Résumé `session` FIT réellement porté par le fichier. `origin` distingue ce
 * résumé d'une valeur calculée : il vient du message FIT `session`, jamais
 * d'une moyenne reconstruite à partir des points.
 */
export interface TraceImportSummaryPayload {
  origin: TraceImportSummaryOrigin;
  startedAt: string | null;
  elapsedSeconds: number | null;
  distanceM: number | null;
  averageSpeedMps: number | null;
  maxSpeedMps: number | null;
  caloriesKcal: number | null;
  averageHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  averageCadenceRpm: number | null;
  averageCadenceSpm: number | null;
  averagePowerW: number | null;
  maxPowerW: number | null;
  activityTimerSeconds: number | null;
}

/** Un point de mesure source. Aucune coordonnée n'est dupliquée ici. */
export interface TraceImportSamplePayload {
  index: number;
  origin: 'device';
  /** Instant UTC du point ; `null` quand la source n'avait pas de fuseau. */
  recordedAt: string | null;
  /** Tour source qui contient ce point ; `null` quand il n'est pas connu. */
  lapIndex: number | null;
  distanceM: number | null;
  altitudeM: number | null;
  speedMps: number | null;
  heartRateBpm: number | null;
  cadenceRpm: number | null;
  cadenceSpm: number | null;
  powerW: number | null;
  temperatureC: number | null;
}

const SUMMARY_METRIC_KEYS: readonly (keyof TraceSessionSummary)[] = [
  'elapsedSeconds',
  'distanceM',
  'averageSpeedMps',
  'maxSpeedMps',
  'caloriesKcal',
  'averageHeartRateBpm',
  'maxHeartRateBpm',
  'averageCadenceRpm',
  'averageCadenceSpm',
  'averagePowerW',
  'maxPowerW',
  'activityTimerSeconds',
];

/** Vrai si le résumé FIT porte au moins une mesure réelle (zéro compris). */
export function traceSummaryHasMetrics(summary: TraceSessionSummary | null): boolean {
  if (summary == null) return false;
  return SUMMARY_METRIC_KEYS.some((key) => summary[key] !== null && summary[key] !== undefined);
}

/**
 * Recopie le résumé `session` FIT. Retourne `null` pour un TCX (le format n'a
 * pas de résumé de session) ou pour un FIT sans message `session` : le contrat
 * ne fabrique pas de résumé à partir des laps ou des points.
 */
export function buildTraceImportSummaryPayload(
  trace: Pick<NormalizedTraceImport, 'summary'>
): TraceImportSummaryPayload | null {
  const summary = trace.summary;
  if (summary == null || !traceSummaryHasMetrics(summary)) return null;

  return {
    origin: 'fit_session',
    startedAt: summary.startedAt,
    elapsedSeconds: summary.elapsedSeconds,
    distanceM: summary.distanceM,
    averageSpeedMps: summary.averageSpeedMps,
    maxSpeedMps: summary.maxSpeedMps,
    caloriesKcal: summary.caloriesKcal,
    averageHeartRateBpm: summary.averageHeartRateBpm,
    maxHeartRateBpm: summary.maxHeartRateBpm,
    averageCadenceRpm: summary.averageCadenceRpm,
    averageCadenceSpm: summary.averageCadenceSpm,
    averagePowerW: summary.averagePowerW,
    maxPowerW: summary.maxPowerW,
    activityTimerSeconds: summary.activityTimerSeconds,
  };
}

/**
 * Métriques de point encore perdues après import : la distance source (absente
 * de `positions_timed`) et les mesures capteur. L'altitude et la vitesse sont
 * déjà conservées dans `positions_timed` ; elles restent recopiées quand elles
 * accompagnent un point retenu, pour que la série soit lisible seule.
 */
export function tracePointHasPreservedMetric(point: NormalizedTrackPoint): boolean {
  return (
    point.distanceM != null
    || point.heartRateBpm != null
    || point.cadenceRpm != null
    || point.runCadenceSpm != null
    || point.powerW != null
    || point.temperatureC != null
  );
}

function samplePoints<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  if (max <= 1) return items.length > 0 ? [items[0]] : [];
  const step = (items.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, index) => items[Math.round(index * step)]);
}

function finite(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function lapIndexOrNull(value: number): number | null {
  return Number.isInteger(value) && value >= 0 && value <= TRACE_IMPORT_SERIES_LIMITS.lapIndexMax
    ? value
    : null;
}

/**
 * Projette les points qui portent une mesure source, dans l'ordre du fichier.
 * Aucun point sans mesure n'est créé ; `null` reste `null`.
 */
export function buildTraceImportSamplePayloads(
  trace: Pick<NormalizedTraceImport, 'points'>,
  limit = TRACE_IMPORT_MAX_PAYLOAD_SAMPLES
): TraceImportSamplePayload[] {
  const max = Number.isFinite(limit) && limit >= 1
    ? Math.min(Math.floor(limit), TRACE_IMPORT_MAX_PAYLOAD_SAMPLES)
    : TRACE_IMPORT_MAX_PAYLOAD_SAMPLES;

  const candidates = trace.points.filter(tracePointHasPreservedMetric);
  return samplePoints(candidates, max).map((point, index) => ({
    index,
    origin: 'device',
    recordedAt: point.recordedAt,
    lapIndex: lapIndexOrNull(point.lapIndex),
    distanceM: finite(point.distanceM),
    altitudeM: finite(point.altitudeM),
    speedMps: finite(point.speedMps),
    heartRateBpm: finite(point.heartRateBpm),
    cadenceRpm: finite(point.cadenceRpm),
    cadenceSpm: finite(point.runCadenceSpm),
    powerW: finite(point.powerW),
    temperatureC: finite(point.temperatureC),
  }));
}

/** Nombre de points qui portent au moins une mesure conservable. */
export function traceImportPreservedSampleCount(
  trace: Pick<NormalizedTraceImport, 'points'>
): number {
  return trace.points.filter(tracePointHasPreservedMetric).length;
}

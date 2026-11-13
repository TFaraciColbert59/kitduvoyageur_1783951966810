/**
 * Validation du contrat HTTP des métriques et séries d'un import FIT/TCX.
 *
 * Le module reste pur : il ne lit aucun fichier, n'appelle aucun réseau et ne
 * connaît ni Next ni Supabase. Il borne les valeurs avant l'appel RPC ; la RPC
 * et les contraintes SQL revalident les mêmes bornes.
 *
 * Règles :
 *   - `null`/absent devient `[]` pour les séries et `null` pour le résumé,
 *     afin de rester compatible avec un client antérieur à cette passe ;
 *   - une valeur `0` est acceptée et conservée telle quelle ;
 *   - un point ou un résumé sans aucune mesure est refusé : aucun objet vide
 *     n'est stocké pour faire croire à une donnée ;
 *   - un instant sans fuseau est refusé, comme pour les tours.
 */

import { parseTraceTime } from './time';
import {
  TRACE_IMPORT_MAX_PAYLOAD_SAMPLES,
  TRACE_IMPORT_SERIES_LIMITS,
  type TraceImportSamplePayload,
  type TraceImportSummaryPayload,
} from './series';

export type { TraceImportSamplePayload, TraceImportSummaryPayload };

export type TraceImportSummaryValidation =
  | { ok: true; summary: TraceImportSummaryPayload | null }
  | { ok: false; message: string };

export type TraceImportSampleValidation =
  | { ok: true; samples: TraceImportSamplePayload[] }
  | { ok: false; message: string };

class InvalidSeriesError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalNumber(
  row: Record<string, unknown>,
  key: string,
  min: number,
  max: number
): number | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new InvalidSeriesError(`${key} invalide`);
  }
  return value;
}

function optionalInteger(
  row: Record<string, unknown>,
  key: string,
  min: number,
  max: number
): number | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new InvalidSeriesError(`${key} invalide`);
  }
  return value;
}

function optionalInstant(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new InvalidSeriesError(`${key} invalide`);
  const parsed = parseTraceTime(value);
  if (!parsed.ok || !parsed.value.instant) {
    throw new InvalidSeriesError(`${key} invalide`);
  }
  return parsed.value.instant;
}

function summaryHasMetric(summary: TraceImportSummaryPayload): boolean {
  return (
    summary.elapsedSeconds !== null
    || summary.distanceM !== null
    || summary.averageSpeedMps !== null
    || summary.maxSpeedMps !== null
    || summary.caloriesKcal !== null
    || summary.averageHeartRateBpm !== null
    || summary.maxHeartRateBpm !== null
    || summary.averageCadenceRpm !== null
    || summary.averageCadenceSpm !== null
    || summary.averagePowerW !== null
    || summary.maxPowerW !== null
    || summary.activityTimerSeconds !== null
  );
}

function sampleHasMetric(sample: TraceImportSamplePayload): boolean {
  return (
    sample.distanceM !== null
    || sample.altitudeM !== null
    || sample.speedMps !== null
    || sample.heartRateBpm !== null
    || sample.cadenceRpm !== null
    || sample.cadenceSpm !== null
    || sample.powerW !== null
    || sample.temperatureC !== null
  );
}

/**
 * Valide le résumé `session` FIT. Un objet sans mesure est refusé ; `null` ou
 * absent retourne `null` (aucun résumé à écrire), jamais un résumé vide.
 */
export function normalizeTraceImportSummary(value: unknown): TraceImportSummaryValidation {
  if (value === null || value === undefined) return { ok: true, summary: null };
  if (!isRecord(value)) {
    return { ok: false, message: 'Résumé de séance invalide.' };
  }

  try {
    const origin = typeof value.origin === 'string' ? value.origin.trim() : '';
    if (origin !== 'fit_session') throw new InvalidSeriesError('origine invalide');

    const summary: TraceImportSummaryPayload = {
      origin: 'fit_session',
      startedAt: optionalInstant(value, 'startedAt'),
      elapsedSeconds: optionalNumber(
        value,
        'elapsedSeconds',
        0,
        TRACE_IMPORT_SERIES_LIMITS.elapsedSecondsMax
      ),
      distanceM: optionalNumber(
        value,
        'distanceM',
        0,
        TRACE_IMPORT_SERIES_LIMITS.distanceMMax
      ),
      averageSpeedMps: optionalNumber(
        value,
        'averageSpeedMps',
        0,
        TRACE_IMPORT_SERIES_LIMITS.speedMpsMax
      ),
      maxSpeedMps: optionalNumber(
        value,
        'maxSpeedMps',
        0,
        TRACE_IMPORT_SERIES_LIMITS.speedMpsMax
      ),
      caloriesKcal: optionalNumber(
        value,
        'caloriesKcal',
        0,
        TRACE_IMPORT_SERIES_LIMITS.caloriesKcalMax
      ),
      averageHeartRateBpm: optionalNumber(
        value,
        'averageHeartRateBpm',
        0,
        TRACE_IMPORT_SERIES_LIMITS.heartRateBpmMax
      ),
      maxHeartRateBpm: optionalNumber(
        value,
        'maxHeartRateBpm',
        0,
        TRACE_IMPORT_SERIES_LIMITS.heartRateBpmMax
      ),
      averageCadenceRpm: optionalNumber(
        value,
        'averageCadenceRpm',
        0,
        TRACE_IMPORT_SERIES_LIMITS.cadenceMax
      ),
      averageCadenceSpm: optionalNumber(
        value,
        'averageCadenceSpm',
        0,
        TRACE_IMPORT_SERIES_LIMITS.cadenceMax
      ),
      averagePowerW: optionalNumber(
        value,
        'averagePowerW',
        0,
        TRACE_IMPORT_SERIES_LIMITS.powerWMax
      ),
      maxPowerW: optionalNumber(
        value,
        'maxPowerW',
        0,
        TRACE_IMPORT_SERIES_LIMITS.powerWMax
      ),
      activityTimerSeconds: optionalNumber(
        value,
        'activityTimerSeconds',
        0,
        TRACE_IMPORT_SERIES_LIMITS.activityTimerSecondsMax
      ),
    };

    if (!summaryHasMetric(summary)) {
      throw new InvalidSeriesError('résumé sans mesure');
    }
    return { ok: true, summary };
  } catch (error) {
    if (error instanceof InvalidSeriesError) {
      return { ok: false, message: 'Résumé de séance invalide : aucune donnée n’a été écrite.' };
    }
    throw error;
  }
}

/**
 * Valide et normalise les mesures de point. Chaque ligne doit être complète,
 * ordonnée et porter au moins une mesure ; aucune valeur n'est complétée.
 */
export function normalizeTraceImportSamples(value: unknown): TraceImportSampleValidation {
  if (value === null || value === undefined) return { ok: true, samples: [] };
  if (!Array.isArray(value)) {
    return { ok: false, message: 'Séries de mesures invalides.' };
  }
  if (value.length > TRACE_IMPORT_MAX_PAYLOAD_SAMPLES) {
    return { ok: false, message: 'Trop de mesures dans le fichier.' };
  }

  try {
    const samples: TraceImportSamplePayload[] = [];
    for (let offset = 0; offset < value.length; offset += 1) {
      const row = value[offset];
      if (!isRecord(row)) throw new InvalidSeriesError('mesure non objet');

      const index = optionalInteger(
        row,
        'index',
        0,
        TRACE_IMPORT_SERIES_LIMITS.sampleIndexMax
      );
      if (index === null || index !== offset) {
        throw new InvalidSeriesError('index non séquentiel');
      }

      const origin = typeof row.origin === 'string' ? row.origin.trim() : '';
      if (origin !== 'device') throw new InvalidSeriesError('origine invalide');

      const sample: TraceImportSamplePayload = {
        index,
        origin: 'device',
        recordedAt: optionalInstant(row, 'recordedAt'),
        lapIndex: optionalInteger(
          row,
          'lapIndex',
          0,
          TRACE_IMPORT_SERIES_LIMITS.lapIndexMax
        ),
        distanceM: optionalNumber(
          row,
          'distanceM',
          0,
          TRACE_IMPORT_SERIES_LIMITS.distanceMMax
        ),
        altitudeM: optionalNumber(
          row,
          'altitudeM',
          TRACE_IMPORT_SERIES_LIMITS.altitudeMMin,
          TRACE_IMPORT_SERIES_LIMITS.altitudeMMax
        ),
        speedMps: optionalNumber(
          row,
          'speedMps',
          0,
          TRACE_IMPORT_SERIES_LIMITS.speedMpsMax
        ),
        heartRateBpm: optionalNumber(
          row,
          'heartRateBpm',
          0,
          TRACE_IMPORT_SERIES_LIMITS.heartRateBpmMax
        ),
        cadenceRpm: optionalNumber(
          row,
          'cadenceRpm',
          0,
          TRACE_IMPORT_SERIES_LIMITS.cadenceMax
        ),
        cadenceSpm: optionalNumber(
          row,
          'cadenceSpm',
          0,
          TRACE_IMPORT_SERIES_LIMITS.cadenceMax
        ),
        powerW: optionalNumber(
          row,
          'powerW',
          0,
          TRACE_IMPORT_SERIES_LIMITS.powerWMax
        ),
        temperatureC: optionalNumber(
          row,
          'temperatureC',
          TRACE_IMPORT_SERIES_LIMITS.temperatureCMin,
          TRACE_IMPORT_SERIES_LIMITS.temperatureCMax
        ),
      };

      if (!sampleHasMetric(sample)) {
        throw new InvalidSeriesError('mesure vide');
      }
      samples.push(sample);
    }
    return { ok: true, samples };
  } catch (error) {
    if (error instanceof InvalidSeriesError) {
      return {
        ok: false,
        message: 'Le fichier contient des séries de mesures invalides : aucune donnée n’a été écrite.',
      };
    }
    throw error;
  }
}

/**
 * Contrat des tours source persistés (`public.trace_import_laps`).
 *
 * Un tour source vient du fichier FIT/TCX : il n'est ni calculé, ni découpé en
 * km/mile, ni fusionné avec un `ActivitySplit` Explorer. `origin` ne peut donc
 * valoir que `device` (lap réellement déclaré) ou `synthetic` (tour unique
 * reconstruit depuis le message FIT `session`). Une valeur `computed` ou
 * `manual` est refusée : les splits calculés ont leur propre contrat et ne
 * doivent jamais entrer dans cette table.
 *
 * Le module est pur : il borne et normalise le tableau `laps` avant l'appel
 * RPC, sans lire de fichier ni appeler le réseau. La RPC et les contraintes SQL
 * revalident les mêmes bornes.
 */

import {
  TRACE_IMPORT_LIMITS,
  type NormalizedTraceImport,
  type TraceImportLapOrigin,
} from './model';
import { parseTraceTime } from './time';

/** Nombre maximal de tours acceptés dans une requête d'import. */
export const TRACE_IMPORT_MAX_PAYLOAD_LAPS = TRACE_IMPORT_LIMITS.maxLaps;

/**
 * Bornes appliquées côté client, route et base. Elles restent volontairement
 * larges : on refuse l'impossible et l'infini, jamais une mesure réelle.
 */
export const TRACE_IMPORT_LAP_LIMITS = Object.freeze({
  indexMax: 9_999,
  elapsedSecondsMax: 31_536_000,
  distanceMMax: 100_000_000,
  speedMpsMax: 1_000,
  caloriesKcalMax: 1_000_000,
  heartRateBpmMax: 300,
  cadenceMax: 500,
  powerWMax: 10_000,
  pointCountMax: 100_000,
  trackCountMax: 100_000,
  textLengthMax: 64,
});

/**
 * Forme réellement envoyée à `POST /api/hike-sessions`, puis à la RPC.
 * `startedAtLocal` n'est pas reprise : une sortie enregistrable est en UTC, et
 * une heure civile nue ne peut pas être convertie sans invention.
 */
export interface TraceImportLapPayload {
  index: number;
  origin: TraceImportLapOrigin;
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
  maxPowerW: number | null;
  intensity: string | null;
  triggerMethod: string | null;
  pointCount: number;
  trackCount: number;
}

export type TraceImportLapValidation =
  | { ok: true; laps: TraceImportLapPayload[] }
  | { ok: false; message: string };

class InvalidLapError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLapOrigin(value: string): value is TraceImportLapOrigin {
  return value === 'device' || value === 'synthetic';
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
    throw new InvalidLapError(`${key} invalide`);
  }
  return value;
}

function requiredInteger(
  row: Record<string, unknown>,
  key: string,
  min: number,
  max: number
): number {
  const value = row[key];
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < min
    || value > max
  ) {
    throw new InvalidLapError(`${key} invalide`);
  }
  return value;
}

function optionalText(
  row: Record<string, unknown>,
  key: string,
  maxLength: number
): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new InvalidLapError(`${key} invalide`);
  const cleaned = value
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function optionalInstant(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new InvalidLapError(`${key} invalide`);
  const parsed = parseTraceTime(value);
  if (!parsed.ok || !parsed.value.instant) {
    throw new InvalidLapError(`${key} invalide`);
  }
  return parsed.value.instant;
}

/** Recopie les tours source réels, sans dériver ni compléter aucune valeur. */
export function buildTraceImportLapPayloads(
  trace: Pick<NormalizedTraceImport, 'laps'>
): TraceImportLapPayload[] {
  return trace.laps.slice(0, TRACE_IMPORT_MAX_PAYLOAD_LAPS).map((lap) => ({
    index: lap.index,
    origin: lap.origin,
    startedAt: lap.startedAt,
    elapsedSeconds: lap.elapsedSeconds,
    distanceM: lap.distanceM,
    averageSpeedMps: lap.averageSpeedMps,
    maxSpeedMps: lap.maxSpeedMps,
    caloriesKcal: lap.caloriesKcal,
    averageHeartRateBpm: lap.averageHeartRateBpm,
    maxHeartRateBpm: lap.maxHeartRateBpm,
    averageCadenceRpm: lap.averageCadenceRpm,
    averageCadenceSpm: lap.averageCadenceSpm,
    maxPowerW: lap.maxPowerW,
    intensity: lap.intensity,
    triggerMethod: lap.triggerMethod,
    pointCount: lap.pointCount,
    trackCount: lap.tracks.length,
  }));
}

/**
 * Valide et normalise le tableau reçu par l'API. `null`/absent devient `[]`
 * pour rester compatible avec un client antérieur à cette passe ; un tableau
 * fourni doit être complet, ordonné et strictement composé de tours source.
 */
export function normalizeTraceImportLaps(value: unknown): TraceImportLapValidation {
  if (value === null || value === undefined) return { ok: true, laps: [] };
  if (!Array.isArray(value)) {
    return { ok: false, message: 'Tours du fichier invalides.' };
  }
  if (value.length > TRACE_IMPORT_MAX_PAYLOAD_LAPS) {
    return { ok: false, message: 'Trop de tours dans le fichier.' };
  }

  try {
    const laps: TraceImportLapPayload[] = [];
    for (let offset = 0; offset < value.length; offset += 1) {
      const row = value[offset];
      if (!isRecord(row)) throw new InvalidLapError('tour non objet');

      const index = requiredInteger(
        row,
        'index',
        0,
        TRACE_IMPORT_LAP_LIMITS.indexMax
      );
      if (index !== offset) throw new InvalidLapError('index non séquentiel');

      const originValue =
        typeof row.origin === 'string' ? row.origin.trim().toLowerCase() : '';
      if (!isLapOrigin(originValue)) {
        throw new InvalidLapError('origine invalide');
      }

      laps.push({
        index,
        origin: originValue,
        startedAt: optionalInstant(row, 'startedAt'),
        elapsedSeconds: optionalNumber(
          row,
          'elapsedSeconds',
          0,
          TRACE_IMPORT_LAP_LIMITS.elapsedSecondsMax
        ),
        distanceM: optionalNumber(
          row,
          'distanceM',
          0,
          TRACE_IMPORT_LAP_LIMITS.distanceMMax
        ),
        averageSpeedMps: optionalNumber(
          row,
          'averageSpeedMps',
          0,
          TRACE_IMPORT_LAP_LIMITS.speedMpsMax
        ),
        maxSpeedMps: optionalNumber(
          row,
          'maxSpeedMps',
          0,
          TRACE_IMPORT_LAP_LIMITS.speedMpsMax
        ),
        caloriesKcal: optionalNumber(
          row,
          'caloriesKcal',
          0,
          TRACE_IMPORT_LAP_LIMITS.caloriesKcalMax
        ),
        averageHeartRateBpm: optionalNumber(
          row,
          'averageHeartRateBpm',
          0,
          TRACE_IMPORT_LAP_LIMITS.heartRateBpmMax
        ),
        maxHeartRateBpm: optionalNumber(
          row,
          'maxHeartRateBpm',
          0,
          TRACE_IMPORT_LAP_LIMITS.heartRateBpmMax
        ),
        averageCadenceRpm: optionalNumber(
          row,
          'averageCadenceRpm',
          0,
          TRACE_IMPORT_LAP_LIMITS.cadenceMax
        ),
        averageCadenceSpm: optionalNumber(
          row,
          'averageCadenceSpm',
          0,
          TRACE_IMPORT_LAP_LIMITS.cadenceMax
        ),
        maxPowerW: optionalNumber(
          row,
          'maxPowerW',
          0,
          TRACE_IMPORT_LAP_LIMITS.powerWMax
        ),
        intensity: optionalText(row, 'intensity', TRACE_IMPORT_LAP_LIMITS.textLengthMax),
        triggerMethod: optionalText(
          row,
          'triggerMethod',
          TRACE_IMPORT_LAP_LIMITS.textLengthMax
        ),
        pointCount: requiredInteger(
          row,
          'pointCount',
          0,
          TRACE_IMPORT_LAP_LIMITS.pointCountMax
        ),
        trackCount: requiredInteger(
          row,
          'trackCount',
          0,
          TRACE_IMPORT_LAP_LIMITS.trackCountMax
        ),
      });
    }
    return { ok: true, laps };
  } catch (error) {
    if (error instanceof InvalidLapError) {
      return {
        ok: false,
        message: 'Le fichier contient des tours invalides : aucune donnée n’a été écrite.',
      };
    }
    throw error;
  }
}

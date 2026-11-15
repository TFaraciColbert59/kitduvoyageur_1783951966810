/**
 * Configuration utilisateur datée des seuils et zones (S2.10–S2.12).
 *
 * Ce module est volontairement séparé du calcul de temps en zone :
 *   - il ne fabrique aucune zone, aucune borne, aucun seuil et aucune échelle ;
 *   - il exige que toutes les valeurs, toutes les dates et la provenance du
 *     seuil soient fournies par l'appelant ;
 *   - il ne lit jamais `Date.now()` : `effectiveFromMs` et `recordedAtMs` sont
 *     des entrées obligatoires, comme `computedAtMs` dans le moteur ;
 *   - il mappe la configuration vers le contrat privé de persistance et
 *     inversement, sans jamais compléter un champ absent.
 *
 * Les valeurs par défaut sont interdites ici : une configuration incomplète est
 * refusée avec ses erreurs, jamais corrigée silencieusement. Une nouvelle
 * configuration datée remplace l'ancienne par sa date d'effet ; l'historique
 * n'est jamais réécrit.
 */

import {
  validateZoneSet,
  type Threshold,
  type ThresholdKind,
  type ThresholdOrigin,
  type ThresholdUnit,
  type ZoneBand,
  type ZoneBasis,
  type ZoneMetric,
  type ZoneSet,
  type ZoneUnit,
} from './activityMetrics';

/** Entrée explicite : même forme que le contrat `ZoneSet`, sans champ optionnel. */
export type ZoneConfigurationInput = ZoneSet;

export interface ZoneConfigurationFailure {
  readonly ok: false;
  readonly errors: readonly string[];
}

export interface ZoneConfigurationSuccess {
  readonly ok: true;
  readonly zoneSet: ZoneSet;
}

export type ZoneConfigurationResult = ZoneConfigurationSuccess | ZoneConfigurationFailure;

/** Colonnes lues par `listZoneConfigs` et renvoyées par la RPC de sauvegarde. */
export const ZONE_CONFIG_SELECT_COLUMNS =
  'id, version, discipline, metric, basis, unit, ' +
  'threshold_kind, threshold_value, threshold_unit, threshold_origin, threshold_measured_at, ' +
  'effective_from, recorded_at, bands, created_at';

export interface ZoneConfigRow {
  readonly id: string;
  readonly version: string;
  readonly discipline: string;
  readonly metric: string;
  readonly basis: string;
  readonly unit: string;
  readonly threshold_kind: string | null;
  readonly threshold_value: number | string | null;
  readonly threshold_unit: string | null;
  readonly threshold_origin: string | null;
  readonly threshold_measured_at: string | null;
  readonly effective_from: string;
  readonly recorded_at: string;
  readonly bands: unknown;
  readonly created_at?: string | null;
}

export interface SaveZoneConfigRpcBody {
  readonly p_id: string;
  readonly p_version: string;
  readonly p_discipline: string;
  readonly p_metric: ZoneMetric;
  readonly p_basis: ZoneBasis;
  readonly p_unit: ZoneUnit;
  readonly p_threshold_kind: ThresholdKind | null;
  readonly p_threshold_value: number | null;
  readonly p_threshold_unit: ThresholdUnit | null;
  readonly p_threshold_origin: ThresholdOrigin | null;
  readonly p_threshold_measured_at: string | null;
  readonly p_effective_from: string;
  readonly p_recorded_at: string;
  readonly p_bands: readonly {
    readonly id: string;
    readonly label: string;
    readonly lower: number;
    readonly upper: number | null;
  }[];
}

export type SaveZoneConfigBodyResult =
  | { readonly ok: true; readonly body: SaveZoneConfigRpcBody }
  | ZoneConfigurationFailure;

export type SaveZoneConfigRpcResult =
  | { readonly ok: true; readonly created: boolean; readonly zoneSet: ZoneSet }
  | { readonly ok: false; readonly reason: 'payload_mismatch' | 'invalid_response' };

const REQUIRED_KEYS = [
  'id',
  'version',
  'discipline',
  'metric',
  'basis',
  'unit',
  'threshold',
  'effectiveFromMs',
  'recordedAtMs',
  'bands',
] as const;

const ALLOWED_KEYS: ReadonlySet<string> = new Set<string>(REQUIRED_KEYS);

const THRESHOLD_KEYS = ['kind', 'value', 'unit', 'origin', 'measuredAtMs'] as const;
const BAND_KEYS = ['id', 'label', 'lower', 'upper'] as const;

const CONFIG_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const DISCIPLINE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const MAX_BANDS = 20;
const MAX_BAND_LABEL_LENGTH = 80;

/**
 * Plage des dates JavaScript. Une date hors de cette plage ne peut pas être
 * convertie en ISO de manière fiable ; elle est refusée avant toute écriture.
 */
const MAX_DATE_MS = 8_640_000_000_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEpochMs(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= -MAX_DATE_MS &&
    value <= MAX_DATE_MS
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseTimestampMs(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function failure(errors: readonly string[]): ZoneConfigurationFailure {
  return { ok: false, errors: unique(errors) };
}

function copyZoneSet(zoneSet: ZoneSet): ZoneSet {
  return {
    id: zoneSet.id,
    version: zoneSet.version,
    discipline: zoneSet.discipline,
    metric: zoneSet.metric,
    basis: zoneSet.basis,
    unit: zoneSet.unit,
    threshold: zoneSet.threshold ? { ...zoneSet.threshold } : null,
    effectiveFromMs: zoneSet.effectiveFromMs,
    recordedAtMs: zoneSet.recordedAtMs,
    bands: zoneSet.bands.map((band) => ({ ...band })),
  };
}

/**
 * Valide une configuration **explicite** et renvoie une copie.
 *
 * Différences avec `validateZoneSet` :
 *   - toutes les clés sont obligatoires, y compris `threshold` (mettre `null`
 *     est un choix explicite) et `unit` ;
 *   - les clés inconnues sont refusées ;
 *   - les dates doivent être des entiers JavaScript valides ;
 *   - `threshold.measuredAtMs` doit être présent, même à `null`.
 */
export function createZoneSet(input: unknown): ZoneConfigurationResult {
  if (!isRecord(input)) return failure(['zone_config_absent']);

  const errors: string[] = [];

  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) errors.push(`zone_config_unknown_${key}`);
  }
  for (const key of REQUIRED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) {
      errors.push(`zone_config_missing_${key}`);
    }
  }

  if (input.threshold === undefined) errors.push('zone_config_threshold_explicit');
  if (input.unit === undefined) errors.push('zone_config_unit_explicit');
  if (typeof input.id !== 'string' || !CONFIG_ID_PATTERN.test(input.id)) {
    errors.push('zone_set_id_format');
  }
  if (typeof input.version !== 'string' || !CONFIG_ID_PATTERN.test(input.version)) {
    errors.push('zone_set_version_format');
  }
  if (typeof input.discipline !== 'string' || !DISCIPLINE_PATTERN.test(input.discipline)) {
    errors.push('zone_set_discipline_format');
  }

  if (isRecord(input.threshold)) {
    const thresholdInput = input.threshold;
    for (const key of Object.keys(thresholdInput)) {
      if (!(THRESHOLD_KEYS as readonly string[]).includes(key)) {
        errors.push(`threshold_unknown_${key}`);
      }
    }
    for (const key of THRESHOLD_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(thresholdInput, key)) {
        errors.push(`threshold_missing_${key}`);
      }
    }
    if (thresholdInput.measuredAtMs !== null && !isEpochMs(thresholdInput.measuredAtMs)) {
      errors.push('threshold_measured_at');
    }
  } else if (input.threshold !== null && input.threshold !== undefined) {
    errors.push('zone_set_threshold');
  }

  if (!isEpochMs(input.effectiveFromMs)) errors.push('zone_set_effective_from');
  if (!isEpochMs(input.recordedAtMs)) errors.push('zone_set_recorded_at');

  if (Array.isArray(input.bands)) {
    if (input.bands.length > MAX_BANDS) errors.push('zone_set_bands_limit');
    input.bands.forEach((band, index) => {
      if (!isRecord(band)) return;
      for (const key of Object.keys(band)) {
        if (!(BAND_KEYS as readonly string[]).includes(key)) {
          errors.push(`zone_band_${index}_unknown_${key}`);
        }
      }
      for (const key of BAND_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(band, key)) {
          errors.push(`zone_band_${index}_missing_${key}`);
        }
      }
      if (typeof band.id !== 'string' || !CONFIG_ID_PATTERN.test(band.id)) {
        errors.push(`zone_band_${index}_id_format`);
      }
      if (typeof band.label !== 'string' || band.label.length > MAX_BAND_LABEL_LENGTH) {
        errors.push(`zone_band_${index}_label_length`);
      }
    });
  }

  const validation = validateZoneSet(input as unknown as ZoneSet);
  errors.push(...validation.errors);

  const deduped = unique(errors);
  if (deduped.length > 0) return { ok: false, errors: deduped };

  return { ok: true, zoneSet: copyZoneSet(input as unknown as ZoneSet) };
}

/**
 * Convertit une ligne privée (`activity_zone_configs`) en `ZoneSet`.
 * Une ligne partielle ou incohérente est refusée, jamais complétée.
 */
export function zoneConfigRowToZoneSet(rowInput: unknown): ZoneConfigurationResult {
  if (!isRecord(rowInput)) return failure(['zone_config_row_absent']);

  const errors: string[] = [];
  const row = rowInput;

  if (!isNonEmptyString(row.id)) errors.push('zone_config_row_id');
  if (!isNonEmptyString(row.version)) errors.push('zone_config_row_version');
  if (!isNonEmptyString(row.discipline)) errors.push('zone_config_row_discipline');
  if (!isNonEmptyString(row.metric)) errors.push('zone_config_row_metric');
  if (!isNonEmptyString(row.basis)) errors.push('zone_config_row_basis');
  if (!isNonEmptyString(row.unit)) errors.push('zone_config_row_unit');

  const effectiveFromMs = parseTimestampMs(row.effective_from);
  if (effectiveFromMs === null) errors.push('zone_config_row_effective_from');
  const recordedAtMs = parseTimestampMs(row.recorded_at);
  if (recordedAtMs === null) errors.push('zone_config_row_recorded_at');

  for (const key of [
    'threshold_kind',
    'threshold_value',
    'threshold_unit',
    'threshold_origin',
    'threshold_measured_at',
  ]) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) {
      errors.push(`zone_config_row_missing_${key}`);
    }
  }

  let threshold: Threshold | null = null;
  const thresholdKind = row.threshold_kind;
  if (thresholdKind === null || thresholdKind === undefined) {
    if (
      row.threshold_value !== null ||
      row.threshold_unit !== null ||
      row.threshold_origin !== null ||
      row.threshold_measured_at !== null
    ) {
      errors.push('zone_config_row_threshold_partial');
    }
  } else {
    const value = toFiniteNumber(row.threshold_value);
    const measuredAtMs =
      row.threshold_measured_at === null ? null : parseTimestampMs(row.threshold_measured_at);
    if (
      !isNonEmptyString(thresholdKind) ||
      value === null ||
      !isNonEmptyString(row.threshold_unit) ||
      !isNonEmptyString(row.threshold_origin) ||
      (row.threshold_measured_at !== null && measuredAtMs === null)
    ) {
      errors.push('zone_config_row_threshold');
    } else {
      threshold = {
        kind: thresholdKind as ThresholdKind,
        value,
        unit: row.threshold_unit as ThresholdUnit,
        origin: row.threshold_origin as ThresholdOrigin,
        measuredAtMs,
      };
    }
  }

  const bands: ZoneBand[] = [];
  if (!Array.isArray(row.bands)) {
    errors.push('zone_config_row_bands');
  } else {
    row.bands.forEach((entry, index) => {
      if (!isRecord(entry)) {
        errors.push(`zone_config_row_band_${index}_absent`);
        return;
      }
      const id = entry.id;
      const label = entry.label;
      const lower = toFiniteNumber(entry.lower);
      const upperRaw = entry.upper;
      const upper = upperRaw === null ? null : toFiniteNumber(upperRaw);
      if (!isNonEmptyString(id)) errors.push(`zone_config_row_band_${index}_id`);
      if (!isNonEmptyString(label)) errors.push(`zone_config_row_band_${index}_label`);
      if (lower === null) errors.push(`zone_config_row_band_${index}_lower`);
      if (upperRaw !== null && upper === null) {
        errors.push(`zone_config_row_band_${index}_upper`);
      }
      if (
        isNonEmptyString(id) &&
        isNonEmptyString(label) &&
        lower !== null &&
        (upperRaw === null || upper !== null)
      ) {
        bands.push({ id, label, lower, upper });
      }
    });
  }

  if (errors.length > 0) return failure(errors);

  return createZoneSet({
    id: row.id,
    version: row.version,
    discipline: row.discipline,
    metric: row.metric,
    basis: row.basis,
    unit: row.unit,
    threshold,
    effectiveFromMs,
    recordedAtMs,
    bands,
  });
}

/**
 * Corps exact attendu par `save_activity_zone_config`.
 * Aucune clé de seuil n'est omise : les valeurs absentes sont explicitement
 * `null`, ce qui permet à la RPC de distinguer « pas de seuil » d'un oubli.
 */
export function buildSaveZoneConfigRpcBody(zoneSet: ZoneSet): SaveZoneConfigBodyResult {
  const checked = createZoneSet(zoneSet);
  if (!checked.ok) return checked;

  const value = checked.zoneSet;
  const threshold = value.threshold;

  return {
    ok: true,
    body: {
      p_id: value.id,
      p_version: value.version,
      p_discipline: value.discipline,
      p_metric: value.metric,
      p_basis: value.basis,
      p_unit: value.unit,
      p_threshold_kind: threshold ? threshold.kind : null,
      p_threshold_value: threshold ? threshold.value : null,
      p_threshold_unit: threshold ? threshold.unit : null,
      p_threshold_origin: threshold ? threshold.origin : null,
      p_threshold_measured_at:
        threshold && threshold.measuredAtMs !== null
          ? new Date(threshold.measuredAtMs).toISOString()
          : null,
      p_effective_from: new Date(value.effectiveFromMs).toISOString(),
      p_recorded_at: new Date(value.recordedAtMs).toISOString(),
      p_bands: value.bands.map((band) => ({
        id: band.id,
        label: band.label,
        lower: band.lower,
        upper: band.upper,
      })),
    },
  };
}

/** Lit la réponse de la RPC sans jamais présenter un échec comme un succès. */
export function parseSaveZoneConfigRpcResult(input: unknown): SaveZoneConfigRpcResult {
  if (!isRecord(input)) return { ok: false, reason: 'invalid_response' };

  if (input.ok === false) {
    return input.reason === 'payload_mismatch'
      ? { ok: false, reason: 'payload_mismatch' }
      : { ok: false, reason: 'invalid_response' };
  }

  const created = input.created;
  const config = input.config;
  if (input.ok !== true || typeof created !== 'boolean' || !isRecord(config)) {
    return { ok: false, reason: 'invalid_response' };
  }

  const parsed = zoneConfigRowToZoneSet(config);
  if (!parsed.ok) return { ok: false, reason: 'invalid_response' };

  return { ok: true, created, zoneSet: parsed.zoneSet };
}

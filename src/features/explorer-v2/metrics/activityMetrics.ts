/**
 * Métriques d'activité — zones cardio, allure, puissance et effort
 * (S2.10, S2.11, S2.12).
 *
 * Module de domaine **autonome** : aucun import de l'Explorer, aucun état,
 * aucun accès réseau, aucune migration. Il ne fabrique ni seuil, ni zone, ni
 * échelle d'effort, ni pondération : toutes les bornes, tous les seuils et
 * toutes les pondérations sont fournis par l'appelant et versionnés.
 *
 * Ce que le module calcule :
 *   - le temps passé dans chaque zone d'une configuration datée, à partir
 *     d'échantillons cardio, de puissance ou de vitesse réellement fournis ;
 *   - un effort relatif cardio, uniquement si des pondérations par zone sont
 *     fournies ; ce n'est **pas** la formule propriétaire de Strava ;
 *   - la validation et la normalisation d'un effort perçu (RPE) sur une
 *     échelle elle aussi fournie.
 *
 * Règles de couverture :
 *   - `null` / `undefined` = mesure absente ; `0` = mesure présente (zéro
 *     conservé, y compris pour la fréquence cardiaque, sans seuil inventé) ;
 *   - une valeur négative ou non finie est invalide, jamais zéro ;
 *   - un échantillon ne couvre le temps que jusqu'au prochain échantillon,
 *     jusqu'à `maxHoldMs` au plus, et jamais au-delà d'une pause ;
 *   - une pause est une interruption dure : aucun échantillon antérieur ne
 *     couvre l'après-pause ;
 *   - aucun temps hors couverture n'est versé dans la zone la plus basse.
 *
 * Les échantillons sont intégrés en escalier (valeur constante entre deux
 * mesures), pas interpolés. Sur des échantillons irréguliers, c'est la durée
 * couverte qui pèse, jamais le nombre de points.
 *
 * Aucun branchement n'est fait dans cette tranche. L'intégration future est
 * décrite dans `docs/explorer-v2/S2.10-S2.12-METRICS.md`.
 */

export type MetricAvailability = 'available' | 'unavailable';

export type MetricValueKind = 'measured' | 'calculated' | 'estimated' | 'declared';

export type MetricSourceKind =
  | 'sensor'
  | 'device'
  | 'import'
  | 'manual'
  | 'calculated'
  | 'estimated';

/** Provenance minimale d'une série ou d'une valeur calculée. */
export interface MetricSource {
  readonly kind: MetricSourceKind;
  /** Identifiant du capteur, du connecteur, du fichier ou de la saisie. */
  readonly id: string | null;
}

/** Intervalle demi-ouvert `[startMs, endMs)`, en millisecondes UTC. */
export interface TimeRange {
  readonly startMs: number;
  readonly endMs: number;
}

export type ZoneMetric = 'heartRate' | 'power' | 'pace';

/**
 * `absolute` : bornes dans l'unité canonique de la métrique.
 * `percentOfThreshold` : bornes en pourcentage du seuil fourni. Pour l'allure,
 * le pourcentage porte sur la **vitesse** de seuil (`seuil / allure`), pas sur
 * le temps au kilomètre.
 */
export type ZoneBasis = 'absolute' | 'percentOfThreshold';

export type ZoneUnit = 'bpm' | 'watts' | 'secondsPerKm' | 'percent';

export type ThresholdKind =
  | 'maxHeartRate'
  | 'lactateThreshold'
  | 'ftp'
  | 'paceThreshold'
  | 'custom';

export type ThresholdUnit = 'bpm' | 'watts' | 'secondsPerKm';

/** Saisi, lu sur un appareil, issu d'un test déclaré, ou estimé. */
export type ThresholdOrigin = 'manual' | 'device' | 'tested' | 'estimated';

export interface Threshold {
  readonly kind: ThresholdKind;
  /** Valeur strictement positive, dans `unit`. */
  readonly value: number;
  readonly unit: ThresholdUnit;
  readonly origin: ThresholdOrigin;
  /** Date de la mesure ou du test ; `null` pour une valeur simplement saisie. */
  readonly measuredAtMs: number | null;
}

/** Borne basse incluse, borne haute exclue ; `upper: null` = zone ouverte. */
export interface ZoneBand {
  readonly id: string;
  readonly label: string;
  readonly lower: number;
  readonly upper: number | null;
}

/**
 * Configuration de zones datée et versionnée. Modifier une zone crée une
 * nouvelle configuration ; l'historique n'est jamais réécrit silencieusement.
 */
export interface ZoneSet {
  readonly id: string;
  readonly version: string;
  /** Discipline ou sport de la configuration (`course`, `velo`, …). */
  readonly discipline: string;
  readonly metric: ZoneMetric;
  readonly basis: ZoneBasis;
  readonly unit: ZoneUnit;
  readonly threshold: Threshold | null;
  readonly effectiveFromMs: number;
  readonly recordedAtMs: number;
  readonly bands: readonly ZoneBand[];
}

export interface HeartRateSample {
  readonly atMs: number;
  readonly bpm: number | null;
}

export interface PowerSample {
  readonly atMs: number;
  readonly watts: number | null;
}

export interface SpeedSample {
  readonly atMs: number;
  readonly speedMps: number | null;
}

export interface ZoneTimeOptions {
  /** Début de la fenêtre de séance, en millisecondes UTC. */
  readonly fromMs: number;
  /** Fin de la fenêtre de séance, en millisecondes UTC. */
  readonly toMs: number;
  /**
   * Durée maximale pendant laquelle un échantillon peut couvrir le temps sans
   * nouvelle mesure. Fourni par l'appelant : aucune valeur par défaut.
   */
  readonly maxHoldMs: number;
  /** Pauses manuelles et automatiques, en intervalles demi-ouverts. */
  readonly excluded?: readonly TimeRange[];
  readonly source: MetricSource;
  /** Date du calcul, fournie pour rester déterministe. */
  readonly computedAtMs: number;
}

export interface ZoneDuration {
  readonly zoneId: string;
  readonly label: string;
  readonly seconds: number;
  /** Part de la fenêtre totale, pauses comprises. */
  readonly shareOfWindow: number;
  /** Part du temps effectivement classé dans une zone. */
  readonly shareOfInZone: number;
}

export interface ZoneTimeConfig {
  readonly zoneSetId: string;
  readonly zoneSetVersion: string;
  readonly discipline: string;
  readonly metric: ZoneMetric;
  readonly basis: ZoneBasis;
  readonly unit: ZoneUnit;
  readonly threshold: Threshold | null;
  readonly effectiveFromMs: number;
  readonly recordedAtMs: number;
  /** Règle de couverture réellement appliquée ; `null` si elle est invalide. */
  readonly maxHoldMs: number | null;
}

export interface ZoneTimeWindow {
  readonly fromMs: number;
  readonly toMs: number;
  readonly durationS: number;
  /** Intersection des pauses avec la fenêtre. */
  readonly pausedS: number;
  /** Temps couvert par un échantillon présent, hors pauses. */
  readonly sampledS: number;
  /** Temps sans échantillon exploitable, hors pauses. */
  readonly uncoveredS: number;
  /** Temps effectivement classé dans une des zones fournies. */
  readonly inZoneS: number;
  /** Temps échantillonné mais hors zones (trou de zone, allure indéfinie). */
  readonly outsideZoneS: number;
}

export interface ZoneSampleCoverage {
  readonly received: number;
  readonly present: number;
  readonly missing: number;
  readonly invalid: number;
  /** Échantillons présents ayant réellement couvert au moins un instant. */
  readonly used: number;
}

export type ZoneTimeReason =
  | 'invalid_zone_set'
  | 'metric_mismatch'
  | 'invalid_window'
  | 'invalid_context'
  | 'invalid_pause_range'
  | 'no_samples'
  | 'no_present_samples'
  | 'no_coverage';

export interface ZoneTimeResult {
  readonly status: MetricAvailability;
  readonly reason: ZoneTimeReason | null;
  readonly valueKind: 'calculated';
  readonly method: 'time-in-zone/v1';
  readonly config: ZoneTimeConfig | null;
  readonly source: MetricSource | null;
  readonly computedAtMs: number | null;
  readonly window: ZoneTimeWindow;
  readonly samples: ZoneSampleCoverage;
  readonly zones: readonly ZoneDuration[];
  readonly diagnostics: readonly string[];
}

export interface EffortWeights {
  readonly id: string;
  readonly version: string;
  /** Points d'effort par heure passée dans la zone, indexés par `zoneId`. */
  readonly pointsPerHour: Readonly<Record<string, number>>;
}

export interface RelativeEffortOptions {
  readonly weights: EffortWeights;
  /** Date du calcul, fournie pour rester déterministe. */
  readonly computedAtMs: number;
}

export interface RelativeEffortZone {
  readonly zoneId: string;
  readonly label: string;
  readonly seconds: number;
  readonly pointsPerHour: number;
  readonly points: number;
  readonly shareOfScore: number;
}

export interface RelativeEffortConfig {
  readonly zoneSetId: string;
  readonly zoneSetVersion: string;
  readonly weightsId: string;
  readonly weightsVersion: string;
  /** Règle de couverture du calcul de zones source. */
  readonly maxHoldMs: number | null;
}

export type RelativeEffortReason =
  | ZoneTimeReason
  | 'invalid_weights'
  | 'not_heart_rate'
  | 'missing_zone_weight'
  | 'no_zone_time'
  | 'invalid_context';

export interface RelativeEffortResult {
  readonly status: MetricAvailability;
  readonly reason: RelativeEffortReason | null;
  readonly valueKind: 'estimated';
  readonly method: 'zone-weighted-relative-effort/v1';
  readonly score: number | null;
  readonly unit: 'points';
  readonly config: RelativeEffortConfig | null;
  readonly source: MetricSource | null;
  readonly computedAtMs: number | null;
  readonly window: ZoneTimeWindow;
  readonly samples: ZoneSampleCoverage;
  readonly zones: readonly RelativeEffortZone[];
  /**
   * Part du temps non pausé réellement classé en zone cardio. Une couverture
   * partielle est signalée, jamais extrapolée.
   */
  readonly coverageRatio: number;
  readonly diagnostics: readonly string[];
}

/**
 * Échelle d'effort perçu fournie par l'appelant (0–10, 1–10, 6–20, …).
 * Aucune échelle par défaut n'est imposée par le module.
 */
export interface PerceivedEffortScale {
  readonly min: number;
  readonly max: number;
  readonly label: string | null;
}

export interface PerceivedEffortInput {
  readonly value: number;
  readonly scale: PerceivedEffortScale;
  readonly recordedAtMs: number;
  readonly source: MetricSource;
}

export type PerceivedEffortReason =
  | 'invalid_scale'
  | 'invalid_value'
  | 'value_out_of_scale'
  | 'invalid_recorded_at'
  | 'invalid_source'
  | 'invalid_context';

export interface PerceivedEffortResult {
  readonly status: MetricAvailability;
  readonly reason: PerceivedEffortReason | null;
  readonly valueKind: 'declared';
  readonly method: 'perceived-effort/v1';
  readonly value: number | null;
  readonly scale: PerceivedEffortScale | null;
  readonly recordedAtMs: number | null;
  readonly source: MetricSource | null;
  readonly computedAtMs: number | null;
  readonly diagnostics: readonly string[];
}

export interface ZoneSetValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const ZONE_METRICS: readonly ZoneMetric[] = ['heartRate', 'power', 'pace'];
const ZONE_BASES: readonly ZoneBasis[] = ['absolute', 'percentOfThreshold'];
const ZONE_UNITS: readonly ZoneUnit[] = ['bpm', 'watts', 'secondsPerKm', 'percent'];
const THRESHOLD_KINDS: readonly ThresholdKind[] = [
  'maxHeartRate',
  'lactateThreshold',
  'ftp',
  'paceThreshold',
  'custom',
];
const THRESHOLD_UNITS: readonly ThresholdUnit[] = ['bpm', 'watts', 'secondsPerKm'];
const THRESHOLD_ORIGINS: readonly ThresholdOrigin[] = ['manual', 'device', 'tested', 'estimated'];
const SOURCE_KINDS: readonly MetricSourceKind[] = [
  'sensor',
  'device',
  'import',
  'manual',
  'calculated',
  'estimated',
];

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_HOUR = 3600;
const METERS_PER_KILOMETER = 1000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonicalUnit(metric: ZoneMetric): ThresholdUnit | null {
  if (metric === 'heartRate') return 'bpm';
  if (metric === 'power') return 'watts';
  if (metric === 'pace') return 'secondsPerKm';
  return null;
}

function expectedZoneUnit(metric: ZoneMetric, basis: ZoneBasis): ZoneUnit | null {
  if (basis === 'percentOfThreshold') return 'percent';
  if (basis === 'absolute') return canonicalUnit(metric);
  return null;
}

function thresholdKindAllowed(metric: ZoneMetric, kind: ThresholdKind): boolean {
  if (metric === 'power') return kind === 'ftp';
  if (metric === 'pace') return kind === 'paceThreshold';
  if (metric === 'heartRate') {
    return kind === 'maxHeartRate' || kind === 'lactateThreshold' || kind === 'custom';
  }
  return false;
}

function isValidSource(source: MetricSource | null | undefined): source is MetricSource {
  if (!source || typeof source !== 'object') return false;
  if (!SOURCE_KINDS.includes(source.kind)) return false;
  return source.id === null || isNonEmptyString(source.id);
}

function copySource(source: MetricSource): MetricSource {
  return { kind: source.kind, id: source.id };
}

/**
 * Valide une configuration de zones sans la compléter : les erreurs sont
 * explicites et aucune borne n'est déduite d'une autre.
 */
export function validateZoneSet(zoneSet: ZoneSet): ZoneSetValidation {
  const errors: string[] = [];
  if (!zoneSet || typeof zoneSet !== 'object') {
    return { valid: false, errors: ['zone_set_absent'] };
  }

  const candidate = zoneSet as Partial<ZoneSet>;
  if (!isNonEmptyString(candidate.id)) errors.push('zone_set_id');
  if (!isNonEmptyString(candidate.version)) errors.push('zone_set_version');
  if (!isNonEmptyString(candidate.discipline)) errors.push('zone_set_discipline');
  if (!isFiniteNumber(candidate.effectiveFromMs)) errors.push('zone_set_effective_from');
  if (!isFiniteNumber(candidate.recordedAtMs)) errors.push('zone_set_recorded_at');

  const metric = candidate.metric;
  const basis = candidate.basis;
  if (!metric || !ZONE_METRICS.includes(metric)) errors.push('zone_set_metric');
  if (!basis || !ZONE_BASES.includes(basis)) errors.push('zone_set_basis');

  if (metric && basis) {
    const expectedUnit = expectedZoneUnit(metric, basis);
    if (candidate.unit !== expectedUnit) errors.push('zone_set_unit');
  } else if (candidate.unit && !ZONE_UNITS.includes(candidate.unit)) {
    errors.push('zone_set_unit');
  }

  const threshold = candidate.threshold;
  if (threshold === undefined || threshold === null) {
    if (basis === 'percentOfThreshold') errors.push('zone_set_threshold_required');
  } else if (typeof threshold !== 'object') {
    errors.push('zone_set_threshold');
  } else {
    if (!THRESHOLD_KINDS.includes(threshold.kind)) errors.push('threshold_kind');
    if (!isFiniteNumber(threshold.value) || threshold.value <= 0) errors.push('threshold_value');
    if (!THRESHOLD_UNITS.includes(threshold.unit)) errors.push('threshold_unit');
    if (!THRESHOLD_ORIGINS.includes(threshold.origin)) errors.push('threshold_origin');
    if (threshold.measuredAtMs !== null && !isFiniteNumber(threshold.measuredAtMs)) {
      errors.push('threshold_measured_at');
    }
    if (metric && thresholdKindAllowed(metric, threshold.kind) === false) {
      errors.push('threshold_kind_for_metric');
    }
    if (metric && threshold.unit !== canonicalUnit(metric)) {
      errors.push('threshold_unit_for_metric');
    }
  }

  const bands = candidate.bands;
  if (!Array.isArray(bands) || bands.length === 0) {
    errors.push('zone_set_bands');
    return { valid: false, errors };
  }

  const seenIds = new Set<string>();
  let previousLower: number | null = null;
  let previousUpper: number | null = null;
  let previousUpperIsOpen = false;

  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index] as Partial<ZoneBand> | null;
    if (!band || typeof band !== 'object') {
      errors.push(`zone_band_${index}_absent`);
      continue;
    }
    const bandId = band.id;
    const bandLabel = band.label;
    if (!isNonEmptyString(bandId) || seenIds.has(bandId)) errors.push(`zone_band_${index}_id`);
    else seenIds.add(bandId);
    if (!isNonEmptyString(bandLabel)) errors.push(`zone_band_${index}_label`);

    const lower = band.lower;
    const upper = band.upper;
    const openTop = upper === null;
    const lowerNumber = isFiniteNumber(lower) && lower >= 0 ? lower : null;
    const upperNumber = isFiniteNumber(upper) && upper > 0 ? upper : null;
    if (lowerNumber === null) errors.push(`zone_band_${index}_lower`);
    if (!openTop && upperNumber === null) errors.push(`zone_band_${index}_upper`);

    if (lowerNumber !== null && upperNumber !== null && upperNumber <= lowerNumber) {
      errors.push(`zone_band_${index}_range`);
    }
    if (openTop && index !== bands.length - 1) {
      errors.push(`zone_band_${index}_open_not_last`);
    }
    if (previousUpperIsOpen) {
      errors.push(`zone_band_${index}_after_open`);
    } else if (lowerNumber !== null && previousUpper !== null && lowerNumber < previousUpper) {
      errors.push(`zone_band_${index}_overlap`);
    } else if (lowerNumber !== null && previousLower !== null && lowerNumber < previousLower) {
      errors.push(`zone_band_${index}_order`);
    }

    if (lowerNumber !== null) previousLower = lowerNumber;
    if (openTop) {
      previousUpper = null;
      previousUpperIsOpen = true;
    } else if (upperNumber !== null) {
      previousUpper = upperNumber;
      previousUpperIsOpen = false;
    }
  }

  return { valid: errors.length === 0, errors };
}

function zoneConfig(zoneSet: ZoneSet, maxHoldMs: number | null): ZoneTimeConfig {
  return {
    zoneSetId: zoneSet.id,
    zoneSetVersion: zoneSet.version,
    discipline: zoneSet.discipline,
    metric: zoneSet.metric,
    basis: zoneSet.basis,
    unit: zoneSet.unit,
    threshold: zoneSet.threshold ? { ...zoneSet.threshold } : null,
    effectiveFromMs: zoneSet.effectiveFromMs,
    recordedAtMs: zoneSet.recordedAtMs,
    maxHoldMs,
  };
}

function emptyWindow(): ZoneTimeWindow {
  return {
    fromMs: 0,
    toMs: 0,
    durationS: 0,
    pausedS: 0,
    sampledS: 0,
    uncoveredS: 0,
    inZoneS: 0,
    outsideZoneS: 0,
  };
}

function emptySamples(): ZoneSampleCoverage {
  return { received: 0, present: 0, missing: 0, invalid: 0, used: 0 };
}

function zeroZoneDurations(zoneSet: ZoneSet): ZoneDuration[] {
  return zoneSet.bands.map((band) => ({
    zoneId: band.id,
    label: band.label,
    seconds: 0,
    shareOfWindow: 0,
    shareOfInZone: 0,
  }));
}

function unavailableZoneTime(input: {
  reason: ZoneTimeReason;
  diagnostics: readonly string[];
  config?: ZoneTimeConfig | null;
  source?: MetricSource | null;
  computedAtMs?: number | null;
  zones?: readonly ZoneDuration[];
  window?: ZoneTimeWindow;
  samples?: ZoneSampleCoverage;
}): ZoneTimeResult {
  return {
    status: 'unavailable',
    reason: input.reason,
    valueKind: 'calculated',
    method: 'time-in-zone/v1',
    config: input.config ?? null,
    source: input.source ?? null,
    computedAtMs: input.computedAtMs ?? null,
    window: input.window ?? emptyWindow(),
    samples: input.samples ?? emptySamples(),
    zones: input.zones ?? [],
    diagnostics: input.diagnostics,
  };
}

interface NormalizedZoneTimeOptions {
  readonly valid: boolean;
  readonly reason: 'invalid_window' | 'invalid_context' | 'invalid_pause_range' | null;
  readonly diagnostics: readonly string[];
  readonly excluded: readonly TimeRange[];
  readonly source: MetricSource | null;
  readonly computedAtMs: number | null;
}

function mergeRanges(ranges: readonly TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];
  const sorted = ranges.slice().sort((left, right) => left.startMs - right.startMs);
  const merged: TimeRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push({ startMs: range.startMs, endMs: range.endMs });
      continue;
    }
    if (range.startMs <= previous.endMs) {
      merged[merged.length - 1] = {
        startMs: previous.startMs,
        endMs: Math.max(previous.endMs, range.endMs),
      };
    } else {
      merged.push({ startMs: range.startMs, endMs: range.endMs });
    }
  }
  return merged;
}

function normalizeZoneTimeOptions(options: ZoneTimeOptions): NormalizedZoneTimeOptions {
  const diagnostics: string[] = [];
  const excluded: TimeRange[] = [];
  let windowError = false;
  let contextError = false;
  let pauseError = false;

  if (!options || typeof options !== 'object') {
    return {
      valid: false,
      reason: 'invalid_context',
      diagnostics: ['options_absent'],
      excluded: [],
      source: null,
      computedAtMs: null,
    };
  }

  if (
    !isFiniteNumber(options.fromMs) ||
    !isFiniteNumber(options.toMs) ||
    options.fromMs >= options.toMs ||
    !isFiniteNumber(options.maxHoldMs) ||
    options.maxHoldMs < 0
  ) {
    windowError = true;
    diagnostics.push('window_invalid');
  }

  if (!isFiniteNumber(options.computedAtMs)) {
    contextError = true;
    diagnostics.push('computed_at_invalid');
  }

  if (!isValidSource(options.source)) {
    contextError = true;
    diagnostics.push('source_invalid');
  }

  const rawExcluded = options.excluded;
  if (rawExcluded !== undefined) {
    if (!Array.isArray(rawExcluded)) {
      pauseError = true;
      diagnostics.push('excluded_not_array');
    } else {
      for (let index = 0; index < rawExcluded.length; index += 1) {
        const range = rawExcluded[index];
        if (!range || typeof range !== 'object') {
          pauseError = true;
          diagnostics.push(`excluded_${index}_absent`);
          continue;
        }
        if (
          !isFiniteNumber(range.startMs) ||
          !isFiniteNumber(range.endMs) ||
          range.endMs <= range.startMs
        ) {
          pauseError = true;
          diagnostics.push(`excluded_${index}_invalid`);
          continue;
        }
        excluded.push({ startMs: range.startMs, endMs: range.endMs });
      }
    }
  }

  const reason: NormalizedZoneTimeOptions['reason'] = windowError
    ? 'invalid_window'
    : contextError
      ? 'invalid_context'
      : pauseError
        ? 'invalid_pause_range'
        : null;

  return {
    valid: reason === null,
    reason,
    diagnostics,
    excluded: mergeRanges(excluded),
    source: isValidSource(options.source) ? copySource(options.source) : null,
    computedAtMs: isFiniteNumber(options.computedAtMs) ? options.computedAtMs : null,
  };
}

interface PreparedSample {
  readonly atMs: number;
  readonly value: number | null;
  readonly present: boolean;
}

interface PreparedSamples {
  readonly rows: readonly PreparedSample[];
  readonly coverage: ZoneSampleCoverage;
}

function prepareSamples(
  samples: readonly { atMs: number | undefined; value: number | null | undefined }[],
): PreparedSamples {
  const rows: PreparedSample[] = [];
  const raw = Array.isArray(samples) ? samples : [];
  let present = 0;
  let missing = 0;
  let invalid = 0;

  for (const sample of raw) {
    if (!sample || typeof sample !== 'object') {
      invalid += 1;
      continue;
    }
    if (!isFiniteNumber(sample.atMs)) {
      invalid += 1;
      continue;
    }
    if (sample.value === null || sample.value === undefined) {
      missing += 1;
      rows.push({ atMs: sample.atMs, value: null, present: false });
      continue;
    }
    if (!isFiniteNumber(sample.value) || sample.value < 0) {
      invalid += 1;
      rows.push({ atMs: sample.atMs, value: null, present: false });
      continue;
    }
    present += 1;
    rows.push({ atMs: sample.atMs, value: sample.value, present: true });
  }

  rows.sort((left, right) => left.atMs - right.atMs);

  return {
    rows,
    coverage: { received: raw.length, present, missing, invalid, used: 0 },
  };
}

function isInsideExcluded(excluded: readonly TimeRange[], atMs: number): boolean {
  for (const range of excluded) {
    if (atMs >= range.startMs && atMs < range.endMs) return true;
  }
  return false;
}

function firstExcludedStartAtOrAfter(excluded: readonly TimeRange[], atMs: number): number | null {
  let next: number | null = null;
  for (const range of excluded) {
    if (range.startMs >= atMs && (next === null || range.startMs < next)) {
      next = range.startMs;
    }
  }
  return next;
}

function intersectionMs(range: TimeRange, fromMs: number, toMs: number): number {
  const start = Math.max(range.startMs, fromMs);
  const end = Math.min(range.endMs, toMs);
  return Math.max(0, end - start);
}

function canonicalSampleValue(metric: ZoneMetric, rawValue: number): number | null {
  if (metric === 'pace') {
    if (rawValue <= 0) return null;
    return METERS_PER_KILOMETER / rawValue;
  }
  return rawValue;
}

function classificationValue(zoneSet: ZoneSet, canonicalValue: number | null): number | null {
  if (canonicalValue === null) return null;
  if (zoneSet.basis === 'absolute') return canonicalValue;
  if (!zoneSet.threshold) return null;

  if (zoneSet.metric === 'pace') {
    if (canonicalValue <= 0 || zoneSet.threshold.value <= 0) return null;
    // Pourcentage de la vitesse de seuil : une allure plus rapide (valeur plus
    // petite) donne un pourcentage plus grand.
    const percent = (zoneSet.threshold.value / canonicalValue) * 100;
    return Number.isFinite(percent) ? percent : null;
  }

  if (zoneSet.threshold.value <= 0) return null;
  const percentage = (canonicalValue / zoneSet.threshold.value) * 100;
  return Number.isFinite(percentage) ? percentage : null;
}

function findZone(zoneSet: ZoneSet, value: number): ZoneBand | null {
  for (const band of zoneSet.bands) {
    if (value < band.lower) continue;
    if (band.upper === null || value < band.upper) return band;
  }
  return null;
}

function computeZoneTimesForMetric(
  expectedMetric: ZoneMetric,
  samples: readonly { atMs: number | undefined; value: number | null | undefined }[],
  zoneSet: ZoneSet,
  options: ZoneTimeOptions,
): ZoneTimeResult {
  const validation = validateZoneSet(zoneSet);
  if (!validation.valid) {
    return unavailableZoneTime({
      reason: 'invalid_zone_set',
      diagnostics: validation.errors,
      zones: [],
    });
  }

  const maxHoldMs =
    options && isFiniteNumber(options.maxHoldMs) && options.maxHoldMs >= 0
      ? options.maxHoldMs
      : null;
  const config = zoneConfig(zoneSet, maxHoldMs);
  if (zoneSet.metric !== expectedMetric) {
    return unavailableZoneTime({
      reason: 'metric_mismatch',
      diagnostics: [`expected_${expectedMetric}_zone_set`],
      config,
      zones: zeroZoneDurations(zoneSet),
    });
  }

  const normalizedOptions = normalizeZoneTimeOptions(options);
  const baseZones = zeroZoneDurations(zoneSet);
  if (!normalizedOptions.valid) {
    return unavailableZoneTime({
      reason: normalizedOptions.reason ?? 'invalid_window',
      diagnostics: normalizedOptions.diagnostics,
      config,
      source: normalizedOptions.source,
      computedAtMs: normalizedOptions.computedAtMs,
      zones: baseZones,
    });
  }

  const prepared = prepareSamples(samples);
  if (prepared.coverage.received === 0) {
    return unavailableZoneTime({
      reason: 'no_samples',
      diagnostics: ['no_samples'],
      config,
      source: normalizedOptions.source,
      computedAtMs: normalizedOptions.computedAtMs,
      zones: baseZones,
      samples: prepared.coverage,
    });
  }
  if (prepared.coverage.present === 0) {
    return unavailableZoneTime({
      reason: 'no_present_samples',
      diagnostics: ['no_present_samples'],
      config,
      source: normalizedOptions.source,
      computedAtMs: normalizedOptions.computedAtMs,
      zones: baseZones,
      samples: prepared.coverage,
    });
  }

  const { fromMs, toMs } = options;
  const holdMs = options.maxHoldMs;
  const excluded = normalizedOptions.excluded;
  const zoneMilliseconds = new Map<string, number>();
  let sampledMs = 0;
  let used = 0;

  for (let index = 0; index < prepared.rows.length; index += 1) {
    const sample = prepared.rows[index];
    if (!sample.present || sample.value === null) continue;
    if (sample.atMs >= toMs) break;
    if (isInsideExcluded(excluded, sample.atMs)) continue;

    const nextSample = prepared.rows[index + 1];
    const nextAtMs = nextSample ? nextSample.atMs : Number.POSITIVE_INFINITY;
    const startMs = Math.max(sample.atMs, fromMs);
    let endMs = Math.min(nextAtMs, sample.atMs + holdMs, toMs);
    const pauseStart = firstExcludedStartAtOrAfter(excluded, sample.atMs);
    if (pauseStart !== null) endMs = Math.min(endMs, pauseStart);
    if (endMs <= startMs) continue;

    used += 1;
    const durationMs = endMs - startMs;
    sampledMs += durationMs;

    const canonical = canonicalSampleValue(zoneSet.metric, sample.value);
    const classified = classificationValue(zoneSet, canonical);
    const zone = classified === null ? null : findZone(zoneSet, classified);
    if (zone) {
      zoneMilliseconds.set(zone.id, (zoneMilliseconds.get(zone.id) ?? 0) + durationMs);
    }
  }

  const durationMs = toMs - fromMs;
  let pausedMs = 0;
  for (const range of excluded) pausedMs += intersectionMs(range, fromMs, toMs);
  pausedMs = Math.min(pausedMs, durationMs);
  sampledMs = Math.min(sampledMs, Math.max(0, durationMs - pausedMs));
  const uncoveredMs = Math.max(0, durationMs - pausedMs - sampledMs);

  const durationS = durationMs / MILLISECONDS_PER_SECOND;
  const pausedS = pausedMs / MILLISECONDS_PER_SECOND;
  const sampledS = sampledMs / MILLISECONDS_PER_SECOND;
  const uncoveredS = uncoveredMs / MILLISECONDS_PER_SECOND;
  let inZoneMs = 0;
  for (const milliseconds of zoneMilliseconds.values()) inZoneMs += milliseconds;
  inZoneMs = Math.min(inZoneMs, sampledMs);
  const inZoneS = inZoneMs / MILLISECONDS_PER_SECOND;
  const outsideZoneS = Math.max(0, sampledS - inZoneS);

  if (sampledMs <= 0) {
    return unavailableZoneTime({
      reason: 'no_coverage',
      diagnostics: ['no_coverage'],
      config,
      source: normalizedOptions.source,
      computedAtMs: normalizedOptions.computedAtMs,
      zones: baseZones,
      window: {
        fromMs,
        toMs,
        durationS,
        pausedS,
        sampledS,
        uncoveredS,
        inZoneS,
        outsideZoneS,
      },
      samples: { ...prepared.coverage, used },
    });
  }

  const zones = zoneSet.bands.map((band) => {
    const seconds = (zoneMilliseconds.get(band.id) ?? 0) / MILLISECONDS_PER_SECOND;
    return {
      zoneId: band.id,
      label: band.label,
      seconds,
      shareOfWindow: durationS > 0 ? seconds / durationS : 0,
      shareOfInZone: inZoneS > 0 ? seconds / inZoneS : 0,
    };
  });

  return {
    status: 'available',
    reason: null,
    valueKind: 'calculated',
    method: 'time-in-zone/v1',
    config,
    source: normalizedOptions.source,
    computedAtMs: normalizedOptions.computedAtMs,
    window: {
      fromMs,
      toMs,
      durationS,
      pausedS,
      sampledS,
      uncoveredS,
      inZoneS,
      outsideZoneS,
    },
    samples: { ...prepared.coverage, used },
    zones,
    diagnostics: normalizedOptions.diagnostics,
  };
}

/** Temps passé dans les zones cardio fournies. */
export function computeHeartRateZoneTimes(
  samples: readonly HeartRateSample[],
  zoneSet: ZoneSet,
  options: ZoneTimeOptions,
): ZoneTimeResult {
  const rows = Array.isArray(samples) ? samples : [];
  return computeZoneTimesForMetric(
    'heartRate',
    rows.map((sample) => ({ atMs: sample?.atMs, value: sample?.bpm })),
    zoneSet,
    options,
  );
}

/**
 * Temps passé dans les zones de puissance fournies. Une puissance nulle est
 * une mesure présente ; elle est classée par les bornes fournies.
 */
export function computePowerZoneTimes(
  samples: readonly PowerSample[],
  zoneSet: ZoneSet,
  options: ZoneTimeOptions,
): ZoneTimeResult {
  const rows = Array.isArray(samples) ? samples : [];
  return computeZoneTimesForMetric(
    'power',
    rows.map((sample) => ({ atMs: sample?.atMs, value: sample?.watts })),
    zoneSet,
    options,
  );
}

/**
 * Temps passé dans les zones d'allure fournies. La vitesse est convertie en
 * secondes par kilomètre ; une vitesse nulle est présente mais n'a pas
 * d'allure finie : elle reste hors zone, jamais rangée dans la zone basse.
 */
export function computePaceZoneTimes(
  samples: readonly SpeedSample[],
  zoneSet: ZoneSet,
  options: ZoneTimeOptions,
): ZoneTimeResult {
  const rows = Array.isArray(samples) ? samples : [];
  return computeZoneTimesForMetric(
    'pace',
    rows.map((sample) => ({ atMs: sample?.atMs, value: sample?.speedMps })),
    zoneSet,
    options,
  );
}

interface NormalizedEffortWeights {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly pointsPerHour: Readonly<Record<string, number>>;
}

function normalizeEffortWeights(weights: EffortWeights): NormalizedEffortWeights {
  const errors: string[] = [];
  if (!weights || typeof weights !== 'object') {
    return { valid: false, errors: ['weights_absent'], pointsPerHour: {} };
  }
  if (!isNonEmptyString(weights.id)) errors.push('weights_id');
  if (!isNonEmptyString(weights.version)) errors.push('weights_version');

  const pointsPerHour = Object.create(null) as Record<string, number>;
  const raw = weights.pointsPerHour;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push('weights_points');
  } else {
    for (const zoneId of Object.keys(raw)) {
      if (!isNonEmptyString(zoneId)) {
        errors.push('weights_zone_id');
        continue;
      }
      const value = raw[zoneId];
      if (!isFiniteNumber(value) || value < 0) {
        errors.push(`weights_${zoneId}_invalid`);
        continue;
      }
      pointsPerHour[zoneId] = value;
    }
    if (Object.keys(pointsPerHour).length === 0) errors.push('weights_empty');
  }

  return { valid: errors.length === 0, errors, pointsPerHour };
}

function unavailableRelativeEffort(input: {
  reason: RelativeEffortReason;
  diagnostics: readonly string[];
  config?: RelativeEffortConfig | null;
  source?: MetricSource | null;
  computedAtMs?: number | null;
  window?: ZoneTimeWindow;
  samples?: ZoneSampleCoverage;
  zones?: readonly RelativeEffortZone[];
  coverageRatio?: number;
}): RelativeEffortResult {
  return {
    status: 'unavailable',
    reason: input.reason,
    valueKind: 'estimated',
    method: 'zone-weighted-relative-effort/v1',
    score: null,
    unit: 'points',
    config: input.config ?? null,
    source: input.source ?? null,
    computedAtMs: input.computedAtMs ?? null,
    window: input.window ?? emptyWindow(),
    samples: input.samples ?? emptySamples(),
    zones: input.zones ?? [],
    coverageRatio: input.coverageRatio ?? 0,
    diagnostics: input.diagnostics,
  };
}

/**
 * Effort relatif cardio : somme du temps par zone multipliée par des points
 * par heure **fournis**, divisée par 3600. La méthode est versionnée et
 * distincte de la formule propriétaire de Strava ; elle n'est calculée que sur
 * des zones cardio et des pondérations complètes.
 */
export function computeRelativeEffort(
  zoneTimes: ZoneTimeResult,
  options: RelativeEffortOptions,
): RelativeEffortResult {
  if (!options || typeof options !== 'object' || !isFiniteNumber(options.computedAtMs)) {
    return unavailableRelativeEffort({
      reason: 'invalid_context',
      diagnostics: ['computed_at_invalid'],
    });
  }

  const normalizedWeights = normalizeEffortWeights(options.weights);
  if (!normalizedWeights.valid) {
    return unavailableRelativeEffort({
      reason: 'invalid_weights',
      diagnostics: normalizedWeights.errors,
      computedAtMs: options.computedAtMs,
      source: zoneTimes?.source ?? null,
      window: zoneTimes?.window,
      samples: zoneTimes?.samples,
    });
  }

  if (!zoneTimes || zoneTimes.status !== 'available') {
    return unavailableRelativeEffort({
      reason: zoneTimes?.reason ?? 'no_coverage',
      diagnostics: zoneTimes?.diagnostics ?? ['zone_times_absent'],
      config: null,
      source: zoneTimes?.source ?? null,
      computedAtMs: options.computedAtMs,
      window: zoneTimes?.window,
      samples: zoneTimes?.samples,
      coverageRatio: 0,
    });
  }

  const zoneConfigValue = zoneTimes.config;
  if (!zoneConfigValue || zoneConfigValue.metric !== 'heartRate') {
    return unavailableRelativeEffort({
      reason: 'not_heart_rate',
      diagnostics: ['heart_rate_zones_required'],
      source: zoneTimes.source,
      computedAtMs: options.computedAtMs,
      window: zoneTimes.window,
      samples: zoneTimes.samples,
      coverageRatio: 0,
    });
  }

  const weightByZone: Readonly<Record<string, number | undefined>> =
    normalizedWeights.pointsPerHour;
  const missingZones: string[] = [];
  const knownZones = new Set<string>();
  for (const zone of zoneTimes.zones) {
    knownZones.add(zone.zoneId);
    if (weightByZone[zone.zoneId] === undefined) missingZones.push(zone.zoneId);
  }
  if (missingZones.length > 0) {
    return unavailableRelativeEffort({
      reason: 'missing_zone_weight',
      diagnostics: missingZones.map((zoneId) => `missing_weight_${zoneId}`),
      source: zoneTimes.source,
      computedAtMs: options.computedAtMs,
      window: zoneTimes.window,
      samples: zoneTimes.samples,
      coverageRatio: 0,
    });
  }

  const diagnostics: string[] = [];
  for (const zoneId of Object.keys(normalizedWeights.pointsPerHour)) {
    if (!knownZones.has(zoneId)) diagnostics.push(`unknown_weight_${zoneId}`);
  }

  if (zoneTimes.window.inZoneS <= 0) {
    return unavailableRelativeEffort({
      reason: 'no_zone_time',
      diagnostics: [...diagnostics, 'no_zone_time'],
      source: zoneTimes.source,
      computedAtMs: options.computedAtMs,
      window: zoneTimes.window,
      samples: zoneTimes.samples,
      coverageRatio: 0,
    });
  }

  const zones: RelativeEffortZone[] = zoneTimes.zones.map((zone) => {
    const pointsPerHour = weightByZone[zone.zoneId] ?? 0;
    return {
      zoneId: zone.zoneId,
      label: zone.label,
      seconds: zone.seconds,
      pointsPerHour,
      points: (zone.seconds * pointsPerHour) / SECONDS_PER_HOUR,
      shareOfScore: 0,
    };
  });
  const score = zones.reduce((sum, zone) => sum + zone.points, 0);
  const withShares = zones.map((zone) => ({
    ...zone,
    shareOfScore: score > 0 ? zone.points / score : 0,
  }));
  const nonPausedS = Math.max(0, zoneTimes.window.durationS - zoneTimes.window.pausedS);
  const coverageRatio = nonPausedS > 0 ? zoneTimes.window.inZoneS / nonPausedS : 0;

  return {
    status: 'available',
    reason: null,
    valueKind: 'estimated',
    method: 'zone-weighted-relative-effort/v1',
    score,
    unit: 'points',
    config: {
      zoneSetId: zoneConfigValue.zoneSetId,
      zoneSetVersion: zoneConfigValue.zoneSetVersion,
      weightsId: options.weights.id,
      weightsVersion: options.weights.version,
      maxHoldMs: zoneConfigValue.maxHoldMs,
    },
    source: zoneTimes.source,
    computedAtMs: options.computedAtMs,
    window: zoneTimes.window,
    samples: zoneTimes.samples,
    zones: withShares,
    coverageRatio,
    diagnostics,
  };
}

function unavailablePerceivedEffort(input: {
  reason: PerceivedEffortReason;
  diagnostics: readonly string[];
  source?: MetricSource | null;
  computedAtMs?: number | null;
  recordedAtMs?: number | null;
  scale?: PerceivedEffortScale | null;
}): PerceivedEffortResult {
  return {
    status: 'unavailable',
    reason: input.reason,
    valueKind: 'declared',
    method: 'perceived-effort/v1',
    value: null,
    scale: input.scale ?? null,
    recordedAtMs: input.recordedAtMs ?? null,
    source: input.source ?? null,
    computedAtMs: input.computedAtMs ?? null,
    diagnostics: input.diagnostics,
  };
}

/**
 * Valide un effort perçu sur l'échelle fournie. Le module renvoie la valeur
 * déclarée et son échelle ; il ne fabrique ni score cardio ni équivalence
 * validée entre deux échelles différentes.
 */
export function normalizePerceivedEffort(
  input: PerceivedEffortInput,
  computedAtMs: number,
): PerceivedEffortResult {
  if (!isFiniteNumber(computedAtMs)) {
    return unavailablePerceivedEffort({
      reason: 'invalid_context',
      diagnostics: ['computed_at_invalid'],
    });
  }

  if (!input || typeof input !== 'object') {
    return unavailablePerceivedEffort({
      reason: 'invalid_value',
      diagnostics: ['effort_absent'],
      computedAtMs,
    });
  }

  const source = isValidSource(input.source) ? copySource(input.source) : null;
  if (!source) {
    return unavailablePerceivedEffort({
      reason: 'invalid_source',
      diagnostics: ['source_invalid'],
      computedAtMs,
    });
  }

  const scale = input.scale;
  if (
    !scale ||
    typeof scale !== 'object' ||
    !isFiniteNumber(scale.min) ||
    !isFiniteNumber(scale.max) ||
    scale.min >= scale.max
  ) {
    return unavailablePerceivedEffort({
      reason: 'invalid_scale',
      diagnostics: ['scale_invalid'],
      source,
      computedAtMs,
    });
  }

  if (!isFiniteNumber(input.recordedAtMs)) {
    return unavailablePerceivedEffort({
      reason: 'invalid_recorded_at',
      diagnostics: ['recorded_at_invalid'],
      source,
      computedAtMs,
      scale: { min: scale.min, max: scale.max, label: scale.label ?? null },
    });
  }

  if (!isFiniteNumber(input.value)) {
    return unavailablePerceivedEffort({
      reason: 'invalid_value',
      diagnostics: ['value_invalid'],
      source,
      computedAtMs,
      recordedAtMs: input.recordedAtMs,
      scale: { min: scale.min, max: scale.max, label: scale.label ?? null },
    });
  }

  if (input.value < scale.min || input.value > scale.max) {
    return unavailablePerceivedEffort({
      reason: 'value_out_of_scale',
      diagnostics: ['value_out_of_scale'],
      source,
      computedAtMs,
      recordedAtMs: input.recordedAtMs,
      scale: { min: scale.min, max: scale.max, label: scale.label ?? null },
    });
  }

  return {
    status: 'available',
    reason: null,
    valueKind: 'declared',
    method: 'perceived-effort/v1',
    value: input.value,
    scale: { min: scale.min, max: scale.max, label: scale.label ?? null },
    recordedAtMs: input.recordedAtMs,
    source,
    computedAtMs,
    diagnostics: [],
  };
}

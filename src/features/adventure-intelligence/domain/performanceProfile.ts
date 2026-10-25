/**
 * A3 — Profil Terrain appris (moteur pur).
 *
 * Construit un `PerformanceProfile` à partir d'observations GPS dérivées
 * (Phase 2) + déclaratif, sans aucune donnée de santé connectée :
 * médiane pondérée (récence × qualité), rejet d'anomalies MAD, calibrations
 * séparées plat / montée / descente, courbe de fatigue, modèle de pauses,
 * réponse au portage et niveaux de calibration.
 *
 * Aucune I/O : uniquement des nombres et des chaînes. La persistance est
 * laissée à `server/buildUserProfile.ts`.
 */
import { clamp01, makeConfidence, type Confidence } from './confidence';
import type {
  CalibrationLevel,
  FatigueCurve,
  PauseModel,
  PerformanceProfile,
  ResponseCurve,
} from '../schemas/performance.schema';

export interface ProfileObservation {
  observedAt: string;
  distanceM: number;
  durationS: number;
  movingS?: number | null;
  gainM?: number | null;
  lossM?: number | null;
  meanGradePct?: number | null;
  surface?: string | null;
  packWeightKg?: number | null;
  quality?: number | null;
  declaredFatigue?: number | null;
  perceivedDifficulty?: number | null;
}

export interface BuildProfileOptions {
  now?: string;
  halfLifeDays?: number;
  minQuality?: number;
}

/**
 * Profil appris sans `userId` : le moteur pur ne connaît pas l'utilisateur.
 * `server/buildUserProfile.ts` ajoute l'identité avant persistance (la forme
 * persistée reste celle du schéma A1 `PerformanceProfile`).
 */
export type LearnedPerformanceProfile = Omit<PerformanceProfile, 'userId'> & {
  personalized: boolean;
};

/** Seuils normatifs des niveaux de calibration (spec Phase 3). */
export const CALIBRATION_THRESHOLDS = {
  calibration: 3,
  personalization: 10,
  contextualization: 20,
} as const;

/** Version de modèle persistée (idempotence de `buildUserProfile`). */
export const PERFORMANCE_PROFILE_MODEL_VERSION = 'a3-v1';

export const DEFAULT_HALF_LIFE_DAYS = 90;
export const DEFAULT_MIN_QUALITY = 0.5;

/** Borne d'un nombre dans [min, max] ; non fini ⇒ min. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Vitesses neutres de repli (standards randonnée) quand une catégorie est vide. */
const FALLBACK_FLAT_SPEED_KMH = 4;
const FALLBACK_ASCENT_SPEED_M_PER_HOUR = 300;
const FALLBACK_DESCENT_SPEED_M_PER_HOUR = 500;

/** Bornes de pente (%) : [-3, 3] = plat, > 3 = montée, < -3 = descente. */
const FLAT_GRADE_BOUND_PCT = 3;

/** Médiane pondérée ; ignore poids nuls/négatifs et valeurs non finies. */
export function weightedMedian(entries: { value: number; weight: number }[]): number | null {
  const valid = entries.filter(
    (entry) => Number.isFinite(entry.value) && Number.isFinite(entry.weight) && entry.weight > 0
  );
  if (valid.length === 0) return null;

  const sorted = [...valid].sort((a, b) => a.value - b.value);
  const totalWeight = sorted.reduce((sum, entry) => sum + entry.weight, 0);
  if (!(totalWeight > 0)) return null;

  const half = totalWeight / 2;
  let cumulative = 0;
  for (const entry of sorted) {
    cumulative += entry.weight;
    if (cumulative >= half) return entry.value;
  }
  return sorted[sorted.length - 1]?.value ?? null;
}

/**
 * Rejette les anomalies par MAD (score z modifié standard 0.6745 · |x − médiane| / MAD).
 * Si MAD = 0, seules les valeurs strictement égales à la médiane sont conservées.
 */
export function rejectOutliersMAD(
  entries: { value: number; weight: number }[],
  threshold = 3.5
): { value: number; weight: number }[] {
  const valid = entries.filter(
    (entry) => Number.isFinite(entry.value) && Number.isFinite(entry.weight) && entry.weight > 0
  );
  if (valid.length < 3) return valid;

  const median = weightedMedian(valid);
  if (median === null) return [];

  const mad = weightedMedian(
    valid.map((entry) => ({ value: Math.abs(entry.value - median), weight: entry.weight }))
  );
  if (mad === null || mad === 0) {
    return valid.filter((entry) => entry.value === median);
  }

  // Score z modifié standard : 0.6745 · |x − médiane| / MAD.
  return valid.filter((entry) => (0.6745 * Math.abs(entry.value - median)) / mad <= threshold);
}

type TerrainClass = 'flat' | 'ascent' | 'descent';

interface ExploitableObservation {
  observation: ProfileObservation;
  weight: number;
  movingS: number;
  speedKmH: number;
  gradePct: number;
  terrain: TerrainClass;
}

interface WeightedValue {
  value: number;
  weight: number;
}

function medianOrFallback(entries: WeightedValue[], fallback: number): number {
  const median = weightedMedian(rejectOutliersMAD(entries));
  if (median === null || !Number.isFinite(median)) return fallback;
  return median;
}

function toExploitable(observation: ProfileObservation, options: Required<BuildProfileOptions>): ExploitableObservation | null {
  if (!Number.isFinite(observation.distanceM) || observation.distanceM <= 0) return null;
  if (!Number.isFinite(observation.durationS) || observation.durationS <= 0) return null;

  const movingS =
    observation.movingS != null && Number.isFinite(observation.movingS) && observation.movingS > 0
      ? observation.movingS
      : observation.durationS;

  const quality = Number.isFinite(observation.quality ?? Number.NaN)
    ? (observation.quality as number)
    : 0.5;
  if (quality < options.minQuality) return null;

  const referenceMs = Date.parse(options.now);
  const observedMs = Date.parse(observation.observedAt);
  const ageDays =
    Number.isFinite(referenceMs) && Number.isFinite(observedMs)
      ? Math.max(0, (referenceMs - observedMs) / 86400000)
      : 0;
  const recency =
    Number.isFinite(options.halfLifeDays) && options.halfLifeDays > 0
      ? Math.pow(0.5, ageDays / options.halfLifeDays)
      : 1;
  const weight = recency * quality;
  if (!(weight > 0)) return null;

  const gainM = Number.isFinite(observation.gainM ?? Number.NaN)
    ? Math.max(0, observation.gainM as number)
    : null;
  const lossM = Number.isFinite(observation.lossM ?? Number.NaN)
    ? Math.max(0, observation.lossM as number)
    : null;

  const gradePct = Number.isFinite(observation.meanGradePct ?? Number.NaN)
    ? (observation.meanGradePct as number)
    : gainM !== null || lossM !== null
      ? ((gainM ?? 0) - (lossM ?? 0)) / observation.distanceM * 100
      : 0;

  const terrain: TerrainClass =
    gradePct > FLAT_GRADE_BOUND_PCT
      ? 'ascent'
      : gradePct < -FLAT_GRADE_BOUND_PCT
        ? 'descent'
        : 'flat';

  const speedKmH = (observation.distanceM / movingS) * 3.6;

  return { observation, weight, movingS, speedKmH, gradePct, terrain };
}

/** Courbe de vitesse relative en fonction de la pente (x = % de pente). */
function buildGradeResponse(
  flatSpeedKmH: number,
  exploitable: ExploitableObservation[]
): ResponseCurve {
  const points: { x: number; value: number }[] = [{ x: 0, value: 1 }];
  const reference = flatSpeedKmH > 0 ? flatSpeedKmH : FALLBACK_FLAT_SPEED_KMH;

  for (const terrain of ['ascent', 'descent'] as const) {
    const bucket = exploitable.filter((entry) => entry.terrain === terrain);
    if (bucket.length === 0) continue;
    const grade = weightedMedian(bucket.map((entry) => ({ value: entry.gradePct, weight: entry.weight })));
    const speed = weightedMedian(bucket.map((entry) => ({ value: entry.speedKmH, weight: entry.weight })));
    if (grade === null || speed === null) continue;
    points.push({ x: Number(grade.toFixed(2)), value: Number((speed / reference).toFixed(4)) });
  }

  return { points: points.sort((a, b) => a.x - b.x), interpolate: 'linear' };
}

/** Indice ordinal de rugosité de surface (0 = lisse, 4 = très accidenté). */
function surfaceRoughness(surface: string): number {
  const key = surface.toLowerCase();
  if (key.includes('pav') || key.includes('asphalt') || key.includes('concrete')) return 0;
  if (key.includes('gravel') || key.includes('path') || key.includes('foot')) return 1;
  if (key.includes('ground') || key.includes('dirt') || key.includes('earth')) return 1.5;
  if (key.includes('grass')) return 2;
  if (key.includes('sand')) return 2.5;
  if (key.includes('rock') || key.includes('scree') || key.includes('stone')) return 3;
  if (key.includes('snow')) return 4;
  return 1;
}

/** Courbe de vitesse relative par rugosité de surface (données déclarées). */
function buildSurfaceResponse(
  flatSpeedKmH: number,
  exploitable: ExploitableObservation[]
): ResponseCurve {
  const reference = flatSpeedKmH > 0 ? flatSpeedKmH : FALLBACK_FLAT_SPEED_KMH;
  const byRoughness = new Map<number, WeightedValue[]>();

  for (const entry of exploitable) {
    const surface = entry.observation.surface;
    if (surface == null || surface.trim() === '') continue;
    const roughness = surfaceRoughness(surface);
    const bucket = byRoughness.get(roughness) ?? [];
    bucket.push({ value: entry.speedKmH, weight: entry.weight });
    byRoughness.set(roughness, bucket);
  }

  if (byRoughness.size === 0) return { points: [{ x: 0, value: 1 }], interpolate: 'linear' };

  const points = [...byRoughness.entries()]
    .map(([roughness, bucket]) => {
      const speed = weightedMedian(bucket) ?? reference;
      return { x: roughness, value: Number(clamp(speed / reference, 0, 2).toFixed(4)) };
    })
    .sort((a, b) => a.x - b.x);

  return { points, interpolate: 'linear' };
}

/** Décroissance exponentielle horaire estimée sur les vitesses observées. */
function buildFatigueCurve(exploitable: ExploitableObservation[]): FatigueCurve {
  const usable = exploitable.filter((entry) => entry.observation.durationS > 0 && entry.speedKmH > 0);
  if (usable.length < 5) {
    return { points: [{ x: 0, value: 1 }], decayPerHour: 0 };
  }

  const hours = usable.map((entry) => entry.observation.durationS / 3600);
  const logSpeeds = usable.map((entry) => Math.log(entry.speedKmH));
  const meanX = hours.reduce((sum, value) => sum + value, 0) / hours.length;
  const meanY = logSpeeds.reduce((sum, value) => sum + value, 0) / logSpeeds.length;
  let covariance = 0;
  let variance = 0;
  for (let index = 0; index < hours.length; index += 1) {
    covariance += (hours[index] - meanX) * (logSpeeds[index] - meanY);
    variance += (hours[index] - meanX) ** 2;
  }

  const slope = variance > 0 ? covariance / variance : 0;
  const decayPerHour = clamp(-slope, 0, 0.2);
  const points = Array.from({ length: 7 }, (_, hour) => ({
    x: hour,
    value: Number(Math.exp(-decayPerHour * hour).toFixed(4)),
  }));

  return { points, decayPerHour: Number(decayPerHour.toFixed(4)) };
}

/** Pauses médianes (minutes par heure active) observées sur durationS − movingS. */
function buildPauseModel(exploitable: ExploitableObservation[]): PauseModel {
  const entries = exploitable
    .filter((entry) => entry.observation.durationS > 0)
    .map((entry) => {
      const stoppedS = Math.max(0, entry.observation.durationS - entry.movingS);
      const hours = entry.observation.durationS / 3600;
      return { value: stoppedS / 60 / hours, weight: entry.weight };
    });

  const pauseMinutesPerHour = medianOrFallback(entries, 0);
  return {
    pauseMinutesPerHour: Number(clamp(pauseMinutesPerHour, 0, 240).toFixed(2)),
    pauseMinutesPerAscentM: 0,
    minPauseMinutes: 0,
  };
}

/** Régression linéaire vitesse ~ poids déclaré (≥ 5 points) sinon neutre. */
function buildPackResponse(exploitable: ExploitableObservation[]): ResponseCurve {
  const entries = exploitable.filter(
    (entry) =>
      entry.observation.packWeightKg != null &&
      Number.isFinite(entry.observation.packWeightKg) &&
      (entry.observation.packWeightKg as number) > 0
  );

  if (entries.length >= 5) {
    const weights = entries.map((entry) => entry.observation.packWeightKg as number);
    const speeds = entries.map((entry) => entry.speedKmH);
    const meanWeight = weights.reduce((sum, value) => sum + value, 0) / weights.length;
    const meanSpeed = speeds.reduce((sum, value) => sum + value, 0) / speeds.length;

    let covariance = 0;
    let variance = 0;
    for (let index = 0; index < weights.length; index += 1) {
      covariance += (weights[index] - meanWeight) * (speeds[index] - meanSpeed);
      variance += (weights[index] - meanWeight) ** 2;
    }

    const slope = variance > 0 ? covariance / variance : 0;
    const intercept = meanSpeed - slope * meanWeight;

    if (intercept > 0 && slope < 0) {
      const points = [0, 5, 10, 15, 20].map((x) => ({
        x,
        value: Number(clamp((intercept + slope * x) / intercept, 0, 2).toFixed(4)),
      }));
      return { points, interpolate: 'linear' };
    }
  }

  return { points: [{ x: 0, value: 1 }], interpolate: 'linear' };
}

/** Calibration : froide sous 3, calibration < 10, personnalisation ≤ 20, contextuelle > 20 diversifiée. */
function calibrationLevelFor(sampleCount: number, diversified: boolean): CalibrationLevel {
  if (sampleCount < CALIBRATION_THRESHOLDS.calibration) return 'cold';
  if (sampleCount < CALIBRATION_THRESHOLDS.personalization) return 'calibration';
  if (sampleCount > CALIBRATION_THRESHOLDS.contextualization && diversified) {
    return 'contextualization';
  }
  return 'personalization';
}

/** Confiance = couverture d'échantillon × pénalité de dispersion (plafond 0.95). */
function confidenceFor(exploitable: ExploitableObservation[], sampleCount: number): Confidence {
  if (sampleCount < CALIBRATION_THRESHOLDS.calibration) {
    return makeConfidence({ score: 0, sampleCount, method: 'weighted_median_a3' });
  }

  const flatSpeeds = exploitable
    .filter((entry) => entry.terrain === 'flat')
    .map((entry) => ({ value: entry.speedKmH, weight: entry.weight }));
  const samples = flatSpeeds.length >= 2 ? flatSpeeds : exploitable.map((entry) => ({
    value: entry.speedKmH,
    weight: entry.weight,
  }));

  const medianSpeed = weightedMedian(samples);
  const totalWeight = samples.reduce((sum, entry) => sum + entry.weight, 0);
  const meanAbsoluteDeviation =
    medianSpeed !== null && totalWeight > 0
      ? samples.reduce((sum, entry) => sum + entry.weight * Math.abs(entry.value - medianSpeed), 0) /
        totalWeight
      : 0;
  const relativeDispersion =
    medianSpeed !== null && medianSpeed > 0 ? meanAbsoluteDeviation / medianSpeed : 0;

  const sampleScore = Math.min(1, sampleCount / CALIBRATION_THRESHOLDS.contextualization);
  const score = Math.min(0.95, sampleScore * (1 - 0.7 * clamp01(relativeDispersion)));

  return makeConfidence({ score, sampleCount, method: 'weighted_median_a3' });
}

/**
 * Construit le profil appris à partir d'observations terrain.
 * Moins de 3 observations exploitables ⇒ profil froid explicitement non personnalisé.
 */
export function buildPerformanceProfile(
  observations: ProfileObservation[],
  options: BuildProfileOptions = {}
): LearnedPerformanceProfile {
  const resolvedOptions: Required<BuildProfileOptions> = {
    now: options.now ?? new Date().toISOString(),
    halfLifeDays: options.halfLifeDays ?? DEFAULT_HALF_LIFE_DAYS,
    minQuality: options.minQuality ?? DEFAULT_MIN_QUALITY,
  };

  const exploitable = observations
    .map((observation) => toExploitable(observation, resolvedOptions))
    .filter((entry): entry is ExploitableObservation => entry !== null);

  const flatEntries = exploitable
    .filter((entry) => entry.terrain === 'flat')
    .map((entry) => ({ value: entry.speedKmH, weight: entry.weight }));
  const ascentEntries = exploitable
    .filter((entry) => entry.terrain === 'ascent' && (entry.observation.gainM ?? 0) > 0)
    .map((entry) => ({
      value: ((entry.observation.gainM as number) / entry.movingS) * 3600,
      weight: entry.weight,
    }));
  const descentEntries = exploitable
    .filter((entry) => entry.terrain === 'descent' && (entry.observation.lossM ?? 0) > 0)
    .map((entry) => ({
      value: ((entry.observation.lossM as number) / entry.movingS) * 3600,
      weight: entry.weight,
    }));

  const flatSpeedKmH = medianOrFallback(flatEntries, FALLBACK_FLAT_SPEED_KMH);
  const ascentSpeedMPerHour = medianOrFallback(ascentEntries, FALLBACK_ASCENT_SPEED_M_PER_HOUR);
  const descentSpeedMPerHour = medianOrFallback(descentEntries, FALLBACK_DESCENT_SPEED_M_PER_HOUR);

  const sampleCount = exploitable.length;
  const distinctTerrains = new Set(exploitable.map((entry) => entry.terrain));
  const distinctSurfaces = new Set(
    exploitable.map((entry) => entry.observation.surface).filter((surface): surface is string => Boolean(surface))
  );
  const diversified = distinctTerrains.size >= 2 || distinctSurfaces.size >= 2;
  const calibrationLevel = calibrationLevelFor(sampleCount, diversified);

  return {
    activityType: 'hiking',
    flatSpeedKmH,
    ascentSpeedMPerHour,
    descentSpeedMPerHour,
    gradeResponse: buildGradeResponse(flatSpeedKmH, exploitable),
    surfaceResponse: buildSurfaceResponse(flatSpeedKmH, exploitable),
    fatigueCurve: buildFatigueCurve(exploitable),
    pauseModel: buildPauseModel(exploitable),
    packResponse: buildPackResponse(exploitable),
    confidence: confidenceFor(exploitable, sampleCount),
    sampleCount,
    calibrationLevel,
    modelVersion: PERFORMANCE_PROFILE_MODEL_VERSION,
    computedAt: resolvedOptions.now,
    personalized: calibrationLevel !== 'cold',
  };
}

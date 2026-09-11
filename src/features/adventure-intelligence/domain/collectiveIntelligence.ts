/**
 * A4 — Intelligence collective des sentiers (moteur pur).
 *
 * Fusionne les passages de plusieurs utilisateurs en difficulté collective
 * par segment, **normalisée par personne** : jamais de moyenne de vitesses
 * brutes, uniquement un ratio observé/attendu (profil A3). Agrégation
 * robuste : médiane pondérée (qualité × récence), rejet d'anomalies MAD,
 * percentiles, scores bornés et seuils de publication stricts.
 *
 * Aucune I/O : uniquement des nombres et des chaînes. La construction des
 * passages et la persistance appartiennent à `server/aggregateSegments.ts`.
 */
import { clamp01, makeConfidence, type Confidence } from './confidence';
import { weightedMedian } from './performanceProfile';
import type { ConditionBucket } from '../schemas/live.schema';

export { weightedMedian } from './performanceProfile';

/** Version de traitement persistée (idempotence de l'agrégation). */
export const A4_PROCESSOR_VERSION = 'a4-v1';

/** Méthode de confiance normative des agrégats collectifs. */
export const COLLECTIVE_CONFIDENCE_METHOD = 'collective_weighted_median_a4';

/** Plancher de publication : nombre d'utilisateurs distincts. */
export const MIN_DISTINCT_USERS = 5;
/** Confiance minimale de publication. */
export const MIN_PUBLISH_CONFIDENCE = 0.5;
/** Âge maximal d'une agrégation publiable (2 ans). */
export const MAX_AGGREGATE_AGE_DAYS = 730;
/** Âge maximal d'une observation intégrée à l'agrégation (2 ans). */
export const MAX_OBSERVATION_AGE_DAYS = 730;
/** Demi-vie de récence des passages (jours). */
export const DEFAULT_HALF_LIFE_DAYS = 180;
/** Seuil du score z modifié pour le rejet d'anomalies. */
export const MAD_THRESHOLD = 3.5;
/** Bornes de winsorisation du ratio de ralentissement. */
export const WINSORIZE_BOUNDS: readonly [number, number] = [0.25, 4];
/** Poids de sac (kg) à partir duquel le sac est considéré lourd. */
export const HEAVY_PACK_KG = 8;

/** Combinaison pondérée de la difficulté collective (spec A4). */
export const COLLECTIVE_DIFFICULTY_WEIGHTS = {
  effort: 0.4,
  technical: 0.25,
  fatigue: 0.2,
  orientation: 0.15,
} as const;

export interface CollectivePassage {
  passageId: string;
  userIdHash: string;
  segmentId: number;
  direction: 'forward' | 'reverse';
  observedDurationS: number;
  expectedDurationS: number;
  quality: number;
  observedAt: string;
  conditionBucket: ConditionBucket;
  uturnDetected: boolean;
  offRoute: boolean;
}

export interface CollectiveAggregate {
  segmentId: number;
  conditionBucket: ConditionBucket;
  direction: 'forward' | 'reverse';
  passageCount: number;
  distinctUserCount: number;
  weightedMedianSlowdown: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  effortScore: number;
  technicalScore: number;
  fatigueScore: number;
  orientationScore: number;
  slowdownScore: number;
  collectiveDifficulty: number;
  confidence: Confidence;
}

export interface AggregateOptions {
  /** Instant de référence (récence, `computedAt`) — défaut : maintenant. */
  now?: string;
  halfLifeDays?: number;
  madThreshold?: number;
  winsorize?: readonly [number, number];
}

export interface PublishableOptions {
  now?: string;
  minDistinctUsers?: number;
  minConfidence?: number;
  maxAgeDays?: number;
  /** Dernière observation connue ; sinon `computedAt` sert de référence. */
  lastObservedAt?: string;
}

export interface WeightedValue {
  value: number;
  weight: number;
}

export interface AnomalyDetection<T extends WeightedValue = WeightedValue> {
  kept: T[];
  rejected: T[];
}

/** Borne un nombre dans [min, max] ; non fini ⇒ min. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Arrondit à 4 décimales pour des sorties stables entre exécutions. */
function round4(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10000) / 10000;
}

/**
 * Ratio de ralentissement observé/attendu. Toute durée attendue absente ou
 * non positive retombe sur un ratio neutre de 1 (jamais de division folle).
 */
export function normalizedSlowdown(observedDurationS: number, expectedDurationS: number): number {
  if (!Number.isFinite(observedDurationS) || observedDurationS <= 0) return 1;
  if (!Number.isFinite(expectedDurationS) || expectedDurationS <= 0) return 1;
  return observedDurationS / expectedDurationS;
}

/** Percentile interpolé (p ∈ [0,1]) d'une série non pondérée. */
export function percentile(values: number[], p: number): number | null {
  const valid = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];

  const bounded = clamp(Number.isFinite(p) ? p : 0, 0, 1);
  const rank = bounded * (valid.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return valid[lower];
  const fraction = rank - lower;
  return valid[lower] + (valid[upper] - valid[lower]) * fraction;
}

/**
 * Rejette les anomalies par MAD (score z modifié 0.6745 · |x − médiane| / MAD).
 * Moins de 3 entrées valides ⇒ tout est conservé ; MAD = 0 ⇒ seules les valeurs
 * strictement égales à la médiane sont conservées.
 */
export function detectAnomalies<T extends WeightedValue>(
  values: T[],
  madThreshold = MAD_THRESHOLD
): AnomalyDetection<T> {
  const threshold =
    Number.isFinite(madThreshold) && madThreshold >= 0 ? madThreshold : MAD_THRESHOLD;
  const valid: T[] = [];
  const rejected: T[] = [];

  for (const entry of values) {
    if (Number.isFinite(entry.value) && Number.isFinite(entry.weight) && entry.weight > 0) {
      valid.push(entry);
    } else {
      rejected.push(entry);
    }
  }

  if (valid.length < 3) {
    return { kept: [...valid], rejected };
  }

  const median = weightedMedian(valid);
  if (median === null) {
    return { kept: [], rejected: [...rejected, ...valid] };
  }

  const mad = weightedMedian(
    valid.map((entry) => ({ value: Math.abs(entry.value - median), weight: entry.weight }))
  );

  if (mad === null || mad === 0) {
    const kept = valid.filter((entry) => entry.value === median);
    const dropped = valid.filter((entry) => entry.value !== median);
    return { kept, rejected: [...rejected, ...dropped] };
  }

  const kept: T[] = [];
  for (const entry of valid) {
    if ((0.6745 * Math.abs(entry.value - median)) / mad <= threshold) {
      kept.push(entry);
    } else {
      rejected.push(entry);
    }
  }
  return { kept, rejected };
}

export interface ConditionBucketInput {
  surface?: string | null;
  weather?: string | null;
  isNight?: boolean | null;
  isAscent?: boolean | null;
  packWeightKg?: number | null;
}

const ICE_HINTS = ['ice', 'glace', 'verglas'];
const SNOW_HINTS = ['snow', 'neige'];
const WET_HINTS = ['wet', 'humide', 'rain', 'pluie', 'mud', 'boue', 'water', 'flood'];

function matchesHint(text: string | null | undefined, hints: string[]): boolean {
  const normalized = (text ?? '').trim().toLowerCase();
  if (normalized === '') return false;
  return hints.some((hint) => normalized.includes(hint));
}

/**
 * Bucket de conditions dominant d'un passage. Une seule dimension est
 * retenue : la plus contraignante (glace > neige > humide > nuit >
 * montée > descente > sac lourd > sac léger > sec).
 */
export function assignConditionBucket(input: ConditionBucketInput): ConditionBucket {
  const { surface, weather } = input;
  if (matchesHint(surface, ICE_HINTS) || matchesHint(weather, ICE_HINTS)) return 'ice';
  if (matchesHint(surface, SNOW_HINTS) || matchesHint(weather, SNOW_HINTS)) return 'snow';
  if (matchesHint(surface, WET_HINTS) || matchesHint(weather, WET_HINTS)) return 'wet';
  if (input.isNight === true) return 'night';
  if (input.isAscent === true) return 'ascent';
  if (input.isAscent === false) return 'descent';

  const packWeight = input.packWeightKg;
  if (packWeight != null && Number.isFinite(packWeight)) {
    if (packWeight >= HEAVY_PACK_KG) return 'heavy_pack';
    if (packWeight > 0) return 'light_pack';
  }
  return 'dry';
}

interface ExploitedPassage extends WeightedValue {
  passage: CollectivePassage;
  ageDays: number;
  slowdown: number;
  late: boolean;
}

function groupKey(passage: CollectivePassage): string {
  return `${passage.segmentId}::${passage.conditionBucket}::${passage.direction}`;
}

function toExploitedPassage(
  passage: CollectivePassage,
  nowMs: number,
  halfLifeDays: number,
  bounds: readonly [number, number]
): ExploitedPassage | null {
  if (!Number.isFinite(passage.observedDurationS) || passage.observedDurationS <= 0) return null;

  const observedMs = Date.parse(passage.observedAt);
  const ageDays = Number.isFinite(observedMs) ? Math.max(0, (nowMs - observedMs) / 86400000) : 0;
  if (ageDays > MAX_OBSERVATION_AGE_DAYS) return null;

  const recency =
    Number.isFinite(halfLifeDays) && halfLifeDays > 0
      ? Math.pow(0.5, ageDays / halfLifeDays)
      : 1;
  const weight = clamp01(passage.quality) * recency;
  if (!(weight > 0)) return null;

  const winsorized = clamp(
    normalizedSlowdown(passage.observedDurationS, passage.expectedDurationS),
    bounds[0],
    bounds[1]
  );
  const observedDate = new Date(observedMs);
  const late = Number.isFinite(observedMs) && observedDate.getUTCHours() >= 18;

  return { value: winsorized, weight, passage, ageDays, slowdown: winsorized, late };
}

function weightedMean(entries: WeightedValue[]): number {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!(total > 0)) return 0;
  return entries.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / total;
}

function weightedVariance(entries: WeightedValue[], mean: number): number {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!(total > 0)) return 0;
  return entries.reduce((sum, entry) => sum + entry.weight * (entry.value - mean) ** 2, 0) / total;
}

function weightedShare(entries: ExploitedPassage[], predicate: (entry: ExploitedPassage) => boolean): number {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!(total > 0)) return 0;
  const selected = entries.reduce(
    (sum, entry) => sum + (predicate(entry) ? entry.weight : 0),
    0
  );
  return selected / total;
}

/**
 * Agrège les passages collectifs par `(segment, bucket, sens)`.
 *
 * La difficulté est calculée sur le ratio normalisé par personne, pondéré par
 * qualité × récence, après winsorisation et rejet des anomalies MAD. Les
 * agrégats sont rendus triés (segment, bucket, sens) pour être déterministes.
 * Le filtre de publication n'est pas appliqué ici : il appartient au serveur.
 */
export function aggregateCollective(
  passages: CollectivePassage[],
  options: AggregateOptions = {}
): CollectiveAggregate[] {
  const nowIso = options.now ?? new Date().toISOString();
  const parsedNow = Date.parse(nowIso);
  const nowMs = Number.isFinite(parsedNow) ? parsedNow : Date.now();
  const halfLifeDays = options.halfLifeDays ?? DEFAULT_HALF_LIFE_DAYS;
  const madThreshold = options.madThreshold ?? MAD_THRESHOLD;
  const bounds: readonly [number, number] = options.winsorize ?? WINSORIZE_BOUNDS;

  const groups = new Map<string, ExploitedPassage[]>();
  for (const passage of passages) {
    const exploited = toExploitedPassage(passage, nowMs, halfLifeDays, bounds);
    if (exploited === null) continue;
    const key = groupKey(passage);
    const bucket = groups.get(key);
    if (bucket) bucket.push(exploited);
    else groups.set(key, [exploited]);
  }

  const aggregates: CollectiveAggregate[] = [];

  for (const group of groups.values()) {
    const { kept } = detectAnomalies(group, madThreshold);
    if (kept.length === 0) continue;

    const slowdowns = kept.map((entry) => entry.value);
    const median = weightedMedian(kept) ?? 1;
    const p25 = percentile(slowdowns, 0.25) ?? median;
    const p50 = percentile(slowdowns, 0.5) ?? median;
    const p75 = percentile(slowdowns, 0.75) ?? median;
    const p90 = percentile(slowdowns, 0.9) ?? median;

    const mean = weightedMean(kept);
    const variance = weightedVariance(kept, mean);
    const relativeDispersion = median > 0 ? Math.sqrt(variance) / median : 0;

    const passageCount = kept.length;
    const distinctUserCount = new Set(kept.map((entry) => entry.passage.userIdHash)).size;

    const uturnShare = weightedShare(kept, (entry) => entry.passage.uturnDetected);
    const offRouteShare = weightedShare(kept, (entry) => entry.passage.offRoute);
    const lateSlowShare = weightedShare(kept, (entry) => entry.late && entry.slowdown > 1);

    const slowdownScore = clamp((median - 1) * 50 + 50, 0, 100);
    const effortScore = clamp(slowdownScore + Math.min(20, variance * 20), 0, 100);
    const technicalScore = clamp(
      uturnShare * 40 + offRouteShare * 40 + Math.min(20, variance * 20),
      0,
      100
    );
    const fatigueScore = clamp(lateSlowShare * 100, 0, 100);
    const orientationScore = clamp(offRouteShare * 100, 0, 100);
    const collectiveDifficulty = clamp(
      effortScore * COLLECTIVE_DIFFICULTY_WEIGHTS.effort +
        technicalScore * COLLECTIVE_DIFFICULTY_WEIGHTS.technical +
        fatigueScore * COLLECTIVE_DIFFICULTY_WEIGHTS.fatigue +
        orientationScore * COLLECTIVE_DIFFICULTY_WEIGHTS.orientation,
      0,
      100
    );

    const userScore = Math.min(1, distinctUserCount / MIN_DISTINCT_USERS);
    const sampleScore = Math.min(1, passageCount / 15);
    const agreement = 1 - clamp01(relativeDispersion);
    const confidence = makeConfidence({
      score: 0.5 * userScore + 0.3 * sampleScore + 0.2 * agreement,
      sampleCount: passageCount,
      method: COLLECTIVE_CONFIDENCE_METHOD,
    });

    const sample = kept[0].passage;
    aggregates.push({
      segmentId: sample.segmentId,
      conditionBucket: sample.conditionBucket,
      direction: sample.direction,
      passageCount,
      distinctUserCount,
      weightedMedianSlowdown: round4(median),
      p25: round4(p25),
      p50: round4(p50),
      p75: round4(p75),
      p90: round4(p90),
      effortScore: round4(effortScore),
      technicalScore: round4(technicalScore),
      fatigueScore: round4(fatigueScore),
      orientationScore: round4(orientationScore),
      slowdownScore: round4(slowdownScore),
      collectiveDifficulty: round4(collectiveDifficulty),
      confidence,
    });
  }

  aggregates.sort((a, b) => {
    if (a.segmentId !== b.segmentId) return a.segmentId - b.segmentId;
    if (a.conditionBucket !== b.conditionBucket) {
      return a.conditionBucket < b.conditionBucket ? -1 : 1;
    }
    return a.direction < b.direction ? -1 : a.direction > b.direction ? 1 : 0;
  });

  return aggregates;
}

/**
 * Seuil de publication : ≥ 5 utilisateurs distincts, confiance ≥ 0.5 et
 * agrégation (ou dernière observation) vieille de moins de 730 jours.
 */
export function isPublishable(
  aggregate: { distinctUserCount: number; confidence: Confidence; computedAt: string },
  options: PublishableOptions = {}
): boolean {
  const minDistinctUsers = options.minDistinctUsers ?? MIN_DISTINCT_USERS;
  if (aggregate.distinctUserCount < minDistinctUsers) return false;

  const minConfidence = options.minConfidence ?? MIN_PUBLISH_CONFIDENCE;
  if (clamp01(aggregate.confidence.score) < minConfidence) return false;

  const reference = Date.parse(options.lastObservedAt ?? aggregate.computedAt);
  const now = Date.parse(options.now ?? new Date().toISOString());
  if (!Number.isFinite(reference) || !Number.isFinite(now)) return false;

  const maxAgeDays = options.maxAgeDays ?? MAX_AGGREGATE_AGE_DAYS;
  return (now - reference) / 86400000 <= maxAgeDays;
}

/**
 * Orchestrateur pur d'analyse experte post-sortie (6 sous-volets Liquid Glass).
 *
 * Zéro duplication mathématique : agrège exclusivement les moteurs scientifiques
 * et télémétriques existants du dépôt, 100 % client-safe, offline-first, 0 €.
 *
 * Invariants :
 *  - C-MET (honnêteté métrique) : chaque grandeur distingue explicitement
 *    `measured` (Mesurée), `estimated` (Estimée) ou `unavailable` (Non captée).
 *  - Charge canonique unique : `computeSessionLoadUnits()` (hiérarchie 4 niveaux),
 *    accompagnée des libellés exacts Foster AU et Banister TRIMP dans le volet Physio.
 *  - Domaine LCDA : `computeEffortScore()` est strictement validé pour les vitesses
 *    pédestres (1,6 – 7,1 km/h). Hors domaine, un badge explicite signale la limite
 *    sans forcer un score factice.
 *  - Conformité RGPD Art. 9 : `buildAiActivityInsightPayload()` bloque strictement
 *    le pont IA sur les profils santé sensibles ou sources Strava.
 */

import {
  EFFORT_SCORE_VERSION,
  IEA_REFERENCE_WEIGHT_KG,
  buildFallbackSegmentsFromPositionsTimed,
  computeEffortScore,
  type EffortScoreComputedOutput,
} from '@/features/adventure-intelligence/domain/effortScore';
import { computeFatigue, type FatigueResult } from '@/features/adventure-intelligence/domain/fatigue';
import {
  computeRouteDifficulty,
  estimateSortiePerformance,
  type SortiePerformanceEstimate,
} from '@/features/community/v2/create/sortie/sortiePerformanceEngine';
import {
  findComparableOutings,
  type ComparableOutingEntry,
} from '@/features/compte/progression/comparableOutings';
import {
  detectOutingHighlights,
  type SessionHighlight,
} from '@/features/compte/progression/declaredRecords';
import type { ProgressionSession } from '@/features/compte/progression/engine';
import {
  computeRacePredictions,
  extractCleanRunningBestEffortsFromTrace,
  type CleanRunningTraceResult,
  type RacePredictionResult,
} from '@/features/compte/progression/runningRecords';
import {
  computeTrainingLoad,
  type TrainingLoadSummary,
} from '@/features/compte/progression/trainingLoad';
import type { OutingImportSample, OutingPoint } from '@/features/compte/server/sorties';
import { analyzeClimbs, type ClimbAnalysis } from '@/features/routes/analysis/climbs';
import { analyzeDifficulty, type DifficultyAnalysis } from '@/features/routes/analysis/difficulty';
import type { AnalysisSport, ProfileSample } from '@/features/routes/analysis/types';
import { buildRecoveryProgram } from '@/features/workouts/domain/recovery';
import type { RecoveryProgram, WorkoutSport } from '@/features/workouts/domain/types';
import { analyzeSkiTrace, type SkiActivityDetails } from '../../activity/modes/skiActivity';
import { computeSwimPace } from '../../activity/modes/swimActivity';
import type { ExplicitMetricValue } from '../../activity/modes/types';
import { haversineDistanceM } from '../../activity/slopeAdjustedPace';
import {
  computeEffectiveRidgeWind,
  computeOfflineDaylight,
  computeThermalStress,
  estimateHydrationLiters,
} from '../../adaptive/environment';
import {
  computeExplorerReadiness,
  computeSessionLoadUnits,
  mapSportToSortieActivity,
} from '../../adaptive/loadAndReadiness';
import { scoreOutingFit } from '../../adaptive/outingFit';
import { estimateSafeEta } from '../../adaptive/safeEta';
import type {
  ExplorerReadiness,
  LoadTier,
  OfflineDaylight,
  OutingFitResult,
  RidgeWindResult,
  SessionLoadResult,
  SessionRecord,
  ThermalStressResult,
  WeatherSnapshot,
} from '../../adaptive/types';
import type { ActivitySourceOrigin } from '../../events/activityEventBus';
import {
  buildAiActivityInsightPayload,
  computePhysiologyAndXp,
  type AiInsightGuardResult,
  type PhysiologyAndXpResult,
} from '../../events/consumers/physiologyXpAiConsumer';
import type { ProfileResult } from '../../geo/profile';
import type { ZoneSet } from '../../metrics/activityMetrics';
import { computeCyclingPowerSkills, type PowerSkillsResult } from '../../metrics/powerCurve';
import {
  analyzeOutingTelemetry,
  type OutingTelemetryBundle,
} from '../../metrics/telemetryAnalysis';
import type { ActivityProfileSpec } from '../../specs/activityProfileSpec.types';
import { formatPrimarySpeedMetric } from '../../specs/resolveActivityProfile';
import type { ActivityState, MetricSeries, Sport, StrengthLog } from '../../state/types';
import { computeMuscleHeatmap, type MuscleHeatmapSummary } from '../../strength/muscles';

export interface SummaryTrackPointInput {
  readonly lat: number;
  readonly lng: number;
  readonly ele?: number | null;
  readonly t?: number;
  readonly hr?: number | null;
  readonly speedKmh?: number | null;
  readonly speed?: number | null;
  readonly acc?: number | null;
  readonly cad?: number | null;
  readonly powerW?: number | null;
  readonly tempC?: number | null;
}

export interface SummaryZoneThresholds {
  readonly fcMax: number;
  readonly fcRest: number;
  readonly ftpW: number;
  readonly vmaKmh: number;
}

export interface SummaryExpertAnalysisInput {
  readonly profile: ActivityProfileSpec;
  readonly summary: Partial<ActivityState> & {
    readonly sport: Sport;
    readonly startedAt: number;
    readonly endedAt: number;
    readonly distanceM: number;
    readonly movingS: number;
    readonly elevGainM: number;
  };
  readonly points: ReadonlyArray<SummaryTrackPointInput>;
  readonly title?: string | null;
  readonly notes?: string | null;
  readonly rpe?: number | null;
  readonly units?: 'metric' | 'imperial';
  readonly locationLabel?: string | null;
  readonly centerCoords?: readonly [number, number] | null;
  readonly weather?: WeatherSnapshot | null;
  readonly packWeightKg?: number | null;
  readonly bodyWeightKg?: number | null;
  readonly strengthLog?: StrengthLog | null;
  readonly zoneSets?: ReadonlyArray<ZoneSet>;
  readonly thresholds?: Partial<SummaryZoneThresholds>;
  readonly historySessions?: ReadonlyArray<ProgressionSession>;
  readonly sourceOrigin?: ActivitySourceOrigin;
  readonly timeZone?: string;
}

export type MetricHonestyBadge = 'measured' | 'estimated' | 'unavailable';

export interface SlopeDistributionBucket {
  readonly id: string;
  readonly label: string;
  readonly distanceKm: number;
  readonly sharePct: number;
  readonly tone: 'descent_steep' | 'descent' | 'flat' | 'climb_mild' | 'climb_steep' | 'climb_extreme';
}

export interface VerticalityMetrics {
  readonly minAltM: number | null;
  readonly maxAltM: number | null;
  readonly avgAltM: number | null;
  readonly elevGainM: number;
  readonly elevLossM: number;
  readonly vamAvgMH: number | null;
  readonly vamPeakMH: number | null;
  readonly maxGrade50mPct: number | null;
  readonly elevationCoveragePct: number;
  readonly elevationQuality: MetricHonestyBadge;
  readonly slopeBuckets: readonly SlopeDistributionBucket[];
}

export interface GpsQualityAudit {
  readonly pointCount: number;
  readonly timedPointCount: number;
  readonly validElevationCount: number;
  readonly elevationCoveragePct: number;
  readonly avgAccuracyM: number | null;
  readonly maxAccuracyM: number | null;
  readonly filteredSpikeCount: number;
  readonly qualityLabel: 'Excellente' | 'Bonne' | 'Partielle' | 'Sans trace GPS';
}

export interface PacingDynamics {
  readonly splitDeltaPct: number | null;
  readonly splitStrategyLabel: 'Negative Split' | 'Régulier' | 'Positive Split' | 'Indisponible';
  readonly regularityCvPct: number | null;
  readonly firstHalfPaceMinKm: number | null;
  readonly secondHalfPaceMinKm: number | null;
}

export interface ShapleyPillarItem {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly sharePct: number;
  readonly color: string;
}

export interface LcdaEffortBlock {
  readonly status: 'in_domain' | 'out_of_domain_fast' | 'non_pedestrian' | 'insufficient_trace';
  readonly reason: string | null;
  readonly avgSpeedKmh: number | null;
  readonly output: EffortScoreComputedOutput | null;
  readonly shapleyPillars: readonly ShapleyPillarItem[];
}

export interface LoadAndFormProjection {
  readonly canonicalLoad: SessionLoadResult;
  readonly canonicalTierLabelFr: string;
  readonly fosterAu: number;
  readonly physiologyXp: PhysiologyAndXpResult;
  readonly trainingLoadBefore: TrainingLoadSummary;
  readonly trainingLoadAfter: TrainingLoadSummary;
  readonly readinessBefore: ExplorerReadiness;
  readonly readinessAfter: ExplorerReadiness;
  readonly projectedTsbBefore: number | null;
  readonly projectedTsbAfter: number | null;
  readonly deltaCtl: number | null;
  readonly deltaAtl: number | null;
  readonly deltaTsb: number | null;
  readonly deltaReadiness: number | null;
}

export interface CyclingAdvancedMetrics {
  readonly intensityFactor: number | null;
  readonly variabilityIndex: number | null;
  readonly estimatedTss: number | null;
  readonly powerSkills: PowerSkillsResult;
}

export interface SwimModuleAnalysis {
  readonly available: boolean;
  readonly poolLengthM: number | null;
  readonly poolLengthsCount: number | null;
  readonly pacePer100m: ExplicitMetricValue<number>;
  readonly pacePer100yd: ExplicitMetricValue<number>;
  readonly swolf: ExplicitMetricValue<number>;
}

export interface EquipmentAndEcoAnalysis {
  readonly co2SavedKg: number | null;
  readonly co2Applicable: boolean;
  readonly wearHintFr: string;
  readonly estimatedGearWearPct: number | null;
}

export interface RecoveryTimelineWindow {
  readonly windowLabel: string;
  readonly focus: string;
  readonly actions: readonly string[];
}

export interface SummaryExpertAnalysisResult {
  readonly outingId: string;
  readonly title: string;
  readonly sport: Sport;
  readonly familyId: ActivityProfileSpec['identity']['familyId'];
  readonly units: 'metric' | 'imperial';
  readonly distanceKm: number;
  readonly movingS: number;
  readonly elapsedS: number;
  readonly primarySpeed: { readonly valueText: string; readonly unitLabel: string };
  readonly rpe: number;
  readonly telemetry: OutingTelemetryBundle;
  readonly gpsAudit: GpsQualityAudit;
  readonly verticality: VerticalityMetrics;
  readonly climbs: ClimbAnalysis;
  readonly difficulty: DifficultyAnalysis;
  readonly sortiePerformance: SortiePerformanceEstimate;
  readonly benchmarkDeltaPct: number | null;
  readonly lcda: LcdaEffortBlock;
  readonly fatigue: FatigueResult;
  readonly loadProjection: LoadAndFormProjection;
  readonly outingFit: OutingFitResult;
  readonly pacing: PacingDynamics;
  readonly cycling: CyclingAdvancedMetrics;
  readonly runningTraceRecords: CleanRunningTraceResult | null;
  readonly racePredictions: RacePredictionResult;
  readonly highlights: readonly SessionHighlight[];
  readonly comparableOutings: readonly ComparableOutingEntry[];
  readonly daylight: OfflineDaylight | null;
  readonly daylightMarginMin: number | null;
  readonly ridgeWind: RidgeWindResult | null;
  readonly thermalStress: ThermalStressResult;
  readonly hydrationLiters: number;
  readonly recoveryProgram: RecoveryProgram;
  readonly recoveryTimeline: readonly RecoveryTimelineWindow[];
  readonly skiDetails: SkiActivityDetails | null;
  readonly swimModule: SwimModuleAnalysis | null;
  readonly muscleHeatmap: MuscleHeatmapSummary | null;
  readonly equipmentEco: EquipmentAndEcoAnalysis;
  readonly aiGuard: AiInsightGuardResult;
}

const LOAD_TIER_LABELS: Record<LoadTier, string> = {
  power_tss: 'TSS Puissance',
  hr_relative_effort: 'FC Relative',
  srpe: 'sRPE',
  gps_mechanical_ke: 'km-Effort GPS',
};

const PEDESTRIAN_FAMILIES: ReadonlySet<ActivityProfileSpec['identity']['familyId']> = new Set([
  'hiking_trekking',
  'alpinism_vertical',
  'running_trail',
]);

function mapToAnalysisSport(sport: Sport, slugId: string): AnalysisSport {
  if (slugId.includes('gravel')) return 'gravel';
  if (slugId.includes('mtb') || slugId.includes('vtt')) return 'vtt';
  if (slugId.includes('road_cycling')) return 'route';
  if (sport === 'escalade') return 'rando';
  return sport;
}

function mapToWorkoutSport(sport: Sport): WorkoutSport | null {
  switch (sport) {
    case 'rando':
    case 'famille':
    case 'bivouac':
      return 'rando';
    case 'trail':
      return 'trail';
    case 'course':
      return 'course';
    case 'velo':
      return 'velo';
    case 'ski':
      return 'ski';
    case 'escalade':
      return 'escalade';
    case 'kayak':
      return 'kayak';
    default:
      return null;
  }
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Interpole linéairement les altitudes DEM (`ProfileResult`) sur les points GPS
 * originaux par distance cumulée.
 *
 * Invariant C-MET : si une des deux bornes encadrantes du profil DEM vaut `null`
 * (trou DEM / tuile non chargée), l'altitude interpolée reste strictement `null`
 * — aucune altitude n'est jamais inventée au-dessus d'un trou.
 */
export function interpolateDemElevationOnPoints<
  T extends { readonly lat: number; readonly lng: number; readonly ele?: number | null },
>(points: ReadonlyArray<T>, demProfile: Pick<ProfileResult, 'points'>): Array<T & { ele: number | null }> {
  if (points.length === 0) return [];
  const demPts = demProfile.points;
  if (!Array.isArray(demPts) || demPts.length === 0) {
    return points.map((pt) => ({ ...pt, ele: pt.ele ?? null }));
  }

  // Distances cumulées des points GPS originaux
  const cumD: number[] = [0];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const seg =
      Number.isFinite(prev.lat) &&
      Number.isFinite(prev.lng) &&
      Number.isFinite(curr.lat) &&
      Number.isFinite(curr.lng)
        ? haversineDistanceM(prev.lat, prev.lng, curr.lat, curr.lng)
        : 0;
    cumD.push(cumD[i - 1] + seg);
  }

  let demIdx = 0;
  return points.map((pt, i) => {
    const d = cumD[i];
    while (demIdx < demPts.length - 2 && demPts[demIdx + 1].d < d) {
      demIdx += 1;
    }
    const left = demPts[demIdx];
    const right = demPts[Math.min(demPts.length - 1, demIdx + 1)];

    if (!left || !right) {
      return { ...pt, ele: null };
    }
    // Si exact match sur une borne
    if (Math.abs(d - left.d) < 1e-3) {
      return { ...pt, ele: left.ele !== null && Number.isFinite(left.ele) ? round(left.ele, 1) : null };
    }
    if (Math.abs(d - right.d) < 1e-3) {
      return {
        ...pt,
        ele: right.ele !== null && Number.isFinite(right.ele) ? round(right.ele, 1) : null,
      };
    }
    // Légère tolérance de fin de trace liée à la décimation 400 pts de buildProfile
    if (d > right.d) {
      const maxSlack = Math.max(50, right.d * 0.05);
      if (d - right.d <= maxSlack && right.ele !== null && Number.isFinite(right.ele)) {
        return { ...pt, ele: round(right.ele, 1) };
      }
      return { ...pt, ele: null };
    }
    // Trou DEM sur l'une ou l'autre borne → strictement null (C-MET)
    if (
      left.ele === null ||
      right.ele === null ||
      !Number.isFinite(left.ele) ||
      !Number.isFinite(right.ele)
    ) {
      return { ...pt, ele: null };
    }

    const span = right.d - left.d;
    if (span <= 0) {
      return { ...pt, ele: round(left.ele, 1) };
    }
    const ratio = Math.max(0, Math.min(1, (d - left.d) / span));
    const interpolated = left.ele + ratio * (right.ele - left.ele);
    return { ...pt, ele: round(interpolated, 1) };
  });
}

function buildImportSamplesFromInputs(
  points: ReadonlyArray<SummaryTrackPointInput>,
  metricSeries?: ReadonlyArray<MetricSeries>,
): OutingImportSample[] {
  const byTime = new Map<number, OutingImportSample>();

  const upsert = (tMs: number, patch: Partial<OutingImportSample>) => {
    const existing = byTime.get(tMs);
    if (existing) {
      byTime.set(tMs, {
        ...existing,
        ...patch,
      });
    } else {
      byTime.set(tMs, {
        index: byTime.size,
        origin: 'device',
        recordedAt: new Date(tMs).toISOString(),
        lapIndex: null,
        heartRateBpm: patch.heartRateBpm ?? null,
        cadenceRpm: patch.cadenceRpm ?? null,
        cadenceSpm: patch.cadenceSpm ?? null,
        powerW: patch.powerW ?? null,
        temperatureC: patch.temperatureC ?? null,
        altitudeM: patch.altitudeM ?? null,
        speedMps: patch.speedMps ?? null,
        distanceM: patch.distanceM ?? null,
      });
    }
  };

  for (const pt of points) {
    const tMs = finiteOrNull(pt.t);
    if (tMs === null) continue;
    const hr = finiteOrNull(pt.hr);
    const cad = finiteOrNull(pt.cad);
    const powerW = finiteOrNull(pt.powerW);
    const tempC = finiteOrNull(pt.tempC);
    const speedMps =
      finiteOrNull(pt.speed) ??
      (finiteOrNull(pt.speedKmh) !== null ? (pt.speedKmh as number) / 3.6 : null);
    if (hr !== null || cad !== null || powerW !== null || tempC !== null || speedMps !== null) {
      upsert(tMs, {
        heartRateBpm: hr,
        cadenceSpm: cad,
        cadenceRpm: cad,
        powerW,
        temperatureC: tempC,
        altitudeM: finiteOrNull(pt.ele),
        speedMps,
      });
    }
  }

  for (const series of metricSeries ?? []) {
    for (const sample of series.samples) {
      if (!Number.isFinite(sample.t) || !Number.isFinite(sample.value)) continue;
      if (series.key === 'heartRate') upsert(sample.t, { heartRateBpm: sample.value });
      else if (series.key === 'cadence')
        upsert(sample.t, { cadenceSpm: sample.value, cadenceRpm: sample.value });
      else if (series.key === 'power') upsert(sample.t, { powerW: sample.value });
      else if (series.key === 'temperature') upsert(sample.t, { temperatureC: sample.value });
      else if (series.key === 'speed') upsert(sample.t, { speedMps: sample.value });
      else if (series.key === 'elevation') upsert(sample.t, { altitudeM: sample.value });
    }
  }

  return Array.from(byTime.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, v], idx) => ({ ...v, index: idx }));
}

function readSeriesStatAverage(
  metricSeries: ReadonlyArray<MetricSeries> | undefined,
  key: MetricSeries['key'],
): number | null {
  const s = metricSeries?.find((item) => item.key === key);
  if (!s || s.stats.count <= 0) return null;
  if (s.stats.weightedDurationS > 0) {
    return s.stats.weightedSum / s.stats.weightedDurationS;
  }
  return s.stats.sum / s.stats.count;
}

/**
 * Lit la valeur totale d'une série cumulative (calories kcal, pas podomètre).
 * Un compteur cumulatif ne doit jamais être moyenné dans le temps.
 */
function readSeriesCumulativeTotal(
  metricSeries: ReadonlyArray<MetricSeries> | undefined,
  key: 'calories' | 'steps',
): number | null {
  const s = metricSeries?.find((item) => item.key === key);
  if (!s || s.stats.count <= 0) return null;
  const candidate = Math.max(
    Number.isFinite(s.stats.max) ? s.stats.max : 0,
    Number.isFinite(s.stats.last) ? s.stats.last : 0,
  );
  return candidate > 0 ? Math.round(candidate) : null;
}

function computeVerticality(
  aligned: OutingTelemetryBundle['aligned'],
  fallbackElevGainM: number,
  movingS: number,
  climbs: ClimbAnalysis,
): VerticalityMetrics {
  let minAlt = Infinity;
  let maxAlt = -Infinity;
  let sumAlt = 0;
  let countAlt = 0;
  let gainM = 0;
  let lossM = 0;
  let lastEle: number | null = null;

  const bucketDistances = {
    descent_steep: 0,
    descent: 0,
    flat: 0,
    climb_mild: 0,
    climb_steep: 0,
    climb_extreme: 0,
  };
  let totalSlopeDistM = 0;

  for (let i = 0; i < aligned.length; i += 1) {
    const pt = aligned[i];
    if (pt.altitudeM !== null && Number.isFinite(pt.altitudeM)) {
      if (pt.altitudeM < minAlt) minAlt = pt.altitudeM;
      if (pt.altitudeM > maxAlt) maxAlt = pt.altitudeM;
      sumAlt += pt.altitudeM;
      countAlt += 1;

      if (lastEle !== null) {
        const diff = pt.altitudeM - lastEle;
        if (diff > 1.5) gainM += diff;
        else if (diff < -1.5) lossM += Math.abs(diff);
      }
      lastEle = pt.altitudeM;
    }

    if (i > 0) {
      const prev = aligned[i - 1];
      const segM = Math.max(0, (pt.distanceKm - prev.distanceKm) * 1000);
      if (segM > 0 && pt.gradePct !== null && Number.isFinite(pt.gradePct)) {
        totalSlopeDistM += segM;
        if (pt.gradePct < -10) bucketDistances.descent_steep += segM;
        else if (pt.gradePct < -3) bucketDistances.descent += segM;
        else if (pt.gradePct <= 3) bucketDistances.flat += segM;
        else if (pt.gradePct <= 8) bucketDistances.climb_mild += segM;
        else if (pt.gradePct <= 15) bucketDistances.climb_steep += segM;
        else bucketDistances.climb_extreme += segM;
      }
    }
  }

  // Max grade over >= 50 m sliding window
  let maxGrade50m: number | null = null;
  let left = 0;
  for (let right = 1; right < aligned.length; right += 1) {
    const r = aligned[right];
    if (r.altitudeM === null) continue;
    while (left < right - 1 && (r.distanceKm - aligned[left + 1].distanceKm) * 1000 >= 50) {
      left += 1;
    }
    const l = aligned[left];
    const spanM = (r.distanceKm - l.distanceKm) * 1000;
    if (spanM >= 45 && l.altitudeM !== null) {
      const grade = ((r.altitudeM - l.altitudeM) / spanM) * 100;
      if (Number.isFinite(grade) && Math.abs(grade) <= 65) {
        if (maxGrade50m === null || grade > maxGrade50m) {
          maxGrade50m = grade;
        }
      }
    }
  }

  // Peak VAM over >= 180 s climbing window
  let vamPeak: number | null = null;
  let vLeft = 0;
  for (let vRight = 1; vRight < aligned.length; vRight += 1) {
    const r = aligned[vRight];
    if (r.altitudeM === null || r.elapsedS === null) continue;
    while (
      vLeft < vRight - 1 &&
      aligned[vLeft + 1].elapsedS !== null &&
      r.elapsedS - (aligned[vLeft + 1].elapsedS as number) >= 180
    ) {
      vLeft += 1;
    }
    const l = aligned[vLeft];
    if (l.altitudeM !== null && l.elapsedS !== null) {
      const dtS = r.elapsedS - l.elapsedS;
      const dEle = r.altitudeM - l.altitudeM;
      if (dtS >= 120 && dEle >= 25) {
        const vam = (dEle / dtS) * 3600;
        if (vam > 0 && vam <= 3500 && (vamPeak === null || vam > vamPeak)) {
          vamPeak = vam;
        }
      }
    }
  }

  const effectiveGain = Math.max(Math.round(fallbackElevGainM), Math.round(gainM));
  const effectiveLoss =
    lossM > 0 ? Math.round(lossM) : climbs.totalLossM > 0 ? Math.round(climbs.totalLossM) : 0;
  const vamAvg = movingS >= 120 && effectiveGain >= 20 ? Math.round((effectiveGain / movingS) * 3600) : null;
  const elevationCoveragePct =
    aligned.length > 0 ? Math.round((countAlt / aligned.length) * 100) : 0;

  const slopeBuckets: SlopeDistributionBucket[] = [
    {
      id: 'descent_steep',
      label: '< -10 %',
      distanceKm: round(bucketDistances.descent_steep / 1000, 2),
      sharePct: totalSlopeDistM > 0 ? Math.round((bucketDistances.descent_steep / totalSlopeDistM) * 100) : 0,
      tone: 'descent_steep',
    },
    {
      id: 'descent',
      label: '-10 à -3 %',
      distanceKm: round(bucketDistances.descent / 1000, 2),
      sharePct: totalSlopeDistM > 0 ? Math.round((bucketDistances.descent / totalSlopeDistM) * 100) : 0,
      tone: 'descent',
    },
    {
      id: 'flat',
      label: '-3 à +3 %',
      distanceKm: round(bucketDistances.flat / 1000, 2),
      sharePct: totalSlopeDistM > 0 ? Math.round((bucketDistances.flat / totalSlopeDistM) * 100) : 0,
      tone: 'flat',
    },
    {
      id: 'climb_mild',
      label: '+3 à +8 %',
      distanceKm: round(bucketDistances.climb_mild / 1000, 2),
      sharePct: totalSlopeDistM > 0 ? Math.round((bucketDistances.climb_mild / totalSlopeDistM) * 100) : 0,
      tone: 'climb_mild',
    },
    {
      id: 'climb_steep',
      label: '+8 à +15 %',
      distanceKm: round(bucketDistances.climb_steep / 1000, 2),
      sharePct: totalSlopeDistM > 0 ? Math.round((bucketDistances.climb_steep / totalSlopeDistM) * 100) : 0,
      tone: 'climb_steep',
    },
    {
      id: 'climb_extreme',
      label: '> +15 %',
      distanceKm: round(bucketDistances.climb_extreme / 1000, 2),
      sharePct: totalSlopeDistM > 0 ? Math.round((bucketDistances.climb_extreme / totalSlopeDistM) * 100) : 0,
      tone: 'climb_extreme',
    },
  ];

  return {
    minAltM: Number.isFinite(minAlt) ? Math.round(minAlt) : null,
    maxAltM: Number.isFinite(maxAlt) ? Math.round(maxAlt) : null,
    avgAltM: countAlt > 0 ? Math.round(sumAlt / countAlt) : null,
    elevGainM: effectiveGain,
    elevLossM: effectiveLoss,
    vamAvgMH: vamAvg,
    vamPeakMH: vamPeak !== null ? Math.round(vamPeak) : null,
    maxGrade50mPct: maxGrade50m !== null ? round(maxGrade50m, 1) : null,
    elevationCoveragePct,
    elevationQuality: countAlt >= 2 ? 'measured' : effectiveGain > 0 ? 'estimated' : 'unavailable',
    slopeBuckets,
  };
}

function computePacingDynamics(splits: OutingTelemetryBundle['kmSplits']): PacingDynamics {
  const completed = splits.filter(
    (s) => s.completed && s.paceMinPerKm !== null && Number.isFinite(s.paceMinPerKm) && s.paceMinPerKm > 0,
  );
  if (completed.length < 2) {
    return {
      splitDeltaPct: null,
      splitStrategyLabel: 'Indisponible',
      regularityCvPct: null,
      firstHalfPaceMinKm: null,
      secondHalfPaceMinKm: null,
    };
  }

  const paces = completed.map((s) => s.paceMinPerKm as number);
  const mean = paces.reduce((a, b) => a + b, 0) / paces.length;
  const variance = paces.reduce((sum, p) => sum + (p - mean) ** 2, 0) / paces.length;
  const cvPct = mean > 0 ? round((Math.sqrt(variance) / mean) * 100, 1) : null;

  const mid = Math.floor(completed.length / 2);
  const firstHalf = paces.slice(0, mid);
  const secondHalf = paces.slice(mid);
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const deltaPct = firstAvg > 0 ? round(((secondAvg - firstAvg) / firstAvg) * 100, 1) : null;

  let strategy: PacingDynamics['splitStrategyLabel'] = 'Régulier';
  if (deltaPct !== null) {
    if (deltaPct <= -2.0) strategy = 'Negative Split';
    else if (deltaPct >= 2.5) strategy = 'Positive Split';
  }

  return {
    splitDeltaPct: deltaPct,
    splitStrategyLabel: strategy,
    regularityCvPct: cvPct,
    firstHalfPaceMinKm: round(firstAvg, 2),
    secondHalfPaceMinKm: round(secondAvg, 2),
  };
}

function buildShapleyPillars(output: EffortScoreComputedOutput): ShapleyPillarItem[] {
  const s = output.shapley;
  const raw: Array<{ id: string; label: string; value: number; color: string }> = [
    {
      id: 'locomotion',
      label: 'Distance & Montée',
      value: Math.max(0, round(s.baseDistance + s.ascent, 1)),
      color: '#17402c',
    },
    {
      id: 'descent',
      label: 'Freinage descente',
      value: Math.max(0, round(s.descent, 1)),
      color: '#0e8f5b',
    },
    {
      id: 'pack',
      label: 'Portage sac',
      value: Math.max(0, round(s.packLoad, 1)),
      color: '#d97706',
    },
    {
      id: 'terrain',
      label: 'Terrain & Neige',
      value: Math.max(0, round(s.surfaceAndSnow, 1)),
      color: '#7c3aed',
    },
    {
      id: 'thermal',
      label: 'Météo & Vent',
      value: Math.max(0, round(s.thermalAndWind, 1)),
      color: '#0284c7',
    },
    {
      id: 'altitude_fatigue',
      label: 'Altitude & Fatigue',
      value: Math.max(0, round(s.altitude + s.fatigue, 1)),
      color: '#dc2626',
    },
  ];
  const totalPos = raw.reduce((acc, item) => acc + item.value, 0);
  return raw.map((item) => ({
    ...item,
    sharePct: totalPos > 0 ? Math.round((item.value / totalPos) * 100) : 0,
  }));
}

function buildRecoveryTimeline(
  rpe: number,
  loadUnits: number,
  eccentricDomsScore: number,
  hydrationLiters: number,
  program: RecoveryProgram,
): RecoveryTimelineWindow[] {
  const highIntensity = rpe >= 7 || loadUnits >= 75;
  const highDoms = eccentricDomsScore >= 40;
  return [
    {
      windowLabel: '0 – 6 h',
      focus: 'Réhydratation & retour au calme',
      actions: [
        `Reconstituer ~${Math.max(0.5, round(hydrationLiters * 0.75, 1))} L d’eau + électrolytes`,
        highIntensity
          ? 'Apport glucides + protéines (ratio 3:1) dans les 60 min'
          : 'Collation légère glucidique & respiration diaphragmatique 5 min',
        program.exercises[0]
          ? `${program.exercises[0].title} (${Math.round(program.exercises[0].durationS / 60)} min)`
          : 'Auto-massage léger mollets & quadriceps',
      ],
    },
    {
      windowLabel: '24 h',
      focus: highDoms ? 'Pic DOMS excentrique — mobilité douce' : 'Assimilation aérobie',
      actions: [
        highDoms
          ? 'Privilégier vélo souple / marche 20 min pour drainer les quadriceps'
          : 'Endurance fondamentale Z1–Z2 ou repos actif',
        'Sommeil cible 8 h+ (pic synthèse protéique nocturne)',
      ],
    },
    {
      windowLabel: '48 h',
      focus: 'Surcompensation & reprise qualitative',
      actions: [
        highIntensity || highDoms
          ? 'Réévaluer la fraîcheur musculaire avant toute séance seuil / D+ fort'
          : 'Fenêtre favorable pour une séance de qualité ou sortie longue',
        program.nextPracticeHint ?? 'Maintenir 10 min de mobilité hanches & chevilles',
      ],
    },
  ];
}

/**
 * Orchestrateur principal pur d'analyse experte post-sortie.
 */
export function computeSummaryExpertAnalysis(
  input: SummaryExpertAnalysisInput,
): SummaryExpertAnalysisResult {
  const { profile, summary, points } = input;
  const units = input.units ?? 'metric';
  const rpe = Math.max(1, Math.min(10, Math.round(input.rpe ?? 5)));
  const timeZone = input.timeZone ?? 'Europe/Paris';
  const distanceM = Math.max(0, summary.distanceM || 0);
  const distanceKm = round(distanceM / 1000, 2);
  const elapsedS = Math.max(0, Math.round((summary.endedAt - summary.startedAt) / 1000));
  const movingS = summary.movingS > 0 ? Math.round(summary.movingS) : elapsedS;
  const elevGainRaw = Math.max(0, Math.round(summary.elevGainM || 0));
  const outingId =
    summary.sessionId ?? summary.clientSessionId ?? `local-${summary.startedAt}`;
  const title =
    (input.title && input.title.trim()) ||
    summary.route?.name ||
    `Sortie ${profile.identity.labelFr}`;

  const primarySpeed = formatPrimarySpeedMetric(profile, {
    distanceM,
    movingS,
    elevGainM: elevGainRaw,
    units,
  });

  // ── 1. Télémétrie alignée, splits, intervalles, GAP, puissance & zones ────
  const outingPoints: OutingPoint[] = points
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => ({
      lat: p.lat,
      lng: p.lng,
      elevationM: finiteOrNull(p.ele),
      timestamp: finiteOrNull(p.t) !== null ? new Date(p.t as number).toISOString() : null,
    }));

  const importSamples = buildImportSamplesFromInputs(points, summary.metricSeries);
  const seriesAvgHr = readSeriesStatAverage(summary.metricSeries, 'heartRate');
  const seriesCalories = readSeriesCumulativeTotal(summary.metricSeries, 'calories');
  const seriesSteps = readSeriesCumulativeTotal(summary.metricSeries, 'steps');

  const rawTelemetry = analyzeOutingTelemetry({
    outingId,
    sport: summary.sport,
    segments: outingPoints.length > 0 ? [outingPoints] : [],
    samples: importSamples.length > 0 ? importSamples : null,
    durationS: elapsedS > 0 ? elapsedS : null,
    movingTimeS: movingS > 0 ? movingS : null,
    measuredCaloriesKcal: seriesCalories,
    measuredHrBpm: seriesAvgHr,
    rpe,
    zoneSets: input.zoneSets ? [...input.zoneSets] : undefined,
    bodyWeightKg: input.bodyWeightKg ?? null,
  });

  const telemetry: OutingTelemetryBundle =
    seriesSteps !== null && rawTelemetry.energyAndSteps.steps === null
      ? {
          ...rawTelemetry,
          energyAndSteps: {
            ...rawTelemetry.energyAndSteps,
            steps: seriesSteps,
            stepsQuality: 'measured',
            stepsNote: 'Mesurés par le podomètre / capteur de l’appareil.',
          },
        }
      : rawTelemetry;

  // ── 2. Relief, montées Cat 1–5 & difficulté ──────────────────────────────
  const analysisSport = mapToAnalysisSport(summary.sport, profile.identity.slugId);
  const profileSamples: ProfileSample[] = telemetry.aligned.map((pt) => ({
    distanceM: pt.distanceKm * 1000,
    elevationM: pt.altitudeM,
  }));

  const climbs = analyzeClimbs({
    profile: profileSamples.length >= 2 ? profileSamples : null,
    sport: analysisSport,
  });

  const verticality = computeVerticality(telemetry.aligned, elevGainRaw, movingS, climbs);

  const difficulty = analyzeDifficulty({
    sport: analysisSport,
    distanceM: Math.max(distanceM, telemetry.aligned.length > 0 ? telemetry.aligned[telemetry.aligned.length - 1].distanceKm * 1000 : 0),
    gainM: verticality.elevationQuality === 'unavailable' && verticality.elevGainM === 0 ? null : verticality.elevGainM,
    lossM: verticality.elevLossM,
    maxAltitudeM: verticality.maxAltM,
    climbs,
  });

  const sortieActivity = mapSportToSortieActivity(summary.sport);
  const sortiePerformance = estimateSortiePerformance(
    {
      activity: sortieActivity,
      distanceKm: Math.max(0.05, distanceKm),
      elevationGainM: verticality.elevGainM,
      elevationLossM: verticality.elevLossM,
      maxAltitudeM: verticality.maxAltM,
      meanAltitudeM: verticality.avgAltM,
      packWeightKg: input.packWeightKg ?? null,
    },
    [],
  );

  // Also ensure km-Effort / IBP is coherent even on very short outings
  const routeDiff = computeRouteDifficulty(
    {
      activity: sortieActivity,
      distanceKm: Math.max(0.01, distanceKm),
      elevationGainM: verticality.elevGainM,
      elevationLossM: verticality.elevLossM,
      maxAltitudeM: verticality.maxAltM,
      packWeightKg: input.packWeightKg ?? null,
    },
    Math.max(0.05, movingS / 3600),
  );
  const resolvedSortiePerf: SortiePerformanceEstimate = {
    ...sortiePerformance,
    ibpIndex: Math.max(sortiePerformance.ibpIndex, routeDiff.ibpIndex),
    effortScoreKe: Math.max(sortiePerformance.effortScoreKe, routeDiff.effortScoreKe),
  };

  const benchmarkDeltaPct =
    movingS >= 180 && resolvedSortiePerf.movingHours > 0
      ? round(((movingS / 3600 - resolvedSortiePerf.movingHours) / resolvedSortiePerf.movingHours) * 100, 1)
      : null;

  // ── 3. Bioénergétique LCDA + Shapley 6 piliers + Fatigue ─────────────────
  const avgSpeedKmh = movingS >= 10 && distanceM > 0 ? round((distanceM / movingS) * 3.6, 1) : null;
  const isPedestrianSport = PEDESTRIAN_FAMILIES.has(profile.identity.familyId);
  const inLcdaSpeedRange = avgSpeedKmh !== null && avgSpeedKmh >= 1.6 && avgSpeedKmh <= 7.1;

  const hrChannel = telemetry.sensorChannels.find((c) => c.key === 'heartRate');
  const effectiveWeightKg =
    input.bodyWeightKg && input.bodyWeightKg > 25 ? input.bodyWeightKg : IEA_REFERENCE_WEIGHT_KG;
  const safePackKg = Math.min(
    Math.max(0, input.packWeightKg ?? 0),
    Math.floor(effectiveWeightKg * 0.65),
  );

  let lcda: LcdaEffortBlock;
  if (!isPedestrianSport) {
    lcda = {
      status: 'non_pedestrian',
      reason: `Domaine LCDA pédestre (1,6–7,1 km/h) non applicable à ${profile.identity.labelFr}. Les moteurs natifs du sport prennent le relais.`,
      avgSpeedKmh,
      output: null,
      shapleyPillars: [],
    };
  } else if (avgSpeedKmh !== null && !inLcdaSpeedRange) {
    lcda = {
      status: 'out_of_domain_fast',
      reason:
        avgSpeedKmh > 7.1
          ? `Vitesse moyenne (${avgSpeedKmh} km/h) au-dessus du domaine pédestre LCDA (1,6–7,1 km/h) : GAP Minetti & charge canonique prioritaires.`
          : `Vitesse moyenne (${avgSpeedKmh} km/h) sous le seuil LCDA (1,6 km/h).`,
      avgSpeedKmh,
      output: null,
      shapleyPillars: [],
    };
  } else {
    const timedPositions = points
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p, idx) => ({
        lat: p.lat,
        lng: p.lng,
        ele: finiteOrNull(p.ele) ?? undefined,
        t: finiteOrNull(p.t) ?? summary.startedAt + idx * 10_000,
      }));
    const rawSegments = buildFallbackSegmentsFromPositionsTimed(timedPositions, {
      defaultSurface: summary.sport === 'trail' ? 'dirt' : 'dirt',
    });

    if (rawSegments.length === 0) {
      lcda = {
        status: 'insufficient_trace',
        reason: 'Trace GPS horodatée insuffisante pour décomposer les 6 piliers Shapley LCDA.',
        avgSpeedKmh,
        output: null,
        shapleyPillars: [],
      };
    } else {
      try {
        const effortOut = computeEffortScore({
          segments: rawSegments,
          weather: {
            tempC: input.weather?.temperatureC ?? 15,
            windMs: (input.weather?.windSpeedKmh ?? 0) / 3.6,
            humidityPct: input.weather?.humidityPct ?? 55,
            precipMmPerH: input.weather?.precipitationMmH ?? 0,
          },
          ground: {
            surface: 'trail',
            snowSinkCm: 0,
            wetness: (input.weather?.precipitationMmH ?? 0) > 1 ? 0.5 : 0,
          },
          pack: {
            packWeightKg: safePackKg,
          },
          physiology: {
            weightKg: effectiveWeightKg,
            hrRest: input.thresholds?.fcRest ?? 58,
            hrMax: input.thresholds?.fcMax ?? 190,
          },
          observations: {
            avgHeartRateBpm: hrChannel ? hrChannel.avg : undefined,
            maxHeartRateBpm: hrChannel ? hrChannel.max : undefined,
            hrCoverageRatio: hrChannel ? hrChannel.coveragePct / 100 : undefined,
            sessionRpe: rpe,
          },
          dataLevel: hrChannel ? 'cardio' : 'socle',
          snapshot: {
            modelVersion: EFFORT_SCORE_VERSION,
            profileVersion: profile.specVersion,
            routeFeatureVersion: 'gps-fallback-v1',
            equipmentSnapshot: `pack:${safePackKg}`,
            contextSnapshot: `sport:${summary.sport}`,
            scenario: `outing:${outingId}`,
          },
          evidence: [],
        });

        lcda = {
          status: 'in_domain',
          reason: null,
          avgSpeedKmh,
          output: effortOut,
          shapleyPillars: buildShapleyPillars(effortOut),
        };
      } catch {
        lcda = {
          status: 'insufficient_trace',
          reason: 'Segments hors bornes bioénergétiques pour le calcul Shapley.',
          avgSpeedKmh,
          output: null,
          shapleyPillars: [],
        };
      }
    }
  }

  const fatigue = computeFatigue({
    version: EFFORT_SCORE_VERSION,
    activeDurationS: movingS,
    gainM: verticality.elevGainM,
    lossM: verticality.elevLossM,
    technicalClass: difficulty.status !== 'unavailable' ? Math.min(5, difficulty.level) : 1,
    packWeightKg: safePackKg,
    declaredFatigue: rpe,
    weightKg: effectiveWeightKg,
  });

  // ── 4. Charge canonique 4 niveaux, CTL/ATL/TSB & Readiness Avant → Après ─
  const ftpW =
    input.thresholds?.ftpW ??
    telemetry.powerAnalysis.estimatedFtp.ftpW ??
    null;

  const currentSessionRecord: SessionRecord = {
    id: outingId,
    sport: summary.sport,
    startedAtMs: summary.startedAt,
    endedAtMs: summary.endedAt,
    movingS,
    distanceKm,
    elevationGainM: verticality.elevGainM,
    elevationLossM: verticality.elevLossM,
    maxAltitudeM: verticality.maxAltM,
    meanAltitudeM: verticality.avgAltM,
    packWeightKg: safePackKg,
    normalizedPowerW:
      telemetry.powerAnalysis.quality === 'measured'
        ? telemetry.powerAnalysis.normalizedW
        : null,
    ftpW,
    hrRelativeEffort: telemetry.relativeEffort?.score ?? null,
    rpe,
    rehabPainLevel: summary.rehabPainLevel ?? null,
    rehabBodyZone: summary.rehabBodyZone ?? null,
  };

  const canonicalLoad = computeSessionLoadUnits(currentSessionRecord);
  const fosterAu = Math.round((movingS / 60) * rpe);
  const physiologyXp = computePhysiologyAndXp(profile, {
    distanceM,
    movingS,
    elevGainM: verticality.elevGainM,
    avgHrBpm: hrChannel?.avg ?? null,
    maxHrBpm: input.thresholds?.fcMax ?? hrChannel?.max ?? null,
    restingHrBpm: input.thresholds?.fcRest ?? null,
    rpe,
  });

  const historyExcludingCurrent = (input.historySessions ?? []).filter(
    (s) => s.id !== outingId && s.id !== summary.clientSessionId,
  );
  const currentProgressionSession: ProgressionSession = {
    id: outingId,
    title,
    sport: summary.sport,
    massif: input.locationLabel ?? null,
    startedAt: new Date(summary.startedAt).toISOString(),
    endedAt: new Date(summary.endedAt).toISOString(),
    km: distanceKm,
    dplus: verticality.elevGainM,
    durationS: movingS,
  };

  const nowDate = new Date(Math.max(summary.endedAt, summary.startedAt));
  const trainingLoadBefore = computeTrainingLoad(historyExcludingCurrent, timeZone, 56, nowDate);
  const trainingLoadAfter = computeTrainingLoad(
    [...historyExcludingCurrent, currentProgressionSession],
    timeZone,
    56,
    nowDate,
  );

  const historyRecords: SessionRecord[] = historyExcludingCurrent
    .map((s): SessionRecord | null => {
      const startMs = s.startedAt ? Date.parse(s.startedAt) : NaN;
      const endMs = s.endedAt ? Date.parse(s.endedAt) : startMs + (s.durationS ?? 0) * 1000;
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
      return {
        id: s.id,
        sport: (s.sport as Sport) || 'rando',
        startedAtMs: startMs,
        endedAtMs: Math.max(startMs, endMs),
        movingS: s.durationS ?? 0,
        distanceKm: s.km,
        elevationGainM: s.dplus,
      };
    })
    .filter((rec): rec is SessionRecord => rec !== null);

  const readinessBefore = computeExplorerReadiness(
    { sessions: historyRecords },
    summary.startedAt,
  );
  const readinessAfter = computeExplorerReadiness(
    { sessions: [...historyRecords, currentSessionRecord] },
    summary.endedAt,
  );

  // Banister end-of-day projected TSB (CTL_today - ATL_today), reflecting the actual
  // post-outing form shift rather than `formTsb` which is evaluated at start-of-day.
  const latestBefore = trainingLoadBefore.series[trainingLoadBefore.series.length - 1] ?? null;
  const latestAfter = trainingLoadAfter.series[trainingLoadAfter.series.length - 1] ?? null;
  const projectedTsbBefore =
    latestBefore !== null ? Math.round(latestBefore.fitnessCtl - latestBefore.fatigueAtl) : null;
  const projectedTsbAfter =
    latestAfter !== null ? Math.round(latestAfter.fitnessCtl - latestAfter.fatigueAtl) : null;

  const loadProjection: LoadAndFormProjection = {
    canonicalLoad,
    canonicalTierLabelFr: LOAD_TIER_LABELS[canonicalLoad.tier],
    fosterAu,
    physiologyXp,
    trainingLoadBefore,
    trainingLoadAfter,
    readinessBefore,
    readinessAfter,
    projectedTsbBefore,
    projectedTsbAfter,
    deltaCtl:
      latestAfter !== null
        ? round(latestAfter.fitnessCtl - (latestBefore?.fitnessCtl ?? 0), 1)
        : null,
    deltaAtl:
      latestAfter !== null
        ? round(latestAfter.fatigueAtl - (latestBefore?.fatigueAtl ?? 0), 1)
        : null,
    deltaTsb:
      latestAfter !== null
        ? round(
            latestAfter.fitnessCtl -
              latestAfter.fatigueAtl -
              (latestBefore ? latestBefore.fitnessCtl - latestBefore.fatigueAtl : 0),
            1,
          )
        : null,
    deltaReadiness:
      readinessAfter.score !== null && readinessBefore.score !== null
        ? readinessAfter.score - readinessBefore.score
        : null,
  };

  // ── 5. Puissance vélo avancée (IF / VI / TSS / Power Skills) ─────────────
  const npW = telemetry.powerAnalysis.normalizedW;
  const avgW = telemetry.powerAnalysis.averageW;
  const intensityFactor =
    npW !== null && ftpW !== null && ftpW > 0 ? round(npW / ftpW, 2) : null;
  const variabilityIndex =
    npW !== null && avgW !== null && avgW > 0 ? round(npW / avgW, 2) : null;
  const estimatedTss =
    npW !== null && intensityFactor !== null && ftpW !== null && ftpW > 0 && movingS > 0
      ? Math.round(((movingS * npW * intensityFactor) / (ftpW * 3600)) * 100)
      : null;
  const powerSkills = computeCyclingPowerSkills(telemetry.powerAnalysis.curve, {
    bodyWeightKg: input.bodyWeightKg ?? null,
    ftpW,
  });

  // ── 6. Rythme, Records 400 m → Marathon, Riegel, Temps forts & Comparables
  const activeSplits = units === 'imperial' ? telemetry.miSplits : telemetry.kmSplits;
  const pacing = computePacingDynamics(activeSplits);

  const runningTraceInput = points
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && finiteOrNull(p.t) !== null)
    .map((p) => ({
      lat: p.lat,
      lng: p.lng,
      timestampMs: p.t as number,
    }));

  const runningTraceRecords =
    runningTraceInput.length >= 2 &&
    (summary.sport === 'course' || summary.sport === 'trail' || summary.sport === 'rando')
      ? extractCleanRunningBestEffortsFromTrace(runningTraceInput, {
          sessionId: outingId,
          title,
          date: new Date(summary.startedAt).toISOString().slice(0, 10),
        })
      : null;

  const racePredictions = computeRacePredictions(
    [...historyExcludingCurrent, currentProgressionSession],
    timeZone,
    nowDate,
  );

  const avgPaceMinKm =
    distanceKm > 0 && movingS > 0 ? round(movingS / 60 / distanceKm, 2) : null;

  const highlights = detectOutingHighlights(
    {
      id: outingId,
      sport: summary.sport,
      km: distanceKm,
      dplus: verticality.elevGainM,
      durationS: movingS,
      paceMinPerKm: avgPaceMinKm,
      powerW: telemetry.powerAnalysis.averageW,
      heartRateBpm: hrChannel?.avg ?? null,
      maxAlt: verticality.maxAltM,
    },
    historyExcludingCurrent,
  );

  const comparableOutings = findComparableOutings(
    {
      id: outingId,
      title,
      date: new Date(summary.startedAt).toISOString(),
      sport: summary.sport,
      massif: input.locationLabel ?? null,
      routeName: summary.route?.name ?? null,
      km: distanceKm,
      dplus: verticality.elevGainM,
      durationS: movingS,
      paceMinPerKm: avgPaceMinKm,
    },
    historyExcludingCurrent,
    timeZone,
  );

  // ── 7. Audit qualité GPS ─────────────────────────────────────────────────
  const accValues = points
    .map((p) => finiteOrNull(p.acc))
    .filter((v): v is number => v !== null && v >= 0);
  const timedPointCount = points.filter((p) => finiteOrNull(p.t) !== null).length;
  const validElevationCount = points.filter((p) => finiteOrNull(p.ele) !== null).length;
  const gpsAudit: GpsQualityAudit = {
    pointCount: points.length,
    timedPointCount,
    validElevationCount,
    elevationCoveragePct:
      points.length > 0 ? Math.round((validElevationCount / points.length) * 100) : 0,
    avgAccuracyM:
      accValues.length > 0
        ? round(accValues.reduce((a, b) => a + b, 0) / accValues.length, 1)
        : null,
    maxAccuracyM: accValues.length > 0 ? round(Math.max(...accValues), 1) : null,
    filteredSpikeCount: runningTraceRecords?.filteredSpikeCount ?? 0,
    qualityLabel:
      points.length < 2
        ? 'Sans trace GPS'
        : validElevationCount / points.length >= 0.8 &&
            (accValues.length === 0 || accValues.reduce((a, b) => a + b, 0) / accValues.length <= 15)
          ? 'Excellente'
          : points.length >= 10
            ? 'Bonne'
            : 'Partielle',
  };

  // ── 8. Environnement, Soleil NOAA offline, Outing Fit & Récupération ─────
  const refCoord: [number, number] | null =
    points.length > 0 && Number.isFinite(points[0].lng) && Number.isFinite(points[0].lat)
      ? [points[0].lng, points[0].lat]
      : input.centerCoords
        ? [input.centerCoords[0], input.centerCoords[1]]
        : null;

  const daylight = refCoord
    ? computeOfflineDaylight(refCoord[1], refCoord[0], summary.startedAt)
    : null;
  const daylightMarginMin =
    daylight?.civilDuskMs !== null && daylight?.civilDuskMs !== undefined
      ? Math.round((daylight.civilDuskMs - summary.endedAt) / 60_000)
      : null;

  const ridgeWind =
    input.weather && input.weather.windSpeedKmh != null
      ? computeEffectiveRidgeWind(
          input.weather.windSpeedKmh,
          verticality.maxAltM ?? 0,
          (verticality.maxAltM ?? 0) >= 1800,
          input.weather.windGustKmh ?? null,
        )
      : null;

  const thermalStress = computeThermalStress(input.weather, ridgeWind?.effectiveWindKmh ?? null);
  const hydrationLiters = estimateHydrationLiters({
    durationHours: Math.max(0.25, movingS / 3600),
    elevationGainM: verticality.elevGainM,
    maxAltitudeM: verticality.maxAltM,
    weather: input.weather,
    effectiveWindKmh: ridgeWind?.effectiveWindKmh ?? null,
  });

  const safeEta = estimateSafeEta({
    activity: sortieActivity,
    distanceKm: Math.max(0.1, distanceKm),
    elevationGainM: verticality.elevGainM,
    elevationLossM: verticality.elevLossM,
    maxAltitudeM: verticality.maxAltM,
    meanAltitudeM: verticality.avgAltM,
    packWeightKg: safePackKg,
    lat: refCoord ? refCoord[1] : 45.83,
    lng: refCoord ? refCoord[0] : 6.86,
    departureAtMs: summary.startedAt,
    readiness: readinessBefore,
    weather: input.weather,
  });

  const outingFit = scoreOutingFit({
    safeEta,
    readiness: readinessBefore,
    weather: input.weather,
    maxAltitudeM: verticality.maxAltM,
    ridgeExposed: (verticality.maxAltM ?? 0) >= 1800,
  });

  const workoutSport = mapToWorkoutSport(summary.sport);
  const recoveryProgram = buildRecoveryProgram({
    lastPracticeAt: new Date(summary.endedAt).toISOString(),
    sport: workoutSport,
    sportStatus: workoutSport ? 'known' : 'unknown',
    soreness: rpe >= 8 ? 'moderee' : rpe >= 6 ? 'legere' : 'aucune',
    now: summary.endedAt,
  });

  const recoveryTimeline = buildRecoveryTimeline(
    rpe,
    canonicalLoad.loadUnits,
    readinessAfter.eccentricDomsScore,
    hydrationLiters,
    recoveryProgram,
  );

  // ── 9. Modules spécialisés conditionnels (Ski, Natation, Muscu, CO₂) ─────
  let skiDetails: SkiActivityDetails | null = null;
  if (
    profile.identity.familyId === 'snow_winter' ||
    summary.sport === 'ski'
  ) {
    const skiFixes = points
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p, idx) => ({
        t: finiteOrNull(p.t) ?? summary.startedAt + idx * 5000,
        lat: p.lat,
        lng: p.lng,
        ele: finiteOrNull(p.ele),
        acc: finiteOrNull(p.acc),
        speed: finiteOrNull(p.speed),
      }));
    if (skiFixes.length >= 2) {
      const skiVariant =
        profile.identity.slugId.includes('touring') || profile.identity.legacyVariantId === 'ski-rando'
          ? 'ski-rando'
          : profile.identity.slugId.includes('snowboard')
            ? 'snowboard'
            : 'ski-alpin';
      skiDetails = analyzeSkiTrace(skiFixes, {
        variantId: skiVariant,
        units,
        clientSessionId: summary.clientSessionId ?? undefined,
      }).details;
    }
  }

  let swimModule: SwimModuleAnalysis | null = null;
  if (
    profile.identity.familyId === 'swimming_aquatic' ||
    profile.algorithms.primarySpeedUnit === 'min_per_100m'
  ) {
    const swimDistM =
      distanceM > 0
        ? distanceM
        : summary.poolLengthM && summary.poolLengthsCount
          ? summary.poolLengthM * summary.poolLengthsCount
          : 0;
    const paces = computeSwimPace(swimDistM, movingS);
    swimModule = {
      available: swimDistM > 0 && movingS > 0,
      poolLengthM: summary.poolLengthM ?? null,
      poolLengthsCount: summary.poolLengthsCount ?? null,
      pacePer100m: paces.pacePer100m,
      pacePer100yd: paces.pacePer100yd,
      swolf: {
        status: 'unavailable',
        value: null,
        unit: 'swolf',
        formatted: 'Non capté',
        unavailableReason: 'stroke_count_missing',
      },
    };
  }

  const muscleHeatmap =
    input.strengthLog && input.strengthLog.exercises.length > 0
      ? computeMuscleHeatmap(input.strengthLog)
      : null;

  const co2Applicable =
    summary.sport === 'velo' ||
    profile.identity.familyId === 'cycling_mobility' ||
    profile.identity.slugId.includes('commute');
  const co2SavedKg = co2Applicable && distanceKm > 0 ? round(distanceKm * 0.193, 2) : null;
  const wearRefKm = summary.sport === 'velo' ? 4000 : 750;
  const equipmentEco: EquipmentAndEcoAnalysis = {
    co2SavedKg,
    co2Applicable,
    wearHintFr:
      summary.sport === 'velo'
        ? `Usure transmission / pneus estimée sur base 4 000 km (${distanceKm.toFixed(1)} km parcourus).`
        : distanceKm > 0
          ? `Usure semelles / amorti estimée sur base 750 km (${distanceKm.toFixed(1)} km parcourus).`
          : 'Sortie stationnaire / indoor : usure distance non applicable.',
    estimatedGearWearPct: distanceKm > 0 ? round((distanceKm / wearRefKm) * 100, 2) : null,
  };

  // ── 10. Garde stricte RGPD Art. 9 / Strava avant tout pont IA ────────────
  const aiGuard = buildAiActivityInsightPayload(profile, {
    sessionId: outingId,
    profileSlugId: profile.identity.slugId,
    sourceOrigin: input.sourceOrigin ?? 'explorer_native_gps',
    startedAtMs: summary.startedAt,
    endedAtMs: summary.endedAt,
    distanceM,
    movingS,
    elevGainM: verticality.elevGainM,
    rpe,
    avgHrBpm: hrChannel?.avg ?? null,
    maxHrBpm: hrChannel?.max ?? null,
    restingHrBpm: input.thresholds?.fcRest ?? null,
    notes: input.notes ?? null,
  });

  return {
    outingId,
    title,
    sport: summary.sport,
    familyId: profile.identity.familyId,
    units,
    distanceKm,
    movingS,
    elapsedS,
    primarySpeed,
    rpe,
    telemetry,
    gpsAudit,
    verticality,
    climbs,
    difficulty,
    sortiePerformance: resolvedSortiePerf,
    benchmarkDeltaPct,
    lcda,
    fatigue,
    loadProjection,
    outingFit,
    pacing,
    cycling: {
      intensityFactor,
      variabilityIndex,
      estimatedTss,
      powerSkills,
    },
    runningTraceRecords,
    racePredictions,
    highlights,
    comparableOutings,
    daylight,
    daylightMarginMin,
    ridgeWind,
    thermalStress,
    hydrationLiters,
    recoveryProgram,
    recoveryTimeline,
    skiDetails,
    swimModule,
    muscleHeatmap,
    equipmentEco,
    aiGuard,
  };
}

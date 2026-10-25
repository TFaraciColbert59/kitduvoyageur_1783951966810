/**
 * A6 — Adaptateur de difficulté : A3 `predictSegment` agrégé par étape.
 *
 * La difficulté personnelle est la moyenne pondérée par la distance des
 * difficultés de segment. Sans profils des participants, la difficulté groupe
 * n'est calculée que pour un participant unique — sinon `null` explicite.
 */
import 'server-only';
import { predictSegment } from '@/features/adventure-intelligence/domain/prediction';
import type { SegmentPrediction } from '@/features/adventure-intelligence/schemas/prediction.schema';
import { combineConfidence, COLD_CONFIDENCE } from '@/features/adventure-intelligence/domain/confidence';
import {
  makeEngineResult,
  type AdventureEngine,
  type Assumption,
  type EngineWarning,
} from '@/features/adventure-intelligence/domain/engine';
import { EngineSkipSignal } from '@/features/adventure-intelligence/domain/engineRegistry';
import type { PerformanceProfile } from '@/features/adventure-intelligence/schemas/performance.schema';
import type { RouteAdapterOutput } from './routeAdapter';
import { ADAPTER_VERSION, routePredictionEnabled, uniformSegmentsFromItinerary } from './adapterSupport';

export interface DifficultyAdapterInput {
  route?: RouteAdapterOutput | null;
  profile?: PerformanceProfile | null;
  participantsCount?: number;
}

export interface DifficultyAdapterOutput {
  personalDifficulty: number;
  maxEffortScore: number;
  hardestSegmentIds: number[];
  groupDifficulty: number | null;
  segmentation: 'uniform_from_blueprint';
  segmentCount: number;
  /**
   * A10 (10.9) — prédictions par segment (stratégie recommandée) exposées pour
   * la persistance `segment_predictions` (P50/P90, effort, pause).
   */
  segmentPredictions: SegmentPrediction[];
}

export const difficultyAdapter: AdventureEngine<DifficultyAdapterInput, DifficultyAdapterOutput> = {
  id: 'difficulty',
  version: ADAPTER_VERSION,
  dependencies: ['prediction'],
  canRun: () => true,
  async run(input, context) {
    const route = input?.route;
    if (!route) {
      throw new EngineSkipSignal({
        code: 'difficulty_no_source',
        message: 'Aucun itinéraire amont — difficulté non calculable.',
        severity: 'warning',
      });
    }

    const { count, segments } = uniformSegmentsFromItinerary(route.layers.itinerary?.value);
    const profile = input.profile ?? null;
    const participants = Math.max(1, Math.trunc(input.participantsCount ?? 1));
    const flagEnabled = routePredictionEnabled(context);

    const predictions: SegmentPrediction[] = segments.map((segment) =>
      predictSegment(
        {
          segmentId: segment.segmentId,
          distanceM: segment.distanceM,
          gainM: segment.gainM,
          lossM: segment.lossM,
          technicalClass: segment.technicalClass ?? null,
          packWeightKg: null,
        },
        profile,
        profile?.confidence ?? null,
        { flagEnabled }
      )
    );

    const totalDistance = segments.reduce((sum, segment) => sum + Math.max(0, segment.distanceM), 0);
    const weightedDifficulty = predictions.reduce(
      (sum, prediction, index) =>
        sum + prediction.personalDifficulty * Math.max(0, segments[index].distanceM),
      0
    );
    const personalDifficulty =
      totalDistance > 0 ? Math.round(weightedDifficulty / totalDistance) : 0;
    const maxEffortScore = predictions.reduce(
      (max, prediction) => Math.max(max, prediction.effortScore),
      0
    );
    const hardestSegmentIds = [...predictions]
      .sort((a, b) => b.personalDifficulty - a.personalDifficulty)
      .slice(0, 3)
      .map((prediction) => prediction.segmentId);

    const groupDifficulty = participants <= 1 ? personalDifficulty : null;

    const warnings: EngineWarning[] = [];
    if (groupDifficulty === null) {
      warnings.push({
        code: 'group_profiles_missing',
        message:
          'Profils des participants indisponibles — difficulté groupe laissée vide (aucune moyenne inventée).',
        severity: 'info',
      });
    }

    const assumptions: Assumption[] = [
      {
        id: 'uniform_segmentation',
        label: 'Découpage uniforme des étapes',
        detail: `${count} étape(s) moyennes issues du blueprint.`,
      },
    ];

    return makeEngineResult({
      value: {
        personalDifficulty,
        maxEffortScore,
        hardestSegmentIds,
        groupDifficulty,
        segmentation: 'uniform_from_blueprint',
        segmentCount: count,
        segmentPredictions: predictions,
      },
      confidence:
        predictions.length > 0
          ? combineConfidence(...predictions.map((prediction) => prediction.confidence))
          : { ...COLD_CONFIDENCE, reasons: [...COLD_CONFIDENCE.reasons] },
      provenance: [
        {
          source: 'computed',
          sourceRef: 'a6:difficultyAdapter',
          notes: 'Agrégation A3 (predictSegment) pondérée par la distance',
        },
      ],
      assumptions,
      warnings,
      computedAt: context.nowIso,
    });
  },
};

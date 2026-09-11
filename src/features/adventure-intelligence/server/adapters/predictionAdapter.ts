/**
 * A6 — Adaptateur de prédiction : A3 `predictRoute` (profil fourni, sinon repli standard).
 *
 * Les agrégats du blueprint sont découpés en étapes uniformes (hypothèse
 * explicite) ; sans profil personnel, `resolvePace` retombe sur l'allure
 * standard et l'incertitude est élargie par le moteur A3.
 */
import {
  predictRoute,
  STRATEGIES,
  type LearnedRoutePrediction,
} from '@/features/adventure-intelligence/domain/prediction';
import { combineConfidence } from '@/features/adventure-intelligence/domain/confidence';
import {
  makeEngineResult,
  type AdventureEngine,
  type Assumption,
  type EngineWarning,
} from '@/features/adventure-intelligence/domain/engine';
import { EngineSkipSignal } from '@/features/adventure-intelligence/domain/engineRegistry';
import type { PerformanceProfile } from '@/features/adventure-intelligence/schemas/performance.schema';
import type { RouteAdapterOutput } from './routeAdapter';
import { ADAPTER_VERSION, uniformSegmentsFromItinerary } from './adapterSupport';

export interface PredictionAdapterInput {
  route?: RouteAdapterOutput | null;
  profile?: PerformanceProfile | null;
  startAt?: string;
}

export interface PredictionAdapterOutput {
  strategies: LearnedRoutePrediction[];
  primary: LearnedRoutePrediction;
  segmentation: 'uniform_from_blueprint';
  segmentCount: number;
}

export const predictionAdapter: AdventureEngine<PredictionAdapterInput, PredictionAdapterOutput> = {
  id: 'prediction',
  version: ADAPTER_VERSION,
  dependencies: ['route'],
  canRun: () => true,
  async run(input, context) {
    const route = input?.route;
    if (!route) {
      throw new EngineSkipSignal({
        code: 'prediction_no_source',
        message: 'Aucun itinéraire amont — prédiction impossible.',
        severity: 'warning',
      });
    }

    const itinerary = route.layers.itinerary;
    const { count, segments } = uniformSegmentsFromItinerary(itinerary?.value);
    const profile = input.profile ?? null;
    const startAt = input.startAt ?? context.nowIso;

    const strategies = STRATEGIES.map((strategy) =>
      predictRoute(
        {
          segments,
          startAt,
          profile,
          confidence: profile?.confidence ?? null,
          packWeightKg: null,
        },
        strategy
      )
    );

    const primary = strategies.find((strategy) => strategy.strategy === 'recommended') ?? strategies[0];

    const warnings: EngineWarning[] = [...primary.warnings];
    warnings.push({
      code: 'uniform_segmentation',
      message:
        'Étapes découpées uniformément à partir des agrégats du blueprint — aucune géométrie de trace.',
      severity: 'info',
    });

    const assumptions: Assumption[] = [
      {
        id: 'uniform_segmentation',
        label: 'Découpage uniforme des étapes',
        detail: `${count} étape(s) de longueur et de dénivelé moyens issus du blueprint.`,
      },
      {
        id: profile ? 'provided_profile' : 'standard_pace',
        label: profile ? 'Profil de performance fourni' : 'Allure standard (aucun profil)',
        detail: profile
          ? `Profil ${profile.calibrationLevel} — ${profile.sampleCount} observation(s).`
          : 'Cascade A3 : profil absent → allure standard de 15 min/km.',
      },
    ];

    return makeEngineResult({
      value: {
        strategies,
        primary,
        segmentation: 'uniform_from_blueprint',
        segmentCount: count,
      },
      confidence: combineConfidence(...strategies.map((strategy) => strategy.confidence)),
      provenance: [
        {
          source: 'computed',
          sourceRef: 'a6:predictionAdapter',
          notes: 'Prédiction A3 (predictRoute) sur étapes moyennes du blueprint',
        },
      ],
      assumptions,
      warnings,
      computedAt: context.nowIso,
    });
  },
};

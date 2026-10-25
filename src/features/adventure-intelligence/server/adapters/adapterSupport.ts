/**
 * A6 — Support commun des adaptateurs (serveur).
 *
 * Conversions honnêtes entre les moteurs existants (trips/A3) et le contrat
 * `AdventureEngine` : la confiance et la provenance ne sont jamais inventées,
 * elles sont dérivées des propositions du catalogue ou déclarées `computed`.
 */
import 'server-only';
import { makeConfidence, type Confidence } from '@/features/adventure-intelligence/domain/confidence';
import type { AdventureExecutionContext } from '@/features/adventure-intelligence/domain/engine';
import type { DataProvenance } from '@/features/adventure-intelligence/domain/provenance';
import type { RouteSegmentInput } from '@/features/adventure-intelligence/domain/prediction';
import type { Proposal } from '@/features/trips/schemas/autoGen.schema';

/** Version commune des adaptateurs A6 (observabilité `adventure_engine_runs`). */
export const ADAPTER_VERSION = 'a6-v1';

/**
 * Flag `route_prediction_v2` dans le contexte moteur : absent (appels internes,
 * tests) ⇒ activé par défaut, rétrocompatible ; présent ⇒ strictement `true`
 * (toute autre valeur, y compris absente de la RPC, désactive le profil).
 */
export function routePredictionEnabled(context: AdventureExecutionContext): boolean {
  if (!context.featureFlags) return true;
  return context.featureFlags.route_prediction_v2 === true;
}

const PROPOSAL_LEVEL_SCORES: Record<Proposal['confidence'], number> = {
  high: 0.8,
  medium: 0.6,
  low: 0.35,
};

export function confidenceFromProposal(proposal: Pick<Proposal, 'confidence'>): Confidence {
  const score = PROPOSAL_LEVEL_SCORES[proposal.confidence] ?? 0.35;
  return makeConfidence({
    score,
    sampleCount: 0,
    method: 'autogen_blueprint',
    reasons: ['Blueprint du catalogue LKDV (estimations non vérifiées sur le terrain)'],
  });
}

export function provenanceFromProposal(
  proposal: Pick<Proposal, 'provenance'>,
  fallbackSourceRef: string
): DataProvenance[] {
  const provenance = proposal.provenance;
  if (!provenance) {
    return [{ source: 'estimated', sourceRef: fallbackSourceRef }];
  }
  return [
    {
      source: provenance.source,
      sourceRef: provenance.sourceRef ?? fallbackSourceRef,
      observedAt: provenance.observedAt,
    },
  ];
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Découpe déterministe des agrégats du blueprint en étapes uniformes.
 * Hypothèse explicite : aucune géométrie de trace n'est disponible à ce stade.
 */
export function uniformSegmentsFromItinerary(itineraryValue: unknown): {
  count: number;
  segments: RouteSegmentInput[];
} {
  const record = (itineraryValue ?? {}) as Record<string, unknown>;
  const totalDistanceKm = Math.max(0, finiteNumber(record.totalDistanceKm, 0));
  const totalGainM = Math.max(0, finiteNumber(record.totalGainM, 0));
  const totalLossM = Math.max(0, finiteNumber(record.totalLossM, totalGainM));
  const count = Math.max(1, Math.round(finiteNumber(record.stagesCount, 1)));

  const segments: RouteSegmentInput[] = Array.from({ length: count }, (_, index) => ({
    segmentId: index + 1,
    distanceM: (totalDistanceKm * 1000) / count,
    gainM: totalGainM / count,
    lossM: totalLossM / count,
    technicalClass: null,
  }));

  return { count, segments };
}

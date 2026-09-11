/**
 * A6 — Adaptateur d'itinéraire : `autoGenPipeline` (blueprint + couches + solveur).
 *
 * Aucune donnée inventée : tout provient du catalogue de blueprints existant,
 * la confiance reste celle de la proposition (catalogue = estimations).
 */
import { runAutoGenPipeline } from '@/features/trips/engine/autoGenPipeline';
import type { Proposal, TripBrief } from '@/features/trips/schemas/autoGen.schema';
import type { AdventureEngine, Assumption, EngineWarning } from '@/features/adventure-intelligence/domain/engine';
import { makeEngineResult } from '@/features/adventure-intelligence/domain/engine';
import type { DataProvenance } from '@/features/adventure-intelligence/domain/provenance';
import { ADAPTER_VERSION, confidenceFromProposal, provenanceFromProposal } from './adapterSupport';

export interface RouteAdapterInput {
  text?: string | null;
}

export interface RouteAdapterOutput {
  blueprintId: string;
  layers: Record<string, Proposal<unknown>>;
  tradeoffsLog: string[];
  executionTimeMs: number;
  brief: TripBrief;
}

function collectProvenance(layers: Record<string, Proposal<unknown>>): DataProvenance[] {
  const seen = new Set<string>();
  const provenance: DataProvenance[] = [];

  for (const layer of Object.values(layers)) {
    for (const entry of provenanceFromProposal(layer, 'Catalogue de référence LKDV')) {
      const key = `${entry.source}:${entry.sourceRef ?? ''}:${entry.observedAt ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      provenance.push(entry);
    }
  }

  return provenance.length > 0
    ? provenance
    : [{ source: 'estimated', sourceRef: 'Catalogue de référence LKDV' }];
}

export const routeAdapter: AdventureEngine<RouteAdapterInput, RouteAdapterOutput> = {
  id: 'route',
  version: ADAPTER_VERSION,
  dependencies: ['intent'],
  canRun: () => true,
  async run(input, context) {
    const text = typeof input?.text === 'string' ? input.text.trim() : '';
    if (text.length === 0) {
      throw new Error('Texte d’intention vide — pipeline impossible');
    }

    const pipeline = await runAutoGenPipeline(text);
    const layers = pipeline.layers as Record<string, Proposal<unknown>>;
    const itinerary = layers.itinerary;

    const warnings: EngineWarning[] = pipeline.tradeoffsLog.map((tradeoff, index) => ({
      code: `tradeoff_${index + 1}`,
      message: tradeoff,
      severity: 'info',
    }));

    const assumptions: Assumption[] = [
      {
        id: 'blueprint_catalogue',
        label: 'Blueprint du catalogue LKDV',
        detail: `Blueprint ${pipeline.blueprintId} — valeurs estimées, à confirmer.`,
      },
    ];

    return makeEngineResult({
      value: {
        blueprintId: pipeline.blueprintId,
        layers,
        tradeoffsLog: [...pipeline.tradeoffsLog],
        executionTimeMs: pipeline.executionTimeMs,
        brief: pipeline.brief,
      },
      confidence: itinerary
        ? confidenceFromProposal(itinerary)
        : { score: 0.35, level: 'low', sampleCount: 0, method: 'autogen_blueprint', reasons: ['Couches blueprint indisponibles'] },
      provenance: collectProvenance(layers),
      assumptions,
      warnings,
      computedAt: context.nowIso,
    });
  },
};

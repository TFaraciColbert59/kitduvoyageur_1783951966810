/**
 * A6 — Adaptateur d'intention : `tripBriefExtractor` (déterministe, sans LLM).
 */
import { extractTripBrief } from '@/features/trips/engine/tripBriefExtractor';
import type { TripBrief } from '@/features/trips/schemas/autoGen.schema';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';
import {
  makeEngineResult,
  type AdventureEngine,
  type Assumption,
  type EngineWarning,
} from '@/features/adventure-intelligence/domain/engine';
import { ADAPTER_VERSION } from './adapterSupport';

export interface IntentAdapterInput {
  text?: string | null;
}

const INTAKE_SCORES = { stated: 0.85, inferred: 0.6, defaulted: 0.3 } as const;

export const intentAdapter: AdventureEngine<IntentAdapterInput, TripBrief> = {
  id: 'intent',
  version: ADAPTER_VERSION,
  dependencies: [],
  canRun: () => true,
  async run(input, context) {
    const text = typeof input?.text === 'string' ? input.text.trim() : '';
    if (text.length === 0) {
      throw new Error('Texte d’intention vide — extraction impossible');
    }

    const brief = extractTripBrief(text);
    const destinationConfidence = brief.destinations.confidence;
    const durationConfidence = brief.duration.confidence;
    const windowConfidence = brief.window.confidence;
    const score = Math.min(
      INTAKE_SCORES[destinationConfidence],
      INTAKE_SCORES[durationConfidence],
      INTAKE_SCORES[windowConfidence]
    );

    const warnings: EngineWarning[] = [];
    if (destinationConfidence === 'defaulted') {
      warnings.push({
        code: 'destination_default',
        message: 'Destination par défaut (France) — à confirmer par l’utilisateur.',
        severity: 'warning',
      });
    }
    if (durationConfidence === 'defaulted') {
      warnings.push({
        code: 'duration_default',
        message: 'Durée déduite des règles par défaut — à confirmer.',
        severity: 'info',
      });
    }

    const assumptions: Assumption[] = [
      {
        id: 'deterministic_extraction',
        label: 'Extraction déterministe du texte',
        detail: 'Aucun LLM n’intervient dans l’extraction d’intention.',
      },
    ];

    return makeEngineResult({
      value: brief,
      confidence: makeConfidence({
        score,
        sampleCount: 0,
        method: 'trip_brief_extractor',
        reasons: ['Extraction par dictionnaire et expressions régulières du catalogue LKDV'],
      }),
      provenance: [
        {
          source: 'computed',
          sourceRef: 'a6:intentAdapter',
          notes: 'Extraction déterministe (tripBriefExtractor)',
        },
      ],
      assumptions,
      warnings,
      computedAt: context.nowIso,
    });
  },
};

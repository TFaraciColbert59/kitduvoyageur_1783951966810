/**
 * A6 — Adaptateur sécurité : couche `safety` du blueprint (source déterministe).
 *
 * Les numéros et unités de secours proviennent du catalogue LKDV (provenance
 * `estimated`) et sont explicitement marqués « à vérifier avant départ ».
 * Sans couche `safety`, l'adaptateur skippe — aucune coordonnée inventée.
 */
import 'server-only';
import type { Proposal } from '@/features/trips/schemas/autoGen.schema';
import {
  makeEngineResult,
  type AdventureEngine,
  type Assumption,
  type EngineWarning,
  type PlanImpact,
} from '@/features/adventure-intelligence/domain/engine';
import { EngineSkipSignal } from '@/features/adventure-intelligence/domain/engineRegistry';
import type { RouteAdapterOutput } from './routeAdapter';
import { ADAPTER_VERSION, confidenceFromProposal, provenanceFromProposal } from './adapterSupport';

export interface SafetyAdapterInput {
  route?: RouteAdapterOutput | null;
}

export interface SafetyAdapterOutput {
  rescuePhone?: string;
  rescueUnit?: string;
  primaryHazard?: string;
  [key: string]: unknown;
}

export const safetyAdapter: AdventureEngine<SafetyAdapterInput, SafetyAdapterOutput> = {
  id: 'safety',
  version: ADAPTER_VERSION,
  dependencies: ['route'],
  canRun: () => true,
  async run(input, context) {
    const proposal = input?.route?.layers?.safety as Proposal<SafetyAdapterOutput> | undefined;
    if (!proposal) {
      throw new EngineSkipSignal({
        code: 'safety_no_source',
        message:
          'Aucune couche sécurité dans le blueprint — section safetyPlan laissée vide (aucune donnée inventée).',
        severity: 'warning',
      });
    }

    const warnings: EngineWarning[] = [];
    if (proposal.confidence === 'low') {
      warnings.push({
        code: 'safety_estimate',
        message:
          'Plan de sécurité issu du catalogue LKDV (estimation) — numéros et unités à vérifier avant départ.',
        severity: 'warning',
      });
    }

    const assumptions: Assumption[] = [
      {
        id: 'safety_catalogue',
        label: 'Plan de sécurité issu du catalogue LKDV',
        detail: 'À vérifier avant le départ : coordonnées et couverture de secours locales.',
      },
    ];

    const impacts: PlanImpact[] = [
      {
        id: 'safety-plan',
        section: 'safetyPlan',
        label: 'Plan de sécurité proposé',
        severity: 'warning',
      },
    ];

    return makeEngineResult({
      value: { ...proposal.value },
      confidence: confidenceFromProposal(proposal),
      provenance: provenanceFromProposal(proposal, 'Catalogue de référence LKDV (sécurité)'),
      assumptions,
      warnings,
      impacts,
      computedAt: context.nowIso,
    });
  },
};

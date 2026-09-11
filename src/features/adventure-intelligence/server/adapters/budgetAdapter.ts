/**
 * A6 — Adaptateur budget : `budgetEngine.calculateBudgetSummary`.
 *
 * Le budget prévisionnel provient de la couche `budget` du blueprint ;
 * le moteur existant calcule le résumé (dépenses réelles vides, reste à
 * engager). Aucune dépense n'est inventée.
 */
import 'server-only';
import {
  calculateBudgetSummary,
  type BudgetSummary,
} from '@/features/trips/engine/budgetEngine';
import type { Proposal } from '@/features/trips/schemas/autoGen.schema';
import type { AdventureEngine, EngineWarning } from '@/features/adventure-intelligence/domain/engine';
import { makeEngineResult } from '@/features/adventure-intelligence/domain/engine';
import { EngineSkipSignal } from '@/features/adventure-intelligence/domain/engineRegistry';
import type { RouteAdapterOutput } from './routeAdapter';
import { ADAPTER_VERSION, confidenceFromProposal, provenanceFromProposal } from './adapterSupport';

export interface BudgetAdapterInput {
  route?: RouteAdapterOutput | null;
  participantsCount?: number;
}

export interface BudgetAdapterOutput {
  perPersonEur: number | null;
  totalEur: number | null;
  currency: string;
  summary: BudgetSummary;
}

export const budgetAdapter: AdventureEngine<BudgetAdapterInput, BudgetAdapterOutput> = {
  id: 'budget',
  version: ADAPTER_VERSION,
  dependencies: ['route'],
  canRun: () => true,
  async run(input, context) {
    const proposal = input?.route?.layers?.budget as Proposal<Record<string, unknown>> | undefined;
    const rawPerPerson = proposal?.value?.totalPerPersonEur;
    if (!proposal || typeof rawPerPerson !== 'number' || !Number.isFinite(rawPerPerson)) {
      throw new EngineSkipSignal({
        code: 'budget_no_source',
        message:
          'Aucune couche budget exploitable dans le blueprint — section budget laissée vide (aucune donnée inventée).',
        severity: 'warning',
      });
    }

    const participants = Math.max(1, Math.trunc(input.participantsCount ?? 1));
    const perPersonEur = Math.max(0, rawPerPerson);
    const totalEur = Math.round(perPersonEur * participants * 100) / 100;
    const currency =
      typeof proposal.value.currency === 'string' && proposal.value.currency.length > 0
        ? proposal.value.currency
        : 'EUR';

    const summary = calculateBudgetSummary(
      { estimated_budget: totalEur, budget_currency: currency },
      []
    );

    const warnings: EngineWarning[] = [];
    if (proposal.confidence === 'low') {
      warnings.push({
        code: 'budget_estimate',
        message:
          'Budget prévisionnel issu du catalogue (estimation) — les dépenses réelles restent à saisir.',
        severity: 'info',
      });
    }

    return makeEngineResult({
      value: { perPersonEur, totalEur, currency, summary },
      confidence: confidenceFromProposal(proposal),
      provenance: provenanceFromProposal(proposal, 'Catalogue de référence LKDV (budget)'),
      warnings,
      computedAt: context.nowIso,
    });
  },
};

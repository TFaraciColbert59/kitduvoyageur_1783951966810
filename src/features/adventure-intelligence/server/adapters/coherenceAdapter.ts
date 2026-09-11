/**
 * A6 — Adaptateur de cohérence : `coherenceSolver.solveCoherence`.
 *
 * Les verrous fournis par l'utilisateur sont liés aux propositions par
 * identifiant de proposition, de slot ou de couche ; le solveur ne peut jamais
 * les modifier silencieusement. Toute violation résiduelle est détectée,
 * restaurée et exposée dans `lockReport` (décision à confirmer côté appelant).
 */
import 'server-only';
import { solveCoherence } from '@/features/trips/engine/coherenceSolver';
import type { Proposal } from '@/features/trips/schemas/autoGen.schema';
import type { AdventureConstraint } from '@/features/adventure-intelligence/domain/constraints';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';
import { makeEngineResult, type AdventureEngine, type EngineWarning } from '@/features/adventure-intelligence/domain/engine';
import { detectLockViolations } from '@/features/adventure-intelligence/domain/locks';
import { EngineSkipSignal } from '@/features/adventure-intelligence/domain/engineRegistry';
import type { RouteAdapterOutput } from './routeAdapter';
import { ADAPTER_VERSION } from './adapterSupport';

export interface CoherenceAdapterInput {
  route?: RouteAdapterOutput | null;
  locks?: AdventureConstraint[] | null;
}

export interface CoherenceLockReport {
  before: AdventureConstraint[];
  after: AdventureConstraint[];
  violations: string[];
}

export interface CoherenceAdapterOutput {
  resolvedLayers: Record<string, Proposal<unknown>>;
  tradeoffsLog: string[];
  lockReport: CoherenceLockReport;
}

const LEVEL_SCORES = { high: 0.8, medium: 0.6, low: 0.35 } as const;

function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function lockMatchesLayer(lock: AdventureConstraint, layerKey: string, proposal: Proposal<unknown>): boolean {
  return (
    lock.id === proposal.id ||
    lock.id === proposal.slotId ||
    lock.id === proposal.layer ||
    lock.id === layerKey
  );
}

function lockedConstraints(layers: Record<string, Proposal<unknown>>): AdventureConstraint[] {
  return Object.entries(layers)
    .filter(([, proposal]) => proposal.locked)
    .map(([key, proposal]) => ({
      id: proposal.id,
      kind: 'hard' as const,
      label: `${key} verrouillé`,
      value: proposal.value,
      locked: true,
      source: proposal.editedByUser ? ('user' as const) : ('system' as const),
    }));
}

export const coherenceAdapter: AdventureEngine<CoherenceAdapterInput, CoherenceAdapterOutput> = {
  id: 'coherence',
  version: ADAPTER_VERSION,
  dependencies: ['route'],
  canRun: () => true,
  async run(input, context) {
    const route = input?.route;
    if (!route) {
      throw new EngineSkipSignal({
        code: 'coherence_no_source',
        message: 'Aucun itinéraire amont — cohérence non calculable.',
        severity: 'warning',
      });
    }

    const layers = JSON.parse(JSON.stringify(route.layers)) as Record<string, Proposal<unknown>>;
    const locks = input.locks ?? [];

    for (const [key, proposal] of Object.entries(layers)) {
      if (locks.some((lock) => lock.locked && lockMatchesLayer(lock, key, proposal))) {
        proposal.locked = true;
      }
    }

    const budgetLock = locks.find((lock) => lock.locked && lock.id === 'budget' && isNumeric(lock.value));
    const briefBudget = route.brief.budget.value.totalEur;
    const maxBudgetEur = budgetLock
      ? (budgetLock.value as number)
      : isNumeric(briefBudget)
        ? briefBudget
        : undefined;

    const before = lockedConstraints(layers);
    const { resolvedLayers, tradeoffsLog } = solveCoherence({
      layers,
      maxBudgetEur,
      userBodyWeightKg: 70,
      intensity: route.brief.intensity.value,
    });

    const resolved = resolvedLayers as Record<string, Proposal<unknown>>;
    const violations = detectLockViolations(before, lockedConstraints(resolved));

    if (violations.length > 0) {
      for (const constraint of before) {
        if (!violations.includes(constraint.id)) continue;
        const originalEntry = Object.entries(layers).find(
          ([, proposal]) => proposal.id === constraint.id
        );
        const resolvedEntry = Object.entries(resolved).find(
          ([, proposal]) => proposal.id === constraint.id
        );
        if (originalEntry && resolvedEntry) resolved[resolvedEntry[0]] = originalEntry[1];
      }
      tradeoffsLog.push(
        `Verrou(s) restauré(s) après modification par le solveur : ${violations.join(', ')}.`
      );
    }

    const scores = Object.values(resolved)
      .map((proposal) => LEVEL_SCORES[proposal.confidence] ?? 0.35)
      .filter((score) => Number.isFinite(score));
    const score = scores.length > 0 ? Math.min(...scores) : 0.35;

    const warnings: EngineWarning[] = tradeoffsLog.map((tradeoff, index) => ({
      code: `tradeoff_${index + 1}`,
      message: tradeoff,
      severity: 'info',
    }));

    return makeEngineResult({
      value: {
        resolvedLayers: resolved,
        tradeoffsLog: [...tradeoffsLog],
        lockReport: { before, after: lockedConstraints(resolved), violations },
      },
      confidence: makeConfidence({
        score,
        sampleCount: 0,
        method: 'coherence_solver',
        reasons: ['Arbitrage déterministe budget / portage / ravitaillement'],
      }),
      provenance: [
        {
          source: 'computed',
          sourceRef: 'a6:coherenceAdapter',
          notes: 'Arbitrage issu du solveur de cohérence (verrous respectés)',
        },
      ],
      warnings,
      computedAt: context.nowIso,
    });
  },
};

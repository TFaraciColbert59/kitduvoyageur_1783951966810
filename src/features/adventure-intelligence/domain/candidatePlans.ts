/**
 * A11 #14 — Trois plans candidats complets (confort / équilibré / aventure).
 *
 * Le plan de référence est cloné en profondeur puis différencié de façon
 * pure et déterministe : distances et durées d'étape mises à l'échelle à
 * partir des deltas de `candidates.ts`, stratégie d'allure A3 choisie par
 * variante, budget ajusté du delta publié. Aucune donnée n'est inventée :
 * chaque section modifiée reçoit une provenance `estimated` et un
 * `computedAt` unique et cohérent. Le plan de référence n'est jamais muté.
 */
import { CANDIDATE_IDS, type AdventureCandidate, type AdventureCandidateId } from './candidates';
import type { AdventurePlan, PlanValue } from './adventurePlan';
import type { Assumption } from './engine';
import { STRATEGY_SPEED_FACTORS, type LearnedRoutePrediction } from './prediction';
import type { RouteStrategy } from '../schemas/prediction.schema';

/** Stratégie d'allure A3 associée par défaut à chaque variante. */
export const CANDIDATE_PACE_STRATEGIES: Record<AdventureCandidateId, RouteStrategy> = {
  comfort: 'comfort',
  balanced: 'recommended',
  adventure: 'fast',
};

/** Référence de provenance des valeurs mises à l'échelle par variante. */
export const CANDIDATE_SOURCE_PREFIX = 'a11:candidatePlans';

export interface CandidateStrategyInputs {
  /** Deltas issus de `buildCandidates` — jamais réinventés ici. */
  candidates?: AdventureCandidate[];
  /** Surcharge explicite de la stratégie d'allure par variante. */
  paceStrategyByCandidate?: Partial<Record<AdventureCandidateId, RouteStrategy>>;
  /** Horodatage de calcul des variantes (défaut : `updatedAt` du plan). */
  now?: string;
}

export interface BuildCandidatePlansBase {
  plan: AdventurePlan;
  strategyInputs: CandidateStrategyInputs;
}

interface CandidateProfile {
  id: AdventureCandidateId;
  label: string;
  paceStrategy: RouteStrategy;
  /** Mise à l'échelle des distances/dénivelés (dérivée de `effortDeltaPct`). */
  distanceFactor: number;
  /** Mise à l'échelle des jours d'itinéraire (dérivée de `durationDeltaPct`). */
  daysFactor: number;
  /** Mise à l'échelle des durées de déplacement (distance / facteur d'allure). */
  durationFactor: number;
  budgetDeltaPct: number;
  comfortScore: number;
  riskScore: number;
  uncertainty: number;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function scaledNumber(value: unknown, factor: number): unknown {
  const number = finiteNumber(value);
  return number === null ? value : round(number * factor, 2);
}

function profileFromCandidate(
  candidate: AdventureCandidate,
  paceStrategy: RouteStrategy
): CandidateProfile {
  const distanceFactor = Math.max(0.5, 1 + candidate.effortDeltaPct / 100);
  const daysFactor = Math.max(0.5, 1 + candidate.durationDeltaPct / 100);
  const speedFactor = STRATEGY_SPEED_FACTORS[paceStrategy];
  return {
    id: candidate.id,
    label: candidate.label,
    paceStrategy,
    distanceFactor,
    daysFactor,
    durationFactor: distanceFactor / (speedFactor > 0 ? speedFactor : 1),
    budgetDeltaPct: candidate.budgetDeltaPct,
    comfortScore: candidate.comfortScore,
    riskScore: candidate.riskScore,
    uncertainty: candidate.uncertainty,
  };
}

function resolveProfiles(strategyInputs: CandidateStrategyInputs): CandidateProfile[] {
  const candidates = strategyInputs.candidates;
  return CANDIDATE_IDS.map((id) => {
    const candidate = candidates?.find((entry) => entry.id === id);
    if (!candidate) {
      throw new Error(
        `Variante ${id} absente : impossible de construire les plans candidats sans les deltas publiés.`
      );
    }
    const paceStrategy =
      strategyInputs.paceStrategyByCandidate?.[id] ?? CANDIDATE_PACE_STRATEGIES[id];
    return profileFromCandidate(candidate, paceStrategy);
  });
}

function candidateProvenance(profile: CandidateProfile, detail: string) {
  return {
    source: 'estimated' as const,
    sourceRef: `${CANDIDATE_SOURCE_PREFIX}:${profile.id}`,
    notes: detail,
  };
}

function candidateAssumption(profile: CandidateProfile, detail: string): Assumption {
  return {
    id: `candidate_${profile.id}_scaling`,
    label: `Variante ${profile.label}`,
    detail,
  };
}

/** Clone une section en remplaçant valeur/provenance/hypothèses/horodatage. */
function withCandidateEstimate<T>(
  section: PlanValue<T>,
  profile: CandidateProfile,
  now: string,
  detail: string,
  value: T
): PlanValue<T> {
  return {
    ...section,
    value,
    provenance: [candidateProvenance(profile, detail), ...section.provenance],
    assumptions: [...section.assumptions, candidateAssumption(profile, detail)],
    computedAt: now,
  };
}

function scalePrediction(
  prediction: LearnedRoutePrediction,
  factor: number
): LearnedRoutePrediction {
  const p50 = Math.max(1, Math.round(prediction.totalDurationP50Seconds * factor));
  const p90 = Math.max(p50, Math.round(prediction.totalDurationP90Seconds * factor));
  const startMs = Date.parse(prediction.etaP50) - prediction.totalDurationP50Seconds * 1000;
  const validStart = Number.isFinite(startMs) ? startMs : Date.parse(prediction.etaP50);
  return {
    ...prediction,
    totalDurationP50Seconds: p50,
    totalDurationP90Seconds: p90,
    pausesSeconds: Math.max(0, Math.round(prediction.pausesSeconds * factor)),
    etaP50: Number.isFinite(validStart) ? new Date(validStart + p50 * 1000).toISOString() : prediction.etaP50,
    etaP90: Number.isFinite(validStart) ? new Date(validStart + p90 * 1000).toISOString() : prediction.etaP90,
  };
}

interface PaceStrategiesValue {
  strategies?: LearnedRoutePrediction[];
  primary?: LearnedRoutePrediction;
  [key: string]: unknown;
}

function scaledPaceStrategies(
  value: unknown,
  profile: CandidateProfile
): { strategies: LearnedRoutePrediction[]; primary: LearnedRoutePrediction | null } {
  const record = (value ?? {}) as PaceStrategiesValue;
  const strategies = Array.isArray(record.strategies)
    ? record.strategies.map((strategy) => scalePrediction(strategy, profile.distanceFactor))
    : [];
  const primary =
    strategies.find((strategy) => strategy.strategy === profile.paceStrategy) ??
    (record.primary ? scalePrediction(record.primary, profile.distanceFactor) : strategies[0]) ??
    null;
  return { strategies, primary };
}

function roundBudgetSummary(summary: unknown, deltaPct: number): unknown {
  if (summary === null || typeof summary !== 'object') return summary;
  const record = summary as Record<string, unknown>;
  const scaled = { ...record };
  for (const key of ['estimatedBudget', 'remainingBudget', 'plannedTotal'] as const) {
    const number = finiteNumber(record[key]);
    if (number !== null) scaled[key] = round(number * (1 + deltaPct / 100), 2);
  }
  return scaled;
}

function variantDetail(profile: CandidateProfile): string {
  const budget =
    profile.budgetDeltaPct === 0
      ? 'budget de référence'
      : `budget ${profile.budgetDeltaPct > 0 ? '+' : ''}${profile.budgetDeltaPct} %`;
  return `Variante ${profile.label} (allure ${profile.paceStrategy}, ${budget}) : distances ×${round(profile.distanceFactor, 2)}, jours ×${round(profile.daysFactor, 2)}, durées ×${round(profile.durationFactor, 2)}.`;
}

/**
 * Produit les trois plans candidats complets dans l'ordre canonique
 * `comfort → balanced → adventure`. Chaque plan est un clone indépendant :
 * le plan de base et les candidats ne partagent aucune référence mutable.
 */
export function buildCandidatePlans(base: BuildCandidatePlansBase): AdventurePlan[] {
  const now = base.strategyInputs.now ?? base.plan.updatedAt;
  const profiles = resolveProfiles(base.strategyInputs);

  return profiles.map((profile) => {
    const plan = structuredClone(base.plan);
    const detail = variantDetail(profile);

    // 1) Terrain : distance et dénivelés mis à l'échelle de l'effort de la variante.
    const terrain = plan.sections.terrainAnalysis;
    let totalDistanceKm: number | null = null;
    if (terrain && terrain.value !== null && typeof terrain.value === 'object') {
      const record = terrain.value as Record<string, unknown>;
      const scaled = {
        ...record,
        totalDistanceKm: scaledNumber(record.totalDistanceKm, profile.distanceFactor),
        totalGainM: scaledNumber(record.totalGainM, profile.distanceFactor),
        totalLossM: scaledNumber(record.totalLossM, profile.distanceFactor),
      };
      totalDistanceKm = finiteNumber(scaled.totalDistanceKm);
      plan.sections.terrainAnalysis = withCandidateEstimate(terrain, profile, now, detail, scaled);
    }

    // 2) Itinéraire proposé : mêmes agrégats mis à l'échelle, difficulté inchangée.
    const routes = plan.sections.activityRoutes;
    if (routes && routes.value !== null && typeof routes.value === 'object') {
      const record = routes.value as Record<string, unknown>;
      const scaled = {
        ...record,
        totalDistanceKm: scaledNumber(record.totalDistanceKm, profile.distanceFactor),
        totalGainM: scaledNumber(record.totalGainM, profile.distanceFactor),
        totalLossM: scaledNumber(record.totalLossM, profile.distanceFactor),
      };
      plan.sections.activityRoutes = withCandidateEstimate(routes, profile, now, detail, scaled);
    }

    // 3) Stratégies d'allure : durées/P90/ETA mis à l'échelle, primaire choisie.
    const pace = plan.sections.paceStrategies;
    let primaryDurationP50: number | null = null;
    if (pace && pace.value !== null && typeof pace.value === 'object') {
      const value = pace.value as PaceStrategiesValue;
      const { strategies, primary } = scaledPaceStrategies(value, profile);
      primaryDurationP50 = primary?.totalDurationP50Seconds ?? null;
      plan.sections.paceStrategies = withCandidateEstimate(pace, profile, now, detail, {
        ...value,
        strategies,
        primary,
      });
    }

    // 4) Étapes quotidiennes : jours et distances/durées par étape cohérents.
    const stages = plan.sections.dailyStages;
    if (stages && stages.value !== null && typeof stages.value === 'object') {
      const record = stages.value as Record<string, unknown>;
      const days = Math.max(1, Math.round((finiteNumber(record.days) ?? 1) * profile.daysFactor));
      const stagesCount = Math.max(
        1,
        Math.round((finiteNumber(record.stagesCount) ?? days) * profile.daysFactor)
      );
      const scaled: Record<string, unknown> = { ...record, days, stagesCount };
      if (totalDistanceKm !== null) {
        scaled.stageDistanceKm = round(totalDistanceKm / stagesCount, 2);
      }
      if (primaryDurationP50 !== null) {
        scaled.stageDurationH = round(primaryDurationP50 / 3600 / stagesCount, 2);
      }
      plan.sections.dailyStages = withCandidateEstimate(stages, profile, now, detail, scaled);
    }

    // 5) Budget : delta publié appliqué au total et à la part par personne.
    const budget = plan.sections.budget;
    if (budget && budget.value !== null && typeof budget.value === 'object') {
      const record = budget.value as Record<string, unknown>;
      const factor = 1 + profile.budgetDeltaPct / 100;
      plan.sections.budget = withCandidateEstimate(budget, profile, now, detail, {
        ...record,
        perPersonEur: scaledNumber(record.perPersonEur, factor),
        totalEur: scaledNumber(record.totalEur, factor),
        summary: roundBudgetSummary(record.summary, profile.budgetDeltaPct),
      });
    }

    // 6) Alternatives : annotation confort/risque et variante sélectionnée.
    const alternatives = plan.sections.alternatives;
    if (alternatives && Array.isArray(alternatives.value)) {
      const annotated = alternatives.value.map((entry) => {
        const record = (entry ?? {}) as Record<string, unknown>;
        const entryId = String(record.id ?? '');
        const selected = entryId === profile.id;
        return {
          ...record,
          selected,
          annotation: selected
            ? `Variante ${profile.label} sélectionnée : confort ${profile.comfortScore}, risque ${profile.riskScore}, ${profile.budgetDeltaPct >= 0 ? '+' : ''}${profile.budgetDeltaPct} % de budget.`
            : `Variante ${String(record.label ?? entryId)} — alternative non retenue pour cette prévisualisation.`,
        };
      });
      plan.sections.alternatives = withCandidateEstimate(
        alternatives,
        profile,
        now,
        detail,
        annotated
      );
    }

    plan.confidence = {
      ...plan.confidence,
      reasons: [
        ...plan.confidence.reasons,
        `Variante ${profile.label} — confort ${profile.comfortScore}, risque ${profile.riskScore}, effort ${round((profile.distanceFactor - 1) * 100, 2)} %, budget ${profile.budgetDeltaPct >= 0 ? '+' : ''}${profile.budgetDeltaPct} %, incertitude ${profile.uncertainty}.`,
      ],
    };
    plan.updatedAt = now;
    return plan;
  });
}

/**
 * A11 #14 / A13 (S2) — Trois plans candidats complets réellement comparables.
 *
 * Les trois variantes (confort / équilibré / aventure) partagent la MÊME route,
 * les MÊMES dates et les MÊMES hébergements (le plan de référence est cloné en
 * profondeur puis seules les dimensions autorisées évoluent) :
 *   • stratégie d'allure (stratégie primaire A3 choisie par variante) ;
 *   • marges / pauses (delta de durée publié appliqué explicitement aux pauses) ;
 *   • budget (delta publié documenté) ;
 *   • difficulté personnelle (delta d'effort publié) ;
 *   • confort / risque / incertitude (deltas publiés, portés par la comparaison).
 *
 * Chaque différence est justifiée (`reasons[]`) et porte une provenance
 * `estimated|computed` : `computed` quand la valeur dérive d'une prédiction S1
 * réellement map-matchée, `estimated` pour les mises à l'échelle documentées ou
 * le repli uniforme explicite. Aucune donnée n'est inventée : le plan de
 * référence n'est jamais muté et une variante absente lève une erreur.
 */
import { CANDIDATE_IDS, type AdventureCandidate, type AdventureCandidateId } from './candidates';
import type { AdventurePlan, PlanValue } from './adventurePlan';
import type { Assumption } from './engine';
import type { Confidence } from './confidence';
import type { LearnedRoutePrediction } from './prediction';
import type { RouteStrategy } from '../schemas/prediction.schema';

/** Stratégie d'allure A3 associée par défaut à chaque variante. */
export const CANDIDATE_PACE_STRATEGIES: Record<AdventureCandidateId, RouteStrategy> = {
  comfort: 'comfort',
  balanced: 'recommended',
  adventure: 'fast',
};

/** Référence de provenance des valeurs mises à l'échelle par variante. */
export const CANDIDATE_SOURCE_PREFIX = 'a11:candidatePlans';

/** Source d'une valeur comparée : prédiction réelle ou estimation documentée. */
export type CandidateComparisonSource = 'computed' | 'estimated';

/** Segmentation de la comparaison : route réelle ou repli uniforme explicite. */
export type CandidateComparisonSegmentation = 'map_matched' | 'uniform_from_blueprint';

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
  /** Mise à l'échelle de la difficulté personnelle (delta d'effort publié). */
  effortFactor: number;
  effortDeltaPct: number;
  /** Delta de durée publié, appliqué explicitement aux pauses (marges). */
  durationDeltaPct: number;
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

function signed(value: number, unit = '%'): string {
  return `${value > 0 ? '+' : ''}${value} ${unit}`;
}

function profileFromCandidate(
  candidate: AdventureCandidate,
  paceStrategy: RouteStrategy
): CandidateProfile {
  return {
    id: candidate.id,
    label: candidate.label,
    paceStrategy,
    effortFactor: Math.max(0.5, 1 + candidate.effortDeltaPct / 100),
    effortDeltaPct: candidate.effortDeltaPct,
    durationDeltaPct: candidate.durationDeltaPct,
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

/**
 * Applique un delta de marge publié aux pauses de la stratégie primaire
 * (durée P50/P90 et ETA ajustées en conséquence). Route et dates inchangées :
 * la marge vit dans le temps de pause, jamais dans l'itinéraire.
 */
function applyPauseMargin(
  prediction: LearnedRoutePrediction,
  marginPct: number
): LearnedRoutePrediction {
  if (!Number.isFinite(marginPct) || marginPct === 0) return prediction;
  const factor = Math.max(0, 1 + marginPct / 100);
  const pausesSeconds = Math.max(0, Math.round(prediction.pausesSeconds * factor));
  const delta = pausesSeconds - prediction.pausesSeconds;
  const totalDurationP50Seconds = Math.max(1, prediction.totalDurationP50Seconds + delta);
  const totalDurationP90Seconds = Math.max(
    totalDurationP50Seconds,
    prediction.totalDurationP90Seconds + delta
  );
  const startMs = Date.parse(prediction.etaP50) - prediction.totalDurationP50Seconds * 1000;
  const validStart = Number.isFinite(startMs) ? startMs : Date.parse(prediction.etaP50);
  return {
    ...prediction,
    totalDurationP50Seconds,
    totalDurationP90Seconds,
    pausesSeconds,
    etaP50: Number.isFinite(validStart)
      ? new Date(validStart + totalDurationP50Seconds * 1000).toISOString()
      : prediction.etaP50,
    etaP90: Number.isFinite(validStart)
      ? new Date(validStart + totalDurationP90Seconds * 1000).toISOString()
      : prediction.etaP90,
  };
}

interface PaceStrategiesValue {
  strategies?: LearnedRoutePrediction[];
  primary?: LearnedRoutePrediction | null;
  segmentation?: unknown;
  [key: string]: unknown;
}

function paceStrategiesValue(plan: AdventurePlan): PaceStrategiesValue | null {
  const section = plan.sections.paceStrategies;
  if (!section || section.value === null || typeof section.value !== 'object') return null;
  return section.value as PaceStrategiesValue;
}

/** Sélectionne l'entrée `alternatives` marquée `selected` (identité de variante). */
function selectedAlternative(plan: AdventurePlan): { id: string; label: string } | null {
  const alternatives = plan.sections.alternatives?.value;
  if (!Array.isArray(alternatives)) return null;
  for (const entry of alternatives) {
    const record = entry as Record<string, unknown> | null;
    if (record && record.selected === true && typeof record.id === 'string') {
      return { id: record.id, label: String(record.label ?? record.id) };
    }
  }
  return null;
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
      : `budget ${signed(profile.budgetDeltaPct)}`;
  const margin =
    profile.durationDeltaPct === 0
      ? 'marge de référence'
      : `marge ${signed(profile.durationDeltaPct)} (pauses)`;
  const effort =
    profile.effortDeltaPct === 0
      ? 'effort de référence'
      : `effort ${signed(profile.effortDeltaPct)}`;
  return `Variante ${profile.label} (allure ${profile.paceStrategy}, ${margin}, ${effort}, ${budget}) : route, dates et hébergements partagés — seules l'allure, les marges, la difficulté, le budget, le confort et le risque changent.`;
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

    // 1) Stratégie d'allure : les trois stratégies prédites restent communes à
    // la route partagée, seule la stratégie primaire change ; la marge publiée
    // est appliquée aux pauses de cette primaire (jamais à la distance).
    const pace = plan.sections.paceStrategies;
    let primary: LearnedRoutePrediction | null = null;
    if (pace && pace.value !== null && typeof pace.value === 'object') {
      const value = pace.value as PaceStrategiesValue;
      const strategies = Array.isArray(value.strategies) ? value.strategies : [];
      const chosen =
        strategies.find((strategy) => strategy.strategy === profile.paceStrategy) ??
        value.primary ??
        strategies[0] ??
        null;
      primary = chosen ? applyPauseMargin(chosen, profile.durationDeltaPct) : null;
      plan.sections.paceStrategies = withCandidateEstimate(pace, profile, now, detail, {
        ...value,
        strategies,
        primary,
      });
    }

    // 2) Difficulté personnelle : delta d'effort publié, borné 0..100.
    const difficulty = plan.sections.personalDifficulty;
    if (difficulty && difficulty.value !== null && typeof difficulty.value === 'object') {
      const record = difficulty.value as Record<string, unknown>;
      const current = finiteNumber(record.personalDifficulty);
      const scaled =
        current === null
          ? record
          : {
              ...record,
              personalDifficulty: round(
                Math.min(100, Math.max(0, current * profile.effortFactor)),
                2
              ),
            };
      plan.sections.personalDifficulty = withCandidateEstimate(
        difficulty,
        profile,
        now,
        `${detail} Difficulté personnelle mise à l'échelle effort ${signed(profile.effortDeltaPct)}.`,
        scaled
      );
    }

    // 3) Budget : delta publié appliqué au total et à la part par personne.
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

    // 4) Alternatives : annotation confort/risque et variante sélectionnée.
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
            ? `Variante ${profile.label} sélectionnée : confort ${profile.comfortScore}, risque ${profile.riskScore}, ${signed(profile.budgetDeltaPct)} de budget.`
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
        `Variante ${profile.label} — allure ${profile.paceStrategy}, marge ${signed(profile.durationDeltaPct)}, effort ${signed(profile.effortDeltaPct)}, budget ${signed(profile.budgetDeltaPct)}, confort ${profile.comfortScore}, risque ${profile.riskScore}, incertitude ${profile.uncertainty}.`,
      ],
    };
    plan.updatedAt = now;
    return plan;
  });
}

// ── Comparaison dérivée (S2) ─────────────────────────────────────────────────

export interface AdventureCandidateComparisonRow {
  candidateId: AdventureCandidateId;
  label: string;
  paceStrategy: RouteStrategy;
  durationP50Seconds: number | null;
  durationP90Seconds: number | null;
  pausesSeconds: number | null;
  durationSource: CandidateComparisonSource;
  durationNotes: string;
  budgetTotalEur: number | null;
  budgetDeltaPct: number;
  budgetSource: CandidateComparisonSource;
  budgetNotes: string;
  personalDifficulty: number | null;
  effortDeltaPct: number;
  marginPct: number;
  difficultySource: CandidateComparisonSource;
  difficultyNotes: string;
  comfortScore: number;
  riskScore: number;
  uncertainty: number;
  reasons: string[];
}

export interface AdventureCandidateComparison {
  planId: string;
  /** Route identique pour les trois variantes (`activityRoutes` + `terrainAnalysis`). */
  sharedRoute: boolean;
  /** Dates identiques (`plan.dates`), jamais décalées par une variante. */
  sharedDates: boolean;
  /** Hébergements identiques (`sections.accommodations`). */
  sharedAccommodations: boolean;
  segmentation: CandidateComparisonSegmentation;
  routeTotalDistanceKm: number | null;
  rows: AdventureCandidateComparisonRow[];
  generatedAt: string;
}

export interface BuildCandidateComparisonBase {
  planId: string;
  candidatePlans: AdventurePlan[];
  candidates: AdventureCandidate[];
  now: string;
}

function sectionRecord(plan: AdventurePlan, key: keyof AdventurePlan['sections']): Record<string, unknown> | null {
  const section = plan.sections[key];
  if (!section || section.value === null || typeof section.value !== 'object') return null;
  return section.value as Record<string, unknown>;
}

function sharedJson<T>(values: T[], requiredNonNull = true): boolean {
  if (values.length === 0) return false;
  if (requiredNonNull && values[0] === null) return false;
  const reference = JSON.stringify(values[0]);
  return values.every((value) => JSON.stringify(value) === reference);
}

function resolveSegmentation(plan: AdventurePlan): CandidateComparisonSegmentation {
  const value = paceStrategiesValue(plan);
  return value?.segmentation === 'map_matched' ? 'map_matched' : 'uniform_from_blueprint';
}

function comparisonRow(
  plan: AdventurePlan,
  candidatesById: Map<string, AdventureCandidate>
): AdventureCandidateComparisonRow {
  const selected = selectedAlternative(plan);
  const candidate = selected ? candidatesById.get(selected.id) : undefined;
  if (!selected || !candidate) {
    throw new Error(
      'Comparaison impossible : variante non identifiée dans les alternatives du plan candidat.'
    );
  }

  const pace = paceStrategiesValue(plan);
  const primary = pace?.primary ?? null;
  const paceStrategy = CANDIDATE_PACE_STRATEGIES[candidate.id];
  const segmentation = resolveSegmentation(plan);
  const durationSource: CandidateComparisonSource =
    segmentation === 'map_matched' ? 'computed' : 'estimated';
  const durationNotes =
    durationSource === 'computed'
      ? `Prédiction S1 map-matchée (segmentation map_matched) — stratégie ${paceStrategy}.`
      : 'Estimation explicite issue du blueprint uniforme (repli uniform_from_blueprint, aucune route map-matchée).';

  const budget = sectionRecord(plan, 'budget');
  const budgetTotalEur = budget ? finiteNumber(budget.totalEur) : null;
  const currency = budget && typeof budget.currency === 'string' ? budget.currency : 'EUR';
  const budgetNotes = `Budget ${signed(candidate.budgetDeltaPct)} appliqué au total de référence (delta publié A6).`;

  const difficulty = sectionRecord(plan, 'personalDifficulty');
  const personalDifficulty = difficulty ? finiteNumber(difficulty.personalDifficulty) : null;
  const difficultyNotes = `Difficulté personnelle mise à l'échelle effort ${signed(candidate.effortDeltaPct)} (delta publié A6).`;

  const reasons = [
    ...candidate.reasons,
    `Allure ${paceStrategy} : durée P50 ${primary?.totalDurationP50Seconds ?? 'inconnue'} s / P90 ${primary?.totalDurationP90Seconds ?? 'inconnue'} s, ${primary?.pausesSeconds ?? 0} s de pauses.`,
    `Marge ${signed(candidate.durationDeltaPct)} appliquée aux pauses (route, dates et hébergements partagés).`,
    `Effort ${signed(candidate.effortDeltaPct)} : difficulté personnelle ${personalDifficulty ?? 'inconnue'}/100 (estimation documentée).`,
    `Budget ${signed(candidate.budgetDeltaPct)} : ${budgetTotalEur ?? 'inconnu'} ${currency} (delta publié A6).`,
    `Confort ${candidate.comfortScore} · risque ${candidate.riskScore} · incertitude ${candidate.uncertainty}.`,
  ];

  return {
    candidateId: candidate.id,
    label: candidate.label,
    paceStrategy: CANDIDATE_PACE_STRATEGIES[candidate.id],
    durationP50Seconds: primary?.totalDurationP50Seconds ?? null,
    durationP90Seconds: primary?.totalDurationP90Seconds ?? null,
    pausesSeconds: primary?.pausesSeconds ?? null,
    durationSource,
    durationNotes,
    budgetTotalEur,
    budgetDeltaPct: candidate.budgetDeltaPct,
    budgetSource: 'estimated',
    budgetNotes,
    personalDifficulty,
    effortDeltaPct: candidate.effortDeltaPct,
    marginPct: candidate.durationDeltaPct,
    difficultySource: 'estimated',
    difficultyNotes,
    comfortScore: candidate.comfortScore,
    riskScore: candidate.riskScore,
    uncertainty: candidate.uncertainty,
    reasons,
  };
}

/**
 * Construit le tableau comparatif des trois candidats. La durée P50/P90 est
 * dérivée de la stratégie primaire de chaque plan (prédiction S1 si la route a
 * été map-matchée, estimation uniforme explicite sinon) ; budget, difficulté et
 * marges sont des estimations documentées à partir des deltas publiés A6.
 */
export function buildCandidateComparison(
  base: BuildCandidateComparisonBase
): AdventureCandidateComparison {
  const candidatesById = new Map(base.candidates.map((candidate) => [candidate.id, candidate]));
  const rows = base.candidatePlans.map((plan) => comparisonRow(plan, candidatesById));
  const first = base.candidatePlans[0] ?? null;
  const routeValue = first ? sectionRecord(first, 'activityRoutes') : null;

  return {
    planId: base.planId,
    sharedRoute: sharedJson(
      base.candidatePlans.map((plan) => ({
        routes: sectionRecord(plan, 'activityRoutes'),
        terrain: sectionRecord(plan, 'terrainAnalysis'),
      }))
    ),
    sharedDates: sharedJson(base.candidatePlans.map((plan) => plan.dates)),
    sharedAccommodations: sharedJson(
      base.candidatePlans.map((plan) => sectionRecord(plan, 'accommodations'))
    ),
    segmentation: first ? resolveSegmentation(first) : 'uniform_from_blueprint',
    routeTotalDistanceKm: routeValue ? finiteNumber(routeValue.totalDistanceKm) : null,
    rows,
    generatedAt: base.now,
  };
}

// ── Matérialisation (S2) ─────────────────────────────────────────────────────

export interface CandidateMaterializationVersion {
  version: number;
  snapshot: Record<string, unknown>;
  reason: string;
  generated_by: string;
  confidence: Confidence;
  created_at: string;
}

export interface CandidateMaterializationDecision {
  proposal: string;
  impact: never[];
  requires_confirmation: boolean;
  created_at: string;
}

export interface CandidateMaterialization {
  candidateId: AdventureCandidateId;
  label: string;
  version: CandidateMaterializationVersion;
  decision: CandidateMaterializationDecision;
}

export interface BuildCandidateMaterializationInput {
  plan: AdventurePlan;
  candidatePlans: AdventurePlan[];
  candidateId: string;
  comparison?: AdventureCandidateComparison | null;
  now: string;
}

function findCandidatePlan(
  candidatePlans: AdventurePlan[],
  candidateId: string
): { plan: AdventurePlan; label: string } | null {
  for (const plan of candidatePlans) {
    const selected = selectedAlternative(plan);
    if (selected && selected.id === candidateId) return { plan, label: selected.label };
  }
  return null;
}

/**
 * Prépare le payload de matérialisation d'un candidat : snapshot complet
 * (identifié par `candidateId`, base de l'idempotence côté RPC), version
 * suivante et décision confirmée. Retourne `null` si le candidat n'existe pas —
 * aucune variante n'est jamais inventée.
 */
export function buildCandidateMaterialization(
  input: BuildCandidateMaterializationInput
): CandidateMaterialization | null {
  if (!(CANDIDATE_IDS as readonly string[]).includes(input.candidateId)) return null;
  const candidateId = input.candidateId as AdventureCandidateId;
  const found = findCandidatePlan(input.candidatePlans, candidateId);
  if (!found) return null;

  const nextVersion = input.plan.currentVersion + 1;
  const snapshot: Record<string, unknown> = {
    ...found.plan,
    candidateId,
    currentVersion: nextVersion,
    updatedAt: input.now,
    candidates: input.candidatePlans,
  };
  if (input.comparison) snapshot.candidateComparison = input.comparison;

  return {
    candidateId,
    label: found.label,
    version: {
      version: nextVersion,
      snapshot,
      reason: `Sélection variante ${found.label} (A13)`,
      generated_by: 'a13-select',
      confidence: found.plan.confidence,
      created_at: input.now,
    },
    decision: {
      proposal: `Sélection de la variante ${found.label} (${candidateId}) matérialisée en version ${nextVersion} du plan.`,
      impact: [],
      requires_confirmation: false,
      created_at: input.now,
    },
  };
}

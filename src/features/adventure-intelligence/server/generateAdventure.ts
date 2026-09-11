/**
 * A6 — Orchestrateur de génération d'aventure complète.
 *
 * Une phrase + un registre de moteurs → un `AdventurePlan` versionné, trois
 * variantes, décisions requises, explication (IA injectée sinon résumé local
 * déterministe). L'échec de l'IA ne rend jamais le plan inutilisable.
 *
 * Le client de persistance est injecté (`AdventureEnginePersistence`) :
 * aucune dépendance Supabase dans la logique, testable sans réseau.
 */
import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdventureConstraint } from '../domain/constraints';
import type { AdventureDecision } from '../domain/decisions';
import {
  ADVENTURE_PLAN_SECTION_KEYS,
  type AdventureDates,
  type AdventureDestination,
  type AdventureIntent,
  type AdventurePlan,
  type AdventurePlanSections,
  type PlanParticipant,
  type PlanValue,
} from '../domain/adventurePlan';
import { buildCandidates, type AdventureCandidate } from '../domain/candidates';
import { COLD_CONFIDENCE, type Confidence } from '../domain/confidence';
import type { EngineResult } from '../domain/engine';
import {
  type EngineRegistry,
  type EngineRunRecord,
} from '../domain/engineRegistry';
import { buildLockConfirmationDecisions } from '../domain/locks';
import { adventurePlanSchema } from '../schemas/adventurePlan.schema';
import {
  performanceProfileSchema,
  type PerformanceProfile,
} from '../schemas/performance.schema';
import type { Proposal, TripBrief } from '@/features/trips/schemas/autoGen.schema';
import { confidenceFromProposal, provenanceFromProposal } from './adapters/adapterSupport';
import type { CoherenceAdapterOutput, CoherenceLockReport } from './adapters/coherenceAdapter';
import type { DifficultyAdapterOutput } from './adapters/difficultyAdapter';
import type { RouteAdapterOutput } from './adapters/routeAdapter';
import type { SafetyAdapterOutput } from './adapters/safetyAdapter';
import type { BudgetAdapterOutput } from './adapters/budgetAdapter';
import type { PredictionAdapterOutput } from './adapters/predictionAdapter';
import type { TripKitAnalysis } from '@/features/trips/types/kit.types';

/** Bundle atomique plan + version + runs + décisions (A10 — 10.4). */
export interface AdventurePlanBundle {
  plan: Record<string, unknown>;
  version: Record<string, unknown>;
  runs: Record<string, unknown>[];
  decisions: Record<string, unknown>[];
}

/** Version de modèle des prédictions persistées (A10 — 10.9). */
export const ADVENTURE_PREDICTION_MODEL_VERSION = 'a10-v1';

/** A11 #34 — version globale du pipeline d'orchestration (observabilité). */
export const ADVENTURE_PIPELINE_VERSION = 'a11-v1';

/**
 * A11 #34 — codes d'avertissement comptés comme replis explicites dans
 * `adventure_engine_runs.fallback_count` (allure standard sans profil,
 * sections sans source déterministe). Volontairement conservateur : seuls les
 * replis documentés comptent, jamais une estimation normale.
 */
export const FALLBACK_WARNING_CODES = [
  'cold_profile',
  'prediction_no_source',
  'difficulty_no_source',
  'budget_no_source',
  'gear_no_source',
  'safety_no_source',
  'coherence_no_source',
] as const;

function countFallbacks(run: EngineRunRecord): number {
  const codes = new Set<string>(FALLBACK_WARNING_CODES);
  return run.warnings.filter((warning) => codes.has(warning.code)).length;
}

/**
 * Contexte de prédiction : découpage uniforme des agrégats du blueprint tant
 * que le routage réel (segments map-matchés) n'est pas branché — note a11.
 */
export const PREDICTION_CONTEXT_HASH = 'uniform_from_blueprint';

/** Prédictions prêtes à persister (RPC `persist_adventure_predictions`). */
export interface AdventurePredictionBundle {
  planId: string;
  userId: string;
  segments: Record<string, unknown>[];
  route: Record<string, unknown>[];
}

/**
 * Persistance injectée : le bundle principal est écrit par un seul appel
 * transactionnel ; `insertEngineRun` ne sert qu'aux runs orphelins d'un échec
 * de pipeline (plan jamais créé).
 */
export interface AdventureEnginePersistence {
  persistPlanBundle(bundle: AdventurePlanBundle): Promise<{ id: string }>;
  insertEngineRun(row: unknown): Promise<void>;
}

export interface AdventureGenerationInput {
  ownerId: string;
  text: string;
  locks?: AdventureConstraint[];
  participantsCount?: number;
  now?: string;
  /** Flags de domaine A9 (ADR-AI-008) : injectés dans le contexte des moteurs. */
  featureFlags?: Record<string, boolean>;
}

export interface AdventureExplainContext {
  plan: AdventurePlan;
  candidates: AdventureCandidate[];
  runs: EngineRunRecord[];
}

export interface AdventureGenerationResult {
  plan: AdventurePlan;
  candidates: AdventureCandidate[];
  runs: EngineRunRecord[];
  explanation: string;
  aiUsed: boolean;
}

export interface AdventureGenerationDeps {
  registry: EngineRegistry;
  persistence: AdventureEnginePersistence;
  explain?: (context: AdventureExplainContext) => Promise<string>;
  /**
   * A10 (10.9) — profil Terrain courant (null si froid ou absent). Appelé
   * UNIQUEMENT si `hasActiveConsent('personal_performance')` est vrai.
   */
  getCurrentProfile: (userId: string) => Promise<PerformanceProfile | null>;
  /** A10 (10.7/10.9) — consentement courant pour la performance personnelle. */
  hasActiveConsent: (userId: string, purpose: 'personal_performance') => Promise<boolean>;
  /** A10 (10.9) — persistance des prédictions segment + route. */
  persistAdventurePredictions: (bundle: AdventurePredictionBundle) => Promise<void>;
}

type Layers = Record<string, Proposal<unknown>>;

function engineResultOf<T>(outputs: Map<string, unknown>, id: string): EngineResult<T> | undefined {
  return outputs.get(id) as EngineResult<T> | undefined;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function planValueFromResult<T, V = T>(
  result: EngineResult<T>,
  value: V = result.value as unknown as V
): PlanValue<V> {
  return {
    value,
    confidence: result.confidence,
    provenance: [...result.provenance],
    assumptions: [...result.assumptions],
    warnings: [...result.warnings],
    impacts: [...result.impacts],
    computedAt: result.computedAt,
    validUntil: result.validUntil,
  };
}

function planValueFromProposal(
  proposal: Proposal<unknown>,
  routeResult: EngineResult<RouteAdapterOutput> | undefined,
  now: string
): PlanValue<unknown> {
  return {
    value: proposal.value,
    confidence: confidenceFromProposal(proposal),
    provenance: provenanceFromProposal(proposal, 'Catalogue de référence LKDV'),
    assumptions: [],
    warnings: routeResult ? [...routeResult.warnings] : [],
    impacts: [],
    computedAt: routeResult?.computedAt ?? now,
  };
}

function buildIntent(brief: TripBrief | undefined, text: string): AdventureIntent {
  if (!brief) {
    return { rawInput: text, activities: [], constraints: [] };
  }
  const destinations = brief.destinations.value
    .map((destination) => destination.region ?? destination.country)
    .join(', ');
  return {
    rawInput: brief.rawInput,
    summary: `${brief.duration.value.days} jours · ${destinations || 'destination à préciser'}`,
    activities: [...brief.style.value],
    constraints: [...brief.constraints.value],
  };
}

function buildDestinations(brief: TripBrief | undefined): AdventureDestination[] {
  if (!brief) return [];
  return brief.destinations.value.map((destination) => ({
    label: destination.region ?? destination.country,
    countryCode: /^[A-Za-z]{2}$/.test(destination.country) ? destination.country.toUpperCase() : undefined,
  }));
}

function buildDates(brief: TripBrief | undefined): AdventureDates {
  return {
    start: brief?.window.value.start,
    end: brief?.window.value.end,
    flexible: brief?.duration.value.flexible ?? true,
  };
}

function buildParticipants(ownerId: string, count: number): PlanParticipant[] {
  const participants: PlanParticipant[] = [
    { id: ownerId, displayName: 'Propriétaire', role: 'owner' },
  ];
  for (let index = 2; index <= Math.max(1, count); index += 1) {
    participants.push({ id: `participant-${index}`, displayName: `Participant ${index}`, role: 'member' });
  }
  return participants;
}

/**
 * Assemble les 19 sections normatives : chaque section calculée est un
 * `PlanValue` (confiance + provenance + hypothèses), une section sans source
 * reste `null` — jamais implicite, jamais inventée.
 */
export function buildPlanSections(
  outputs: Map<string, unknown>,
  now: string,
  planConfidence: Confidence,
  candidates: AdventureCandidate[]
): AdventurePlanSections {
  const routeResult = engineResultOf<RouteAdapterOutput>(outputs, 'route');
  const coherenceResult = engineResultOf<CoherenceAdapterOutput>(outputs, 'coherence');
  const budgetResult = engineResultOf<BudgetAdapterOutput>(outputs, 'budget');
  const gearResult = engineResultOf<TripKitAnalysis>(outputs, 'gear');
  const predictionResult = engineResultOf<PredictionAdapterOutput>(outputs, 'prediction');
  const difficultyResult = engineResultOf<DifficultyAdapterOutput>(outputs, 'difficulty');
  const safetyResult = engineResultOf<SafetyAdapterOutput>(outputs, 'safety');

  const layers: Layers = (coherenceResult?.value.resolvedLayers ??
    routeResult?.value.layers ??
    {}) as Layers;
  const skeleton = layers.skeleton as Proposal<Record<string, unknown>> | undefined;
  const itinerary = layers.itinerary as Proposal<Record<string, unknown>> | undefined;

  const itineraryValue = itinerary?.value ?? {};
  const dailyStagesValue = {
    days: finiteNumber(skeleton?.value?.days) ?? routeResult?.value.brief.duration.value.days ?? null,
    stagesCount: finiteNumber(itineraryValue.stagesCount) ?? null,
    phases: Array.isArray(skeleton?.value?.phases) ? skeleton?.value?.phases : [],
  };
  const terrainValue = {
    totalDistanceKm: finiteNumber(itineraryValue.totalDistanceKm),
    totalGainM: finiteNumber(itineraryValue.totalGainM),
    totalLossM: finiteNumber(itineraryValue.totalLossM),
    difficulty: typeof itineraryValue.difficulty === 'string' ? itineraryValue.difficulty : null,
  };

  const majorTransport = layers.major_transport as Proposal<unknown> | undefined;
  const localTransport = layers.local_transport as Proposal<unknown> | undefined;
  const accommodations = layers.accommodations as Proposal<unknown> | undefined;
  const foodWater = layers.food_water as Proposal<unknown> | undefined;

  const groupDifficulty = difficultyResult?.value.groupDifficulty ?? null;

  return {
    transport: majorTransport
      ? planValueFromProposal(majorTransport, routeResult, now)
      : null,
    localMobility: localTransport ? planValueFromProposal(localTransport, routeResult, now) : null,
    accommodations: accommodations
      ? planValueFromProposal(accommodations, routeResult, now)
      : null,
    dailyStages:
      routeResult && itinerary ? planValueFromResult(routeResult, dailyStagesValue) : null,
    activityRoutes: itinerary ? planValueFromProposal(itinerary, routeResult, now) : null,
    terrainAnalysis:
      routeResult && itinerary ? planValueFromResult(routeResult, terrainValue) : null,
    personalDifficulty: difficultyResult
      ? planValueFromResult(difficultyResult, {
          personalDifficulty: difficultyResult.value.personalDifficulty,
          maxEffortScore: difficultyResult.value.maxEffortScore,
          hardestSegmentIds: difficultyResult.value.hardestSegmentIds,
          segmentCount: difficultyResult.value.segmentCount,
        })
      : null,
    groupDifficulty:
      difficultyResult && groupDifficulty !== null
        ? planValueFromResult(difficultyResult, { groupDifficulty })
        : null,
    paceStrategies: predictionResult ? planValueFromResult(predictionResult) : null,
    foodAndWater: foodWater ? planValueFromProposal(foodWater, routeResult, now) : null,
    gearPlan: gearResult ? planValueFromResult(gearResult) : null,
    budget: budgetResult ? planValueFromResult(budgetResult) : null,
    bookings: null,
    documents: null,
    regulations: null,
    safetyPlan: safetyResult ? planValueFromResult(safetyResult) : null,
    offlinePackage: null,
    liveConditions: null,
    alternatives: {
      value: candidates.map((candidate) => ({
        id: candidate.id,
        label: candidate.label,
        budgetDeltaPct: candidate.budgetDeltaPct,
        effortDeltaPct: candidate.effortDeltaPct,
        durationDeltaPct: candidate.durationDeltaPct,
        comfortScore: candidate.comfortScore,
        riskScore: candidate.riskScore,
        uncertainty: candidate.uncertainty,
        reasons: [...candidate.reasons],
      })),
      confidence: planConfidence,
      provenance: [{ source: 'computed', sourceRef: 'a6:candidates' }],
      assumptions: [],
      warnings: [],
      impacts: [],
      computedAt: now,
    },
  };
}

/**
 * Décisions requises : verrous violés (déjà restaurés, à confirmer) et
 * confirmations structurelles (paiement du budget, validation du plan de
 * sécurité). Aucune action coûteuse ou de sécurité n'est silencieuse.
 */
export function buildRequiredDecisions(
  plan: AdventurePlan,
  now: string,
  lockReport?: CoherenceLockReport | null
): AdventureDecision[] {
  const decisions: AdventureDecision[] = [];

  if (lockReport && lockReport.violations.length > 0) {
    decisions.push(
      ...buildLockConfirmationDecisions(plan.id, lockReport.before, lockReport.violations, now)
    );
  }

  const budget = plan.sections.budget?.value as
    | { totalEur?: number | null; currency?: string }
    | undefined;
  if (plan.sections.budget) {
    const amount =
      typeof budget?.totalEur === 'number'
        ? ` de ${budget.totalEur} ${budget.currency ?? 'EUR'}`
        : '';
    decisions.push({
      id: 'decision-payment-budget',
      planId: plan.id,
      decisionType: 'payment',
      proposal: `Confirmer le budget prévisionnel${amount} avant toute dépense.`,
      impact: [
        {
          id: 'decision-payment-budget-impact',
          section: 'sections.budget',
          label: 'Budget prévisionnel à confirmer',
          severity: 'warning',
        },
      ],
      requiresConfirmation: true,
      status: 'proposed',
      createdAt: now,
    });
  }

  if (plan.sections.safetyPlan) {
    decisions.push({
      id: 'decision-safety-plan',
      planId: plan.id,
      decisionType: 'safety_change',
      proposal:
        'Valider le plan de sécurité (consignes, moyens d’alerte et itinéraire de repli) avant le départ.',
      impact: [
        {
          id: 'decision-safety-plan-impact',
          section: 'sections.safetyPlan',
          label: 'Plan de sécurité à valider',
          severity: 'critical',
        },
      ],
      requiresConfirmation: true,
      status: 'proposed',
      createdAt: now,
    });
  }

  return decisions;
}

/** Résumé local déterministe — utilisé sans IA ou en repli si l'IA échoue. */
export function buildLocalExplanation(
  plan: AdventurePlan,
  candidates: AdventureCandidate[],
  runs: EngineRunRecord[],
  aiUsed: boolean
): string {
  const destination =
    plan.destinations.map((entry) => entry.label).join(', ') || 'destination à préciser';
  const dailyStages = plan.sections.dailyStages?.value as { days?: number | null } | null | undefined;
  const days = typeof dailyStages?.days === 'number' ? `de ${dailyStages.days} jours ` : '';
  const emptySections = ADVENTURE_PLAN_SECTION_KEYS.filter((key) => plan.sections[key] === null);
  const skipped = runs
    .filter((run) => run.status === 'skipped')
    .map((run) => run.engineId);

  const parts = [
    `Plan d’aventure ${days}proposé pour ${destination}.`,
    `Trois variantes : ${candidates.map((candidate) => candidate.label).join(', ')}.`,
    `Confiance globale ${Math.round(plan.confidence.score * 100)} % (${plan.confidence.level}).`,
  ];
  if (skipped.length > 0) {
    parts.push(`Moteurs sans source déterministe : ${skipped.join(', ')}.`);
  }
  if (emptySections.length > 0) {
    parts.push(`Sections laissées vides faute de source : ${emptySections.join(', ')}.`);
  }
  parts.push(
    aiUsed
      ? 'Résumé assisté par IA.'
      : 'Brouillon déterministe (sans IA) — les hypothèses restent à confirmer.'
  );
  return parts.join(' ');
}

function planRow(plan: AdventurePlan): Record<string, unknown> {
  return {
    id: plan.id,
    owner_id: plan.ownerId,
    title: plan.title ?? null,
    intent: plan.intent,
    status: plan.status,
    current_version: plan.currentVersion,
    confidence: plan.confidence,
    monitoring_rules: plan.monitoringRules,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
  };
}

function versionRow(plan: AdventurePlan, reason: string, generatedBy: string): Record<string, unknown> {
  return {
    plan_id: plan.id,
    version: plan.currentVersion,
    snapshot: plan,
    reason,
    generated_by: generatedBy,
    confidence: plan.confidence,
    created_at: plan.updatedAt,
  };
}

function runRow(
  planId: string | null,
  run: EngineRunRecord,
  correlationId: string
): Record<string, unknown> {
  return {
    plan_id: planId,
    engine_id: run.engineId,
    engine_version: run.engineVersion,
    status: run.status,
    duration_ms: run.durationMs,
    warnings: run.warnings,
    error: run.error ?? null,
    started_at: run.startedAt,
    finished_at: run.finishedAt,
    correlation_id: correlationId,
    pipeline_version: ADVENTURE_PIPELINE_VERSION,
    external_calls: [],
    fallback_count: countFallbacks(run),
  };
}

function decisionRow(planId: string, decision: AdventureDecision): Record<string, unknown> {
  return {
    plan_id: planId,
    decision_type: decision.decisionType,
    proposal: decision.proposal,
    impact: decision.impact,
    requires_confirmation: decision.requiresConfirmation,
    status: decision.status,
    created_at: decision.createdAt,
  };
}

/**
 * A10 (10.9) — lignes de prédiction persistables : segments (P50/P90, effort,
 * difficulté, pause) et routes (trois stratégies, ETA, fatigue). Le contexte
 * reste `uniform_from_blueprint` tant que le routage réel n'est pas branché.
 */
function buildPredictionBundle(
  planId: string,
  userId: string,
  outputs: Map<string, unknown>,
  now: string
): AdventurePredictionBundle {
  const difficulty = engineResultOf<DifficultyAdapterOutput>(outputs, 'difficulty')?.value;
  const prediction = engineResultOf<PredictionAdapterOutput>(outputs, 'prediction')?.value;

  const segments = (difficulty?.segmentPredictions ?? []).map((segment) => ({
    user_id: userId,
    segment_id: segment.segmentId,
    context_hash: PREDICTION_CONTEXT_HASH,
    predicted_duration_p50: segment.durationP50Seconds,
    predicted_duration_p90: segment.durationP90Seconds,
    predicted_effort: segment.effortScore,
    personal_difficulty: segment.personalDifficulty,
    recommended_pause_s: segment.recommendedPauseSeconds,
    confidence: segment.confidence,
    model_version: ADVENTURE_PREDICTION_MODEL_VERSION,
    computed_at: now,
  }));

  const route = (prediction?.strategies ?? []).map((strategy) => ({
    user_id: userId,
    plan_id: planId,
    strategy: strategy.strategy,
    eta_p50: strategy.etaP50,
    eta_p90: strategy.etaP90,
    total_duration_p50_s: strategy.totalDurationP50Seconds,
    total_duration_p90_s: strategy.totalDurationP90Seconds,
    pace_p25_min_per_km: strategy.paceP25MinPerKm,
    pace_p50_min_per_km: strategy.paceP50MinPerKm,
    pace_p75_min_per_km: strategy.paceP75MinPerKm,
    pauses_s: strategy.pausesSeconds,
    personal_difficulty: strategy.personalDifficulty,
    max_fatigue: strategy.maxFatigue,
    turnaround_time: strategy.turnaroundTime ?? null,
    critical_segment_ids: strategy.criticalSegmentIds,
    warnings: strategy.warnings,
    confidence: strategy.confidence,
    model_version: ADVENTURE_PREDICTION_MODEL_VERSION,
    computed_at: now,
  }));

  return { planId, userId, segments, route };
}

async function resolveExplanation(
  deps: AdventureGenerationDeps,
  context: AdventureExplainContext,
  localExplanation: string
): Promise<{ explanation: string; aiUsed: boolean }> {
  if (!deps.explain) {
    return { explanation: localExplanation, aiUsed: false };
  }
  try {
    const text = await deps.explain(context);
    if (typeof text === 'string' && text.trim().length > 0) {
      return { explanation: text.trim(), aiUsed: true };
    }
  } catch {
    // L'échec de l'IA ne doit jamais rendre le plan inutilisable.
  }
  return { explanation: localExplanation, aiUsed: false };
}

/** Génère l'aventure complète : brief → moteurs → plan → candidats → persistance → explication. */
export async function generateAdventure(
  input: AdventureGenerationInput,
  deps: AdventureGenerationDeps
): Promise<AdventureGenerationResult> {
  const now = input.now ?? new Date().toISOString();
  // A11 #34 — un seul identifiant de corrélation par génération, propagé à
  // tous les runs (tracés même en cas d'échec critique du pipeline).
  const correlationId = randomUUID();

  // A10 (10.9) — le consentement est vérifié AVANT tout chargement de profil :
  // sans `personal_performance`, aucun profil n'est lu et les adaptateurs
  // retombent explicitement sur l'allure standard (avertissement cold_profile).
  let personalConsent = false;
  try {
    personalConsent = (await deps.hasActiveConsent(input.ownerId, 'personal_performance')) === true;
  } catch {
    personalConsent = false;
  }
  let personalProfile: PerformanceProfile | null = null;
  if (personalConsent) {
    try {
      personalProfile = await deps.getCurrentProfile(input.ownerId);
    } catch {
      personalProfile = null;
    }
  }

  const valueOf = <T>(outputs: Map<string, unknown>, id: string): T | undefined =>
    engineResultOf<T>(outputs, id)?.value;

  const resolvedPartySize = (outputs: Map<string, unknown>): number => {
    if (input.participantsCount !== undefined) {
      return Math.max(1, Math.trunc(input.participantsCount));
    }
    const brief = valueOf<TripBrief>(outputs, 'intent');
    return Math.max(1, Math.trunc(brief?.party.value.adults ?? 1));
  };

  const resolveInput = (id: string, outputs: Map<string, unknown>): unknown => {
    switch (id) {
      case 'intent':
      case 'route':
        return { text: input.text };
      case 'budget':
      case 'gear':
      case 'coherence':
      case 'prediction':
      case 'difficulty':
      case 'safety':
      case 'weather':
      case 'regulations':
      case 'documents':
        return {
          route: valueOf<RouteAdapterOutput>(outputs, 'route'),
          locks: input.locks ?? [],
          participantsCount: resolvedPartySize(outputs),
          // A10 (10.9) : profil réel si consentement, sinon null explicite.
          profile: personalProfile,
          startAt: now,
        };
      default:
        return undefined;
    }
  };

  let pipeline: Awaited<ReturnType<EngineRegistry['runPipeline']>>;
  try {
    pipeline = await deps.registry.runPipeline(
      { userId: input.ownerId, nowIso: now, featureFlags: input.featureFlags },
      { text: input.text },
      resolveInput
    );
  } catch (error) {
    const runs =
      typeof (error as { runs?: unknown }).runs === 'object' &&
      Array.isArray((error as { runs?: unknown }).runs)
        ? ((error as { runs: EngineRunRecord[] }).runs)
        : [];
    for (const run of runs) {
      try {
        await deps.persistence.insertEngineRun(runRow(null, run, correlationId));
      } catch {
        // L'observabilité ne doit jamais masquer l'échec critique d'origine.
      }
    }
    throw error;
  }

  const { outputs, runs, planConfidence } = pipeline;

  const brief = engineResultOf<TripBrief>(outputs, 'intent')?.value;
  const participantsCount = resolvedPartySize(outputs);
  const candidates = buildCandidates({
    days: brief?.duration.value.days,
    participantsCount,
    budgetTier: brief?.budget.value.tier,
    month: brief?.window.value.month,
  });

  const sections = buildPlanSections(outputs, now, planConfidence, candidates);
  const destinations = buildDestinations(brief);

  const plan: AdventurePlan = {
    id: randomUUID(),
    ownerId: input.ownerId,
    title: destinations[0] ? `Aventure — ${destinations[0].label}` : 'Aventure à composer',
    status: 'draft',
    currentVersion: 1,
    intent: buildIntent(brief, input.text),
    participants: buildParticipants(input.ownerId, participantsCount),
    dates: buildDates(brief),
    destinations,
    sections,
    confidence: planConfidence,
    monitoringRules: [],
    createdAt: now,
    updatedAt: now,
  };

  const lockReport = engineResultOf<CoherenceAdapterOutput>(outputs, 'coherence')?.value.lockReport;
  const decisions = buildRequiredDecisions(plan, now, lockReport);

  // A10 (10.4) : un seul appel atomique — un échec ne laisse aucun plan partiel.
  const inserted = await deps.persistence.persistPlanBundle({
    plan: planRow(plan),
    version: versionRow(plan, 'Génération initiale (A6)', 'a6-orchestrator'),
    runs: runs.map((run) => runRow(plan.id, run, correlationId)),
    decisions: decisions.map((decision) => decisionRow(plan.id, decision)),
  });
  plan.id = inserted.id;
  for (const decision of decisions) decision.planId = plan.id;

  // A10 (10.9) — prédictions segment + route persistées par RPC dédiée.
  // Best-effort assumé : le plan est déjà persisté, un échec de persistance
  // des prédictions est journalisé mais ne rend jamais le plan inutilisable.
  try {
    await deps.persistAdventurePredictions(
      buildPredictionBundle(plan.id, input.ownerId, outputs, now)
    );
  } catch (error) {
    console.error(
      '[adventure-intelligence] persistAdventurePredictions en échec:',
      error instanceof Error ? error.message : error
    );
  }

  const localExplanation = buildLocalExplanation(plan, candidates, runs, false);
  const { explanation, aiUsed } = await resolveExplanation(
    deps,
    { plan, candidates, runs },
    localExplanation
  );

  return { plan, candidates, runs, explanation, aiUsed };
}

// ── Persistance Supabase (lecture seule côté client) ─────────────────────────

/** Adaptateur Supabase service-role : les lignes sont déjà mises en forme. */
export function createSupabaseAdventurePersistence(
  client: SupabaseClient
): AdventureEnginePersistence {
  return {
    async persistPlanBundle(bundle) {
      const { data, error } = await client.rpc('create_adventure_plan_bundle', {
        p_plan: bundle.plan,
        p_version: bundle.version,
        p_runs: bundle.runs,
        p_decisions: bundle.decisions,
      });
      if (error) throw new Error(error.message);
      return { id: String(data) };
    },
    async insertEngineRun(row: unknown) {
      const { error } = await client.from('adventure_engine_runs').insert(row as never);
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * A10 (10.9) — lecture du profil Terrain courant (service_role).
 * Toute erreur ou ligne non conforme retombe sur `null` (repli standard
 * explicite côté adaptateurs), jamais sur un profil inventé.
 */
export async function getStoredPerformanceProfile(
  client: SupabaseClient,
  userId: string
): Promise<PerformanceProfile | null> {
  const { data, error } = await client
    .from('user_performance_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('activity_type', 'hiking')
    .maybeSingle();
  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const parsed = performanceProfileSchema.safeParse({
    userId: row.user_id,
    activityType: 'hiking',
    flatSpeedKmH: Number(row.flat_speed_kmh),
    ascentSpeedMPerHour: Number(row.ascent_speed_m_per_h ?? 0),
    descentSpeedMPerHour: Number(row.descent_speed_m_per_h ?? 0),
    gradeResponse: row.grade_response,
    surfaceResponse: row.surface_response,
    fatigueCurve: row.fatigue_curve,
    pauseModel: row.pause_model,
    packResponse: row.pack_response,
    confidence: row.confidence,
    sampleCount: Number(row.sample_count ?? 0),
    calibrationLevel: row.calibration_level,
    modelVersion: row.model_version,
    computedAt: row.computed_at,
  });
  return parsed.success ? parsed.data : null;
}

/** A10 (10.9) — persistance des prédictions via RPC service_role dédiée. */
export function createSupabaseAdventurePredictionPersistence(
  client: SupabaseClient
): (bundle: AdventurePredictionBundle) => Promise<void> {
  return async (bundle) => {
    const { error } = await client.rpc('persist_adventure_predictions', {
      p_plan_id: bundle.planId,
      p_user_id: bundle.userId,
      p_segments: bundle.segments,
      p_route: bundle.route,
    });
    if (error) throw new Error(error.message);
  };
}

export interface AdventurePlanVersionRecord {
  version: number;
  snapshot: unknown;
  reason: string;
  generatedBy: string;
  confidence: Confidence;
  createdAt: string;
}

export interface StoredAdventurePlan {
  plan: AdventurePlan;
  version: AdventurePlanVersionRecord | null;
  decisions: AdventureDecision[];
}

function planFromRow(row: Record<string, unknown>): AdventurePlan {
  const base = {
    id: String(row.id),
    ownerId: String(row.owner_id),
    tripId: row.trip_id == null ? undefined : String(row.trip_id),
    title: row.title == null ? undefined : String(row.title),
    status: row.status ?? 'draft',
    currentVersion: Number(row.current_version ?? 0),
    intent: row.intent ?? { rawInput: '', activities: [], constraints: [] },
    participants: [],
    dates: { flexible: true },
    destinations: [],
    sections: Object.fromEntries(
      ADVENTURE_PLAN_SECTION_KEYS.map((key) => [key, null])
    ) as AdventurePlanSections,
    confidence: row.confidence ?? COLD_CONFIDENCE,
    monitoringRules: Array.isArray(row.monitoring_rules) ? row.monitoring_rules : [],
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
  const parsed = adventurePlanSchema.safeParse(base);
  return parsed.success ? (parsed.data as AdventurePlan) : (base as unknown as AdventurePlan);
}

/**
 * Lecture d'un plan accessible (propriétaire ou collaborateur via policy A1) :
 * plan + version courante + décisions. `null` si le plan n'existe pas.
 */
export async function getAdventurePlan(
  client: SupabaseClient,
  planId: string
): Promise<StoredAdventurePlan | null> {
  const { data: planData, error: planError } = await client
    .from('adventure_plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle();
  if (planError) throw new Error(planError.message);
  if (!planData) return null;

  const { data: versionData } = await client
    .from('adventure_plan_versions')
    .select('version, snapshot, reason, generated_by, confidence, created_at')
    .eq('plan_id', planId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: decisionRows } = await client
    .from('adventure_plan_decisions')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true });

  const snapshotParsed = versionData?.snapshot
    ? adventurePlanSchema.safeParse(versionData.snapshot)
    : null;
  const plan = snapshotParsed?.success
    ? (snapshotParsed.data as AdventurePlan)
    : planFromRow(planData as Record<string, unknown>);

  const version: AdventurePlanVersionRecord | null = versionData
    ? {
        version: Number(versionData.version),
        snapshot: versionData.snapshot,
        reason: String(versionData.reason),
        generatedBy: String(versionData.generated_by),
        confidence: versionData.confidence as Confidence,
        createdAt: String(versionData.created_at),
      }
    : null;

  const decisions = ((decisionRows ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    planId: String(row.plan_id),
    decisionType: row.decision_type as AdventureDecision['decisionType'],
    proposal: String(row.proposal),
    impact: Array.isArray(row.impact) ? (row.impact as AdventureDecision['impact']) : [],
    requiresConfirmation: row.requires_confirmation === true,
    status: row.status as AdventureDecision['status'],
    decidedBy: row.decided_by == null ? undefined : String(row.decided_by),
    decidedAt: row.decided_at == null ? undefined : String(row.decided_at),
    createdAt: String(row.created_at),
  }));

  return { plan, version, decisions };
}

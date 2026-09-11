/**
 * A13 (S3) — Produit groupe + trek : étapes de plan, projections publiques et
 * payloads de version persistés dans `adventure_plan_versions.snapshot`.
 *
 * Privacy (ADR-AI-003) : la seule projection qui franchit cette frontière est
 * `summarizeGroupPlanPublic` — aucune identité, aucune vitesse individuelle,
 * aucune limitation. Le payload de version ne contient donc que des agrégats.
 *
 * Aucune I/O : les étapes « trip_steps » sont injectées par le serveur, la
 * répartition uniforme des agrégats blueprint est explicite (`blueprint_uniform`)
 * et jamais silencieuse.
 */
import {
  DEFAULT_MEMBER_ASCENT_SPEED_M_PER_HOUR,
  DEFAULT_MEMBER_DESCENT_SPEED_M_PER_HOUR,
  DEFAULT_MEMBER_FLAT_SPEED_KMH,
  MAX_GEAR_TRANSFER_KG,
  projectGroupPlanPublic,
  type GroupMemberInput,
  type GroupPlan,
  type GroupSegment,
} from './groupIntelligence';
import type { MultiDayTrekResult, TrekDayInput } from './multiDayTrek';
import type { AdventurePlan } from './adventurePlan';
import type { Confidence } from './confidence';
import {
  groupPlanMetaSchema,
  groupPlanSummarySchema,
  multiDayTrekResultSchema,
  trekPlanMetaSchema,
  type GroupPlanMetaSchema,
  type TrekPlanMetaSchema,
} from '../schemas/groupTrek.schema';

export type { GroupPlanMetaSchema, TrekPlanMetaSchema } from '../schemas/groupTrek.schema';

/** Version de modèle du payload groupe persisté (traçabilité snapshot). */
export const GROUP_PLAN_MODEL_VERSION = 'a13-group-v1';
/** Version de modèle du payload trek persisté (traçabilité snapshot). */
export const TREK_PLAN_MODEL_VERSION = 'a13-trek-v1';
/** Borne défensive du nombre d'étapes dérivées d'un plan (jamais d'infini). */
export const MAX_PLAN_STAGES = 60;

export type StagesSource = 'trip_steps' | 'blueprint_uniform';

export interface PlanStage {
  dayNumber: number;
  distanceM: number;
  gainM: number;
  lossM: number;
}

/** Projection publique UI : agrégats uniquement, jamais d'individu. */
export interface GroupPlanSummaryPublic {
  groupPaceKmH: number;
  groupDifficulty: number;
  limitingReason: string | null;
  separationRisk: { level: 'low' | 'medium' | 'high'; reasons: string[] };
  memberCount: number;
  pauseEveryMinutes: number;
  /** Redistribution agrégée : jamais les membres source/destination. */
  gearRedistribution: { transfers: number; totalWeightKg: number; maxPerReceiverKg: number };
  /** Plage de difficulté du groupe (agrégat, jamais par membre). */
  difficultyRange: { min: number; max: number } | null;
}

export interface GroupPlanPayload {
  summary: GroupPlanSummaryPublic;
  meta: GroupPlanMetaSchema;
}

export interface TrekPlanPayload {
  result: MultiDayTrekResult;
  meta: TrekPlanMetaSchema;
}

export interface PlanVersionPayload {
  version: number;
  snapshot: Record<string, unknown>;
  reason: string;
  generated_by: string;
  confidence: Confidence;
  created_at: string;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function finitePositive(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sectionValue(plan: AdventurePlan, key: keyof AdventurePlan['sections']): unknown {
  const section = plan.sections[key];
  return section && section.value !== null ? section.value : null;
}

/**
 * Résumé public d'un plan de groupe. Reprend strictement les champs déjà
 * publics (`projectGroupPlanPublic`) et n'ajoute que des agrégats : nombre de
 * transferts, masse totale redistribuée, plafond, plage de difficulté.
 */
export function summarizeGroupPlanPublic(plan: GroupPlan): GroupPlanSummaryPublic {
  const base = projectGroupPlanPublic(plan);
  const totalWeightKg = round(
    plan.gearRedistribution.reduce((sum, transfer) => sum + finitePositive(transfer.weightKg), 0),
    2
  );
  const difficulties = plan.perMemberDifficulty
    .map((entry) => finiteNumberOrNull(entry.difficulty))
    .filter((value): value is number => value !== null);

  return {
    groupPaceKmH: base.groupPaceKmH,
    groupDifficulty: base.groupDifficulty,
    limitingReason: base.limitingReason,
    separationRisk: {
      level: base.separationRisk.level as GroupPlanSummaryPublic['separationRisk']['level'],
      reasons: [...base.separationRisk.reasons],
    },
    memberCount: base.memberCount,
    pauseEveryMinutes: plan.pauseEveryMinutes,
    gearRedistribution: {
      transfers: plan.gearRedistribution.length,
      totalWeightKg,
      maxPerReceiverKg: MAX_GEAR_TRANSFER_KG,
    },
    difficultyRange:
      difficulties.length > 0
        ? { min: Math.min(...difficulties), max: Math.max(...difficulties) }
        : null,
  };
}

/**
 * Répartition uniforme explicite des agrégats d'un plan en étapes journalières.
 * Retourne `[]` quand aucun agrégat exploitable n'existe : jamais d'étape
 * inventée à partir de rien.
 */
export function stagesFromAggregates(input: {
  days?: number | null;
  totalDistanceKm?: number | null;
  totalGainM?: number | null;
  totalLossM?: number | null;
}): PlanStage[] {
  const totalDistanceM = finitePositive(input.totalDistanceKm) * 1000;
  const totalGainM = finitePositive(input.totalGainM);
  const totalLossM = finitePositive(input.totalLossM);
  if (totalDistanceM <= 0 && totalGainM <= 0 && totalLossM <= 0) return [];

  const rawDays = finitePositive(input.days);
  const count = Math.min(MAX_PLAN_STAGES, Math.max(1, Math.round(rawDays || 1)));

  return Array.from({ length: count }, (_, index) => ({
    dayNumber: index + 1,
    distanceM: round(totalDistanceM / count, 2),
    gainM: round(totalGainM / count, 2),
    lossM: round(totalLossM / count, 2),
  }));
}

/**
 * Étapes dérivées du plan : `dailyStages.days` + agrégats `terrainAnalysis`
 * (repli `activityRoutes`). Source `blueprint_uniform` explicite.
 */
export function planStagesFromPlan(plan: AdventurePlan): {
  stages: PlanStage[];
  source: StagesSource;
} {
  const dailyStages = sectionValue(plan, 'dailyStages') as { days?: unknown } | null;
  const terrain = sectionValue(plan, 'terrainAnalysis') as Record<string, unknown> | null;
  const activities = sectionValue(plan, 'activityRoutes') as Record<string, unknown> | null;
  const aggregates = terrain ?? activities ?? {};

  const stages = stagesFromAggregates({
    days: finiteNumberOrNull(dailyStages?.days),
    totalDistanceKm: finiteNumberOrNull(aggregates.totalDistanceKm),
    totalGainM: finiteNumberOrNull(aggregates.totalGainM),
    totalLossM: finiteNumberOrNull(aggregates.totalLossM),
  });

  return { stages, source: 'blueprint_uniform' };
}

export function groupSegmentsFromStages(stages: PlanStage[]): GroupSegment[] {
  return stages.map((stage, index) => ({
    segmentId: index + 1,
    distanceM: stage.distanceM,
    gainM: stage.gainM,
    lossM: stage.lossM,
  }));
}

export function trekDaysFromStages(stages: PlanStage[]): TrekDayInput[] {
  return stages.map((stage) => ({
    dayNumber: stage.dayNumber,
    distanceM: stage.distanceM,
    gainM: stage.gainM,
    lossM: stage.lossM,
    packWeightKg: null,
    technicalClass: null,
    sleepQuality: null,
  }));
}

/** Membre sans profil consenti : repli standard explicite (jamais inventé). */
export function fallbackGroupMember(input: {
  memberId: string;
  displayName: string;
  role: GroupMemberInput['role'];
  experienceLevel?: GroupMemberInput['experienceLevel'];
}): GroupMemberInput {
  return {
    memberId: input.memberId,
    displayName: input.displayName,
    role: input.role,
    flatSpeedKmH: DEFAULT_MEMBER_FLAT_SPEED_KMH,
    ascentSpeedMPerHour: DEFAULT_MEMBER_ASCENT_SPEED_M_PER_HOUR,
    descentSpeedMPerHour: DEFAULT_MEMBER_DESCENT_SPEED_M_PER_HOUR,
    packWeightKg: null,
    maxCarryKg: null,
    experienceLevel: input.experienceLevel ?? 'intermediate',
  };
}

export interface BuildGroupPlanVersionInput {
  plan: AdventurePlan;
  summary: GroupPlanSummaryPublic;
  stagesSource: StagesSource;
  strategy: 'comfort' | 'recommended' | 'fast';
  crewId: string | null;
  tripId: string | null;
  memberCount: number;
  now: string;
}

export function buildGroupPlanVersion(input: BuildGroupPlanVersionInput): PlanVersionPayload {
  const nextVersion = input.plan.currentVersion + 1;
  return {
    version: nextVersion,
    snapshot: {
      ...(input.plan as unknown as Record<string, unknown>),
      currentVersion: nextVersion,
      updatedAt: input.now,
      groupPlan: input.summary,
      groupPlanMeta: {
        stagesSource: input.stagesSource,
        strategy: input.strategy,
        crewId: input.crewId,
        tripId: input.tripId,
        memberCount: input.memberCount,
        modelVersion: GROUP_PLAN_MODEL_VERSION,
        computedAt: input.now,
      },
    },
    reason: 'group-computed',
    generated_by: 'a13-group',
    confidence: input.plan.confidence,
    created_at: input.now,
  };
}

export interface BuildTrekPlanVersionInput {
  plan: AdventurePlan;
  result: MultiDayTrekResult;
  stagesSource: StagesSource;
  dayCount: number;
  now: string;
}

export function buildTrekPlanVersion(input: BuildTrekPlanVersionInput): PlanVersionPayload {
  const nextVersion = input.plan.currentVersion + 1;
  return {
    version: nextVersion,
    snapshot: {
      ...(input.plan as unknown as Record<string, unknown>),
      currentVersion: nextVersion,
      updatedAt: input.now,
      trekPlan: input.result,
      trekPlanMeta: {
        stagesSource: input.stagesSource,
        dayCount: input.dayCount,
        modelVersion: TREK_PLAN_MODEL_VERSION,
        computedAt: input.now,
      },
    },
    reason: 'trek-computed',
    generated_by: 'a13-trek',
    confidence: input.plan.confidence,
    created_at: input.now,
  };
}

/** Relecture validée d'un payload groupe : snapshot non conforme ⇒ `null`. */
export function groupPlanPayloadFromSnapshot(snapshot: unknown): GroupPlanPayload | null {
  if (snapshot === null || typeof snapshot !== 'object') return null;
  const raw = snapshot as Record<string, unknown>;
  const summary = groupPlanSummarySchema.safeParse(raw.groupPlan);
  const meta = groupPlanMetaSchema.safeParse(raw.groupPlanMeta);
  if (!summary.success || !meta.success) return null;
  return {
    summary: summary.data as GroupPlanSummaryPublic,
    meta: meta.data,
  };
}

/** Relecture validée d'un payload trek : snapshot non conforme ⇒ `null`. */
export function trekPlanPayloadFromSnapshot(snapshot: unknown): TrekPlanPayload | null {
  if (snapshot === null || typeof snapshot !== 'object') return null;
  const raw = snapshot as Record<string, unknown>;
  const result = multiDayTrekResultSchema.safeParse(raw.trekPlan);
  const meta = trekPlanMetaSchema.safeParse(raw.trekPlanMeta);
  if (!result.success || !meta.success) return null;
  return {
    result: result.data as MultiDayTrekResult,
    meta: meta.data,
  };
}

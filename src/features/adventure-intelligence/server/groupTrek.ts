/**
 * A13 (S3) — Serveur groupe / trek : résolution des données réelles (crew,
 * profils consentis, étapes), calcul des moteurs A8 et persistance versionnée.
 *
 * La source de données est injectée (`GroupTrekDataSource`) : la logique de
 * calcul reste testable sans Supabase, et l'adaptateur `createSupabase…`
 * branche les tables réelles (`crews`, `crew_members`, `trip_steps`,
 * `public_profiles`, `user_performance_profiles`) et la RPC
 * `a13_append_plan_version`.
 *
 * Privacy (ADR-AI-003) : seuls des agrégats publics sont persistés/exposés ;
 * `displayName` et vitesses individuelles ne quittent jamais la projection
 * interne. Consentement vérifié AVANT toute lecture de profil (fail-safe).
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildGroupPlan,
  type GroupMemberInput,
  type GroupPlan,
} from '../domain/groupIntelligence';
import { simulateMultiDayTrek, type MultiDayTrekResult } from '../domain/multiDayTrek';
import {
  buildGroupPlanVersion,
  buildTrekPlanVersion,
  fallbackGroupMember,
  groupPlanPayloadFromSnapshot,
  groupSegmentsFromStages,
  planStagesFromPlan,
  summarizeGroupPlanPublic,
  trekDaysFromStages,
  trekPlanPayloadFromSnapshot,
  GROUP_PLAN_MODEL_VERSION,
  TREK_PLAN_MODEL_VERSION,
  type GroupPlanMetaSchema,
  type GroupPlanSummaryPublic,
  type PlanStage,
  type StagesSource,
  type TrekPlanMetaSchema,
} from '../domain/planGroupTrek';
import type { AdventurePlan } from '../domain/adventurePlan';

export type GroupStrategy = 'comfort' | 'recommended' | 'fast';

export interface CrewRow {
  id: string;
  createdBy: string;
  visibility: string;
}

export interface CrewMemberRow {
  userId: string;
  role: string;
}

export interface MemberProfileSpeeds {
  flatSpeedKmH: number | null;
  ascentSpeedMPerHour: number | null;
  descentSpeedMPerHour: number | null;
}

/**
 * Accès aux données réelles, injectable. Chaque méthode est fail-safe :
 * une erreur de lecture remonte `null`/`[]` et le calcul dégrade explicitement.
 */
export interface GroupTrekDataSource {
  getCrewById(crewId: string): Promise<CrewRow | null>;
  getCrewIdForTrip(tripId: string): Promise<string | null>;
  listActiveCrewMembers(crewId: string): Promise<CrewMemberRow[]>;
  getTripStages(tripId: string): Promise<PlanStage[]>;
  getDisplayNames(userIds: string[]): Promise<Record<string, string>>;
  hasActiveConsent(userId: string): Promise<boolean>;
  getProfileSpeeds(userId: string): Promise<MemberProfileSpeeds | null>;
  appendVersion(payload: {
    planId: string;
    userId: string;
    version: {
      version: number;
      snapshot: Record<string, unknown>;
      reason: string;
      generated_by: string;
      confidence: unknown;
      created_at: string;
    };
  }): Promise<number>;
  readLatestSnapshot(planId: string): Promise<{ version: number; snapshot: unknown } | null>;
}

export interface GroupComputationSuccess {
  ok: true;
  version: number;
  summary: GroupPlanSummaryPublic;
  meta: GroupPlanMetaSchema;
}

export interface TrekComputationSuccess {
  ok: true;
  version: number;
  result: MultiDayTrekResult;
  meta: TrekPlanMetaSchema;
}

export type GroupComputationResult =
  | GroupComputationSuccess
  | { ok: false; reason: 'crew_required' | 'forbidden' | 'stages_unavailable' };

export type TrekComputationResult =
  | TrekComputationSuccess
  | { ok: false; reason: 'stages_unavailable' };

export interface GroupComputationOptions {
  crewId?: string | null;
  strategy?: GroupStrategy;
  now?: string;
}

export interface TrekComputationOptions {
  packWeightKg?: number | null;
  now?: string;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function finiteOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function roleFromCrew(role: string): GroupMemberInput['role'] {
  if (role === 'owner' || role === 'organizer') return 'owner';
  if (role === 'guest') return 'guest';
  return 'member';
}

async function resolvePlanStages(
  source: GroupTrekDataSource,
  plan: AdventurePlan
): Promise<{ stages: PlanStage[]; source: StagesSource } | null> {
  if (plan.tripId) {
    const tripStages = await source.getTripStages(plan.tripId).catch(() => []);
    if (tripStages.length > 0) {
      return { stages: tripStages, source: 'trip_steps' };
    }
  }
  const blueprint = planStagesFromPlan(plan);
  if (blueprint.stages.length > 0) return blueprint;
  return null;
}

async function buildGroupMembers(
  source: GroupTrekDataSource,
  members: CrewMemberRow[]
): Promise<GroupMemberInput[]> {
  const userIds = members.map((member) => member.userId);
  const displayNames: Record<string, string> = await source
    .getDisplayNames(userIds)
    .catch(() => ({}));
  const resolved: GroupMemberInput[] = [];

  for (const member of members) {
    let consent = false;
    try {
      consent = (await source.hasActiveConsent(member.userId)) === true;
    } catch {
      consent = false;
    }

    let speeds: MemberProfileSpeeds | null = null;
    if (consent) {
      try {
        speeds = await source.getProfileSpeeds(member.userId);
      } catch {
        speeds = null;
      }
    }

    const displayName = textOrNull(displayNames[member.userId]) ?? 'Membre';
    if (!speeds) {
      resolved.push(
        fallbackGroupMember({
          memberId: member.userId,
          displayName,
          role: roleFromCrew(member.role),
        })
      );
      continue;
    }

    resolved.push({
      memberId: member.userId,
      displayName,
      role: roleFromCrew(member.role),
      flatSpeedKmH: speeds.flatSpeedKmH,
      ascentSpeedMPerHour: speeds.ascentSpeedMPerHour,
      descentSpeedMPerHour: speeds.descentSpeedMPerHour,
      packWeightKg: null,
      maxCarryKg: null,
      experienceLevel: 'intermediate',
    });
  }

  return resolved;
}

/**
 * Calcule le plan de groupe à partir du crew lié (ou fourni) et le persiste en
 * version `group-computed`. Refus explicites : pas de crew, pas d'accès, pas
 * d'étape — jamais de groupe vide ni de donnée inventée.
 */
export async function computeAndPersistGroupPlan(
  source: GroupTrekDataSource,
  userId: string,
  plan: AdventurePlan,
  options: GroupComputationOptions = {}
): Promise<GroupComputationResult> {
  const requestedCrewId = textOrNull(options.crewId);
  let crewId = requestedCrewId;
  if (!crewId && plan.tripId) {
    crewId = await source.getCrewIdForTrip(plan.tripId).catch(() => null);
  }
  if (!crewId) return { ok: false, reason: 'crew_required' };

  const crew = await source.getCrewById(crewId).catch(() => null);
  if (!crew) return { ok: false, reason: 'forbidden' };

  const members = await source.listActiveCrewMembers(crewId).catch(() => []);
  const isMember = members.some((member) => member.userId === userId);
  if (crew.createdBy !== userId && !isMember) {
    return { ok: false, reason: 'forbidden' };
  }
  if (members.length === 0) {
    return { ok: false, reason: 'crew_required' };
  }

  const groupMembers = await buildGroupMembers(source, members);

  const stages = await resolvePlanStages(source, plan);
  if (!stages) return { ok: false, reason: 'stages_unavailable' };

  const now = options.now ?? new Date().toISOString();
  const strategy = options.strategy ?? 'recommended';
  const groupPlan: GroupPlan = buildGroupPlan(
    groupMembers,
    groupSegmentsFromStages(stages.stages),
    { strategy }
  );
  const summary = summarizeGroupPlanPublic(groupPlan);

  const payload = buildGroupPlanVersion({
    plan,
    summary,
    stagesSource: stages.source,
    strategy,
    crewId,
    tripId: plan.tripId ?? null,
    memberCount: summary.memberCount,
    now,
  });

  const version = await source.appendVersion({
    planId: plan.id,
    userId,
    version: {
      version: payload.version,
      snapshot: payload.snapshot,
      reason: payload.reason,
      generated_by: payload.generated_by,
      confidence: payload.confidence,
      created_at: payload.created_at,
    },
  });

  return {
    ok: true,
    version,
    summary,
    meta: {
      stagesSource: stages.source,
      strategy,
      crewId,
      tripId: plan.tripId ?? null,
      memberCount: summary.memberCount,
      modelVersion: GROUP_PLAN_MODEL_VERSION,
      computedAt: now,
    },
  };
}

/** Simule le trek multi-jours des étapes du plan et le persiste (`trek-computed`). */
export async function computeAndPersistTrekPlan(
  source: GroupTrekDataSource,
  plan: AdventurePlan,
  options: TrekComputationOptions = {}
): Promise<TrekComputationResult> {
  const stages = await resolvePlanStages(source, plan);
  if (!stages) return { ok: false, reason: 'stages_unavailable' };

  const now = options.now ?? new Date().toISOString();
  const days = trekDaysFromStages(stages.stages).map((day) => ({
    ...day,
    packWeightKg: finiteOrNull(options.packWeightKg) ?? null,
  }));
  const result = simulateMultiDayTrek(days);

  const payload = buildTrekPlanVersion({
    plan,
    result,
    stagesSource: stages.source,
    dayCount: stages.stages.length,
    now,
  });

  const version = await source.appendVersion({
    planId: plan.id,
    userId: plan.ownerId,
    version: {
      version: payload.version,
      snapshot: payload.snapshot,
      reason: payload.reason,
      generated_by: payload.generated_by,
      confidence: payload.confidence,
      created_at: payload.created_at,
    },
  });

  return {
    ok: true,
    version,
    result,
    meta: {
      stagesSource: stages.source,
      dayCount: stages.stages.length,
      modelVersion: TREK_PLAN_MODEL_VERSION,
      computedAt: now,
    },
  };
}

export async function readLatestGroupPlan(
  source: GroupTrekDataSource,
  planId: string
): Promise<{ version: number; summary: GroupPlanSummaryPublic; meta: GroupPlanMetaSchema } | null> {
  const latest = await source.readLatestSnapshot(planId).catch(() => null);
  if (!latest) return null;
  const payload = groupPlanPayloadFromSnapshot(latest.snapshot);
  if (!payload) return null;
  return { version: latest.version, summary: payload.summary, meta: payload.meta };
}

export async function readLatestTrekPlan(
  source: GroupTrekDataSource,
  planId: string
): Promise<{ version: number; result: MultiDayTrekResult; meta: TrekPlanMetaSchema } | null> {
  const latest = await source.readLatestSnapshot(planId).catch(() => null);
  if (!latest) return null;
  const payload = trekPlanPayloadFromSnapshot(latest.snapshot);
  if (!payload) return null;
  return { version: latest.version, result: payload.result, meta: payload.meta };
}

// ── Adaptateur Supabase (service_role) ──────────────────────────────────────

function planStageFromRows(rows: Record<string, unknown>[]): PlanStage[] {
  const byDay = new Map<number, PlanStage>();
  for (const row of rows) {
    const dayNumber = finiteOrNull(row.day_number);
    if (dayNumber === null || dayNumber < 1) continue;
    const distanceM = (finiteOrNull(row.distance_km) ?? 0) * 1000;
    const gainM = finiteOrNull(row.elevation_gain_m) ?? 0;
    const lossM = finiteOrNull(row.elevation_loss_m) ?? 0;
    if (distanceM <= 0 && gainM <= 0 && lossM <= 0) continue;

    const day = Math.round(dayNumber);
    const existing = byDay.get(day);
    if (existing) {
      existing.distanceM += distanceM;
      existing.gainM += gainM;
      existing.lossM += lossM;
    } else {
      byDay.set(day, { dayNumber: day, distanceM, gainM, lossM });
    }
  }
  return [...byDay.values()]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((stage) => ({
      dayNumber: stage.dayNumber,
      distanceM: Math.round(stage.distanceM * 100) / 100,
      gainM: Math.round(stage.gainM * 100) / 100,
      lossM: Math.round(stage.lossM * 100) / 100,
    }));
}

/**
 * Adaptateur Supabase du flux S3. Les lectures dégradent proprement (null/[]),
 * l'écriture passe exclusivement par la RPC service_role.
 */
export function createSupabaseGroupTrekDataSource(
  client: SupabaseClient
): GroupTrekDataSource {
  return {
    async getCrewById(crewId) {
      const { data, error } = await client
        .from('crews')
        .select('id, created_by, visibility')
        .eq('id', crewId)
        .maybeSingle();
      if (error || !data) return null;
      const row = data as Record<string, unknown>;
      return {
        id: String(row.id),
        createdBy: String(row.created_by),
        visibility: typeof row.visibility === 'string' ? row.visibility : 'private',
      };
    },

    async getCrewIdForTrip(tripId) {
      const { data, error } = await client
        .from('trips')
        .select('crew_id')
        .eq('id', tripId)
        .maybeSingle();
      if (error || !data) return null;
      return textOrNull((data as Record<string, unknown>).crew_id);
    },

    async listActiveCrewMembers(crewId) {
      const { data, error } = await client
        .from('crew_members')
        .select('user_id, role')
        .eq('crew_id', crewId)
        .eq('status', 'active');
      if (error || !data) return [];
      return (data as Record<string, unknown>[]).map((row) => ({
        userId: String(row.user_id),
        role: typeof row.role === 'string' ? row.role : 'member',
      }));
    },

    async getTripStages(tripId) {
      const { data, error } = await client
        .from('trip_steps')
        .select('day_number, distance_km, elevation_gain_m, elevation_loss_m')
        .eq('trip_id', tripId)
        .order('day_number', { ascending: true })
        .order('order_index', { ascending: true });
      if (error || !data) return [];
      return planStageFromRows(data as Record<string, unknown>[]);
    },

    async getDisplayNames(userIds) {
      if (userIds.length === 0) return {};
      const { data, error } = await client
        .from('public_profiles')
        .select('id, full_name')
        .in('id', userIds);
      if (error || !data) return {};
      const names: Record<string, string> = {};
      for (const row of data as Record<string, unknown>[]) {
        const name = textOrNull(row.full_name);
        if (name) names[String(row.id)] = name;
      }
      return names;
    },

    async hasActiveConsent(userId) {
      const { data, error } = await client.rpc('has_active_consent', {
        p_user_id: userId,
        p_purpose: 'personal_performance',
      });
      if (error) return false;
      return data === true;
    },

    async getProfileSpeeds(userId) {
      const { data, error } = await client
        .from('user_performance_profiles')
        .select('flat_speed_kmh, ascent_speed_m_per_h, descent_speed_m_per_h')
        .eq('user_id', userId)
        .eq('activity_type', 'hiking')
        .maybeSingle();
      if (error || !data) return null;
      const row = data as Record<string, unknown>;
      return {
        flatSpeedKmH: finiteOrNull(row.flat_speed_kmh),
        ascentSpeedMPerHour: finiteOrNull(row.ascent_speed_m_per_h),
        descentSpeedMPerHour: finiteOrNull(row.descent_speed_m_per_h),
      };
    },

    async appendVersion(payload) {
      const { data, error } = await client.rpc('a13_append_plan_version', {
        p_user_id: payload.userId,
        p_plan_id: payload.planId,
        p_version: payload.version,
      });
      if (error) throw new Error(error.message);
      return Number(data);
    },

    async readLatestSnapshot(planId) {
      const { data, error } = await client
        .from('adventure_plan_versions')
        .select('version, snapshot')
        .eq('plan_id', planId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      const row = data as Record<string, unknown>;
      return { version: Number(row.version), snapshot: row.snapshot };
    },
  };
}

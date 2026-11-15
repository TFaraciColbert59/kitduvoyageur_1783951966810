/**
 * Lot A01 — S1.08 / S1.12 : Création serveur d'une activité saisie manuellement
 * (avec support natation piscine et rééducation, validation stricte et idempotence).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeLegacyHikeSession,
  type LifecycleActivityRecord,
} from '@/features/activity/lifecycle';
import {
  REHAB_COMPATIBLE_MAPPINGS,
  createManualRehabActivity,
  validateManualActivityInput,
  type ManualActivityInput,
  type RehabBodyZone,
} from '@/features/explorer-v2/activity/modes';
import {
  createSupabaseLifecycleStore,
  type LifecycleOverlayStore,
} from './lifecycle';
import { normalizeVisibility, type OutingVisibility } from './sorties';

export interface CreateManualActivityRequest extends ManualActivityInput {
  visibility?: 'private' | 'collective_anonymized' | null;
  tags?: string[] | null;
  poolLengthM?: number | null;
  poolLengthsCount?: number | null;
  bodyZone?: RehabBodyZone | null;
  painLevel?: number | null;
  mobilityScore?: number | null;
}

export type CreateManualActivityOutcome =
  | {
      ok: true;
      id: string;
      record: LifecycleActivityRecord;
      deduplicated: boolean;
    }
  | {
      ok: false;
      code: string;
      field?: string;
      error: string;
    };

export interface ManualActivityDeps {
  store: LifecycleOverlayStore;
  insertHikeSession: (row: {
    user_id: string;
    title: string;
    notes: string | null;
    started_at: string;
    ended_at: string;
    distance_km: number;
    duration_seconds: number;
    elevation_gain_m: number;
    visibility: OutingVisibility;
    variant_id: string | null;
    processing_status: string;
  }) => Promise<{ id: string }>;
  now?: () => Date;
}

export function createSupabaseManualActivityDeps(
  supabase: SupabaseClient,
): ManualActivityDeps {
  return {
    store: createSupabaseLifecycleStore(supabase),
    async insertHikeSession(row) {
      let attempt = await supabase
        .from('hike_sessions')
        .insert({
          user_id: row.user_id,
          title: row.title,
          notes: row.notes,
          started_at: row.started_at,
          ended_at: row.ended_at,
          distance_km: row.distance_km,
          duration_seconds: row.duration_seconds,
          elevation_gain_m: row.elevation_gain_m,
          visibility: row.visibility,
          variant_id: row.variant_id,
          processing_status: row.processing_status,
        })
        .select('id')
        .single();

      // Fallback si `variant_id` ou `processing_status` manque sur schéma ancien
      if (attempt.error?.code === '42703') {
        attempt = await supabase
          .from('hike_sessions')
          .insert({
            user_id: row.user_id,
            title: row.title,
            notes: row.notes,
            started_at: row.started_at,
            ended_at: row.ended_at,
            distance_km: row.distance_km,
            duration_seconds: row.duration_seconds,
            elevation_gain_m: row.elevation_gain_m,
            visibility: row.visibility,
          })
          .select('id')
          .single();
      }

      if (attempt.error || !attempt.data?.id) {
        throw new Error(attempt.error?.message ?? 'Insertion hike_sessions impossible.');
      }
      return { id: String(attempt.data.id) };
    },
  };
}

export async function createManualActivitySession(
  deps: ManualActivityDeps,
  userId: string,
  input: CreateManualActivityRequest,
): Promise<CreateManualActivityOutcome> {
  const isRehab =
    typeof input.sportOrVariant === 'string' && input.sportOrVariant.startsWith('rehab-');

  let normalizedDistanceM: number | null = null;
  let normalizedElevGainM: number | null = null;
  let normalizedDurationS = 0;
  let normalizedElapsedS = 0;
  let startedAtMs = 0;
  let endedAtMs = 0;
  let sport: LifecycleActivityRecord['sport'] = 'rando';
  let variantId: string | null = null;
  let serverVariantId: string | null = null;
  let defaultTitle = 'Activité manuelle';
  let clientSessionId = input.clientSessionId?.trim() || '';
  let resolvedNotes = input.notes ?? null;

  if (isRehab) {
    const rehabRes = createManualRehabActivity({
      ...input,
      rehabVariant: input.sportOrVariant,
      bodyZone: input.bodyZone ?? null,
      painLevel: input.painLevel ?? null,
      mobilityScore: input.mobilityScore ?? null,
    });
    if (!rehabRes.ok) {
      return {
        ok: false,
        code: rehabRes.code,
        error: rehabRes.message,
      };
    }
    const s = rehabRes.summary;
    const rehabMapping = REHAB_COMPATIBLE_MAPPINGS[s.details.rehabVariantId];
    sport = s.activity.sport;
    variantId = s.variantId;
    serverVariantId = rehabMapping?.serverVariantId ?? null;
    defaultTitle = s.variantLabel;
    startedAtMs = s.activity.startedAt;
    endedAtMs = s.activity.endedAt;
    normalizedDurationS = s.movingS;
    normalizedElapsedS = s.elapsedS;
    normalizedDistanceM = s.activity.distanceM > 0 ? s.activity.distanceM : 0;
    normalizedElevGainM = s.activity.elevGainM > 0 ? s.activity.elevGainM : 0;
    clientSessionId = s.localRecord.clientSessionId ?? clientSessionId;

    const rehabLines = [
      s.details.bodyZone ? `Zone : ${s.details.bodyZone}` : null,
      s.details.painLevel !== null ? `Douleur : ${s.details.painLevel}/10` : null,
      s.details.mobilityScore !== null ? `Mobilité : ${s.details.mobilityScore}/5` : null,
      resolvedNotes?.trim() || null,
    ].filter(Boolean);
    resolvedNotes = rehabLines.length > 0 ? rehabLines.join('\n') : null;
  } else {
    const validated = validateManualActivityInput(input);
    if (!validated.ok) {
      return {
        ok: false,
        code: validated.code,
        field: validated.field,
        error: validated.message,
      };
    }
    const v = validated.value;
    sport = v.mapping.serverSport;
    variantId = v.mapping.selection.variantId;
    serverVariantId = v.mapping.serverVariantId;
    defaultTitle = v.mapping.selection.variantLabel;
    startedAtMs = v.startedAtMs;
    endedAtMs = v.endedAtMs;
    normalizedDurationS = v.movingS;
    normalizedElapsedS = v.elapsedS;
    normalizedDistanceM = v.distanceM ?? 0;
    normalizedElevGainM = v.elevGainM ?? 0;
    clientSessionId = v.clientSessionId;
    resolvedNotes = v.notes;

    if (
      variantId === 'natation-piscine' &&
      typeof input.poolLengthM === 'number' &&
      typeof input.poolLengthsCount === 'number' &&
      input.poolLengthM >= 10 &&
      input.poolLengthsCount > 0 &&
      (!normalizedDistanceM || normalizedDistanceM === 0)
    ) {
      normalizedDistanceM = Math.round(input.poolLengthM * input.poolLengthsCount);
    }
  }

  const operationId = clientSessionId ? `manual:${clientSessionId}` : null;
  if (operationId) {
    const existing = await deps.store.listOverlays(userId);
    const match = existing.find((row) => row.operationId === operationId);
    if (match) {
      return {
        ok: true,
        id: match.activityId,
        record: match.record,
        deduplicated: true,
      };
    }
  }

  const startedAtIso = new Date(startedAtMs).toISOString();
  const endedAtIso = new Date(endedAtMs).toISOString();
  const visibility = normalizeVisibility(input.visibility);
  const title = (input.title?.trim() || defaultTitle).slice(0, 120);
  const distanceKm = Math.round(((normalizedDistanceM ?? 0) / 1000) * 100) / 100;
  const elevGainM = Math.round(normalizedElevGainM ?? 0);

  const inserted = await deps.insertHikeSession({
    user_id: userId,
    title,
    notes: resolvedNotes,
    started_at: startedAtIso,
    ended_at: endedAtIso,
    distance_km: distanceKm,
    duration_seconds: normalizedDurationS,
    elevation_gain_m: elevGainM,
    visibility,
    variant_id: serverVariantId,
    processing_status: 'manual',
  });

  const nowDate = deps.now ? deps.now() : new Date();
  const nowIso = nowDate.toISOString();
  const nowMs = nowDate.getTime();

  const normalized = normalizeLegacyHikeSession(
    {
      id: inserted.id,
      user_id: userId,
      title,
      notes: resolvedNotes,
      sport,
      variant_id: variantId,
      tags: Array.isArray(input.tags) ? input.tags : [],
      started_at: startedAtIso,
      ended_at: endedAtIso,
      distance_km: distanceKm,
      duration_seconds: normalizedDurationS,
      elevation_gain_m: elevGainM,
      visibility,
      points: [],
    },
    nowMs,
  );

  const record: LifecycleActivityRecord = {
    ...normalized,
    stats: {
      ...normalized.stats,
      elapsedTimeS: Math.max(normalizedElapsedS, normalizedDurationS),
      movingTimeS: normalizedDurationS,
      pauseTimeS: Math.max(0, normalizedElapsedS - normalizedDurationS),
      distanceM: normalizedDistanceM ?? 0,
      elevationGainM: elevGainM,
    },
    provenance: {
      ...normalized.provenance,
      origin: 'manual',
      label: 'Saisie manuelle',
      syncedAt: nowIso,
    },
    quickEditState: {
      ...normalized.quickEditState,
      status: 'not_applicable',
      visible: false,
    },
  };

  await deps.store.saveOverlay({
    userId,
    activityId: inserted.id,
    parentActivityId: null,
    source: 'manual',
    revision: record.revision,
    lifecycleStatus: 'active',
    deletedAt: null,
    purgeAfter: null,
    record,
    operationId,
    updatedAt: nowIso,
  });

  return {
    ok: true,
    id: inserted.id,
    record,
    deduplicated: false,
  };
}

import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type ChallengeReplaceFailureReason =
  | 'cooldown'
  | 'no_progression'
  | 'no_alternative'
  | 'unavailable';

/* ============================================================================
 * T13 — Assignations de missions (≤ 3 actives), compatibles avec l'ancien
 * `current_challenge_id` (lecture legacy conservée ; aucun suppression).
 * Le client ne choisit qu'un model_id du catalogue publié ; l'identité vient
 * toujours de la session serveur, jamais du corps de requête.
 * ========================================================================== */

export type MissionFailureReason =
  | 'limite_atteinte'
  | 'modele_non_publie'
  | 'assignation_introuvable'
  | 'invalid_input'
  | 'unavailable';

export interface UserMissionAssignment {
  id: string;
  modelId: string;
  state: 'active' | 'replaced' | 'abandoned';
  targetCount: number;
  period: 'ever' | 'week' | 'season';
  progress: number;
  completedAt: string | null;
  createdAt: string;
}

export interface AvailableMissionModel {
  id: string;
  title: string;
  description: string;
  targetCount: number;
  period: 'ever' | 'week' | 'season';
}

export type MissionMutationResult =
  | { ok: true; assignmentId?: string }
  | { ok: false; reason: MissionFailureReason };

const MISSION_MODEL_ID_PATTERN = /^mission_[a-z0-9_]{3,64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createMissionServiceClient(): SupabaseClient {
  return createChallengeServiceClient();
}

/** Missions du compte (l'utilisateur vient de la session serveur). */
export async function getUserMissions(userId: string): Promise<UserMissionAssignment[]> {
  const supabase = createMissionServiceClient();

  // T14 — l'avancement est recalculé depuis les événements avant lecture.
  // Un échec de recalcul ne bloque jamais la liste (simple fraîcheur).
  try {
    await (supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
    }).rpc('refresh_progression_mission_progress', { p_user_id: userId });
  } catch {
    /* silencieux : lecture servie sur le dernier état connu */
  }

  const { data, error } = await supabase
    .from('progression_mission_assignments')
    .select('id, model_id, state, target_count, period, progress, completed_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    id: string;
    model_id: string;
    state: string;
    target_count: number | null;
    period: string | null;
    progress: number | null;
    completed_at: string | null;
    created_at: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    modelId: row.model_id,
    state: (row.state === 'replaced' || row.state === 'abandoned' ? row.state : 'active') as
      UserMissionAssignment['state'],
    targetCount: Math.max(1, Math.floor(Number(row.target_count) || 1)),
    period: (row.period === 'week' || row.period === 'season' ? row.period : 'ever') as
      UserMissionAssignment['period'],
    progress: Math.max(0, Math.floor(Number(row.progress) || 0)),
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at ?? '',
  }));
}

/**
 * T14 — Modèles publiés (producteurs disponibles) proposables au choix.
 * Les libellés viennent du catalogue versionné ; la publication vient de la
 * base (aucun modèle fermé n'est proposé).
 */
export async function getAvailableMissionModels(): Promise<AvailableMissionModel[]> {
  const { findMissionModel } = await import('../domain/missionCatalog');
  const supabase = createMissionServiceClient();
  const { data, error } = await supabase
    .from('progression_challenge_models')
    .select('model_id')
    .eq('provenance', 'canonical_v2');
  if (error) throw new Error(error.message);

  const ids = [
    ...new Set(
      ((data ?? []) as Array<{ model_id: string | null }>)
        .map((row) => row.model_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];

  const models: AvailableMissionModel[] = [];
  for (const id of ids) {
    const model = findMissionModel(id);
    if (!model || model.status !== 'available') continue;
    models.push({
      id: model.id,
      title: model.title,
      description: model.description,
      targetCount: model.targetCount,
      period: model.period,
    });
  }
  return models;
}

async function callMissionRpc(
  name: string,
  params: Record<string, unknown>
): Promise<MissionMutationResult> {
  const supabase = createMissionServiceClient();
  const rpc = (supabase as unknown as {
    rpc?: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc;
  if (typeof rpc !== 'function') return { ok: false, reason: 'unavailable' };

  const { data, error } = await rpc(name, params);
  if (error) throw new Error(error.message);

  const payload =
    data !== null && typeof data === 'object'
      ? (data as { ok?: unknown; reason?: unknown; assignmentId?: unknown })
      : null;
  if (payload?.ok === true) {
    return {
      ok: true,
      assignmentId:
        typeof payload.assignmentId === 'string' && UUID_PATTERN.test(payload.assignmentId)
          ? payload.assignmentId
          : undefined,
    };
  }
  const known: readonly MissionFailureReason[] = [
    'limite_atteinte',
    'modele_non_publie',
    'assignation_introuvable',
    'invalid_input',
    'unavailable',
  ];
  const reason =
    typeof payload?.reason === 'string' && (known as readonly string[]).includes(payload.reason)
      ? (payload.reason as MissionFailureReason)
      : 'unavailable';
  return { ok: false, reason };
}

export async function chooseProgressionMission(
  userId: string,
  modelId: string
): Promise<MissionMutationResult> {
  if (!MISSION_MODEL_ID_PATTERN.test(modelId)) return { ok: false, reason: 'invalid_input' };
  return callMissionRpc('choose_progression_mission', {
    p_user_id: userId,
    p_model_id: modelId,
  });
}

export async function replaceProgressionMission(
  userId: string,
  assignmentId: string,
  modelId: string
): Promise<MissionMutationResult> {
  if (!UUID_PATTERN.test(assignmentId) || !MISSION_MODEL_ID_PATTERN.test(modelId)) {
    return { ok: false, reason: 'invalid_input' };
  }
  return callMissionRpc('replace_progression_mission', {
    p_user_id: userId,
    p_assignment_id: assignmentId,
    p_model_id: modelId,
  });
}

export async function abandonProgressionMission(
  userId: string,
  assignmentId: string
): Promise<MissionMutationResult> {
  if (!UUID_PATTERN.test(assignmentId)) return { ok: false, reason: 'invalid_input' };
  return callMissionRpc('abandon_progression_mission', {
    p_user_id: userId,
    p_assignment_id: assignmentId,
  });
}

export type ChallengeReplaceResult =
  | { ok: true; challengeId: string }
  | { ok: false; reason: ChallengeReplaceFailureReason };

const KNOWN_FAILURE_REASONS: readonly ChallengeReplaceFailureReason[] = [
  'cooldown',
  'no_progression',
  'no_alternative',
];

function createChallengeServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      '[progression] NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour remplacer un défi.'
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Remplace le défi en cours côté serveur (fonction SQL canonique, cooldown
 * 7 jours, catalogue réel). La décision appartient au serveur : le client ne
 * fournit jamais d'identifiant de défi.
 */
export async function replaceProgressionChallenge(
  userId: string
): Promise<ChallengeReplaceResult> {
  const supabase = createChallengeServiceClient();

  const rpc = (supabase as unknown as {
    rpc?: (
      name: string,
      params: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc;

  if (typeof rpc !== 'function') {
    return { ok: false, reason: 'unavailable' };
  }

  const { data, error } = await rpc('replace_progression_challenge', {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload =
    data !== null && typeof data === 'object'
      ? (data as { ok?: unknown; challengeId?: unknown; reason?: unknown })
      : null;

  if (
    payload?.ok === true &&
    typeof payload.challengeId === 'string' &&
    payload.challengeId.trim().length > 0
  ) {
    return { ok: true, challengeId: payload.challengeId };
  }

  const reason =
    typeof payload?.reason === 'string' &&
    (KNOWN_FAILURE_REASONS as readonly string[]).includes(payload.reason)
      ? (payload.reason as ChallengeReplaceFailureReason)
      : 'unavailable';

  return { ok: false, reason };
}

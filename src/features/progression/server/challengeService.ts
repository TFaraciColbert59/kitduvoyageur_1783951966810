import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type ChallengeReplaceFailureReason =
  | 'cooldown'
  | 'no_progression'
  | 'no_alternative'
  | 'unavailable';

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

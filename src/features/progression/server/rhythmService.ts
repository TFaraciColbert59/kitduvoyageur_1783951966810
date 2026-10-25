import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  RHYTHM_DEFAULT,
  computeWeeklyRhythmProgress,
  type ProgressionRhythmPreference,
  type WeeklyRhythmId,
  type WeeklyRhythmProgress,
} from '../domain/rhythm';

/**
 * T16 — Préférences de rythme (privées). Lecture/écriture scopées utilisateur
 * via service_role ; aucune écriture économique, aucune perte à la pause.
 */

const RHYTHM_IDS: readonly WeeklyRhythmId[] = ['leger', 'regulier', 'intense'];

function createRhythmClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      '[progression] NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour le rythme.'
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isWeeklyRhythmId(value: unknown): value is WeeklyRhythmId {
  return typeof value === 'string' && (RHYTHM_IDS as readonly string[]).includes(value);
}

export interface ProgressionRhythmState {
  preference: ProgressionRhythmPreference;
  weekly: WeeklyRhythmProgress;
}

export async function getProgressionRhythm(userId: string): Promise<ProgressionRhythmState> {
  const supabase = createRhythmClient();

  const { data, error } = await supabase
    .from('progression_user_preferences')
    .select('weekly_rhythm, paused')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const row = (data ?? null) as { weekly_rhythm: string | null; paused: boolean | null } | null;
  const preference: ProgressionRhythmPreference = {
    rhythmId: isWeeklyRhythmId(row?.weekly_rhythm) ? (row?.weekly_rhythm as WeeklyRhythmId) : null,
    paused: row?.paused === true,
  };

  // Réalisations de la semaine : événements canoniques uniquement (aucun XP lu).
  let dates: string[] = [];
  try {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 7);
    const { data: events } = await supabase
      .from('progression_events')
      .select('effective_at')
      .eq('user_id', userId)
      .gte('effective_at', since.toISOString());
    dates = ((events ?? []) as Array<{ effective_at: string | null }>)
      .map((event) => event.effective_at)
      .filter((value): value is string => typeof value === 'string');
  } catch {
    dates = [];
  }

  return { preference, weekly: computeWeeklyRhythmProgress(preference, dates) };
}

export type RhythmUpdateResult =
  | { ok: true }
  | { ok: false; reason: 'rythme_invalide' | 'unavailable' };

/**
 * T35 — Opt-in de compétition (distinct de la confidentialité) : le retrait
 * supprime effectivement les agrégats du compte (fonction SQL verrouillée).
 */
export async function setCompetitionOptIn(
  userId: string,
  optIn: boolean
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const supabase = createRhythmClient();
    const { data, error } = await supabase.rpc('set_competition_optin', {
      p_user_id: userId,
      p_opt_in: optIn,
    });
    if (error) throw new Error(error.message);
    const payload = data !== null && typeof data === 'object' ? (data as { ok?: unknown }) : null;
    return { ok: payload?.ok === true };
  } catch (error) {
    console.error('[progression/rhythm] opt-in compétition:', error);
    return { ok: false, reason: 'unavailable' };
  }
}

export async function updateProgressionRhythm(
  userId: string,
  update: { rhythmId?: WeeklyRhythmId | null; paused?: boolean }
): Promise<RhythmUpdateResult> {
  if (update.rhythmId !== undefined && update.rhythmId !== null && !isWeeklyRhythmId(update.rhythmId)) {
    return { ok: false, reason: 'rythme_invalide' };
  }
  const supabase = createRhythmClient();
  const { data, error } = await supabase.rpc('update_progression_preferences', {
    p_user_id: userId,
    p_weekly_rhythm: update.rhythmId ?? null,
    p_set_rhythm: update.rhythmId !== undefined,
    p_paused: update.paused ?? null,
    p_set_paused: update.paused !== undefined,
  });
  if (error) throw new Error(error.message);

  const payload = data !== null && typeof data === 'object' ? (data as { ok?: unknown }) : null;
  if (payload?.ok === true) return { ok: true };
  return { ok: false, reason: 'unavailable' };
}

export { RHYTHM_DEFAULT };

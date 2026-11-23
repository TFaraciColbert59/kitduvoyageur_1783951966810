/**
 * 10.8 — Recalcul du Profil Terrain après une sortie traitée.
 *
 * Branché sur le cron `process-hike-sessions` : une fois la session `processed` (observations écrites par la RPC
 * `persist_processed_hike_session`, donc déjà sous consentement), le profil de la personne est reconstruit par
 * `buildUserProfile` (`buildPerformanceProfile` sur ses observations privées). Règles :
 *  - consentement vérifié ICI aussi (même contrôle que le traitement : `hasPersonalScoringConsent`, fail-safe) ;
 *  - idempotent : `buildUserProfile` upserte sur `(user_id, activity_type)` et `(profile_id, model_version)` ; de plus,
 *    rien n'est recalculé si le profil est déjà plus récent que la dernière observation ;
 *  - borné : au plus `PROFILE_BUILD_LIMIT` observations lues, une seule reconstruction par personne et par exécution ;
 *  - non bloquant : toute erreur est rendue en statut, jamais levée (la session reste traitée).
 * Client Supabase injecté (service_role côté cron) : testable sans réseau.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileObservation } from '../domain/performanceProfile';
import { ACTIVITY_TYPE, buildUserProfile, PROFILE_BUILD_LIMIT, type ProfileBuildClient } from './buildUserProfile';
import { hasPersonalScoringConsent, type HikeProcessingClient } from './processHikeSession';

export type RecomputeStatus = 'rebuilt' | 'cold' | 'up_to_date' | 'skipped_no_consent' | 'error';

interface ObservationRow {
  observed_at: string;
  distance_m: number | string;
  duration_s: number | string;
  moving_s: number | string | null;
  gain_m: number | string | null;
  loss_m: number | string | null;
  mean_grade_pct: number | string | null;
  surface: string | null;
  pack_weight_kg: number | string | null;
  quality: number | string | null;
  declared_fatigue: number | string | null;
  perceived_difficulty: number | string | null;
}

const num = (v: number | string | null): number | null => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));

/** Adaptateur Supabase de `ProfileBuildClient` (service_role : les écritures du profil lui sont réservées par RLS). */
export function supabaseProfileBuildClient(supabase: SupabaseClient): ProfileBuildClient {
  return {
    async getObservations(userId, limit = PROFILE_BUILD_LIMIT) {
      const { data, error } = await supabase
        .from('performance_observations')
        .select('observed_at, distance_m, duration_s, moving_s, gain_m, loss_m, mean_grade_pct, surface, pack_weight_kg, quality, declared_fatigue, perceived_difficulty')
        .eq('user_id', userId)
        .order('observed_at', { ascending: false })
        .limit(Math.min(limit, PROFILE_BUILD_LIMIT));
      if (error) throw new Error(error.message);
      return ((data ?? []) as ObservationRow[]).map(
        (r): ProfileObservation => ({
          observedAt: r.observed_at,
          distanceM: Number(r.distance_m),
          durationS: Number(r.duration_s),
          movingS: num(r.moving_s),
          gainM: num(r.gain_m),
          lossM: num(r.loss_m),
          meanGradePct: num(r.mean_grade_pct),
          surface: r.surface,
          packWeightKg: num(r.pack_weight_kg),
          quality: num(r.quality),
          declaredFatigue: num(r.declared_fatigue),
          perceivedDifficulty: num(r.perceived_difficulty),
        }),
      );
    },
    async upsertProfile(row) {
      const { data, error } = await supabase
        .from('user_performance_profiles')
        .upsert(row as Record<string, unknown>, { onConflict: 'user_id,activity_type' })
        .select('id')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'profil non écrit');
      return { id: (data as { id: string }).id };
    },
    async upsertProfileVersion(row) {
      const { error } = await supabase.from('user_performance_profile_versions').upsert(row as Record<string, unknown>, { onConflict: 'profile_id,model_version' });
      if (error) throw new Error(error.message);
    },
  };
}

/** Vrai si le profil courant est plus récent que la dernière observation de la personne (rien de neuf à apprendre). */
export async function profileIsUpToDate(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: last } = await supabase
    .from('performance_observations')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastAt = Date.parse((last as { created_at?: string } | null)?.created_at ?? '');
  if (!Number.isFinite(lastAt)) return true; // aucune observation : rien à apprendre, pas de profil « froid » réécrit à chaque passage
  const { data: profile } = await supabase
    .from('user_performance_profiles')
    .select('computed_at')
    .eq('user_id', userId)
    .eq('activity_type', ACTIVITY_TYPE)
    .maybeSingle();
  const computedAt = Date.parse((profile as { computed_at?: string } | null)?.computed_at ?? '');
  return Number.isFinite(computedAt) && computedAt >= lastAt;
}

export interface RecomputeDeps {
  readonly consent: Pick<HikeProcessingClient, 'hasActiveConsent'>;
  readonly build: ProfileBuildClient;
  readonly upToDate: (userId: string) => Promise<boolean>;
  /** Personnes déjà traitées pendant cette exécution : une reconstruction par personne. */
  readonly done?: Set<string>;
}

export async function recomputeProfileAfterSession(userId: string, deps: RecomputeDeps): Promise<RecomputeStatus> {
  try {
    if (deps.done?.has(userId)) return 'up_to_date';
    deps.done?.add(userId);
    if (!(await hasPersonalScoringConsent(deps.consent, userId))) return 'skipped_no_consent';
    if (await deps.upToDate(userId)) return 'up_to_date';
    const built = await buildUserProfile(userId, deps.build);
    return built.status === 'built' ? 'rebuilt' : 'cold';
  } catch (err) {
    console.error('[adventure-intelligence/cron] recalcul du profil en échec:', userId, err instanceof Error ? err.message : err);
    return 'error';
  }
}

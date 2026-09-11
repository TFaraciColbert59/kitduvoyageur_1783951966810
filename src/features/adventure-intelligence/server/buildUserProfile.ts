/**
 * A3 — Orchestrateur serveur de construction du Profil Terrain.
 *
 * Client injecté (`ProfileBuildClient`) : aucune dépendance Supabase ici,
 * testable sans réseau. Idempotent par `modelVersion` (`a3-v1`) : le profil
 * est upserté sur `(user_id, activity_type)` puis un snapshot versionné est
 * upserté sur `(profile_id, model_version)` (contrainte unique A1).
 * Aucune donnée de santé : uniquement les observations GPS Phase 2.
 */
import 'server-only';
import {
  buildPerformanceProfile,
  type LearnedPerformanceProfile,
  type ProfileObservation,
} from '../domain/performanceProfile';

/** Plafond d'observations lues par recalcul (historique récent). */
export const PROFILE_BUILD_LIMIT = 500;
export const ACTIVITY_TYPE = 'hiking';
export const PROFILE_VERSION_REASON = 'recompute';

export interface ProfileBuildClient {
  getObservations(userId: string, limit?: number): Promise<ProfileObservation[]>;
  upsertProfile(row: unknown): Promise<{ id: string }>;
  /**
   * Persiste le snapshot versionné. DOIT être idempotent sur
   * `(profile_id, model_version)` : un recalcul du même `model_version`
   * écrase le snapshot existant au lieu d'insérer une ligne en double
   * (contrainte `UNIQUE (profile_id, model_version)`), c.-à-d. un upsert
   * `onConflict: 'profile_id,model_version'` côté adaptateur Supabase.
   */
  upsertProfileVersion(row: unknown): Promise<void>;
}

export interface BuildUserProfileResult {
  status: 'built' | 'cold';
  sampleCount: number;
}

/** Mapping domaine → colonnes `user_performance_profiles` (schéma A1/M3). */
function toProfileRow(userId: string, profile: LearnedPerformanceProfile): Record<string, unknown> {
  return {
    user_id: userId,
    activity_type: ACTIVITY_TYPE,
    model_version: profile.modelVersion,
    flat_speed_kmh: profile.flatSpeedKmH,
    ascent_speed_m_per_h: profile.ascentSpeedMPerHour,
    descent_speed_m_per_h: profile.descentSpeedMPerHour,
    grade_response: profile.gradeResponse,
    surface_response: profile.surfaceResponse,
    fatigue_curve: profile.fatigueCurve,
    pause_model: profile.pauseModel,
    pack_response: profile.packResponse,
    calibration_level: profile.calibrationLevel,
    confidence: profile.confidence,
    sample_count: profile.sampleCount,
    computed_at: profile.computedAt,
  };
}

/**
 * Reconstruit le profil d'un utilisateur à partir de ses observations privées,
 * puis persiste le profil courant et son snapshot versionné.
 * Profil sans échantillon exploitable ⇒ statut `cold` (profil neutre écrit).
 */
export async function buildUserProfile(
  userId: string,
  client: ProfileBuildClient
): Promise<BuildUserProfileResult> {
  const observations = await client.getObservations(userId, PROFILE_BUILD_LIMIT);
  const profile = buildPerformanceProfile(observations);

  const saved = await client.upsertProfile(toProfileRow(userId, profile));

  await client.upsertProfileVersion({
    profile_id: saved.id,
    user_id: userId,
    activity_type: ACTIVITY_TYPE,
    model_version: profile.modelVersion,
    snapshot: { ...profile, userId },
    confidence: profile.confidence,
    sample_count: profile.sampleCount,
    reason: PROFILE_VERSION_REASON,
  });

  return {
    status: profile.personalized ? 'built' : 'cold',
    sampleCount: profile.sampleCount,
  };
}

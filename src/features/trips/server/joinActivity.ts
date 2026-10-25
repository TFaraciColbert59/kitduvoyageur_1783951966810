import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { syncTripCollaboratorsToCrew } from '@/features/hub/server/syncTripCrew';
import {
  deriveMemberInput,
  type MemberOrientationRaw,
  type MemberPerformanceProfileRaw,
} from '@/features/trips/domain/memberProfile';
import { recomputeParty } from './recomputeParty';

/**
 * Task 17 — Flux « Rejoindre une activité ».
 *
 * Accès : lien porteur du `trips.share_token` OU voyage public/unlisted
 * (mêmes règles que `getTripBySlug`, l.348-391). Le membre déjà présent est
 * renvoyé `already_member` (l'UI redirige `/hub`), un slug inconnu ou un lien
 * invalide reste `not_found` (jamais d'énumération), un appelant sans session
 * est `auth`.
 *
 * Écritures (client service-role : le joiner n'a pas les droits RLS) :
 *   • `trip_collaborators` rôle `editor` (patron `queries-trip-collab` l.124-146) ;
 *   • `trip_participants` rôle `member`, statut `confirmed` (modèle unifié) ;
 *   • `syncTripCollaboratorsToCrew` (couche groupe H-ACT) ;
 *   • snapshot `trip_member_profiles` via `deriveMemberInput` — profil appris
 *     lu UNIQUEMENT si consentement `personal_performance` actif, orientation
 *     déclarée lue si consentement utilisateur ; sans consentement le snapshot
 *     est posé en moyennes population (`consented_at` null) ;
 *   • `recomputeParty(tripId)` (Task 18).
 *
 * `revalidatePath('/hub')` reste à la charge de la route (`accepter/route.ts`).
 */

export type JoinActivityCode = 'auth' | 'not_found' | 'already_member';

export interface JoinActivityOptions {
  consent: boolean;
  /** Token de partage (`?token=`) ; optionnel si voyage public/unlisted. */
  token?: string | null;
  /** Utilisateur courant ; `null` = anonyme explicite, absent = résolu session. */
  userId?: string | null;
  /** Client service-role injecté (tests) ; défaut = client partagé. */
  service?: SupabaseClient | null;
}

export interface JoinActivityResult {
  ok: boolean;
  code?: JoinActivityCode;
  tripId?: string;
}

interface JoinTripRow {
  id: string;
  user_id: string;
  share_token: string | null;
  visibility: string;
}

export interface JoinActivityPreview {
  tripId: string;
  slug: string;
  title: string;
  destinationName: string | null;
  startDate: string | null;
  endDate: string | null;
  participantsCount: number;
  alreadyMember: boolean;
  accessAllowed: boolean;
}

/** Résout l'utilisateur courant via la session serveur (import paresseux). */
async function resolveUserId(options: JoinActivityOptions): Promise<string | null> {
  if (options.userId !== undefined) return options.userId;
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function normalizedToken(token: string | null | undefined): string | null {
  if (typeof token !== 'string') return null;
  const trimmed = token.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Aperçu honnête du voyage à rejoindre : accessible uniquement par token ou
 * visibilité ouverte, et seulement des champs de résumé publics.
 */
export async function loadJoinPreview(
  slug: string,
  options: { userId: string; token?: string | null; service?: SupabaseClient | null }
): Promise<JoinActivityPreview | null> {
  const service = options.service ?? getServiceSupabase();
  if (!service) return null;

  const { data: tripData, error } = await service
    .from('trips')
    .select('id, user_id, slug, title, destination_name, start_date, end_date, share_token, visibility')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !tripData) return null;

  const trip = tripData as unknown as JoinTripRow & {
    slug: string;
    title: string;
    destination_name: string | null;
    start_date: string | null;
    end_date: string | null;
  };

  const { data: membership } = await service
    .from('trip_collaborators')
    .select('user_id')
    .eq('trip_id', trip.id)
    .eq('user_id', options.userId);
  const alreadyMember = trip.user_id === options.userId || (membership ?? []).length > 0;

  const token = normalizedToken(options.token);
  const publicAccess = trip.visibility === 'public' || trip.visibility === 'unlisted';
  const accessAllowed = publicAccess || (token != null && trip.share_token === token);

  let participantsCount = 1;
  if (accessAllowed) {
    const { data: participants } = await service
      .from('trip_collaborators')
      .select('user_id')
      .eq('trip_id', trip.id);
    participantsCount = Math.max(1, (participants ?? []).length);
  }

  return {
    tripId: trip.id,
    slug: trip.slug,
    title: trip.title,
    destinationName: trip.destination_name,
    startDate: trip.start_date,
    endDate: trip.end_date,
    participantsCount,
    alreadyMember,
    accessAllowed,
  };
}

interface MemberSnapshotRow {
  trip_id: string;
  user_id: string;
  consented_at: string | null;
  flat_speed_kmh: number;
  ascent_speed_m_per_h: number;
  descent_speed_m_per_h: number;
  pack_weight_kg: number | null;
  max_carry_kg: number | null;
  experience_level: string;
  limitations: string | null;
  is_child: boolean;
  sources: Record<string, string>;
  calibration_level: string | null;
  sample_count: number | null;
  updated_at: string;
}

/**
 * Snapshot du profil membre : profil appris seulement sous consentement
 * `personal_performance` actif, orientation déclarée seulement si le voyageur
 * a coché le consentement du flux ; sinon moyennes population explicites.
 */
async function buildMemberSnapshot(
  service: SupabaseClient,
  tripId: string,
  userId: string,
  consent: boolean
): Promise<MemberSnapshotRow> {
  let performanceProfile: MemberPerformanceProfileRaw | null = null;
  let orientation: MemberOrientationRaw | null = null;

  if (consent) {
    let activeConsent = false;
    try {
      const { data, error } = await service.rpc('has_active_consent', {
        p_user_id: userId,
        p_purpose: 'personal_performance',
      });
      activeConsent = !error && data === true;
    } catch {
      activeConsent = false;
    }

    if (activeConsent) {
      const { data: profileRow, error: profileError } = await service
        .from('user_performance_profiles')
        .select(
          'flat_speed_kmh, ascent_speed_m_per_h, descent_speed_m_per_h, calibration_level, sample_count'
        )
        .eq('user_id', userId)
        .eq('activity_type', 'hiking')
        .maybeSingle();
      if (!profileError && profileRow) {
        performanceProfile = profileRow as unknown as MemberPerformanceProfileRaw;
      }
    }

    const { data: orientationRow, error: orientationError } = await service
      .from('user_orientation')
      .select('experience, terrain, autonomy')
      .eq('user_id', userId)
      .maybeSingle();
    if (!orientationError && orientationRow) {
      orientation = orientationRow as unknown as MemberOrientationRaw;
    }
  }

  const derived = deriveMemberInput({ performanceProfile, orientation, isChild: false });
  const now = new Date().toISOString();

  return {
    trip_id: tripId,
    user_id: userId,
    consented_at: consent ? now : null,
    flat_speed_kmh: derived.flatSpeedKmH,
    ascent_speed_m_per_h: derived.ascentSpeedMPerHour,
    descent_speed_m_per_h: derived.descentSpeedMPerHour,
    pack_weight_kg: derived.packWeightKg,
    max_carry_kg: derived.maxCarryKg,
    experience_level: derived.experienceLevel,
    limitations: derived.limitations,
    is_child: derived.isChild,
    sources: derived.sources,
    calibration_level: performanceProfile?.calibration_level ?? null,
    sample_count: performanceProfile?.sample_count ?? null,
    updated_at: now,
  };
}

/** Rejoint une activité partagée : membres + snapshot + recalcul d'équipage. */
export async function joinActivity(
  slug: string,
  options: JoinActivityOptions
): Promise<JoinActivityResult> {
  const service = options.service ?? getServiceSupabase();
  if (!service) return { ok: false };

  let userId: string | null;
  try {
    userId = await resolveUserId(options);
  } catch {
    userId = null;
  }
  if (!userId) return { ok: false, code: 'auth' };

  const { data: tripData, error: tripError } = await service
    .from('trips')
    .select('id, user_id, share_token, visibility')
    .eq('slug', slug)
    .maybeSingle();
  if (tripError || !tripData) return { ok: false, code: 'not_found' };
  const trip = tripData as unknown as JoinTripRow;

  const { data: membership } = await service
    .from('trip_collaborators')
    .select('user_id')
    .eq('trip_id', trip.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (membership || trip.user_id === userId) {
    return { ok: false, code: 'already_member', tripId: trip.id };
  }

  const token = normalizedToken(options.token);
  const publicAccess = trip.visibility === 'public' || trip.visibility === 'unlisted';
  const tokenAccess = token != null && trip.share_token === token;
  if (!publicAccess && !tokenAccess) return { ok: false, code: 'not_found' };

  // Insertions service-role : le joiner n'a aucun droit RLS d'écriture ici.
  const { error: collaboratorError } = await service.from('trip_collaborators').upsert(
    { trip_id: trip.id, user_id: userId, role: 'editor', invited_by: trip.user_id },
    { onConflict: 'trip_id,user_id', ignoreDuplicates: true }
  );
  if (collaboratorError) {
    console.error('[LKDV joinActivity] collaborateur non inséré:', collaboratorError.message);
    return { ok: false };
  }

  const { error: participantError } = await service.from('trip_participants').upsert(
    { trip_id: trip.id, user_id: userId, role: 'member', status: 'confirmed' },
    { onConflict: 'trip_id,user_id', ignoreDuplicates: true }
  );
  if (participantError) {
    // Compat modèle unifié best-effort : le collaborateur fait foi.
    console.warn('[LKDV joinActivity] participant non inséré:', participantError.message);
  }

  await syncTripCollaboratorsToCrew(trip.id).catch(() => undefined);

  const snapshot = await buildMemberSnapshot(service, trip.id, userId, options.consent === true);
  const { error: snapshotError } = await service
    .from('trip_member_profiles')
    .upsert(snapshot, { onConflict: 'trip_id,user_id' });
  if (snapshotError) {
    console.error('[LKDV joinActivity] snapshot profil non posé:', snapshotError.message);
  }

  try {
    await recomputeParty(trip.id);
  } catch (error) {
    console.error('[LKDV joinActivity] recalcul équipage en échec:', error);
  }

  return { ok: true, tripId: trip.id };
}

export default joinActivity;

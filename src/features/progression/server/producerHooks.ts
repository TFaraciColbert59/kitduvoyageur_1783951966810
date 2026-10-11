import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { awardProducerGain, type AwardProducerResult } from './awardProducer';

/**
 * P2/T09 — Accroches des producteurs vérifiés.
 *
 * Chaque accroche lit les faits côté serveur (propriété, état final, comptages,
 * durée active, mouvement plausible, contrôles dus) puis délègue au moteur
 * canonique. Toute erreur est avalée : la progression ne doit jamais casser le
 * parcours métier, et l'idempotence empêche tout doublon.
 *
 * T09 — Preuves renforcées (économie 2.0, P1) :
 *   • activité : paliers de DURÉE ACTIVE recalculée (20/60/120/240 min) ; le
 *     bonus par segments OSM est supprimé ; un tracé non plausible (téléphone
 *     immobile) ne produit aucun gain ; nouveauté de parcours canonique
 *     réservée par claim `route_novelty` (+20, une fois par saison, max 150) ;
 *   • checklist : au moins 3 contrôles DUS (`due_offset_days` non nul) tous
 *     terminés — un item libre coché ne suffit pas ;
 *   • itinérance : au moins 2 sessions traitées sur 2 JOURS UTC distincts ; une
 *     checklist ou un POI déclaré seuls ne prouvent plus le voyage ;
 *   • débrief kit : équipements DISTINCTS réellement évalués (20 + 2×n, borné) ;
 *     l'attribution attend la stabilisation de finalisation (capsule SQL) ;
 *   • avis de lieu : 15 XP ; le palier 40 (visite contrôlée) reste FERMÉ faute
 *     de preuve serveur de visite — aucun crédit inventé.
 */

/** Paliers de durée active (minutes) → points du gain d'activité. */
const DURATION_TIERS: ReadonlyArray<{ minActiveMinutes: number; points: number }> = [
  { minActiveMinutes: 240, points: 130 },
  { minActiveMinutes: 120, points: 100 },
  { minActiveMinutes: 60, points: 70 },
  { minActiveMinutes: 20, points: 40 },
];
/** Base du barème v1 (le bonus transmis est relatif à cette base). */
const ACTIVITY_BASE_POINTS = 40;
const NOVELTY_POINTS = 20;
const NOVELTY_CLAIM_GROUP = 'route_novelty';
/** Mouvement plausible minimal du traitement serveur (téléphone immobile exclu). */
const PLAUSIBLE_MOVEMENT_MIN = 0.5;
const KIT_ITEM_BONUS = 2;
const KIT_ITEM_MAX = 10;
const CHECKLIST_MIN_DUE_CONTROLS = 3;
const CHECKLIST_PREPARATION_STATUSES = new Set(['planned', 'active']);

async function award(input: Parameters<typeof awardProducerGain>[0]): Promise<AwardProducerResult> {
  try {
    return await awardProducerGain(input);
  } catch (error) {
    console.error('[progression/producerHooks] échec non bloquant:', error);
    return { success: false, outcome: 'refused', reason: 'hook_error' };
  }
}

/**
 * Lecture fail-closed d'un claim : en cas d'erreur, on considère le fait déjà
 * réservé (le bonus conditionnel n'est jamais accordé deux fois par accident).
 */
async function claimExists(
  supabase: SupabaseClient,
  userId: string,
  group: string,
  key: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('progression_claims')
    .select('id')
    .eq('user_id', userId)
    .eq('claim_group', group)
    .eq('evidence_key', key)
    .maybeSingle();
  if (error) return true;
  return Boolean(data);
}

function utcDayKey(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length < 10) return null;
  return value.slice(0, 10);
}

/**
 * Session de randonnée traitée → Explorer.
 *
 * Le gain suit les paliers de durée active ; le bonus de nouveauté est réservé
 * une fois par parcours canonique et par saison (claim atomique côté moteur).
 */
export async function awardHikeSessionProcessed(sessionId: string): Promise<AwardProducerResult> {
  const supabase = getServiceSupabase();
  if (!supabase) return { success: false, outcome: 'refused', reason: 'service_indisponible' };

  const { data: session, error } = await supabase
    .from('hike_sessions')
    .select('user_id, ended_at, processing_status, duration_seconds, track_quality, route_id')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !session || session.processing_status !== 'processed') {
    return { success: false, outcome: 'refused', reason: 'session_non_traitee' };
  }

  const quality = (session.track_quality ?? {}) as { plausibleMovement?: unknown };
  const plausibleMovement =
    typeof quality.plausibleMovement === 'number' ? quality.plausibleMovement : null;
  if (plausibleMovement !== null && plausibleMovement < PLAUSIBLE_MOVEMENT_MIN) {
    return { success: false, outcome: 'refused', reason: 'mouvement_non_plausible' };
  }

  const activeMinutes = Math.floor(Math.max(0, Number(session.duration_seconds ?? 0)) / 60);
  const tier = DURATION_TIERS.find((candidate) => activeMinutes >= candidate.minActiveMinutes);
  if (!tier) {
    return { success: false, outcome: 'refused', reason: 'duree_insuffisante' };
  }

  // Nouveauté : une fois par parcours canonique et par saison. La clé porte la
  // saison ; le moteur réserve le claim atomiquement dans la même transaction.
  let noveltyGranted = false;
  let noveltyClaim: { group: string; key: string } | undefined;
  if (session.route_id !== null && session.route_id !== undefined) {
    const { data: season } = await supabase
      .from('progression_seasons')
      .select('id')
      .eq('status', 'active')
      .maybeSingle();
    const endedAt = session.ended_at ?? new Date().toISOString();
    const seasonKey = season?.id ?? `y${endedAt.slice(0, 4)}`;
    const evidenceKey = `${seasonKey}:route:${session.route_id}`;
    const alreadyClaimed = await claimExists(
      supabase,
      session.user_id,
      NOVELTY_CLAIM_GROUP,
      evidenceKey
    );
    if (!alreadyClaimed) {
      noveltyGranted = true;
      noveltyClaim = { group: NOVELTY_CLAIM_GROUP, key: evidenceKey };
    }
  }

  const bonus =
    tier.points - ACTIVITY_BASE_POINTS + (noveltyGranted ? NOVELTY_POINTS : 0);

  return award({
    userId: session.user_id,
    action: 'hike_session_processed',
    sourceType: 'hike_session',
    sourceId: sessionId,
    effectiveAt: session.ended_at ?? new Date().toISOString(),
    bonus,
    claims: noveltyClaim ? [noveltyClaim] : [],
    metadata: {
      activeMinutes,
      tierPoints: tier.points,
      novelty: noveltyGranted,
      plausibleMovement,
      routeId: session.route_id ?? null,
    },
  });
}

/** Activité réellement créée depuis un sentier → Se préparer. */
export async function awardTrailPrepared(
  userId: string,
  routeId: string | number,
  tripId: string
): Promise<AwardProducerResult> {
  return award({
    userId,
    action: 'trail_prepared',
    sourceType: 'trail_prep',
    sourceId: `${userId}:${routeId}`,
    effectiveAt: new Date().toISOString(),
    metadata: { routeId: String(routeId), tripId },
  });
}

/**
 * Débrief terrain du kit → Se préparer + Partager.
 *
 * Le gain est calculé sur les équipements DISTINCTS réellement évalués
 * (20 + 2×n, plafond 10 équipements = 40 XP) ; la date métier est celle du
 * dernier enregistrement. L'attribution n'est déclenchée qu'après la capsule
 * de stabilisation de finalisation (réservation d'intention différée).
 */
export async function awardKitFieldReport(sessionId: string): Promise<AwardProducerResult> {
  const supabase = getServiceSupabase();
  if (!supabase) return { success: false, outcome: 'refused', reason: 'service_indisponible' };

  const { data: session, error } = await supabase
    .from('hike_sessions')
    .select('user_id, kit_id, processing_status')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !session || session.processing_status !== 'processed') {
    return { success: false, outcome: 'refused', reason: 'session_non_traitee' };
  }

  const { data: reports, error: reportsError } = await supabase
    .from('kit_field_reports')
    .select('item_key, created_at')
    .eq('hike_session_id', sessionId);
  if (reportsError || !reports || reports.length === 0) {
    return { success: false, outcome: 'refused', reason: 'aucun_debrief' };
  }

  const rows = reports as Array<{ item_key?: string | null; created_at?: string | null }>;
  const distinctItems = new Set(
    rows.map((row) => (typeof row.item_key === 'string' ? row.item_key : '')).filter(Boolean)
  ).size;
  if (distinctItems === 0) {
    return { success: false, outcome: 'refused', reason: 'aucun_debrief' };
  }

  const lastSavedAt = rows
    .map((row) => row.created_at)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
    .at(-1);

  return award({
    userId: session.user_id,
    action: 'kit_field_report',
    sourceType: 'kit_report',
    sourceId: sessionId,
    effectiveAt: lastSavedAt ?? new Date().toISOString(),
    bonus: Math.min(distinctItems * KIT_ITEM_BONUS, KIT_ITEM_MAX),
    metadata: { kitId: session.kit_id ?? null, items: distinctItems },
  });
}

/**
 * Avis de lieu publié (première publication uniquement) → Partager.
 *
 * Économie : 15 XP pour un avis qualifié, 40 si la preuve de visite est
 * validée dès l'attribution. Le palier 40 reste FERMÉ : aucune preuve serveur
 * de visite (lien lieu ↔ réalisation GPS) n'existe dans le schéma actuel ;
 * aucun crédit n'est inventé tant que cette preuve n'est pas construite.
 */
export async function awardPlaceReview(
  userId: string,
  placeId: string
): Promise<AwardProducerResult> {
  return award({
    userId,
    action: 'place_review',
    sourceType: 'place_review',
    // L'auteur fait partie de la clé : un avis par (auteur, lieu) sans
    // collision entre utilisateurs (le premier avis ne doit pas bloquer les autres).
    sourceId: `${userId}:${placeId}`,
    effectiveAt: new Date().toISOString(),
  });
}

/** Visibilités considérées comme une publication réelle (jamais `private`). */
const CARNET_PUBLISHED_VISIBILITIES = new Set(['public', 'friends']);
const CARNET_MIN_MOMENTS = 3;

/**
 * Carnet réellement publié → Partager.
 *
 * Preuves recalculées en service role : visibilité `public`/`friends`, lien
 * voyage (`carnets.trip_id`) ou session (`hike_sessions.carnet_id` / moment
 * `hike_session_id`), contenu suffisant (≥ 3 moments ou ≥ 1 média). Les points
 * ne tombent qu'à la publication : un carnet privé, vide ou orphelin refuse.
 * Idempotent par carnet : `carnet:<carnet_id>`.
 */
export async function awardCarnetPublished(carnetId: string): Promise<AwardProducerResult> {
  try {
    const supabase = getServiceSupabase();
    if (!supabase) return { success: false, outcome: 'refused', reason: 'service_indisponible' };

    const { data: carnet, error: carnetError } = await supabase
      .from('carnets')
      .select('author_id, visibility, trip_id, created_at, updated_at')
      .eq('id', carnetId)
      .maybeSingle();
    if (carnetError || !carnet || !carnet.author_id) {
      return { success: false, outcome: 'refused', reason: 'carnet_introuvable' };
    }
    if (!CARNET_PUBLISHED_VISIBILITIES.has(carnet.visibility)) {
      return { success: false, outcome: 'refused', reason: 'carnet_non_publie' };
    }

    const [momentsResult, mediaResult, sessionsResult] = await Promise.all([
      supabase
        .from('carnet_moments')
        .select('id, hike_session_id, image_url')
        .eq('carnet_id', carnetId),
      supabase
        .from('carnet_media')
        .select('id', { count: 'exact', head: true })
        .eq('carnet_id', carnetId),
      supabase
        .from('hike_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('carnet_id', carnetId),
    ]);
    if (momentsResult.error || mediaResult.error || sessionsResult.error) {
      return { success: false, outcome: 'refused', reason: 'preuves_indisponibles' };
    }

    const moments = (momentsResult.data ?? []) as Array<{
      id: string;
      hike_session_id?: string | null;
      image_url?: string | null;
    }>;
    const mediaRows = mediaResult.count ?? 0;
    const momentsWithImage = moments.filter((moment) => Boolean(moment.image_url)).length;

    const linkedToTrip = carnet.trip_id != null;
    const linkedToSession =
      (sessionsResult.count ?? 0) > 0 || moments.some((moment) => moment.hike_session_id != null);
    if (!linkedToTrip && !linkedToSession) {
      return { success: false, outcome: 'refused', reason: 'carnet_non_rattache' };
    }

    if (moments.length < CARNET_MIN_MOMENTS && mediaRows === 0 && momentsWithImage === 0) {
      return { success: false, outcome: 'refused', reason: 'contenu_insuffisant' };
    }

    return award({
      userId: carnet.author_id,
      action: 'carnet_published',
      sourceType: 'carnet',
      sourceId: carnetId,
      effectiveAt: carnet.updated_at ?? carnet.created_at ?? new Date().toISOString(),
      metadata: {
        moments: moments.length,
        medias: mediaRows,
        momentsWithImage,
        tripId: carnet.trip_id ?? null,
        visibility: carnet.visibility,
      },
    });
  } catch (error) {
    console.error('[progression/producerHooks] carnet publié (non bloquant):', error);
    return { success: false, outcome: 'refused', reason: 'hook_error' };
  }
}

/**
 * Checklist de préparation complétée → Se préparer.
 *
 * Preuves : voyage `planned`/`active`, au moins 3 contrôles DUS pertinents
 * (`due_offset_days` non nul), tous terminés. Les items libres ne comptent pas
 * et ne bloquent pas. Une seule attribution par voyage : `checklist:<trip_id>`.
 */
export async function awardChecklistCompleted(tripId: string): Promise<AwardProducerResult> {
  try {
    const supabase = getServiceSupabase();
    if (!supabase) return { success: false, outcome: 'refused', reason: 'service_indisponible' };

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('user_id, status')
      .eq('id', tripId)
      .maybeSingle();
    if (tripError || !trip) {
      return { success: false, outcome: 'refused', reason: 'voyage_introuvable' };
    }
    if (!CHECKLIST_PREPARATION_STATUSES.has(trip.status)) {
      return { success: false, outcome: 'refused', reason: 'voyage_hors_preparation' };
    }

    const { data: items, error: itemsError } = await supabase
      .from('trip_checklist_items')
      .select('id, done, done_at, due_offset_days')
      .eq('trip_id', tripId);
    if (itemsError) {
      return { success: false, outcome: 'refused', reason: 'checklist_indisponible' };
    }

    const rows = (items ?? []) as Array<{
      id: string;
      done: boolean;
      done_at?: string | null;
      due_offset_days?: number | null;
    }>;
    if (rows.length === 0) {
      return { success: false, outcome: 'refused', reason: 'checklist_vide' };
    }

    const dueRows = rows.filter(
      (item) => item.due_offset_days !== null && item.due_offset_days !== undefined
    );
    if (dueRows.length < CHECKLIST_MIN_DUE_CONTROLS) {
      return { success: false, outcome: 'refused', reason: 'controles_insuffisants' };
    }
    if (dueRows.some((item) => item.done !== true)) {
      return { success: false, outcome: 'refused', reason: 'checklist_incomplete' };
    }

    const lastDoneAt = dueRows
      .map((item) => item.done_at)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .sort()
      .at(-1);

    return award({
      userId: trip.user_id,
      action: 'checklist_completed',
      sourceType: 'checklist',
      sourceId: tripId,
      effectiveAt: lastDoneAt ?? new Date().toISOString(),
      metadata: { dueControls: dueRows.length, total: rows.length },
    });
  } catch (error) {
    console.error('[progression/producerHooks] checklist complétée (non bloquant):', error);
    return { success: false, outcome: 'refused', reason: 'hook_error' };
  }
}

/**
 * Itinérance réellement accomplie → Explorer + Se préparer.
 *
 * Preuves T09 : statut `completed` ET au moins 2 sessions de randonnée
 * `processed` liées au voyage, réparties sur au moins 2 JOURS UTC distincts.
 * Une checklist ou un POI déclaré seuls ne prouvent plus le voyage ; une
 * simple sortie journalière non plus. Idempotent par voyage : `trip:<trip_id>`.
 */
export async function awardTripCompleted(tripId: string): Promise<AwardProducerResult> {
  try {
    const supabase = getServiceSupabase();
    if (!supabase) return { success: false, outcome: 'refused', reason: 'service_indisponible' };

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('user_id, status, updated_at')
      .eq('id', tripId)
      .maybeSingle();
    if (tripError || !trip) {
      return { success: false, outcome: 'refused', reason: 'voyage_introuvable' };
    }
    if (trip.status !== 'completed') {
      return { success: false, outcome: 'refused', reason: 'voyage_non_termine' };
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from('hike_sessions')
      .select('id, ended_at')
      .eq('trip_id', tripId)
      .eq('processing_status', 'processed');
    if (sessionsError) {
      return { success: false, outcome: 'refused', reason: 'preuves_indisponibles' };
    }

    const rows = (sessions ?? []) as Array<{ id: string; ended_at?: string | null }>;
    const days = new Set(
      rows.map((row) => utcDayKey(row.ended_at)).filter((day): day is string => day !== null)
    );

    if (rows.length < 2 || days.size < 2) {
      return { success: false, outcome: 'refused', reason: 'itinerance_non_prouvee' };
    }

    return award({
      userId: trip.user_id,
      action: 'trip_completed',
      sourceType: 'trip',
      sourceId: tripId,
      effectiveAt: trip.updated_at ?? new Date().toISOString(),
      metadata: { sessions: rows.length, days: days.size },
    });
  } catch (error) {
    console.error('[progression/producerHooks] voyage terminé (non bloquant):', error);
    return { success: false, outcome: 'refused', reason: 'hook_error' };
  }
}

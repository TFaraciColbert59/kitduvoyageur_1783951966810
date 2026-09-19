import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { awardProducerGain, type AwardProducerResult } from './awardProducer';

/**
 * P2 — Accroches des producteurs vérifiés.
 *
 * Chaque accroche lit les faits côté serveur (propriété, état final, comptages)
 * puis délègue au moteur canonique. Toute erreur est avalée : la progression ne
 * doit jamais casser le parcours métier, et l'idempotence empêche tout doublon.
 */

const SEGMENT_BONUS = 5;
const SEGMENT_BONUS_CAP = 110;
const KIT_ITEM_BONUS = 2;
const KIT_ITEM_BONUS_CAP = 20;

async function award(input: Parameters<typeof awardProducerGain>[0]): Promise<AwardProducerResult> {
  try {
    return await awardProducerGain(input);
  } catch (error) {
    console.error('[progression/producerHooks] échec non bloquant:', error);
    return { success: false, outcome: 'refused', reason: 'hook_error' };
  }
}

/** Session de randonnée traitée par le processeur → Explorer. */
export async function awardHikeSessionProcessed(sessionId: string): Promise<AwardProducerResult> {
  const supabase = getServiceSupabase();
  if (!supabase) return { success: false, outcome: 'refused', reason: 'service_indisponible' };

  const { data: session, error } = await supabase
    .from('hike_sessions')
    .select('user_id, ended_at, processing_status')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !session || session.processing_status !== 'processed') {
    return { success: false, outcome: 'refused', reason: 'session_non_traitee' };
  }

  const { count } = await supabase
    .from('session_segment_passages')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId);
  const segments = Math.max(0, count ?? 0);

  return award({
    userId: session.user_id,
    action: 'hike_session_processed',
    sourceType: 'hike_session',
    sourceId: sessionId,
    effectiveAt: session.ended_at ?? new Date().toISOString(),
    bonus: Math.min(segments * SEGMENT_BONUS, SEGMENT_BONUS_CAP),
    metadata: { segments },
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

/** Débrief terrain du kit (session traitée portant le kit) → Se préparer + Partager. */
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

  const { data: report, error: reportError } = await supabase
    .from('kit_field_reports')
    .select('kit_id')
    .eq('hike_session_id', sessionId)
    .limit(1)
    .maybeSingle();
  if (reportError || !report) {
    return { success: false, outcome: 'refused', reason: 'aucun_debrief' };
  }

  const { count } = await supabase
    .from('kit_field_reports')
    .select('id', { count: 'exact', head: true })
    .eq('hike_session_id', sessionId);
  const items = Math.max(1, count ?? 1);

  return award({
    userId: session.user_id,
    action: 'kit_field_report',
    sourceType: 'kit_report',
    sourceId: sessionId,
    effectiveAt: new Date().toISOString(),
    bonus: Math.min(items * KIT_ITEM_BONUS, KIT_ITEM_BONUS_CAP),
    metadata: { kitId: report.kit_id ?? session.kit_id, items },
  });
}

/** Avis de lieu publié (première publication uniquement) → Partager. */
export async function awardPlaceReview(
  userId: string,
  placeId: string
): Promise<AwardProducerResult> {
  return award({
    userId,
    action: 'place_review',
    sourceType: 'place_review',
    sourceId: placeId,
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
 * Checklist de préparation complétée à 100 % → Se préparer.
 *
 * Preuves : voyage `planned`/`active`, checklist non vide, tous les items
 * cochés (aucune colonne ne distingue un item dû d'un ajout manuel dans
 * `trip_checklist_items` : la règle exige donc 100 % des items existants).
 * Une seule attribution par voyage : `checklist:<trip_id>`.
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
    if (trip.status !== 'planned' && trip.status !== 'active') {
      return { success: false, outcome: 'refused', reason: 'voyage_hors_preparation' };
    }

    const { data: items, error: itemsError } = await supabase
      .from('trip_checklist_items')
      .select('id, done, done_at')
      .eq('trip_id', tripId);
    if (itemsError) {
      return { success: false, outcome: 'refused', reason: 'checklist_indisponible' };
    }

    const rows = (items ?? []) as Array<{ id: string; done: boolean; done_at?: string | null }>;
    if (rows.length === 0) {
      return { success: false, outcome: 'refused', reason: 'checklist_vide' };
    }
    if (rows.some((item) => item.done !== true)) {
      return { success: false, outcome: 'refused', reason: 'checklist_incomplete' };
    }

    const lastDoneAt = rows
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
      metadata: { items: rows.length },
    });
  } catch (error) {
    console.error('[progression/producerHooks] checklist complétée (non bloquant):', error);
    return { success: false, outcome: 'refused', reason: 'hook_error' };
  }
}

/**
 * Voyage réellement terminé → Explorer + Se préparer.
 *
 * Preuves recalculées en service role : statut `completed` ET au moins une
 * preuve de terrain parmi — session de randonnée `processed` liée au voyage,
 * checklist 100 % complétée, POI du voyage marqué `visited`. Une seule
 * attribution par voyage : `trip:<trip_id>`.
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

    const [sessionsResult, itemsResult, poisResult] = await Promise.all([
      supabase
        .from('hike_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', tripId)
        .eq('processing_status', 'processed'),
      supabase.from('trip_checklist_items').select('id, done').eq('trip_id', tripId),
      supabase
        .from('trip_pois')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', tripId)
        .eq('visited', true),
    ]);
    if (sessionsResult.error || itemsResult.error || poisResult.error) {
      return { success: false, outcome: 'refused', reason: 'preuves_indisponibles' };
    }

    const processedSessions = sessionsResult.count ?? 0;
    const checklistRows = (itemsResult.data ?? []) as Array<{ id: string; done: boolean }>;
    const checklistCompleted =
      checklistRows.length > 0 && checklistRows.every((item) => item.done === true);
    const visitedPois = poisResult.count ?? 0;

    if (processedSessions === 0 && !checklistCompleted && visitedPois === 0) {
      return { success: false, outcome: 'refused', reason: 'aucune_preuve' };
    }

    return award({
      userId: trip.user_id,
      action: 'trip_completed',
      sourceType: 'trip',
      sourceId: tripId,
      effectiveAt: trip.updated_at ?? new Date().toISOString(),
      metadata: { processedSessions, checklistCompleted, visitedPois },
    });
  } catch (error) {
    console.error('[progression/producerHooks] voyage terminé (non bloquant):', error);
    return { success: false, outcome: 'refused', reason: 'hook_error' };
  }
}

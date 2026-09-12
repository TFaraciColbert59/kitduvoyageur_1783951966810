import 'server-only';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Phase 2 — projection serveur de la chaîne d'identifiants d'un voyage :
 * trip → adventure_plan → plan_version → route → kit → hike_session →
 * carnet (journal) → publication, avec un `correlation_id` unifié.
 *
 * Lecture via le client serveur porté par la session (RLS) : jamais le
 * service role. Le voyage est scopé à son propriétaire — la projection
 * alimente le Hub, pas une lecture publique.
 */
export interface TripExperience {
  trip_id: string;
  slug: string;
  title: string;
  status: string;
  kit_id: string | null;
  adventure_plan_id: string | null;
  plan_version_id: string | null;
  plan_version: number | null;
  selected_route_id: number | null;
  route_name: string | null;
  hike_session_id: string | null;
  journal_id: string | null;
  journal_title: string | null;
  community_post_id: string | null;
  correlation_id: string | null;
}

const tripIdSchema = z.string().uuid();

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Retourne la chaîne complète d'expérience d'un voyage du propriétaire
 * connecté, ou `null` si non authentifié / voyage introuvable / id invalide.
 * Les maillons absents (plan non attaché, session pas encore créée…) restent
 * `null` : la projection est toujours retournée sans invention.
 */
export async function getTripExperience(tripId: string): Promise<TripExperience | null> {
  const parsedTripId = tripIdSchema.safeParse(tripId);
  if (!parsedTripId.success) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, slug, title, status, kit_id')
    .eq('id', parsedTripId.data)
    .eq('user_id', user.id)
    .maybeSingle();

  if (tripError || !trip) {
    if (tripError) console.error('[LKDV trips] getTripExperience trip error:', tripError);
    return null;
  }

  const { data: plan, error: planError } = await supabase
    .from('adventure_plans')
    .select('id, current_version, selected_route_id, correlation_id')
    .eq('trip_id', trip.id)
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (planError) console.error('[LKDV trips] getTripExperience plan error:', planError);

  let planVersionId: string | null = null;
  let planVersion: number | null = null;
  let routeName: string | null = null;

  if (plan?.id) {
    const { data: version } = await supabase
      .from('adventure_plan_versions')
      .select('id, version')
      .eq('plan_id', plan.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (version) {
      planVersionId = String(version.id);
      planVersion = toNullableNumber(version.version);
    }
  }

  const selectedRouteId = toNullableNumber(plan?.selected_route_id);
  if (selectedRouteId !== null) {
    const { data: route } = await supabase
      .from('hiking_routes')
      .select('name')
      .eq('id', selectedRouteId)
      .maybeSingle();
    routeName = (route as { name?: string | null } | null)?.name ?? null;
  }

  const { data: journal } = await supabase
    .from('carnets')
    .select('id, title, correlation_id')
    .eq('trip_id', trip.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const planCorrelation = (plan?.correlation_id as string | null | undefined) ?? null;

  let session:
    | { id: string; correlation_id: string | null }
    | null = null;

  if (journal?.id) {
    const { data } = await supabase
      .from('hike_sessions')
      .select('id, correlation_id')
      .eq('carnet_id', journal.id)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    session = data ?? null;
  }

  if (!session && planCorrelation) {
    const { data } = await supabase
      .from('hike_sessions')
      .select('id, correlation_id')
      .eq('correlation_id', planCorrelation)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    session = data ?? null;
  }

  if (!session && selectedRouteId !== null) {
    const { data } = await supabase
      .from('hike_sessions')
      .select('id, correlation_id')
      .eq('route_id', selectedRouteId)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    session = data ?? null;
  }

  const correlationId =
    planCorrelation ??
    (session?.correlation_id as string | null | undefined) ??
    (journal?.correlation_id as string | null | undefined) ??
    null;

  let post: { id: string; correlation_id: string | null } | null = null;

  if (journal?.id) {
    const { data } = await supabase
      .from('community_posts')
      .select('id, correlation_id')
      .eq('linked_carnet_id', journal.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    post = data ?? null;
  }

  if (!post && correlationId) {
    const { data } = await supabase
      .from('community_posts')
      .select('id, correlation_id')
      .eq('correlation_id', correlationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    post = data ?? null;
  }

  const unifiedCorrelation =
    correlationId ??
    (post?.correlation_id as string | null | undefined) ??
    null;

  return {
    trip_id: String(trip.id),
    slug: String(trip.slug),
    title: String(trip.title),
    status: String(trip.status),
    kit_id: (trip.kit_id as string | null | undefined) ?? null,
    adventure_plan_id: plan?.id ? String(plan.id) : null,
    plan_version_id: planVersionId,
    plan_version: planVersion,
    selected_route_id: selectedRouteId,
    route_name: routeName,
    hike_session_id: session ? String(session.id) : null,
    journal_id: journal?.id ? String(journal.id) : null,
    journal_title: (journal?.title as string | null | undefined) ?? null,
    community_post_id: post ? String(post.id) : null,
    correlation_id: unifiedCorrelation,
  };
}

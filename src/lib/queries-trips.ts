import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  Trip,
  TripFull,
  TripWithDetails,
  TripSummary,
  TripFilters,
  TripStats,
  TripCollaborator,
  TripStep,
  TripItem,
  TripExpense,
  TripDocument,
  TripPoi,
  TripSafetyCheckpoint,
  TripNote,
  TripRole,
} from '@/features/trips/types/trip.types';
import {
  createTripSchema,
  updateTripSchema,
  CreateTripInput,
  UpdateTripInput,
  computeTripPermissions,
} from '@/features/trips/schemas/trip.schema';

/**
 * 1.3.1 Récupérer les voyages publics avec filtres et pagination
 */
export async function getPublicTrips(
  filters?: TripFilters
): Promise<{ trips: TripSummary[]; total: number }> {
  const supabase = await createClient();

  const page = Math.max(filters?.page || 1, 1);
  const limit = Math.min(Math.max(filters?.limit || 12, 1), 50);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('trips')
    .select(
      'id, slug, title, description, destination_country_code, destination_name, start_date, end_date, status, visibility, difficulty, primary_activity, cover_image_url, created_at, trip_collaborators(count), trip_steps(count), trip_expenses(amount)',
      { count: 'exact' }
    )
    .in('visibility', ['public', 'unlisted']);

  if (filters?.search && filters.search.trim()) {
    const clean = filters.search.trim().replace(/[%_]/g, '');
    query = query.or(`title.ilike.%${clean}%,destination_name.ilike.%${clean}%`);
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters?.difficulty && filters.difficulty !== 'all') {
    query = query.eq('difficulty', filters.difficulty);
  }

  if (filters?.activity && filters.activity !== 'all') {
    query = query.eq('primary_activity', filters.activity);
  }

  if (filters?.destination && filters.destination.trim()) {
    const dest = filters.destination.trim();
    if (dest.length === 2 && /^[A-Za-z]{2}$/.test(dest)) {
      query = query.eq('destination_country_code', dest.toUpperCase());
    } else {
      query = query.ilike('destination_name', `%${dest}%`);
    }
  }

  const sortBy = filters?.sort_by || 'created_at';
  const sortOrder = filters?.sort_order === 'asc';
  query = query.order(sortBy, { ascending: sortOrder }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error('[LKDV trips] getPublicTrips error:', error);
    return { trips: [], total: 0 };
  }

  const summaries: TripSummary[] = (data || []).map((row: any) => {
    const collabs = row.trip_collaborators?.[0]?.count ?? 1;
    const steps = row.trip_steps?.[0]?.count ?? 0;
    const expenses = (row.trip_expenses || []).reduce(
      (sum: number, e: { amount: number }) => sum + Number(e.amount || 0),
      0
    );

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      destination_country_code: row.destination_country_code,
      destination_name: row.destination_name,
      start_date: row.start_date,
      end_date: row.end_date,
      status: row.status,
      visibility: row.visibility,
      difficulty: row.difficulty,
      primary_activity: row.primary_activity,
      cover_image_url: row.cover_image_url,
      collaborators_count: collabs,
      steps_count: steps,
      total_spent: expenses,
    };
  });

  return {
    trips: summaries,
    total: count || summaries.length,
  };
}

/**
 * 1.3.2 Récupérer les voyages d'un utilisateur (en tant que propriétaire ou collaborateur)
 */
export async function getUserTrips(
  userId: string,
  filters?: TripFilters
): Promise<TripWithDetails[]> {
  const supabase = await createClient();

  // 1. Récupérer les participations du user
  const { data: collabRows } = await supabase
    .from('trip_collaborators')
    .select('trip_id, role')
    .eq('user_id', userId);

  const collabMap = new Map<string, TripRole>();
  (collabRows || []).forEach(row => {
    collabMap.set(row.trip_id, row.role as TripRole);
  });

  // 2. Requêter les voyages
  let query = supabase
    .from('trips')
    .select(
      '*, trip_collaborators(count), trip_steps(count), trip_items(count), trip_expenses(amount)'
    );

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters?.search && filters.search.trim()) {
    const clean = filters.search.trim().replace(/[%_]/g, '');
    query = query.or(`title.ilike.%${clean}%,destination_name.ilike.%${clean}%`);
  }

  const sortBy = filters?.sort_by || 'start_date';
  const sortOrder = filters?.sort_order === 'asc';
  query = query.order(sortBy, { ascending: sortOrder });

  const { data, error } = await query;

  if (error) {
    console.error('[LKDV trips] getUserTrips error:', error);
    return [];
  }

  const userTrips: TripWithDetails[] = (data || []).map((row: any) => {
    const isOwner = row.user_id === userId;
    const role: TripRole = isOwner ? 'owner' : collabMap.get(row.id) || 'viewer';

    const collabs = row.trip_collaborators?.[0]?.count ?? 1;
    const steps = row.trip_steps?.[0]?.count ?? 0;
    const items = row.trip_items?.[0]?.count ?? 0;
    const totalSpent = (row.trip_expenses || []).reduce(
      (sum: number, e: { amount: number }) => sum + Number(e.amount || 0),
      0
    );

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      destination_country_code: row.destination_country_code,
      destination_name: row.destination_name,
      start_date: row.start_date,
      end_date: row.end_date,
      status: row.status,
      visibility: row.visibility,
      difficulty: row.difficulty,
      primary_activity: row.primary_activity,
      estimated_budget: row.estimated_budget,
      budget_currency: row.budget_currency,
      cover_image_url: row.cover_image_url,
      user_id: row.user_id,
      group_id: row.group_id,
      share_token: row.share_token,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at,
      collaborators_count: collabs,
      steps_count: steps,
      items_count: items,
      total_spent: totalSpent,
      user_role: role,
    };
  });

  return userTrips;
}

/**
 * Helper interne pour charger toutes les relations d'un trip
 */
async function loadFullTripDetails(
  supabase: any,
  trip: Trip,
  currentUserId?: string
): Promise<TripFull> {
  // Déterminer le rôle
  let role: TripRole | null = null;
  if (currentUserId) {
    if (trip.user_id === currentUserId) {
      role = 'owner';
    } else {
      const { data: collab } = await supabase
        .from('trip_collaborators')
        .select('role')
        .eq('trip_id', trip.id)
        .eq('user_id', currentUserId)
        .maybeSingle();

      role = (collab?.role as TripRole) || null;
    }
  }

  const permissions = computeTripPermissions(role);

  // Requêtes parallèles pour toutes les relations filles
  const [
    collabsRes,
    stepsRes,
    itemsRes,
    expensesRes,
    docsRes,
    poisRes,
    safetyRes,
    notesRes,
  ] = await Promise.all([
    supabase
      .from('trip_collaborators')
      .select('*')
      .eq('trip_id', trip.id)
      .order('joined_at', { ascending: true }),

    supabase
      .from('trip_steps')
      .select('*')
      .eq('trip_id', trip.id)
      .order('day_number', { ascending: true })
      .order('order_index', { ascending: true }),

    supabase
      .from('trip_items')
      .select('*')
      .eq('trip_id', trip.id)
      .order('category', { ascending: true })
      .order('item_name', { ascending: true }),

    supabase
      .from('trip_expenses')
      .select('*')
      .eq('trip_id', trip.id)
      .order('expense_date', { ascending: false }),

    // RGPD strict : documents uniquement si permissions.canViewDocuments
    permissions.canViewDocuments
      ? supabase
          .from('trip_documents')
          .select('*')
          .eq('trip_id', trip.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),

    supabase
      .from('trip_pois')
      .select('*')
      .eq('trip_id', trip.id)
      .order('created_at', { ascending: true }),

    supabase
      .from('trip_safety_checkpoints')
      .select('*')
      .eq('trip_id', trip.id)
      .order('scheduled_at', { ascending: true }),

    supabase
      .from('trip_notes')
      .select('*')
      .eq('trip_id', trip.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);

  return {
    ...trip,
    collaborators: (collabsRes.data as TripCollaborator[]) || [],
    steps: (stepsRes.data as TripStep[]) || [],
    items: (itemsRes.data as TripItem[]) || [],
    expenses: (expensesRes.data as TripExpense[]) || [],
    documents: (docsRes.data as TripDocument[]) || [],
    pois: (poisRes.data as TripPoi[]) || [],
    safety_checkpoints: (safetyRes.data as TripSafetyCheckpoint[]) || [],
    notes: (notesRes.data as TripNote[]) || [],
    user_role: role,
    permissions,
  };
}

/**
 * 1.3.3 Récupérer un voyage complet par son slug
 */
export async function getTripBySlug(
  slug: string,
  currentUserId?: string
): Promise<TripFull | null> {
  const supabase = await createClient();

  const { data: trip, error } = await supabase
    .from('trips')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !trip) {
    if (error) console.error('[LKDV trips] getTripBySlug error:', error);
    return null;
  }

  return loadFullTripDetails(supabase, trip as Trip, currentUserId);
}

/**
 * 1.3.4 Récupérer un voyage complet par son ID
 */
export async function getTripById(
  id: string,
  currentUserId?: string
): Promise<TripFull | null> {
  const supabase = await createClient();

  const { data: trip, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !trip) {
    if (error) console.error('[LKDV trips] getTripById error:', error);
    return null;
  }

  return loadFullTripDetails(supabase, trip as Trip, currentUserId);
}

/**
 * 1.3.5 Créer un nouveau voyage
 */
export async function createTrip(
  input: CreateTripInput,
  userId: string
): Promise<Trip> {
  const validated = createTripSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trips')
    .insert({
      ...validated,
      user_id: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('[LKDV trips] createTrip error:', error);
    throw new Error(`Échec de création du voyage: ${error.message}`);
  }

  return data as Trip;
}

/**
 * 1.3.6 Mettre à jour un voyage existant
 */
export async function updateTrip(
  id: string,
  input: UpdateTripInput,
  userId: string
): Promise<Trip> {
  const validated = updateTripSchema.parse(input);
  const supabase = await createClient();

  // Vérification de permission via can_edit_trip (RLS ou direct)
  const { data, error } = await supabase
    .from('trips')
    .update({
      ...validated,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[LKDV trips] updateTrip error:', error);
    throw new Error(`Échec de mise à jour du voyage: ${error.message}`);
  }

  return data as Trip;
}

/**
 * 1.3.7 Supprimer un voyage (Owner uniquement)
 */
export async function deleteTrip(
  id: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('[LKDV trips] deleteTrip error:', error);
    throw new Error(`Échec de suppression du voyage: ${error.message}`);
  }

  return true;
}

/**
 * 1.3.8 Calculer les statistiques d'un voyage
 */
export async function getTripStats(tripId: string): Promise<TripStats> {
  const supabase = await createClient();

  const [tripRes, stepsRes, itemsRes, expensesRes, collabsRes] =
    await Promise.all([
      supabase
        .from('trips')
        .select('estimated_budget, start_date, end_date')
        .eq('id', tripId)
        .maybeSingle(),
      supabase
        .from('trip_steps')
        .select('day_number, distance_km, elevation_gain_m, elevation_loss_m')
        .eq('trip_id', tripId),
      supabase
        .from('trip_items')
        .select('quantity, is_packed')
        .eq('trip_id', tripId),
      supabase
        .from('trip_expenses')
        .select('amount')
        .eq('trip_id', tripId),
      supabase
        .from('trip_collaborators')
        .select('id', { count: 'exact' })
        .eq('trip_id', tripId),
    ]);

  const steps = stepsRes.data || [];
  const items = itemsRes.data || [];
  const expenses = expensesRes.data || [];
  const trip = tripRes.data;

  // Calcul du nombre de jours
  let totalDays = 1;
  if (steps.length > 0) {
    const maxDay = Math.max(...steps.map((s: { day_number: number }) => s.day_number || 1));
    totalDays = Math.max(maxDay, 1);
  } else if (trip?.start_date && trip?.end_date) {
    const d1 = new Date(trip.start_date);
    const d2 = new Date(trip.end_date);
    const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24)) + 1;
    totalDays = Math.max(diffDays, 1);
  }

  // Distance et dénivelé
  const totalDistanceKm = steps.reduce(
    (sum: number, s: { distance_km: number | null }) => sum + Number(s.distance_km || 0),
    0
  );
  const totalElevationGainM = steps.reduce(
    (sum: number, s: { elevation_gain_m: number | null }) =>
      sum + Number(s.elevation_gain_m || 0),
    0
  );
  const totalElevationLossM = steps.reduce(
    (sum: number, s: { elevation_loss_m: number | null }) =>
      sum + Number(s.elevation_loss_m || 0),
    0
  );

  // Items
  const itemsPacked = items.filter((i: { is_packed: boolean }) => i.is_packed).length;
  const itemsTotal = items.length;

  // Budget
  const estimatedBudget = Number(trip?.estimated_budget || 0);
  const totalSpent = expenses.reduce(
    (sum: number, e: { amount: number }) => sum + Number(e.amount || 0),
    0
  );

  // Participants
  const participantsCount = collabsRes.count || 1;

  return {
    trip_id: tripId,
    total_days: totalDays,
    total_distance_km: Math.round(totalDistanceKm * 100) / 100,
    total_elevation_gain_m: Math.round(totalElevationGainM),
    total_elevation_loss_m: Math.round(totalElevationLossM),
    items_packed: itemsPacked,
    items_total: itemsTotal,
    estimated_budget: estimatedBudget,
    total_spent: Math.round(totalSpent * 100) / 100,
    participants_count: participantsCount,
  };
}

import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { computeTripPermissions } from '../schemas/trip.schema';
import type { Trip, TripFull, TripStep } from '../types/trip.types';

type Overview = Pick<Trip,
  'id' | 'slug' | 'title' | 'user_id' | 'status' | 'start_date' | 'end_date' | 'primary_activity' |
  'difficulty' | 'destination_name' | 'destination_country_code' | 'cover_image_url' |
  'budget_currency' | 'created_at' | 'updated_at'
> & {
  participant_user_id: string;
  participant_role: string;
  steps: Omit<TripStep, 'description' | 'accommodation_name'>[];
};

/** Données de référence volontairement limitées à la consultation d'une étape. */
export async function getConfirmedTripOverview(slug: string): Promise<TripFull | null> {
  const client = await createClient();
  const { data, error } = await client.rpc('get_confirmed_trip_overview', { p_slug: slug }).maybeSingle<Overview>();
  if (error || !data) return null;

  const { participant_user_id: userId, participant_role: role, steps, ...trip } = data;
  return {
    ...trip,
    description: null,
    visibility: 'private',
    estimated_budget: null,
    share_token: null,
    group_id: null,
    metadata: null,
    steps: steps.map((step) => ({ ...step, description: null, accommodation_name: null })),
    collaborators: [],
    items: [],
    expenses: [],
    documents: [],
    pois: [],
    safety_checkpoints: [],
    notes: [],
    permissions: computeTripPermissions(null),
    confirmed_participant: { userId, role },
  };
}

'use server';

import { createClient } from '@/lib/supabase/server';
import { createTrip } from '@/lib/queries-trips';
import type { CreateTripInput } from '@/features/trips/schemas/trip.schema';

export async function createTripAction(input: CreateTripInput): Promise<{ slug: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Vous devez être connecté pour créer un voyage.');
  }

  const trip = await createTrip(input, user.id);
  return { slug: trip.slug };
}

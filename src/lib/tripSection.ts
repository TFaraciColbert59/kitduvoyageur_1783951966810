import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTripBySlug } from '@/lib/queries-trips';
import type { TripFull } from '@/features/trips/types/trip.types';

/**
 * Y2 — Charge le voyage pour une page de section du hub (après le layout,
 * qui a déjà validé l'accès : les pages rechargent pour passer le TripFull
 * en props des vues clientes). notFound si inaccessible.
 */
export async function loadTripSection(slug: string): Promise<TripFull> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const trip = await getTripBySlug(slug, user?.id);
  if (!trip) notFound();
  return trip;
}

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTripBySlug } from '@/lib/queries-trips';
import { getTripPhaseDetails } from '@/features/trips/engine/temporalPhaseEngine';
import { deriveTripProfile } from '@/features/trips/engine/tripProfileEngine';
import { TripHubShell } from '@/features/trips/components/TripHubShell';

/**
 * Y2.2 — Layout de segment du hub voyage.
 * Charge le voyage UNE fois, calcule phase + profil, et monte le shell unique
 * (colonnes + mobile). Les pages du segment ne rendent que leur vue.
 */
export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const trip = await getTripBySlug(slug, user?.id);
  if (!trip) notFound();

  const phaseDetails = getTripPhaseDetails(trip);
  const profile = deriveTripProfile(trip, new Date());

  return (
    <TripHubShell trip={trip} profile={profile} phase={phaseDetails.phase}>
      {children}
    </TripHubShell>
  );
}

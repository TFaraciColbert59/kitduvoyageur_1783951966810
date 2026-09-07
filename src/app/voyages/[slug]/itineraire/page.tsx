import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTripBySlug } from '@/lib/queries-trips';
import AppShellDesktop from '@/components/shell/AppShellDesktop';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import ItineraryPlannerClient from '@/features/trips/planner/ItineraryPlannerClient';
import ItinerarySidebarLeft from '@/features/trips/planner/ItinerarySidebarLeft';
import ItinerarySidebarRight from '@/features/trips/planner/ItinerarySidebarRight';
import type { PlannerStep } from '@/features/trips/planner/plannerEngine';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const trip = await getTripBySlug(slug);
  if (!trip) return { title: 'Voyage introuvable — Le Kit du Voyageur' };
  return {
    title: `Planificateur — ${trip.title} | LKDV`,
    description: `Planifiez et reorganisez jour par jour les etapes de ${trip.title}.`,
  };
}

export default async function TripItineraryPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const trip = await getTripBySlug(slug, user?.id);
  if (!trip) notFound();

  const { data: rawSteps } = await supabase
    .from('trip_steps')
    .select('*')
    .eq('trip_id', trip.id)
    .order('day_number', { ascending: true })
    .order('order_index', { ascending: true });

  const initialSteps: PlannerStep[] = (rawSteps || []).map((s: any) => ({
    id: s.id,
    trip_id: s.trip_id,
    day_number: s.day_number,
    order_index: s.order_index,
    title: s.title,
    description: s.description,
    location_name: s.location_name,
    latitude: s.latitude ? Number(s.latitude) : null,
    longitude: s.longitude ? Number(s.longitude) : null,
    accommodation_name: s.accommodation_name,
    transport_mode: s.transport_mode,
    distance_km: s.distance_km ? Number(s.distance_km) : null,
    elevation_gain_m: s.elevation_gain_m ? Number(s.elevation_gain_m) : null,
    elevation_loss_m: s.elevation_loss_m ? Number(s.elevation_loss_m) : null,
  }));

  return (
    <AppShellDesktop
      sidebarLeft={<ItinerarySidebarLeft trip={trip} />}
      sidebarRight={<ItinerarySidebarRight trip={trip} stepsCount={initialSteps.length} />}
      mobileSlot={
        <MobilePageShell safeTop={true} hasBottomNav={false}>
          <ItineraryPlannerClient trip={trip} initialSteps={initialSteps} />
        </MobilePageShell>
      }
    >
      <ItineraryPlannerClient trip={trip} initialSteps={initialSteps} />
    </AppShellDesktop>
  );
}
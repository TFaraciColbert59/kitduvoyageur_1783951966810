import { loadTripSection } from '@/lib/tripSection';
import { getTripPhaseDetails } from '@/features/trips/engine/temporalPhaseEngine';
import { TripChecklistView } from '@/features/trips/components/TripChecklistView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Checklist départ — ${slug} | Le Kit du Voyageur` };
}

export default async function ChecklistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = await loadTripSection(slug);
  const phaseDetails = getTripPhaseDetails(trip);
  return <TripChecklistView tripId={trip.id} daysUntilStart={phaseDetails.daysUntilStart} />;
}

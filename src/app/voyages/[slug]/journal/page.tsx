import { loadTripSection } from '@/lib/tripSection';
import { TripNotesView } from '@/features/trips/components/TripNotesView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Journal — ${slug} | Le Kit du Voyageur` };
}

export default async function JournalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = await loadTripSection(slug);
  return <TripNotesView trip={trip} />;
}

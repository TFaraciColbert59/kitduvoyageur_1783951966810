import { loadTripSection } from '@/lib/tripSection';
import { TripTeamView } from '@/features/trips/components/TripTeamView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Équipage — ${slug} | Le Kit du Voyageur` };
}

export default async function EquipagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = await loadTripSection(slug);
  return <TripTeamView trip={trip} />;
}

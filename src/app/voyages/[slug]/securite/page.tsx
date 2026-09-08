import { loadTripSection } from '@/lib/tripSection';
import { TripSafetyView } from '@/features/trips/components/TripSafetyView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Sécurité — ${slug} | Le Kit du Voyageur` };
}

export default async function SecuritePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = await loadTripSection(slug);
  return <TripSafetyView trip={trip} />;
}

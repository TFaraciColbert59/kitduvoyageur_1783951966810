import { notFound } from 'next/navigation';
import { loadTripSection } from '@/lib/tripSection';
import { TripDocumentsView } from '@/features/trips/components/TripDocumentsView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Documents — ${slug} | Le Kit du Voyageur` };
}

export default async function DocumentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = await loadTripSection(slug);
  if (!trip.permissions.canViewDocuments) {
    notFound();
  }
  return <TripDocumentsView trip={trip} />;
}

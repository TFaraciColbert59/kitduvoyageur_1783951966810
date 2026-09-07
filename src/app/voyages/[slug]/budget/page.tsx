import { loadTripSection } from '@/lib/tripSection';
import { TripBudgetView } from '@/features/trips/components/TripBudgetView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Budget — ${slug} | Le Kit du Voyageur` };
}

export default async function BudgetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = await loadTripSection(slug);
  return <TripBudgetView trip={trip} />;
}

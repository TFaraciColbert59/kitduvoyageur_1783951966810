import { notFound } from 'next/navigation';
import { getTripBySlug, getTripStats } from '@/lib/queries-trips';
import { calculateBudgetSummary } from '@/features/trips/engine/budgetEngine';
import ExportClientView from './ExportClientView';

interface ExportPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function TripExportPage({ params, searchParams }: ExportPageProps) {
  const { slug } = await params;
  const { token } = await searchParams;

  // Token vérifié comme token de partage (jamais comme userId).
  const trip = await getTripBySlug(slug, undefined, token ? { shareToken: token } : undefined);
  if (!trip) {
    notFound();
  }

  const stats = await getTripStats(trip.id);
  const budgetSummary = calculateBudgetSummary(
    { estimated_budget: trip.estimated_budget, budget_currency: trip.budget_currency },
    trip.expenses || [],
    trip.collaborators || []
  );

  return <ExportClientView trip={trip} stats={stats} budgetSummary={budgetSummary} />;
}

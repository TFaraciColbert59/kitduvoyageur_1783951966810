import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTripKitDetails } from '@/lib/queries-trip-kit';
import { getTripDurationDays } from '@/features/trips/engine/contextualKitEngine';
import { TripKitView } from '@/features/trips/components/TripKitView';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getTripKitDetails(slug);

  if (!result) {
    return { title: 'Kit de voyage introuvable — Le Kit du Voyageur' };
  }

  const { trip } = result;
  const title = `Kit du Voyage & Sac à Dos — ${trip.title} | LKDV`;
  const description = `Préparez votre sac et votre équipement certifié pour l'expédition ${trip.title}. Bilan de poids, check-list interactive et recommandations adaptées au terrain.`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', url: `https://lekitduvoyageur.fr/voyages/${trip.slug}/kit` },
  };
}

/** Y2 — le shell (colonnes, mobile) est fourni par le layout du segment. */
export default async function TripKitPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await getTripKitDetails(slug, user?.id);
  if (!result) notFound();

  const { trip, analysis } = result;

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <div className="flex items-center gap-2 text-[var(--lkv-text-secondary)] text-xs font-bold uppercase tracking-wider mb-1">
          Kit & Sac à dos
        </div>
        <p className="text-xs sm:text-sm text-[var(--lkv-text-secondary)]">
          Recommandations contextuelles basées sur le climat, l’altitude ({analysis.maxAltitudeM}m) et la durée ({getTripDurationDays(trip)}j).
        </p>
      </div>
      <TripKitView trip={trip} analysis={analysis} showBackLink={false} />
    </div>
  );
}

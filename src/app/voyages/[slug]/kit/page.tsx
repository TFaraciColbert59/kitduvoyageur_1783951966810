import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getTripKitDetails } from '@/lib/queries-trip-kit';
import { getTripDurationDays } from '@/features/trips/engine/contextualKitEngine';
import { TripKitView } from '@/features/trips/components/TripKitView';
import AppShell from '@/components/shell/AppShell';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getTripKitDetails(slug);

  if (!result) {
    return {
      title: 'Kit de voyage introuvable — Le Kit du Voyageur',
    };
  }

  const { trip } = result;
  const title = `Kit du Voyage & Sac à Dos — ${trip.title} | LKDV`;
  const description = `Préparez votre sac et votre équipement certifié pour l'expédition ${trip.title}. Bilan de poids, check-list interactive et recommandations adaptées au terrain.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `https://lekitduvoyageur.fr/voyages/${trip.slug}/kit`,
    },
  };
}

export default async function TripKitPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await getTripKitDetails(slug, user?.id);

  if (!result) {
    notFound();
  }

  const { trip, analysis } = result;

  return (
    <AppShell safeTop={true} hasBottomNav={true}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28">
        {/* Navigation fil d'Ariane */}
        <div className="flex items-center gap-2 text-xs text-[#5B7F55] mb-4">
          <Link href="/voyages" className="hover:underline flex items-center gap-1 font-medium">
            <ArrowLeft size={13} />
            Voyages
          </Link>
          <span>/</span>
          <Link href={`/voyages/${trip.slug}`} className="hover:underline truncate max-w-xs font-medium">
            {trip.title}
          </Link>
          <span>/</span>
          <span className="text-[#17402C] font-semibold flex items-center gap-1">
            <Package size={13} />
            Kit & Sac à dos
          </span>
        </div>

        {/* Titre & sous-titre */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-[#5B7F55] text-xs font-bold uppercase tracking-wider mb-1">
            <Package size={14} />
            Préparation & Matériel Technique
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#17402C]">
            Kit du voyage & Sac à dos
          </h1>
          <p className="text-xs sm:text-sm text-[#5B7F55] mt-1">
            Recommandations contextuelles basées sur le climat, l’altitude ({analysis.maxAltitudeM}m) et la durée ({getTripDurationDays(trip)}j).
          </p>
        </div>

        {/* Vue principale du kit */}
        <TripKitView trip={trip} analysis={analysis} showBackLink={true} />
      </div>
    </AppShell>
  );
}

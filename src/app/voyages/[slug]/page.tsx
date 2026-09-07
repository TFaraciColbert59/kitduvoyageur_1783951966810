import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTripBySlug, getTripStats } from '@/lib/queries-trips';
import { getAffiliateLinks } from '@/lib/queries-affiliation';
import { getTripKitDetails } from '@/lib/queries-trip-kit';
import { getTripElevationProfile } from '@/features/trips/lib/elevation';
import TripDetailClient from './TripDetailClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ phase?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const trip = await getTripBySlug(slug);

  if (!trip) {
    return {
      title: 'Voyage introuvable | Le Kit du Voyageur',
    };
  }

  return {
    title: `${trip.title} | Carnet & Organisation | Le Kit du Voyageur`,
    description: trip.description || `Préparez votre voyage ${trip.title} avec LKDV.`,
    openGraph: {
      title: trip.title,
      description: trip.description || undefined,
      type: 'website',
      images: trip.cover_image_url ? [{ url: trip.cover_image_url }] : [],
    },
    alternates: {
      canonical: `https://lekitduvoyageur.fr/voyages/${trip.slug}`,
    },
  };
}

export default async function TripDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialPhase = resolvedSearchParams?.phase as any;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const trip = await getTripBySlug(slug, user?.id);

  if (!trip) {
    notFound();
  }

  const stats = await getTripStats(trip.id);
  const elevationProfile = getTripElevationProfile(trip);

  // Liens d'affiliation ciblés par pays et altitude (résolution D2)
  const countryCode = trip.destination_country_code || undefined;
  const affiliateLinks = await getAffiliateLinks({
    countryCode,
    maxAltitudeM: elevationProfile.maxM,
    limit: 6,
  });

  // Analyse du Kit contextuel & Équipement LKDV (Chantier 6)
  const kitResult = await getTripKitDetails(slug, user?.id);

  // Schema.org TouristTrip
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: trip.title,
    description: trip.description || trip.title,
    touristType: trip.primary_activity,
    startDate: trip.start_date || undefined,
    endDate: trip.end_date || undefined,
    itinerary: {
      '@type': 'ItemList',
      numberOfItems: trip.steps.length,
      itemListElement: trip.steps.map(step => ({
        '@type': 'ListItem',
        position: step.day_number,
        item: {
          '@type': 'TouristAttraction',
          name: step.title,
          description: step.description || step.title,
        },
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // Échappement < : un titre/étape utilisateur ne peut pas sortir du bloc script.
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <TripDetailClient
        trip={trip}
        stats={stats}
        affiliateLinks={affiliateLinks}
        kitAnalysis={kitResult?.analysis}
        initialPhase={initialPhase}
      />
    </>
  );
}

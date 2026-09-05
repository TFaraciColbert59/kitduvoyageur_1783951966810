import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTripBySlug, getTripStats } from '@/lib/queries-trips';
import { getAffiliateLinks } from '@/lib/queries-affiliation';
import TripDetailClient from './TripDetailClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const trip = await getTripBySlug(slug);

  if (!trip) {
    return {
      title: 'Voyage introuvable — Le Kit du Voyageur',
    };
  }

  const title = `${trip.title} — Expédition Outdoor | LKDV`;
  const description =
    trip.description ||
    `Détails et itinéraire de l'expédition ${trip.title} à ${trip.destination_name || 'destination outdoor'}. Organisé sur Le Kit du Voyageur.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `https://lekitduvoyageur.fr/voyages/${trip.slug}`,
      images: trip.cover_image_url ? [{ url: trip.cover_image_url }] : [],
    },
    alternates: {
      canonical: `https://lekitduvoyageur.fr/voyages/${trip.slug}`,
    },
  };
}

export default async function TripDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const trip = await getTripBySlug(slug, user?.id);

  if (!trip) {
    notFound();
  }

  const stats = await getTripStats(trip.id);

  // Liens d'affiliation ciblés par pays
  const countryCode = trip.destination_country_code || undefined;
  const affiliateLinks = await getAffiliateLinks({
    countryCode,
    limit: 6,
  });

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TripDetailClient trip={trip} stats={stats} affiliateLinks={affiliateLinks} />
    </>
  );
}

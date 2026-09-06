import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPlaceBySlug, getUserTripsForPicker } from '@/lib/queries-places';
import AppShell from '@/components/shell/AppShell';
import { PlaceDetailClient } from '@/features/places/components/PlaceDetailClient';
import { getCategoryLabel } from '@/features/places/components/PlaceCard';

export const dynamic = 'force-dynamic';

interface PlacePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { slug } = await params;
  const { place } = await getPlaceBySlug(slug);

  if (!place) {
    return {
      title: 'Lieu introuvable — Le Kit du Voyageur',
    };
  }

  const categoryLabel = getCategoryLabel(place.category);
  const locationStr = place.city || place.region || place.country_code;

  return {
    title: `${place.name} — ${categoryLabel} (${locationStr}) | LKDV`,
    description:
      place.description ||
      `Fiche détaillée, informations pratiques, accès eau et avis certifiés pour ${place.name}, ${categoryLabel} situé à ${locationStr}.`,
    openGraph: {
      title: `${place.name} — ${categoryLabel} Outdoor LKDV`,
      description:
        place.description ||
        `Consultez les topos et notes certifiées par la communauté outdoor pour ${place.name}.`,
      type: 'website',
      url: `https://lekitduvoyageur.fr/lieux/${place.slug}`,
    },
    alternates: {
      canonical: `https://lekitduvoyageur.fr/lieux/${place.slug}`,
    },
  };
}

export default async function PlaceDetailPage({ params }: PlacePageProps) {
  const { slug } = await params;
  const { place, reviews, photos } = await getPlaceBySlug(slug);

  if (!place) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userTrips: Array<{ id: string; title: string; slug: string; duration_days: number }> = [];
  if (user) {
    userTrips = await getUserTripsForPicker(user.id);
  }

  // Schema.org Structured Data
  const schemaType =
    place.category === 'campground' || place.category === 'bivouac'
      ? 'Campground'
      : place.category === 'refuge'
      ? 'LodgingBusiness'
      : 'TouristAttraction';

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: place.name,
    description: place.description || place.name,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: place.latitude,
      longitude: place.longitude,
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: place.country_code,
      addressRegion: place.region || undefined,
      addressLocality: place.city || undefined,
    },
  };

  if (place.bayesian_rating > 0 && place.reviews_count > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: place.bayesian_rating.toFixed(1),
      reviewCount: place.reviews_count,
      bestRating: '5',
      worstRating: '1',
    };
  }

  return (
    <AppShell safeTop={true} hasBottomNav={true}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <PlaceDetailClient
          place={place}
          reviews={reviews}
          photos={photos}
          userTrips={userTrips}
        />
      </div>
    </AppShell>
  );
}

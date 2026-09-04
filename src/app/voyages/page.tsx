import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getPublicTrips, getUserTrips } from '@/lib/queries-trips';
import VoyagesClient from './VoyagesClient';
import type { TripWithDetails } from '@/features/trips/types/trip.types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Voyages & Expéditions Outdoor — Le Kit du Voyageur',
  description:
    'Découvrez, planifiez et organisez vos randonnées, treks et expéditions en autonomie. Cockpit complet pour préparer votre itinéraire, matériel et budget.',
  openGraph: {
    title: 'Voyages & Expéditions Outdoor — Le Kit du Voyageur',
    description:
      'Planifiez et suivez vos expéditions outdoor en toute sécurité avec LKDV.',
    type: 'website',
    url: 'https://lekitduvoyageur.fr/voyages',
  },
  alternates: {
    canonical: 'https://lekitduvoyageur.fr/voyages',
  },
};

export default async function VoyagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Récupérer les voyages publics
  const { trips: initialPublicTrips, total: publicTotal } =
    await getPublicTrips({ limit: 24, sort_by: 'created_at', sort_order: 'desc' });

  // 2. Si l'utilisateur est connecté, charger ses voyages
  let initialUserTrips: TripWithDetails[] = [];
  if (user) {
    initialUserTrips = await getUserTrips(user.id);
  }

  // Schema.org ItemList pour le SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Expéditions et Voyages Outdoor LKDV',
    description: 'Sélection de parcours, treks et voyages en autonomie',
    numberOfItems: initialPublicTrips.length,
    itemListElement: initialPublicTrips.map((trip, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'TouristTrip',
        name: trip.title,
        description: trip.description || trip.title,
        url: `https://lekitduvoyageur.fr/voyages/${trip.slug}`,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <VoyagesClient
        initialPublicTrips={initialPublicTrips}
        initialUserTrips={initialUserTrips}
        publicTotal={publicTotal}
        isAuthenticated={Boolean(user)}
        currentUserId={user?.id}
      />
    </>
  );
}

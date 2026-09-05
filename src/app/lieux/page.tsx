import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getPlaces, getUserTripsForPicker } from '@/lib/queries-places';
import AppShell from '@/components/shell/AppShell';
import { PlacesExplorerClient } from '@/features/places/components/PlacesExplorerClient';
import { Compass } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Lieux Communautaires, Refuges & Topos — Le Kit du Voyageur',
  description:
    'Explorez les refuges d’altitude, bivouacs réglementés, sources d’eau et cols qualifiés par la communauté outdoor. Évaluations certifiées terrain et floutage éthique.',
  openGraph: {
    title: 'Lieux Communautaires & Refuges Outdoor — LKDV',
    description:
      'Guide et topos des lieux réels vérifiés par la communauté outdoor pour vos treks en France, Népal, Pérou, Islande et Maroc.',
    type: 'website',
    url: 'https://lekitduvoyageur.fr/lieux',
  },
  alternates: {
    canonical: 'https://lekitduvoyageur.fr/lieux',
  },
};

export default async function LieuxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Récupérer les lieux qualifiés
  const { places } = await getPlaces({ limit: 100 });

  // 2. Si connecté, récupérer les voyages pour l'ajout direct
  let userTrips: Array<{ id: string; title: string; slug: string; duration_days: number }> = [];
  if (user) {
    userTrips = await getUserTripsForPicker(user.id);
  }

  // 3. Schema.org ItemList pour le SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Lieux Communautaires et Refuges Outdoor LKDV',
    description:
      'Catalogue de refuges alpins, bivouacs réglementés, sources et cols de montagne',
    numberOfItems: places.length,
    itemListElement: places.map((place, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': place.category === 'campground' || place.category === 'bivouac' ? 'Campground' : 'TouristAttraction',
        name: place.name,
        description: place.description || place.name,
        url: `https://lekitduvoyageur.fr/lieux/${place.slug}`,
      },
    })),
  };

  return (
    <AppShell safeTop={true} hasBottomNav={true}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Header de la Page */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#17402C]/10 text-[#17402C] text-xs font-bold uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5 text-[#5B7F55]" />
            Communauté & Topos Outdoor
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight">
            Lieux & Refuges d’Altitude
          </h1>

          <p className="text-sm sm:text-base text-stone-600 max-w-2xl leading-relaxed">
            Refuges gardés, zones de bivouac réglementées, sources d’eau et cols remarquables.
            Notes bayésiennes certifiées par les retours terrain de randonneurs autonomes.
          </p>
        </div>

        {/* Client Explorer */}
        <PlacesExplorerClient
          initialPlaces={places}
          userTrips={userTrips}
        />
      </div>
    </AppShell>
  );
}

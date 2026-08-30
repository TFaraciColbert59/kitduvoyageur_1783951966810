import { Metadata } from 'next';
import { fetchCountries } from '@/lib/geodata';
import { countryGeoToCountry } from '@/lib/countries';
import EarthPageClient from './EarthPageClient';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Atlas 3D des Pays — Le Kit du Voyageur',
  description: 'Explorez les 195 pays du monde en 3D interactif. Données géographiques, capitales, devises, fuseaux horaires et guides d’aventure.',
  alternates: {
    canonical: `${siteUrl}/pays`,
  },
  openGraph: {
    title: 'Atlas 3D des Pays — Le Kit du Voyageur',
    description: 'Explorez les 195 pays du monde en 3D interactif. Données géographiques, capitales, devises, fuseaux horaires et guides d’aventure.',
    url: `${siteUrl}/pays`,
    type: 'website',
  },
};

export default async function EarthPage() {
  let initialCountries: import('@/lib/countries').Country[] = [];
  try {
    const geoCountries = await fetchCountries();
    initialCountries = geoCountries.map(countryGeoToCountry);
  } catch (err) {
    console.error('[EarthPage] Error fetching countries:', err);
  }

  return <EarthPageClient initialCountries={initialCountries} />;
}
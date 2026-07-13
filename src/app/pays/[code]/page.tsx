import { Metadata } from 'next';
import CountryPage from './CountryPageClient';
import { getCountryByCode, getPublishedCountries } from '@/lib/countries';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.com';

/**
 * Generate static params for published countries only
 * Unpublished countries still render but with noindex
 */
export async function generateStaticParams() {
  const publishedCountries = getPublishedCountries();
  return publishedCountries.map((country) => ({
    code: country.code.toLowerCase(),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const country = getCountryByCode(code);

  if (!country) {
    return {
      title: 'Pays non trouvé',
      robots: { index: false, follow: false },
    };
  }

  const isPublished = country.published;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: country.nom,
    url: `${siteUrl}/pays/${country.code.toLowerCase()}`,
    description: `Tout ce qu'il faut savoir pour voyager en ${country.nom} : calendrier météo, informations pratiques, visa, vaccins et kits recommandés.`,
    touristType: ['Randonneur', 'Aventurier', 'Trekker'],
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Pays', item: `${siteUrl}/pays` },
        { '@type': 'ListItem', position: 3, name: country.nom, item: `${siteUrl}/pays/${country.code.toLowerCase()}` },
      ],
    },
  };

  return {
    title: `Fiche pays ${country.nom} — Météo, visa, équipement`,
    description: `Tout ce qu'il faut savoir pour voyager en ${country.nom} : calendrier météo, informations pratiques, visa, vaccins et kits recommandés.`,
    alternates: {
      canonical: `${siteUrl}/pays/${country.code.toLowerCase()}`,
    },
    openGraph: {
      title: `Voyager en ${country.nom} — Le Kit du Voyageur`,
      description: `Calendrier météo, visa, vaccins et équipement recommandé pour ${country.nom}.`,
      url: `${siteUrl}/pays/${country.code.toLowerCase()}`,
      images: [
        {
          url: '/assets/images/og-image.png',
          width: 1200,
          height: 630,
          alt: `Voyager en ${country.nom} — Le Kit du Voyageur`,
        },
      ],
    },
    robots: {
      index: isPublished,
      follow: true,
    },
    other: {
      'script:ld+json': JSON.stringify(jsonLd),
    },
  };
}

export default CountryPage;
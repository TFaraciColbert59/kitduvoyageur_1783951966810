import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchCountryByIso, fetchAllCountrySlugs } from '@/lib/geodata';
import { getCompleteCountryDetail } from '@/lib/countryDetails';
import CountryDetailClient from './CountryDetailClient';

interface Props {
  params: Promise<{ code: string }>;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export async function generateStaticParams() {
  try {
    const slugs = await fetchAllCountrySlugs();
    if (slugs && slugs.length > 0) {
      return slugs.map((code) => ({ code }));
    }
  } catch (error) {
    console.error('[CountryPage] Error in generateStaticParams:', error);
  }
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const geoCountry = await fetchCountryByIso(code);

  if (!geoCountry) {
    return {
      title: `Pays non trouvé — Le Kit du Voyageur`,
    };
  }

  const title = `${geoCountry.name} — Guide de voyage & équipement | Le Kit du Voyageur`;
  const description = `Guide complet pour voyager en ${geoCountry.name} (${geoCountry.subregion || geoCountry.continent}). Capitale : ${geoCountry.capital}, fuseau : ${geoCountry.timezone}, superficie : ${geoCountry.area_km2 ? `${geoCountry.area_km2} km²` : '—'}. Conseils terrain et kits recommandés.`;
  const canonicalUrl = `${siteUrl}/pays/${code.toLowerCase()}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
    },
  };
}

export default async function CountryPage({ params }: Props) {
  const { code } = await params;
  const geoCountry = await fetchCountryByIso(code);

  if (!geoCountry) {
    notFound();
  }

  const country = getCompleteCountryDetail(code, geoCountry);

  const schemaOrg = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Place',
        '@id': `${siteUrl}/pays/${code.toLowerCase()}#place`,
        name: country.nom,
        description: country.subtitle,
        url: `${siteUrl}/pays/${code.toLowerCase()}`,
        containedInPlace: {
          '@type': 'AdministrativeArea',
          name: country.continent,
        },
      },
      {
        '@type': 'WebPage',
        '@id': `${siteUrl}/pays/${code.toLowerCase()}#webpage`,
        name: `${country.nom} — Guide de voyage & équipement`,
        description: country.subtitle,
        url: `${siteUrl}/pays/${code.toLowerCase()}`,
        isPartOf: { '@id': `${siteUrl}/#website` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${siteUrl}/pays/${code.toLowerCase()}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Atlas Pays', item: `${siteUrl}/pays` },
          { '@type': 'ListItem', position: 3, name: country.nom, item: `${siteUrl}/pays/${code.toLowerCase()}` },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
        suppressHydrationWarning
      />
      <CountryDetailClient country={country} />
    </>
  );
}

import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import CountryPageClient from './CountryPageClient';
import { getCountryByCode, getPublishedCountries } from '@/lib/countries';

interface Props {
  params: Promise<{ code: string }>;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

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

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { code } = await params;
  const country = getCountryByCode(code);

  if (!country) {
    return {
      title: 'Pays non trouvé',
      robots: { index: false, follow: false },
    };
  }

  const isPublished = country.published;
  const canonicalUrl = `${siteUrl}/pays/${country.code.toLowerCase()}`;
  const title = `Voyager en ${country.nom} — Fiche pays complète`;
  const description = `Tout ce qu'il faut savoir pour voyager en ${country.nom} : météo, visa, vaccins, équipement recommandé et kits optimisés.`;

  return {
    title,
    description,
    keywords: [
      country.nom,
      'voyage',
      'fiche pays',
      'équipement',
      'randonnée',
      ...country.tags,
    ],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: 'website',
      title: `Voyager en ${country.nom} — Le Kit du Voyageur`,
      description,
      url: canonicalUrl,
      images: [
        {
          url: '/assets/images/og-image.png',
          width: 1200,
          height: 630,
          alt: `Voyager en ${country.nom} — Le Kit du Voyageur`,
          type: 'image/png',
        },
      ],
      siteName: 'Le Kit du Voyageur',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Voyager en ${country.nom}`,
      description,
      images: ['/assets/images/og-image.png'],
    },
    robots: {
      index: isPublished,
      follow: true,
      googleBot: {
        index: isPublished,
        follow: true,
      },
    },
  };
}

export default async function PaysPage({ params }: Props) {
  const { code } = await params;
  const country = getCountryByCode(code);

  if (!country) {
    notFound();
  }

  const canonicalUrl = `${siteUrl}/pays/${country.code.toLowerCase()}`;

  // JSON-LD: TouristDestination + BreadcrumbList + FAQPage
  const schemaOrg = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TouristDestination',
        '@id': `${canonicalUrl}#destination`,
        name: country.nom,
        url: canonicalUrl,
        description: `Tout ce qu'il faut savoir pour voyager en ${country.nom} : météo, visa, vaccins, équipement recommandé et kits optimisés.`,
        touristType: ['Randonneur', 'Aventurier', 'Trekker'],
        containedInPlace: {
          '@type': 'Continent',
          name: country.continent,
        },
        areaServed: {
          '@type': 'Country',
          name: country.nom,
        },
      },
      {
        '@type': 'BreadcrumbList','@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',position: 1,name: 'Accueil',
            item: siteUrl,
          },
          {
            '@type': 'ListItem',position: 2,name: 'Pays',
            item: `${siteUrl}/pays`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: country.nom,
            item: canonicalUrl,
          },
        ],
      },
      {
        '@type': 'FAQPage','@id': `${canonicalUrl}#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: `Quelle est la meilleure saison pour voyager en ${country.nom} ?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `La meilleure saison pour voyager en ${country.nom} est ${country.meilleure_saison}. C'est la période idéale pour profiter des conditions météorologiques optimales et des paysages à leur meilleur.`,
            },
          },
          {
            '@type': 'Question',
            name: `Quel équipement recommandez-vous pour ${country.nom} ?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Pour ${country.nom}, nous recommandons un équipement adapté aux conditions locales. Consultez notre fiche pays complète pour les kits optimisés et les équipements essentiels.`,
            },
          },
          {
            '@type': 'Question',
            name: `Quel est le niveau de sécurité en ${country.nom} ?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Le niveau de sécurité en ${country.nom} est classé comme ${country.danger_level === 'low' ? 'faible' : country.danger_level === 'medium' ? 'moyen' : 'élevé'}. Consultez les informations officielles avant de voyager.`,
            },
          },
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
      <CountryPageClient code={country.code.toLowerCase()} />
    </>
  );
}

// ISR: Revalidate every 24 hours (countries data changes infrequently)
export const revalidate = 86400;
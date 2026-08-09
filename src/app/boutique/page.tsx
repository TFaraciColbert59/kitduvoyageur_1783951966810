import { Metadata } from 'next';
import BoutiqueClient from './BoutiqueClient';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Boutique — Équipement outdoor & matériel voyage',
  description: 'Découvrez notre sélection d\'equipements outdoor vérifiés et testés. Matériel de randonnée, camping, trekking et aventure.',
  alternates: {
    canonical: `${siteUrl}/boutique`,
  },
  openGraph: {
    title: 'Boutique — Équipement outdoor & matériel voyage',
    description: 'Découvrez notre sélection d\'equipements outdoor vérifiés et testés. Matériel de randonnée, camping, trekking et aventure.',
    url: `${siteUrl}/boutique`,
    type: 'website',
  },
};

export default function BoutiquePage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Boutique — Équipement outdoor & matériel voyage',
    description: 'Découvrez notre sélection d\'equipements outdoor vérifiés et testés. Matériel de randonnée, camping, trekking et aventure.',
    url: `${siteUrl}/boutique`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Le Kit du Voyageur',
      url: siteUrl,
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Accueil',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Boutique',
        item: `${siteUrl}/boutique`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
        suppressHydrationWarning
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        suppressHydrationWarning
      />
      <BoutiqueClient />
    </>
  );
}
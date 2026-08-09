import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Location mat\u00e9riel outdoor',
  description: "Louez du mat\u00e9riel outdoor pour vos voyages : tentes, sacs \u00e0 dos, r\u00e9chauds, v\u00eatements techniques. \u00c9quipement professionnel sans l'achat.",
  alternates: {
    canonical: `${siteUrl}/location`,
  },

  openGraph: {
    title: 'Location mat\u00e9riel outdoor',
    description: "Louez du mat\u00e9riel outdoor pour vos voyages : tentes, sacs \u00e0 dos, r\u00e9chauds, v\u00eatements techniques. \u00c9quipement professionnel sans l'achat.",
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/location#webpage`,
          name: 'Location mat\u00e9riel outdoor — Le Kit du Voyageur',
          description: "Louez du mat\u00e9riel outdoor pour vos voyages : tentes, sacs \u00e0 dos, r\u00e9chauds, v\u00eatements techniques.",
          url: `${siteUrl}/location`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/location#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Location mat\u00e9riel', item: `${siteUrl}/location` },
          ],
        },
      ],
    }),
  },
};

export default function LocationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

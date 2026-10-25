import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Occasion outdoor',
  description: "Achetez et vendez du mat\u00e9riel outdoor d'occasion certifi\u00e9 : \u00e9quipement contr\u00f4l\u00e9, garanti et livr\u00e9 chez vous en toute s\u00e9curit\u00e9.",
  alternates: {
    canonical: `${siteUrl}/occasion`,
  },

  openGraph: {
    title: 'Occasion outdoor',
    description: "Achetez et vendez du mat\u00e9riel outdoor d'occasion certifi\u00e9 : \u00e9quipement contr\u00f4l\u00e9, garanti et livr\u00e9 chez vous en toute s\u00e9curit\u00e9.",
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/occasion#webpage`,
          name: 'Occasion outdoor — Le Kit du Voyageur',
          description: "Achetez et vendez du mat\u00e9riel outdoor d'occasion certifi\u00e9 : \u00e9quipement contr\u00f4l\u00e9, garanti et livr\u00e9 chez vous.",
          url: `${siteUrl}/occasion`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/occasion#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Occasion', item: `${siteUrl}/occasion` },
          ],
        },
      ],
    }),
  },
};

export default function OccasionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

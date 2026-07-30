import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Ench\u00e8res outdoor',
  description: 'Ench\u00e9rissez sur du mat\u00e9riel outdoor d\u0027occasion : tentes, sacs \u00e0 dos, v\u00eatements techniques. Trouvez votre \u00e9quipement au meilleur prix.',
  alternates: {
    canonical: `${siteUrl}/encheres`,
  },

  openGraph: {
    title: 'Ench\u00e8res outdoor',
    description: 'Ench\u00e9rissez sur du mat\u00e9riel outdoor d\u0027occasion : tentes, sacs \u00e0 dos, v\u00eatements techniques. Trouvez votre \u00e9quipement au meilleur prix.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/encheres#webpage`,
          name: 'Ench\u00e8res outdoor — Le Kit du Voyageur',
          description: 'Ench\u00e9rissez sur du mat\u00e9riel outdoor d\u0027occasion : tentes, sacs \u00e0 dos, v\u00eatements techniques.',
          url: `${siteUrl}/encheres`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/encheres#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Ench\u00e8res', item: `${siteUrl}/encheres` },
          ],
        },
      ],
    }),
  },
};

export default function EncheresLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

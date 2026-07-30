import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Cr\u00e9ateurs outdoor',
  description: 'D\u00e9couvrez les cr\u00e9ateurs de contenu outdoor : tests mat\u00e9riel, r\u00e9cits d\u0027aventures, tutoriels et inspirations pour vos prochains voyages.',
  alternates: {
    canonical: `${siteUrl}/createurs`,
  },

  openGraph: {
    title: 'Cr\u00e9ateurs outdoor',
    description: 'D\u00e9couvrez les cr\u00e9ateurs de contenu outdoor : tests mat\u00e9riel, r\u00e9cits d\u0027aventures, tutoriels et inspirations pour vos prochains voyages.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/createurs#webpage`,
          name: 'Cr\u00e9ateurs outdoor — Le Kit du Voyageur',
          description: 'D\u00e9couvrez les cr\u00e9ateurs de contenu outdoor : tests mat\u00e9riel, r\u00e9cits d\u2019aventures, tutoriels et inspirations.',
          url: `${siteUrl}/createurs`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/createurs#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Cr\u00e9ateurs', item: `${siteUrl}/createurs` },
          ],
        },
      ],
    }),
  },
};

export default function CreateursLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

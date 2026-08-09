import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Clubs de voyageurs',
  description: 'Rejoignez des clubs de voyageurs passionn\u00e9s : randonn\u00e9e, trek, vanlife, ultralight. \u00c9changez conseils et organisez des sorties en groupe.',
  alternates: {
    canonical: `${siteUrl}/clubs`,
  },

  openGraph: {
    title: 'Clubs de voyageurs',
    description: 'Rejoignez des clubs de voyageurs passionn\u00e9s : randonn\u00e9e, trek, vanlife, ultralight. \u00c9changez conseils et organisez des sorties en groupe.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/clubs#webpage`,
          name: 'Clubs de voyageurs — Le Kit du Voyageur',
          description: 'Rejoignez des clubs de voyageurs passionn\u00e9s : randonn\u00e9e, trek, vanlife, ultralight.',
          url: `${siteUrl}/clubs`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/clubs#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Clubs', item: `${siteUrl}/clubs` },
          ],
        },
      ],
    }),
  },
};

export default function ClubsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

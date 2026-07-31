import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Mode Terrain',
  description:
    'Accédez à tous vos outils terrain en un seul endroit : GPS, carte interactive, recherche, mon kit, et mode hors ligne.',
  alternates: {
    canonical: `${siteUrl}/terrain`,
  },
  openGraph: {
    title: 'Mode Terrain — Le Kit du Voyageur',
    description:
      'GPS, carte, kit, recherche : tous vos outils terrain réunis.',
    url: `${siteUrl}/terrain`,
  },
  other: {
    'structured-data': JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${siteUrl}/terrain#webpage`,
      url: `${siteUrl}/terrain`,
      name: 'Mode Terrain',
      description:
        'Hub terrain centralisant GPS, carte interactive, recherche, mon kit et mode hors ligne.',
      isPartOf: { '@id': `${siteUrl}/#website` },
      breadcrumb: {
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
            name: 'Mode Terrain',
            item: `${siteUrl}/terrain`,
          },
        ],
      },
    }),
  },
};

export default function TerrainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

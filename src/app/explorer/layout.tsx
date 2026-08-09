import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Explorer — Sentiers & Randonnées',
  description:
    'Découvrez les plus beaux sentiers de randonnée et trails. Carte interactive, filtres par difficulté et durée, et fiches détaillées pour préparer vos aventures outdoor.',
  alternates: {
    canonical: `${siteUrl}/explorer`,
  },

  openGraph: {
    title: 'Explorer — Sentiers & Randonnées',
    description:
      'Découvrez les plus beaux sentiers de randonnée et trails. Carte interactive, filtres par difficulté et durée, et fiches détaillées pour préparer vos aventures outdoor.',
  },
  twitter: {
    title: 'Explorer — Sentiers & Randonnées',
    description:
      'Découvrez les plus beaux sentiers de randonnée et trails. Carte interactive, filtres par difficulté et durée, et fiches détaillées pour préparer vos aventures outdoor.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          '@id': `${siteUrl}/explorer#webpage`,
          name: 'Explorer — Sentiers & Randonnées',
          description:
            "Découvrez les plus beaux sentiers de randonnée et trails. Carte interactive, filtres par difficulté et durée, et fiches détaillées pour préparer vos aventures outdoor.",
          url: `${siteUrl}/explorer`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/explorer#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Explorer', item: `${siteUrl}/explorer` },
          ],
        },
      ],
    }),
  },
};

export default function ExplorerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

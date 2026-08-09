import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Jumeau 3D',
  description:
    "Visualisez votre sac et \u00e9quipement en 3D. Optimisez le poids et l'encombrement de votre mat\u00e9riel avant chaque d\u00e9part.",
  alternates: {
    canonical: `${siteUrl}/jumeau-3d`,
  },

  openGraph: {
    title: 'Jumeau 3D',
    description:
      "Visualisez votre sac et \u00e9quipement en 3D. Optimisez le poids et l'encombrement de votre mat\u00e9riel avant chaque d\u00e9part.",
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/jumeau-3d#webpage`,
          name: 'Jumeau 3D — Le Kit du Voyageur',
          description: "Visualisez votre sac et \u00e9quipement en 3D. Optimisez le poids et l'encombrement de votre mat\u00e9riel.",
          url: `${siteUrl}/jumeau-3d`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/jumeau-3d#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Jumeau 3D', item: `${siteUrl}/jumeau-3d` },
          ],
        },
      ],
    }),
  },
};

export default function Jumeau3dLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

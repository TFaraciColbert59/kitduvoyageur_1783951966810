import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: "Fil d'actualit\u00e9",
  description: "Le fil d'actualit\u00e9 de la communaut\u00e9 Le Kit du Voyageur : aventures, conseils, bons plans et d\u00e9couvertes du monde outdoor.",
  alternates: {
    canonical: `${siteUrl}/feed`,
  },

  openGraph: {
    title: "Fil d'actualit\u00e9",
    description: "Le fil d'actualit\u00e9 de la communaut\u00e9 Le Kit du Voyageur : aventures, conseils, bons plans et d\u00e9couvertes du monde outdoor.",
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/feed#webpage`,
          name: "Fil d'actualit\u00e9 — Le Kit du Voyageur",
          description: "Le fil d'actualit\u00e9 de la communaut\u00e9 Le Kit du Voyageur : aventures, conseils, bons plans et d\u00e9couvertes du monde outdoor.",
          url: `${siteUrl}/feed`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/feed#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: "Fil d'actualit\u00e9", item: `${siteUrl}/feed` },
          ],
        },
      ],
    }),
  },
};

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

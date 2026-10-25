import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Bilan Carbone',
  description: 'Calculez et suivez votre empreinte carbone li\u00e9e \u00e0 vos d\u00e9placements et \u00e9quipements outdoor. Agissez pour un voyage plus responsable.',
  alternates: {
    canonical: `${siteUrl}/carbone`,
  },

  openGraph: {
    title: 'Bilan Carbone',
    description: 'Calculez et suivez votre empreinte carbone li\u00e9e \u00e0 vos d\u00e9placements et \u00e9quipements outdoor. Agissez pour un voyage plus responsable.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/carbone#webpage`,
          name: 'Bilan Carbone — Le Kit du Voyageur',
          description: 'Calculez et suivez votre empreinte carbone li\u00e9e \u00e0 vos d\u00e9placements et \u00e9quipements outdoor.',
          url: `${siteUrl}/carbone`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/carbone#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Bilan Carbone', item: `${siteUrl}/carbone` },
          ],
        },
      ],
    }),
  },
};

export default function CarboneLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

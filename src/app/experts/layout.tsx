import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Experts outdoor',
  description: 'Consultez les experts outdoor du Kit du Voyageur : guides professionnels, formateurs et sp\u00e9cialistes mat\u00e9riel pour des conseils avis\u00e9s.',
  alternates: {
    canonical: `${siteUrl}/experts`,
  },

  openGraph: {
    title: 'Experts outdoor',
    description: 'Consultez les experts outdoor du Kit du Voyageur : guides professionnels, formateurs et sp\u00e9cialistes mat\u00e9riel pour des conseils avis\u00e9s.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/experts#webpage`,
          name: 'Experts outdoor — Le Kit du Voyageur',
          description: 'Consultez les experts outdoor du Kit du Voyageur : guides professionnels, formateurs et sp\u00e9cialistes mat\u00e9riel.',
          url: `${siteUrl}/experts`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/experts#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Experts', item: `${siteUrl}/experts` },
          ],
        },
      ],
    }),
  },
};

export default function ExpertsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

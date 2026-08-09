import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Espace Professionnel \u2014 B2B',
  description:
    'Tarifs pr\u00e9f\u00e9rentiels, commandes group\u00e9es et outils d\u00e9di\u00e9s pour les professionnels de l\u2019outdoor : guides, agences de voyage aventure et revendeurs B2B.',
  alternates: {
    canonical: `${siteUrl}/pro`,
  },

  openGraph: {
    title: 'Espace Professionnel \u2014 B2B',
    description:
      'Tarifs pr\u00e9f\u00e9rentiels, commandes group\u00e9es et outils d\u00e9di\u00e9s pour les professionnels de l\u2019outdoor : guides, agences de voyage aventure et revendeurs B2B.',
  },
  twitter: {
    title: 'Espace Professionnel \u2014 B2B',
    description:
      'Tarifs pr\u00e9f\u00e9rentiels, commandes group\u00e9es et outils d\u00e9di\u00e9s pour les professionnels de l\u2019outdoor : guides, agences de voyage aventure et revendeurs B2B.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/pro#webpage`,
          name: 'Espace Professionnel B2B — Le Kit du Voyageur',
          description: 'Tarifs pr\u00e9f\u00e9rentiels, commandes group\u00e9es et outils d\u00e9di\u00e9s pour les professionnels de l\u2019outdoor.',
          url: `${siteUrl}/pro`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/pro#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Espace Professionnel', item: `${siteUrl}/pro` },
          ],
        },
      ],
    }),
  },
};

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

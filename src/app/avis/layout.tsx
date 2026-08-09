import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Avis & T\u00e9moignages',
  description:
    'Consultez les avis v\u00e9rifi\u00e9s de la communaut\u00e9 sur les produits, kits, locations et articles d\u2019occasion. Partagez votre exp\u00e9rience et aidez les autres voyageurs.',
  alternates: {
    canonical: `${siteUrl}/avis`,
  },

  openGraph: {
    title: 'Avis & T\u00e9moignages',
    description:
      'Consultez les avis v\u00e9rifi\u00e9s de la communaut\u00e9 sur les produits, kits, locations et articles d\u2019occasion. Partagez votre exp\u00e9rience et aidez les autres voyageurs.',
  },
  twitter: {
    title: 'Avis & T\u00e9moignages',
    description:
      'Consultez les avis v\u00e9rifi\u00e9s de la communaut\u00e9 sur les produits, kits, locations et articles d\u2019occasion. Partagez votre exp\u00e9rience et aidez les autres voyageurs.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/avis#webpage`,
          name: 'Avis & T\u00e9moignages — Le Kit du Voyageur',
          description: 'Consultez les avis v\u00e9rifi\u00e9s de la communaut\u00e9 sur les produits, kits, locations et articles d\u2019occasion.',
          url: `${siteUrl}/avis`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/avis#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Avis & T\u00e9moignages', item: `${siteUrl}/avis` },
          ],
        },
      ],
    }),
  },
};

export default function AvisLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

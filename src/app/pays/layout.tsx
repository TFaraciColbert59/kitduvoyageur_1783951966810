import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Destinations Voyage & Aventure',
  description:
    'Explorez tous les pays du monde avec Le Kit du Voyageur : fiches destinations, conseils de s\u00e9curit\u00e9, activit\u00e9s outdoor et \u00e9quipement recommand\u00e9 pour chaque pays.',
  alternates: {
    canonical: `${siteUrl}/pays`,
  },

  openGraph: {
    title: 'Destinations Voyage & Aventure',
    description:
      'Explorez tous les pays du monde avec Le Kit du Voyageur : fiches destinations, conseils de s\u00e9curit\u00e9, activit\u00e9s outdoor et \u00e9quipement recommand\u00e9 pour chaque pays.',
  },
  twitter: {
    title: 'Destinations Voyage & Aventure',
    description:
      'Explorez tous les pays du monde avec Le Kit du Voyageur : fiches destinations, conseils de s\u00e9curit\u00e9, activit\u00e9s outdoor et \u00e9quipement recommand\u00e9 pour chaque pays.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/pays#webpage`,
          name: 'Destinations Voyage & Aventure — Le Kit du Voyageur',
          description: 'Explorez tous les pays du monde avec Le Kit du Voyageur : fiches destinations, conseils de s\u00e9curit\u00e9, activit\u00e9s outdoor et \u00e9quipement recommand\u00e9.',
          url: `${siteUrl}/pays`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/pays#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Destinations', item: `${siteUrl}/pays` },
          ],
        },
      ],
    }),
  },
};

export default function PaysLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

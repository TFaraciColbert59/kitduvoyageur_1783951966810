import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Fid\u00e9lit\u00e9',
  description: 'Programme de fid\u00e9lit\u00e9 Le Kit du Voyageur : cumulez des points \u00e0 chaque achat, d\u00e9bloquez des avantages exclusifs et des r\u00e9ductions.',
  alternates: {
    canonical: `${siteUrl}/fidelite`,
  },

  openGraph: {
    title: 'Fid\u00e9lit\u00e9',
    description: 'Programme de fid\u00e9lit\u00e9 Le Kit du Voyageur : cumulez des points \u00e0 chaque achat, d\u00e9bloquez des avantages exclusifs et des r\u00e9ductions.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/fidelite#webpage`,
          name: 'Fid\u00e9lit\u00e9 — Le Kit du Voyageur',
          description: 'Programme de fid\u00e9lit\u00e9 : cumulez des points \u00e0 chaque achat, d\u00e9bloquez des avantages exclusifs.',
          url: `${siteUrl}/fidelite`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/fidelite#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Fid\u00e9lit\u00e9', item: `${siteUrl}/fidelite` },
          ],
        },
      ],
    }),
  },
};

export default function FideliteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

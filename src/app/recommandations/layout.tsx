import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Recommandations',
  description: 'Recommandations personnalis\u00e9es d\u0027\u00e9quipement outdoor bas\u00e9es sur vos voyages, votre profil et les avis de la communaut\u00e9.',
  alternates: {
    canonical: `${siteUrl}/recommandations`,
  },

  openGraph: {
    title: 'Recommandations',
    description: 'Recommandations personnalis\u00e9es d\u0027\u00e9quipement outdoor bas\u00e9es sur vos voyages, votre profil et les avis de la communaut\u00e9.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/recommandations#webpage`,
          name: 'Recommandations — Le Kit du Voyageur',
          description: 'Recommandations personnalis\u00e9es d\u2019\u00e9quipement outdoor bas\u00e9es sur vos voyages, votre profil et les avis de la communaut\u00e9.',
          url: `${siteUrl}/recommandations`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/recommandations#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Recommandations', item: `${siteUrl}/recommandations` },
          ],
        },
      ],
    }),
  },
};

export default function RecommandationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: '\u00c9v\u00e9nements & Rencontres',
  description:
    'D\u00e9couvrez les sorties organis\u00e9es par la communaut\u00e9 : randonn\u00e9es, bushcraft, vanlife et alpinisme. Inscrivez-vous aux \u00e9v\u00e9nements pr\u00e8s de chez vous.',
  alternates: {
    canonical: `${siteUrl}/evenements`,
  },

  openGraph: {
    title: '\u00c9v\u00e9nements & Rencontres',
    description:
      'D\u00e9couvrez les sorties organis\u00e9es par la communaut\u00e9 : randonn\u00e9es, bushcraft, vanlife et alpinisme. Inscrivez-vous aux \u00e9v\u00e9nements pr\u00e8s de chez vous.',
  },
  twitter: {
    title: '\u00c9v\u00e9nements & Rencontres',
    description:
      'D\u00e9couvrez les sorties organis\u00e9es par la communaut\u00e9 : randonn\u00e9es, bushcraft, vanlife et alpinisme. Inscrivez-vous aux \u00e9v\u00e9nements pr\u00e8s de chez vous.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/evenements#webpage`,
          name: '\u00c9v\u00e9nements & Rencontres — Le Kit du Voyageur',
          description: 'D\u00e9couvrez les sorties organis\u00e9es par la communaut\u00e9 : randonn\u00e9es, bushcraft, vanlife et alpinisme.',
          url: `${siteUrl}/evenements`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/evenements#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: '\u00c9v\u00e9nements', item: `${siteUrl}/evenements` },
          ],
        },
      ],
    }),
  },
};

export default function EvenementsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

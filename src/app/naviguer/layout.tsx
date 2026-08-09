import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Planifier un itin\u00e9raire',
  description: "Planifiez vos itin\u00e9raires de voyage avec notre carte interactive. D\u00e9couvrez les meilleures \u00e9tapes, points d'int\u00e9r\u00eat et conseils par pays.",
  alternates: {
    canonical: `${siteUrl}/naviguer`,
  },

  openGraph: {
    title: 'Planifier un itin\u00e9raire',
    description: "Planifiez vos itin\u00e9raires de voyage avec notre carte interactive. D\u00e9couvrez les meilleures \u00e9tapes, points d'int\u00e9r\u00eat et conseils par pays.",
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/naviguer#webpage`,
          name: 'Planifier un itin\u00e9raire — Le Kit du Voyageur',
          description: "Planifiez vos itin\u00e9raires de voyage avec notre carte interactive. D\u00e9couvrez les meilleures \u00e9tapes, points d'int\u00e9r\u00eat et conseils par pays.",
          url: `${siteUrl}/naviguer`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/naviguer#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Planifier un itin\u00e9raire', item: `${siteUrl}/naviguer` },
          ],
        },
      ],
    }),
  },
};

export default function NaviguerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

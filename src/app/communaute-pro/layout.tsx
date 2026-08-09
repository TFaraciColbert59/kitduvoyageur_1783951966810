import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Communaut\u00e9 Pro',
  description:
    'Espace d\u00e9di\u00e9 aux professionnels de l\u0027outdoor et du voyage : partenariats B2B, revendeurs, cr\u00e9ateurs de contenu et marques.',
  alternates: {
    canonical: `${siteUrl}/communaute-pro`,
  },

  openGraph: {
    title: 'Communaut\u00e9 Pro',
    description:
      'Espace d\u00e9di\u00e9 aux professionnels de l\u0027outdoor et du voyage : partenariats B2B, revendeurs, cr\u00e9ateurs de contenu et marques.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/communaute-pro#webpage`,
          name: 'Communaut\u00e9 Pro — Le Kit du Voyageur',
          description: 'Espace d\u00e9di\u00e9 aux professionnels de l\u0027outdoor et du voyage : partenariats B2B, revendeurs, cr\u00e9ateurs de contenu et marques.',
          url: `${siteUrl}/communaute-pro`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/communaute-pro#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Communaut\u00e9 Pro', item: `${siteUrl}/communaute-pro` },
          ],
        },
      ],
    }),
  },
};

export default function CommunauteProLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

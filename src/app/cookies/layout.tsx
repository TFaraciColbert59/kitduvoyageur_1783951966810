import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Cookies',
  description: 'Gestion des cookies et traceurs sur Le Kit du Voyageur. Informations transparentes sur vos donn\u00e9es et vos choix de confidentialit\u00e9.',
  alternates: {
    canonical: `${siteUrl}/cookies`,
  },

  openGraph: {
    title: 'Cookies',
    description: 'Gestion des cookies et traceurs sur Le Kit du Voyageur. Informations transparentes sur vos donn\u00e9es et vos choix de confidentialit\u00e9.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/cookies#webpage`,
          name: 'Cookies — Le Kit du Voyageur',
          description: 'Gestion des cookies et traceurs sur Le Kit du Voyageur.',
          url: `${siteUrl}/cookies`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/cookies#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Cookies', item: `${siteUrl}/cookies` },
          ],
        },
      ],
    }),
  },
};

export default function CookiesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

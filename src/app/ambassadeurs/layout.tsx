import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Ambassadeurs & Cr\u00e9ateurs',
  description:
    'Rejoignez le programme ambassadeurs du Kit du Voyageur. Partagez votre passion pour l\u2019outdoor et gagnez des commissions en recommandant nos produits.',
  alternates: {
    canonical: `${siteUrl}/ambassadeurs`,
  },

  openGraph: {
    title: 'Ambassadeurs & Cr\u00e9ateurs',
    description:
      'Rejoignez le programme ambassadeurs du Kit du Voyageur. Partagez votre passion pour l\u2019outdoor et gagnez des commissions en recommandant nos produits.',
  },
  twitter: {
    title: 'Ambassadeurs & Cr\u00e9ateurs',
    description:
      'Rejoignez le programme ambassadeurs du Kit du Voyageur. Partagez votre passion pour l\u2019outdoor et gagnez des commissions en recommandant nos produits.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/ambassadeurs#webpage`,
          name: 'Ambassadeurs & Cr\u00e9ateurs — Le Kit du Voyageur',
          description: 'Rejoignez le programme ambassadeurs du Kit du Voyageur. Partagez votre passion pour l\u2019outdoor et gagnez des commissions.',
          url: `${siteUrl}/ambassadeurs`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/ambassadeurs#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Ambassadeurs', item: `${siteUrl}/ambassadeurs` },
          ],
        },
      ],
    }),
  },
};

export default function AmbassadeursLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

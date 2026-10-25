import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Cr\u00e9er un groupe',
  description:
    'Cr\u00e9ez un groupe de voyageurs pour organiser des exp\u00e9ditions, partager des conseils et \u00e9changer sur vos passions outdoor.',
  alternates: {
    canonical: `${siteUrl}/nouveau-groupe`,
  },

  openGraph: {
    title: 'Cr\u00e9er un groupe',
    description:
      'Cr\u00e9ez un groupe de voyageurs pour organiser des exp\u00e9ditions, partager des conseils et \u00e9changer sur vos passions outdoor.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/nouveau-groupe#webpage`,
          name: 'Cr\u00e9er un groupe — Le Kit du Voyageur',
          description: 'Cr\u00e9ez un groupe de voyageurs pour organiser des exp\u00e9ditions, partager des conseils et \u00e9changer sur vos passions outdoor.',
          url: `${siteUrl}/nouveau-groupe`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/nouveau-groupe#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Cr\u00e9er un groupe', item: `${siteUrl}/nouveau-groupe` },
          ],
        },
      ],
    }),
  },
};

export default function NouveauGroupeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

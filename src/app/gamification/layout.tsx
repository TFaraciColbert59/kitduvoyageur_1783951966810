import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'D\u00e9fis & R\u00e9compenses',
  description: 'Gagnez des badges, accomplissez des d\u00e9fis et suivez votre progression outdoor. La communaut\u00e9 r\u00e9compense votre passion du voyage.',
  alternates: {
    canonical: `${siteUrl}/gamification`,
  },

  openGraph: {
    title: 'D\u00e9fis & R\u00e9compenses',
    description: 'Gagnez des badges, accomplissez des d\u00e9fis et suivez votre progression outdoor. La communaut\u00e9 r\u00e9compense votre passion du voyage.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/gamification#webpage`,
          name: 'D\u00e9fis & R\u00e9compenses — Le Kit du Voyageur',
          description: 'Gagnez des badges, accomplissez des d\u00e9fis et suivez votre progression outdoor.',
          url: `${siteUrl}/gamification`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/gamification#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'D\u00e9fis & R\u00e9compenses', item: `${siteUrl}/gamification` },
          ],
        },
      ],
    }),
  },
};

export default function GamificationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

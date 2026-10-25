import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Copilote Voyage IA',
  description: 'Votre assistant IA pour pr\u00e9parer vos voyages : itin\u00e9raires sur mesure, s\u00e9lection d\u0027\u00e9quipement, formalit\u00e9s et conseils personnalis\u00e9s.',
  alternates: {
    canonical: `${siteUrl}/copilote`,
  },

  openGraph: {
    title: 'Copilote Voyage IA',
    description: 'Votre assistant IA pour pr\u00e9parer vos voyages : itin\u00e9raires sur mesure, s\u00e9lection d\u0027\u00e9quipement, formalit\u00e9s et conseils personnalis\u00e9s.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/copilote#webpage`,
          name: 'Copilote Voyage IA — Le Kit du Voyageur',
          description: 'Votre assistant IA pour pr\u00e9parer vos voyages : itin\u00e9raires sur mesure, s\u00e9lection d\u2019\u00e9quipement, formalit\u00e9s et conseils personnalis\u00e9s.',
          url: `${siteUrl}/copilote`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/copilote#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Copilote IA', item: `${siteUrl}/copilote` },
          ],
        },
      ],
    }),
  },
};

export default function CopiloteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

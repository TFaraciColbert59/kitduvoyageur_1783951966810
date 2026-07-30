import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Publier',
  description: "Publiez votre contenu sur Le Kit du Voyageur : r\u00e9cits de voyage, guides pratiques, photos d'aventures et astuces \u00e9quipement.",
  alternates: {
    canonical: `${siteUrl}/publier`,
  },

  openGraph: {
    title: 'Publier',
    description: "Publiez votre contenu sur Le Kit du Voyageur : r\u00e9cits de voyage, guides pratiques, photos d'aventures et astuces \u00e9quipement.",
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/publier#webpage`,
          name: 'Publier — Le Kit du Voyageur',
          description: "Publiez votre contenu sur Le Kit du Voyageur : r\u00e9cits de voyage, guides pratiques, photos d'aventures et astuces \u00e9quipement.",
          url: `${siteUrl}/publier`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/publier#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Publier', item: `${siteUrl}/publier` },
          ],
        },
      ],
    }),
  },
};

export default function PublierLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

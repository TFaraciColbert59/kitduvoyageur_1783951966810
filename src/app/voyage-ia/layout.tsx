import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Voyage IA',
  description:
    "Planifiez votre voyage avec l'intelligence artificielle : itin\u00e9raire optimis\u00e9, budget pr\u00e9visionnel, \u00e9quipement recommand\u00e9 et formalit\u00e9s.",
  alternates: {
    canonical: `${siteUrl}/voyage-ia`,
  },

  openGraph: {
    title: 'Voyage IA',
    description:
      "Planifiez votre voyage avec l'intelligence artificielle : itin\u00e9raire optimis\u00e9, budget pr\u00e9visionnel, \u00e9quipement recommand\u00e9 et formalit\u00e9s.",
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/voyage-ia#webpage`,
          name: 'Voyage IA — Le Kit du Voyageur',
          description: "Planifiez votre voyage avec l'intelligence artificielle : itin\u00e9raire optimis\u00e9, budget pr\u00e9visionnel, \u00e9quipement recommand\u00e9.",
          url: `${siteUrl}/voyage-ia`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/voyage-ia#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Voyage IA', item: `${siteUrl}/voyage-ia` },
          ],
        },
      ],
    }),
  },
};

export default function VoyageIALayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

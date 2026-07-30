import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Abonnements Premium',
  description:
    "Choisissez votre abonnement : Explorer gratuit, Aventurier avec configurateur IA illimit\u00e9, ou Exp\u00e9dition avec box mensuelle. \u00c9quipement outdoor livr\u00e9 chaque mois.",
  alternates: {
    canonical: `${siteUrl}/abonnements`,
  },

  openGraph: {
    title: 'Abonnements Premium',
    description:
      "Choisissez votre abonnement : Explorer gratuit, Aventurier avec configurateur IA illimit\u00e9, ou Exp\u00e9dition avec box mensuelle. \u00c9quipement outdoor livr\u00e9 chaque mois.",
  },
  twitter: {
    title: 'Abonnements Premium',
    description:
      "Choisissez votre abonnement : Explorer gratuit, Aventurier avec configurateur IA illimit\u00e9, ou Exp\u00e9dition avec box mensuelle. \u00c9quipement outdoor livr\u00e9 chaque mois.",
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/abonnements#webpage`,
          name: "Abonnements Premium — Le Kit du Voyageur",
          description:
            "Choisissez votre abonnement : Explorer gratuit, Aventurier avec configurateur IA illimit\u00e9, ou Exp\u00e9dition avec box mensuelle.",
          url: `${siteUrl}/abonnements`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/abonnements#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Abonnements', item: `${siteUrl}/abonnements` },
          ],
        },
      ],
    }),
  },
};

export default function AbonnementsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

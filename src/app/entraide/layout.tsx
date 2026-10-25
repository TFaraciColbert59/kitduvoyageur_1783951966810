import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Entraide voyageurs',
  description: 'Plateforme d\u0027entraide entre voyageurs : posez vos questions, partagez vos astuces et exp\u00e9riences pour voyager mieux et plus l\u00e9ger.',
  alternates: {
    canonical: `${siteUrl}/entraide`,
  },

  openGraph: {
    title: 'Entraide voyageurs',
    description: 'Plateforme d\u0027entraide entre voyageurs : posez vos questions, partagez vos astuces et exp\u00e9riences pour voyager mieux et plus l\u00e9ger.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/entraide#webpage`,
          name: 'Entraide voyageurs — Le Kit du Voyageur',
          description: 'Plateforme d\u2019entraide entre voyageurs : posez vos questions, partagez vos astuces et exp\u00e9riences.',
          url: `${siteUrl}/entraide`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/entraide#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Entraide', item: `${siteUrl}/entraide` },
          ],
        },
      ],
    }),
  },
};

export default function EntraideLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Questions fr\u00e9quentes \u2014 Le Kit du Voyageur',
  description: 'Trouvez les r\u00e9ponses \u00e0 vos questions sur les commandes, livraisons, retours, le configurateur IA et votre compte.',
  alternates: {
    canonical: `${siteUrl}/faq`,
  },
  openGraph: {
    title: 'Questions fr\u00e9quentes \u2014 Le Kit du Voyageur',
    description: 'Trouvez les r\u00e9ponses \u00e0 vos questions sur les commandes, livraisons, retours, le configurateur IA et votre compte.',
    url: `${siteUrl}/faq`,
    type: 'website',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/faq#webpage`,
          name: 'Questions fr\u00e9quentes \u2014 Le Kit du Voyageur',
          description: 'Trouvez les r\u00e9ponses \u00e0 vos questions sur les commandes, livraisons, retours, le configurateur IA et votre compte.',
          url: `${siteUrl}/faq`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/faq#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'FAQ', item: `${siteUrl}/faq` },
          ],
        },
      ],
    }),
  },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

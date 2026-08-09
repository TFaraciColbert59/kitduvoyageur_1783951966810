import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Communaut\u00e9 Voyageurs & Aventuriers',
  description:
    'Rejoignez la communaut\u00e9 des voyageurs et aventuriers : publications, carnets de voyage, clubs, fils d\u2019actualit\u00e9 et \u00e9changes entre passionn\u00e9s d\u2019outdoor.',
  alternates: {
    canonical: `${siteUrl}/communaute`,
  },

  openGraph: {
    title: 'Communaut\u00e9 Voyageurs & Aventuriers',
    description:
      'Rejoignez la communaut\u00e9 des voyageurs et aventuriers : publications, carnets de voyage, clubs, fils d\u2019actualit\u00e9 et \u00e9changes entre passionn\u00e9s d\u2019outdoor.',
  },
  twitter: {
    title: 'Communaut\u00e9 Voyageurs & Aventuriers',
    description:
      'Rejoignez la communaut\u00e9 des voyageurs et aventuriers : publications, carnets de voyage, clubs, fils d\u2019actualit\u00e9 et \u00e9changes entre passionn\u00e9s d\u2019outdoor.',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/communaute#webpage`,
          name: 'Communaut\u00e9 Voyageurs & Aventuriers — Le Kit du Voyageur',
          description: 'Rejoignez la communaut\u00e9 des voyageurs et aventuriers : publications, carnets de voyage, clubs, \u00e9changes entre passionn\u00e9s d\u2019outdoor.',
          url: `${siteUrl}/communaute`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/communaute#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Communaut\u00e9', item: `${siteUrl}/communaute` },
          ],
        },
      ],
    }),
  },
};

export default function CommunauteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Guides & Checklists Outdoor — Le Kit du Voyageur',
  description: 'Conseils d\'experts, checklists téléchargeables et guides destination pour préparer chaque aventure avec précision.',
  alternates: {
    canonical: `${siteUrl}/guides`,
  },
  openGraph: {
    type: 'website',
    title: 'Guides & Checklists Outdoor',
    description: 'Conseils d\'experts, checklists téléchargeables et guides destination pour préparer chaque aventure.',
    url: `${siteUrl}/guides`,
    siteName: 'Le Kit du Voyageur',
    images: [{ url: `${siteUrl}/assets/images/og-image.png`, width: 1200, height: 630, alt: 'Guides outdoor Le Kit du Voyageur' }],
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${siteUrl}/guides#webpage`,
      name: 'Guides & Checklists Outdoor',
      description: 'Conseils d\'experts, checklists téléchargeables et guides destination pour préparer chaque aventure avec précision.',
      url: `${siteUrl}/guides`,
      isPartOf: { '@id': `${siteUrl}/#website` },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Guides', item: `${siteUrl}/guides` },
        ],
      },
    }),
  },
};

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

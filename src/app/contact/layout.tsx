import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    "Contactez l'équipe du Kit du Voyageur : support client, retours, partenariats B2B et données personnelles. Notre équipe répond sous 48 heures ouvrées.",
  alternates: {
    canonical: `${siteUrl}/contact`,
  },

  openGraph: {
    title: 'Contact',
    description:
      "Contactez l'équipe du Kit du Voyageur : support client, retours, partenariats B2B et données personnelles. Notre équipe répond sous 48 heures ouvrées.",
  },
  twitter: {
    title: 'Contact',
    description:
      "Contactez l'équipe du Kit du Voyageur : support client, retours, partenariats B2B et données personnelles. Notre équipe répond sous 48 heures ouvrées.",
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${siteUrl}/contact#webpage`,
          name: 'Contact — Le Kit du Voyageur',
          description:
            "Contactez l'équipe du Kit du Voyageur : support client, retours, partenariats B2B et données personnelles.",
          url: `${siteUrl}/contact`,
          isPartOf: { '@id': `${siteUrl}/#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${siteUrl}/contact#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Contact', item: `${siteUrl}/contact` },
          ],
        },
      ],
    }),
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

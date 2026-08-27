import React from 'react';
import CarteClient from './CarteClient';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata = {
  title: 'Carte Interactive - Le Kit du Voyageur',
  description: 'Explorez les tracés de randonnée, les refuges et les points d\'eau sur la carte interactive.',
};

export default function CarteInteractivePage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Carte Interactive — Le Kit du Voyageur',
    description: "Explorez les trac\u00e9s de randonn\u00e9e, les refuges et les points d'eau sur la carte interactive.",
    url: `${siteUrl}/carte-interactive`,
    isPartOf: { '@id': `${siteUrl}/#website` },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Carte Interactive', item: `${siteUrl}/carte-interactive` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} suppressHydrationWarning />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} suppressHydrationWarning />
      {/* DESKTOP */}
      <div className="hidden md:block">
        <CarteClient />
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell safeTop={false} hasBottomNav={false}>
          <CarteClient />
        </MobilePageShell>
      </div>
    </>
  );
}

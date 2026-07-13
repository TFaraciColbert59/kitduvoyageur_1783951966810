import React from 'react';
import type { Metadata } from 'next';
import HomePageClient from '@/app/components/HomePageClient';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Le Kit du Voyageur — Votre voyage commence par le bon sac',
  description: "L'IA qui analyse votre destination, votre style de voyage et votre équipement pour créer le kit parfait. Aucun oubli. Aucun surplus. Juste ce qu'il faut.",
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Le Kit du Voyageur — Votre voyage commence par le bon sac',
    description: "L'IA qui analyse votre destination, votre style de voyage et votre équipement pour créer le kit parfait.",
    url: siteUrl,
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Le Kit du Voyageur — Équipement outdoor intelligent',
      },
    ],
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Le Kit du Voyageur',
  url: siteUrl,
  logo: `${siteUrl}/assets/images/og-image.png`,
  description: "Plateforme d'équipement outdoor avec configurateur IA, fiches pays et outils de préparation voyage.",
  sameAs: [],
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Le Kit du Voyageur',
  url: siteUrl,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${siteUrl}/catalogue?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <HomePageClient />
    </>
  );
}
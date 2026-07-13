import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from '@/app/components/HeroSection';
import BelowFoldSections from '@/app/components/BelowFoldSections';
import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.com';

export const metadata: Metadata = {
  title: 'Le Kit du Voyageur — Équipement outdoor & Configurateur IA',
  description: 'Configurateur IA, équipement outdoor, fiches pays et outils terrain. La plateforme complète du voyageur et de l\'aventurier.',
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Le Kit du Voyageur — Équipement & Préparation',
    description: 'Configurez, achetez et préparez chaque voyage en un seul endroit.',
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
  description: 'Plateforme d\'équipement outdoor avec configurateur IA, fiches pays et outils de préparation voyage.',
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
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <Header />
      <div id="main-content">
        {/* Hero is critical — loaded eagerly */}
        <HeroSection />
        {/* Below-fold sections lazy loaded via client wrapper */}
        <BelowFoldSections />
      </div>
      <Footer />
    </main>
  );
}
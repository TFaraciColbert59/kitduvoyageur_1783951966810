import React from 'react';
import dynamic from 'next/dynamic';
import type { Metadata } from 'next';

// Static imports for above-the-fold critical components
import Header from '@/components/Header';
import HeroSection from '@/app/components/HeroSection';

// Dynamic imports for below-the-fold components — each gets its own webpack chunk
// This prevents the react-server-dom-webpack module factory collision
const VerifiedReviewsSection = dynamic(
  () => import('@/app/components/VerifiedReviewsSection'),
  { ssr: true }
);

const BelowFoldSections = dynamic(
  () => import('@/app/components/BelowFoldSections'),
  { ssr: true }
);

const Footer = dynamic(
  () => import('@/components/Footer'),
  { ssr: true }
);

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
        <HeroSection />
        <VerifiedReviewsSection />
        <BelowFoldSections />
      </div>
      <Footer />
    </main>
  );
}
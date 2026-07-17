import { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Hero from '@/components/home/Hero';
import BentoGrid from '@/components/home/BentoGrid';
import TrailOfTheDay from '@/components/home/TrailOfTheDay';
import TrustCounters from '@/components/home/TrustCounters';
import FeaturedJournal from '@/components/home/FeaturedJournal';
import QuickStartQuiz from '@/components/home/QuickStartQuiz';
import FinalCTA from '@/components/home/FinalCTA';
import { getTrailOfDay, getTrustStats, getFeaturedCarnets } from '@/lib/home-queries';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Le Kit du Voyageur — Équipement outdoor & aventure',
  description:
    'Configurez votre kit de voyage parfait avec notre IA. Équipements outdoor vérifiés, kits prêts à partir, communauté de voyageurs passionnés.',
  url: siteUrl,
  image: `${siteUrl}/assets/images/og-image.png`,
  isPartOf: {
    '@type': 'WebSite',
    name: 'Le Kit du Voyageur',
    url: siteUrl,
  },
};

export const metadata = {
  title: 'Le Kit du Voyageur — Équipement outdoor & aventure',
  description:
    'Configurez votre kit de voyage parfait avec notre IA. Équipements outdoor vérifiés, kits prêts à partir, communauté de voyageurs passionnés.',
  other: {
    'script:ld+json': JSON.stringify(webPageSchema),
  },
};

// Revalidation: trail daily, stats hourly, carnets hourly
export const revalidate = 3600;

export default async function HomePage() {
  // Fetch all data in parallel — each query handles its own errors gracefully
  const [trail, stats, carnets] = await Promise.all([
    getTrailOfDay(),
    getTrustStats(),
    getFeaturedCarnets(),
  ]);

  return (
    <>
      <Header />
      <main id="main-content" className="min-h-screen" style={{ background: 'var(--background)' }}>
        {/* 1. HERO — full-screen map background + search */}
        <Hero />

        {/* 2. BENTO GRID — asymmetric desktop / carousel mobile */}
        <BentoGrid />

        {/* 3. QUICK START QUIZ — inline desktop / bottom-sheet mobile */}
        <QuickStartQuiz />

        {/* 4. SENTIER DU JOUR — hidden if no data */}
        <Suspense fallback={null}>
          <TrailOfTheDay trail={trail} />
        </Suspense>

        {/* 5. TRUST COUNTERS — animated on scroll */}
        <TrustCounters stats={stats} />

        {/* 6. FEATURED JOURNAL — carnets with editorial fallback */}
        <FeaturedJournal carnets={carnets} />

        {/* 7. FINAL CTA — summit */}
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}

'use client';

import { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HomepageV1 from '@/app/components/HomepageV1';
import MobileHomePage from '@/components/mobile-nav/MobileHomePage';
import type { TrailOfDay, TrustStats, FeaturedCarnet } from '@/lib/home-queries';

interface HomePageClientProps {
  trail: TrailOfDay | null;
  stats: TrustStats;
  carnets: FeaturedCarnet[];
}

export default function HomePageClient({ trail, stats, carnets }: HomePageClientProps) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <Header />
      </div>
      <main id="main-content" className="min-h-screen hidden md:block" style={{ background: 'var(--background)' }}>
        <Suspense fallback={null}>
          <HomepageV1 stats={stats} carnets={carnets} />
        </Suspense>
      </main>
      <div className="hidden md:block">
        <Footer />
      </div>

      {/* Mobile — premium refonte */}
      <div className="md:hidden">
        <MobileHomePage />
      </div>
    </>
  );
}

'use client';

import { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HomepageV1 from '@/app/components/HomepageV1';
import MobileHomePage from '@/components/mobile-nav/MobileHomePage';

export default function HomePageClient({
  trail,
  stats,
  carnets,
}: {
  trail: Awaited<ReturnType<typeof import('@/lib/home-queries').getTrailOfDay>>;
  stats: Awaited<ReturnType<typeof import('@/lib/home-queries').getTrustStats>>;
  carnets: Awaited<ReturnType<typeof import('@/lib/home-queries').getFeaturedCarnets>>;
}) {
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

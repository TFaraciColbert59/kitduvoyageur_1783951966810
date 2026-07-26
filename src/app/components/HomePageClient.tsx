'use client';

import { Suspense } from 'react';
import Header from '@/components/Header';
import NewHomepage from '@/app/components/NewHomepage';
import NewMobileHomepage from '@/app/components/NewMobileHomepage';
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
          <NewHomepage stats={stats} carnets={carnets} />
        </Suspense>
      </main>

      {/* Mobile */}
      <div className="md:hidden">
        <NewMobileHomepage />
      </div>
    </>
  );
}

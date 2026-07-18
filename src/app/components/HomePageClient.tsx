'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

// Mobile redirect — runs before any desktop content is rendered
function MobileRedirect() {
  const router = useRouter();

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
    if (isMobile || isPWA) {
      router.replace('/explorer');
    }
  }, [router]);

  return null;
}

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
      {/* Mobile redirect — no flash: renders nothing on mobile, redirects immediately */}
      <MobileRedirect />

      {/* Desktop content — hidden on mobile via CSS to prevent flash */}
      <div className="hidden md:block">
        <Header />
      </div>
      <main id="main-content" className="min-h-screen hidden md:block" style={{ background: 'var(--background)' }}>
        <Hero />
        <BentoGrid />
        <QuickStartQuiz />
        <Suspense fallback={null}>
          <TrailOfTheDay trail={trail} />
        </Suspense>
        <TrustCounters stats={stats} />
        <FeaturedJournal carnets={carnets} />
        <FinalCTA />
      </main>
      <div className="hidden md:block">
        <Footer />
      </div>
    </>
  );
}

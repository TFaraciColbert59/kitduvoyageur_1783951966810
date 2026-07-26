'use client';

import React from 'react';
import type { TrustStats, FeaturedCarnet } from '@/lib/home-queries';
import NewHeroSection from '@/app/components/home/NewHeroSection';
import NewAdventuresSection from '@/app/components/home/NewAdventuresSection';
import NewPromiseSection from '@/app/components/home/NewPromiseSection';
import NewFeaturedProductSection from '@/app/components/home/NewFeaturedProductSection';
import NewFooterSection from '@/app/components/home/NewFooterSection';

interface NewHomepageProps {
  stats: TrustStats;
  carnets: FeaturedCarnet[];
}

export default function NewHomepage({ stats, carnets }: NewHomepageProps) {
  return (
    <>
      <NewHeroSection />
      <NewAdventuresSection />
      <NewPromiseSection />
      <NewFeaturedProductSection />
      <NewFooterSection />
    </>
  );
}

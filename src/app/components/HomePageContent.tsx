'use client';

import React from 'react';
import HomeHeroSection from '@/app/components/home/HomeHeroSection';
import HomeConfiguratorSection from '@/app/components/home/HomeConfiguratorSection';
import HomeBeforeAfterSection from '@/app/components/home/HomeBeforeAfterSection';
import HomePopularKitsSection from '@/app/components/home/HomePopularKitsSection';
import HomeMarketplaceSection from '@/app/components/home/HomeMarketplaceSection';
import HomeTrustScoreSection from '@/app/components/home/HomeTrustScoreSection';
import HomeVisionSection from '@/app/components/home/HomeVisionSection';
import HomepageFooterSection from '@/app/components/home/HomepageFooterSection';

export default function HomePageContent() {
  return (
    <main>
      <HomeHeroSection />
      <HomeConfiguratorSection />
      <HomeBeforeAfterSection />
      <HomePopularKitsSection />
      <HomeMarketplaceSection />
      <HomeTrustScoreSection />
      <HomeVisionSection />
      <HomepageFooterSection />
    </main>
  );
}

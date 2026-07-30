'use client';

import React from 'react';
import HomeHeroSection from '@/components/home/HomeHeroSection';
import QuickGrid from '@/components/home/QuickGrid';
import EditorialCard from '@/components/home/EditorialCard';
import StatsRow from '@/components/home/StatsRow';
import StripCTA from '@/components/home/StripCTA';

export default function MobileHomePage() {
  return (
    <div style={{ background: '#FBFAF6', minHeight: '100vh' }}>
      <HomeHeroSection />
      <QuickGrid />
      <EditorialCard
        title="Six semaines, quatre saisons."
        subtitle="Comment nous testons chaque objet avant de le référencer."
      />
      <StatsRow />
      <StripCTA />
      {/* Footer spacer for bottom tab bar */}
      
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

import MobileDrawer from '@/components/mobile-nav/MobileDrawer';
import OfflineBanner from '@/components/mobile-nav/OfflineBanner';
import SearchOverlay from '@/components/search/SearchOverlay';
import { useSearchContext } from '@/contexts/SearchContext';

const BottomTabBar = dynamic(() => import('@/components/mobile-nav/BottomTabBar'), {
  ssr: false,
});

export default function MobileNavWrapper() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { openSearch } = useSearchContext();
  const pathname = usePathname();

  // Hide general top site navigation on map-heavy views to allow full-screen map focus
  const isMapHeavyRoute = 
    pathname?.startsWith('/randonnee-active') || 
    pathname?.startsWith('/materiel/depart') || 
    pathname?.startsWith('/carte-interactive');

  if (isMapHeavyRoute) {
    return (
      <>
        <BottomTabBar />
        <OfflineBanner />
      </>
    );
  }

  return (
    <>
      <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} onSearchOpen={openSearch} />
      <BottomTabBar />
      <SearchOverlay />
      <OfflineBanner />
    </>
  );
}

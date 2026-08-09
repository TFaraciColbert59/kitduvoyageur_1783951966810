'use client';

import React, { useState } from 'react';
import BottomTabBar from '@/components/mobile-nav/BottomTabBar';
import MobileDrawer from '@/components/mobile-nav/MobileDrawer';
import OfflineBanner from '@/components/mobile-nav/OfflineBanner';
import SearchOverlay from '@/components/search/SearchOverlay';
import TopBar from '@/components/mobile-nav/TopBar';
import { useSearchContext } from '@/contexts/SearchContext';

export default function MobileNavWrapper() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { openSearch } = useSearchContext();

  return (
    <>
      <TopBar 
        onMenuOpen={() => setDrawerOpen(true)} 
        onSearchOpen={openSearch}
        isMenuOpen={drawerOpen}
      />
      <BottomTabBar />
      <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <SearchOverlay />
      <OfflineBanner />
    </>
  );
}

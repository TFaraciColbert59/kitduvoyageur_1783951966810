'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import BottomTabBar from '@/components/mobile-nav/BottomTabBar';
import MobileDrawer from '@/components/mobile-nav/MobileDrawer';
import OfflineBanner from '@/components/mobile-nav/OfflineBanner';
import SearchOverlay from '@/components/search/SearchOverlay';
import LkvIcon from '@/components/ui/LkvIcon';
import { useSearchContext } from '@/contexts/SearchContext';

export default function MobileNavWrapper() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { openSearch } = useSearchContext();
  const pathname = usePathname();

  // Hide general top site navigation on map-heavy views to allow full-screen map focus
  const isMapHeavyRoute = 
    pathname?.startsWith('/randonnee-active') || 
    pathname?.startsWith('/preparer-randonnee') || 
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
      <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      aria-label="Ouvrir le menu"
      className="md:hidden fixed left-4 z-40 flex items-center justify-center rounded-full"
      style={{
        top: 'calc(10px + env(safe-area-inset-top))',
        width: '44px',
        height: '44px',
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(11,31,23,0.08)',
        boxShadow: '0 4px 14px rgba(11,31,23,0.08)',
        color: '#0B1F17',
        cursor: 'pointer',
        touchAction: 'manipulation',
      }}
    >
      <LkvIcon name="menu" size={20} />
    </button>
      <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} onSearchOpen={openSearch} />
      <BottomTabBar />
      <SearchOverlay />
      <OfflineBanner />
    </>
  );
}

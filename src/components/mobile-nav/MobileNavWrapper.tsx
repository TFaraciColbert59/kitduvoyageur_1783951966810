'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

import MobileDrawer from '@/components/mobile-nav/MobileDrawer';
import OfflineBanner from '@/components/mobile-nav/OfflineBanner';
import SearchOverlay from '@/components/search/SearchOverlay';
import { HUB_DEPART_HREF } from '@/features/hub/registry/hubSectionRegistry';
import { useSearchContext } from '@/contexts/SearchContext';

const NavigationBar = dynamic(() => import('@/components/mobile-nav/NavigationBar'), {
  ssr: false,
});

export default function MobileNavWrapper() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { openSearch } = useSearchContext();
  const pathname = usePathname();

  // Masquer la navigation mobile sur les pages d'authentification pour éviter tout chevauchement avec le clavier ou le formulaire
  const isAuthRoute =
    pathname?.startsWith('/connexion') ||
    pathname?.startsWith('/inscription');

  if (isAuthRoute) {
    return <OfflineBanner />;
  }

  // Hide general top site navigation on map-heavy views to allow full-screen map focus
  const isMapHeavyRoute = 
    pathname?.startsWith('/randonnee-active') || 
    pathname?.startsWith(HUB_DEPART_HREF) || 
    pathname?.startsWith('/carte-interactive');

  if (isMapHeavyRoute) {
    return (
      <>
        <NavigationBar />
        <OfflineBanner />
      </>
    );
  }

  return (
    <>
      <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} onSearchOpen={openSearch} />
      <NavigationBar />
      <SearchOverlay />
      <OfflineBanner />
    </>
  );
}

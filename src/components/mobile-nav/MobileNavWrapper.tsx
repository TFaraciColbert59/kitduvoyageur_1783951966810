'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

import OfflineBanner from '@/components/mobile-nav/OfflineBanner';
import NavigationSurface from '@/components/mobile-nav/navigation/NavigationSurface';
import SearchOverlay from '@/components/search/SearchOverlay';
import { HUB_DEPART_HREF } from '@/features/hub/registry/hubSectionRegistry';
import { useSearchContext } from '@/contexts/SearchContext';

const NavigationBar = dynamic(() => import('@/components/mobile-nav/NavigationBar'), {
  ssr: false,
  loading: () => null,
});

export default function MobileNavWrapper() {
  useSearchContext();
  const pathname = usePathname();

  // La barre globale est désormais l'unique barre basse de l'application.
  // Seules les pages d'authentification et de checkout la masquent.
  const isNoNavRoute =
    pathname?.startsWith('/connexion') ||
    pathname?.startsWith('/inscription') ||
    pathname?.startsWith('/checkout');

  if (isNoNavRoute) {
    return <OfflineBanner />;
  }

  // Hide general top site navigation on map-heavy views to allow full-screen map focus
  const isMapHeavyRoute = 
    pathname?.startsWith('/explorer') || 
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
      <NavigationBar />
      <SearchOverlay />
      <OfflineBanner />
    </>
  );
}

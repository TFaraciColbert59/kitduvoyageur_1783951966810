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
  loading: () => <NavigationSurface loading label="Chargement de la navigation" />,
});

export default function MobileNavWrapper() {
  useSearchContext();
  const pathname = usePathname();

  // Masquer la navigation mobile sur les pages d'authentification et de checkout pour éviter tout chevauchement
  const isNoNavRoute =
    pathname?.startsWith('/connexion') ||
    pathname?.startsWith('/inscription') ||
    pathname?.startsWith('/checkout') ||
    // Laboratoire de la barre : elle y est rendue dans la maquette iPhone.
    pathname?.startsWith('/dev/bottombar-ios27') ||
    // A Reel is a true full-screen viewer with its own close/back controls.
    // Never overlay the shared web OR Capacitor tab bar on its media.
    pathname === '/communaute/reels' ||
    pathname?.startsWith('/communaute/reels/') ||
    // Carte vivante 3D plein écran immersive avec scrubber d'altitude
    pathname === '/carte-3d' ||
    pathname?.startsWith('/carte-3d');

  if (isNoNavRoute) {
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
      <NavigationBar />
      <SearchOverlay />
      <OfflineBanner />
    </>
  );
}

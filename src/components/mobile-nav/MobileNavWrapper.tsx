'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

import OfflineBanner from '@/components/mobile-nav/OfflineBanner';
import { HUB_DEPART_HREF } from '@/features/hub/registry/hubSectionRegistry';
import { useSearchContext } from '@/contexts/SearchContext';

const NavigationBar = dynamic(() => import('@/components/mobile-nav/NavigationBar'), {
  ssr: false,
  loading: () => null,
});

const SearchOverlay = dynamic(() => import('@/components/search/SearchOverlay'), {
  ssr: false,
  loading: () => null,
});

export default function MobileNavWrapper() {
  const { isSearchOpen } = useSearchContext();
  const [searchMounted, setSearchMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (isSearchOpen) setSearchMounted(true);
  }, [isSearchOpen]);

  // Masquer la navigation mobile uniquement sur les flux immersifs plein écran
  // (authentification, tunnels de commande, lecteur plein écran vertical et carte 3D).
  // Toutes les autres pages (Communauté, Compte, Hub, Explorer, Messagerie, Pays, Clubs, Profil, Carnets)
  // partagent la barre unique iOS 27 Liquid Glass.
  const isNoNavRoute =
    pathname?.startsWith('/connexion') ||
    pathname?.startsWith('/inscription') ||
    pathname?.startsWith('/checkout') ||
    // Reel plein écran immersif avec ses propres commandes
    pathname === '/communaute/reels' ||
    pathname?.startsWith('/communaute/reels/') ||
    // Carte vivante 3D plein écran immersive
    pathname === '/carte-3d' ||
    pathname?.startsWith('/carte-3d') ||
    // Kit Studio : scène 3D plein écran avec son propre tiroir
    pathname === '/kit-studio' ||
    pathname?.startsWith('/kit-studio/');

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
      {searchMounted ? <SearchOverlay /> : null}
      <OfflineBanner />
    </>
  );
}

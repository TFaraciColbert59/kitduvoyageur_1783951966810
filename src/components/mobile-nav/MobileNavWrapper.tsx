'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

import OfflineBanner from '@/components/mobile-nav/OfflineBanner';
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

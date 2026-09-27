'use client';

import React, { useState } from 'react';
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
  const { openSearch } = useSearchContext();
  const pathname = usePathname();

  // Masquer la navigation mobile sur les pages d'authentification et de checkout pour éviter tout chevauchement
  const isNoNavRoute =
    pathname?.startsWith('/connexion') ||
    pathname?.startsWith('/inscription') ||
    pathname?.startsWith('/checkout') ||
    // '/prepare' n'est PLUS dans cette liste : le preparateur d'aventure doit
    // garder la barre d'onglets. Elle en etait retiree parce que le flux
    // occupe tout l'ecran, mais l'effet reel etait l'inverse de l'intention —
    // aucun moyen de quitter l'ecran, puisque AppShell ne rend que la
    // reservation de place et jamais la barre elle-meme. Voir
    // AdventurePrepScreen.
    // Égalité stricte conservee pour les autres routes '/prepare*' :
    // '/preparer-randonnee' et '/preparer-sentier' gardent leur navigation.
    pathname?.startsWith('/communaute/publier');

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

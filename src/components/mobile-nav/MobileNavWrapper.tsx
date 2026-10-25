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
    pathname?.startsWith('/checkout') ||
    pathname === '/compte' ||
    pathname?.startsWith('/compte') ||
    pathname === '/clubs' ||
    pathname?.startsWith('/clubs') ||
    pathname === '/profil' ||
    pathname?.startsWith('/profil') ||
    // La fiche carnet porte sa propre top bar et la barre basse du Compte.
    pathname?.startsWith('/carnets/') ||
    // Le preparateur d'aventure doit
    // garder la barre d'onglets. Elle en etait retiree parce que le flux
    // occupe tout l'ecran, mais l'effet reel etait l'inverse de l'intention —
    // aucun moyen de quitter l'ecran, puisque AppShell ne rend que la
    // reservation de place et jamais la barre elle-meme. Voir
    // AdventurePrepScreen.
    // Les routes de preparation gardent leur navigation.
    // Fiche carnet : la page porte sa propre top bar et la barre basse du Compte.
    // Sans cela, le plateau contextuel « Récit / Carte & GPX… » et la barre
    // globale se superposent aux contrôles de la fiche (constaté en recette).
    (pathname?.startsWith('/communaute/') && !pathname.startsWith('/communaute')) ||
    pathname === '/communaute' ||
    // A Reel is a true full-screen viewer with its own close/back controls.
    // Never overlay the shared web OR Capacitor tab bar on its media.
    pathname === '/communaute' ||
    pathname?.startsWith('/communaute/');

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

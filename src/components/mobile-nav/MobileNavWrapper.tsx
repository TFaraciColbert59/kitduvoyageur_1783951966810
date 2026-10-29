'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

import OfflineBanner from '@/components/mobile-nav/OfflineBanner';
import FloatingLiquidTabBar from '@/components/mobile-nav/FloatingLiquidTabBar';
import TabSwipeNavigator from '@/components/mobile-nav/TabSwipeNavigator';
import SearchOverlay from '@/components/search/SearchOverlay';
import { HUB_DEPART_HREF } from '@/features/hub/registry/hubSectionRegistry';
import { useSearchContext } from '@/contexts/SearchContext';

const NavigationBar = dynamic(() => import('@/components/mobile-nav/NavigationBar'), {
  ssr: false,
  // Même barre que le rendu final : aucun changement visuel au chargement.
  loading: () => <FloatingLiquidTabBar />,
});

export default function MobileNavWrapper() {
  useSearchContext();
  const pathname = usePathname();

  // Masquer la navigation mobile sur les pages d'authentification et de checkout pour éviter tout chevauchement
  const isNoNavRoute =
    pathname?.startsWith('/connexion') ||
    pathname?.startsWith('/inscription') ||
    pathname?.startsWith('/checkout') ||
    // Clubs et profils publics gardent la barre unique de l'app (iOS 27) :
    // leurs anciennes barres intégrées ne sont plus affichées.
    // '/prepare' n'est PLUS dans cette liste : le preparateur d'aventure doit
    // garder la barre d'onglets. Elle en etait retiree parce que le flux
    // occupe tout l'ecran, mais l'effet reel etait l'inverse de l'intention —
    // aucun moyen de quitter l'ecran, puisque AppShell ne rend que la
    // reservation de place et jamais la barre elle-meme. Voir
    // AdventurePrepScreen.
    // Égalité stricte conservee pour les autres routes '/prepare*' :
    // '/preparer-randonnee' et '/preparer-sentier' gardent leur navigation.
    // A Reel is a true full-screen viewer with its own close/back controls.
    // Never overlay the shared web OR Capacitor tab bar on its media.
    pathname === '/communaute/reels' ||
    pathname?.startsWith('/communaute/reels/') ||
    // Carte vivante 3D plein écran immersive avec scrubber d'altitude
    pathname === '/carte-3d' ||
    pathname?.startsWith('/carte-3d') ||
    // Explorer v2 : la page porte sa propre barre basse (une seule barre visible,
    // 00_MISSION §8) — la barre globale est masquée pour éviter le doublon.
    pathname === '/explorer';


  // Hide general top site navigation on map-heavy views to allow full-screen map focus
  const isMapHeavyRoute = 
    pathname?.startsWith('/randonnee-active') || 
    pathname?.startsWith(HUB_DEPART_HREF) || 
    pathname?.startsWith('/carte-interactive');

  // La barre reste montée en permanence (une seule instance, détachée des
  // pages) : changer de page ne la démonte jamais. Les routes plein écran la
  // masquent par CSS seulement.
  return (
    <>
      <div style={{ display: isNoNavRoute ? 'none' : 'contents' }} data-persistent-nav>
        <NavigationBar />
      </div>
      {!isNoNavRoute && <TabSwipeNavigator />}
      {!isNoNavRoute && !isMapHeavyRoute && <SearchOverlay />}
      <OfflineBanner />
    </>
  );
}

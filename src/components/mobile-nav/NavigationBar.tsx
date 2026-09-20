'use client';

import BottomTabBar from './BottomTabBar';

/**
 * NavigationBar — contrat unique de la navigation principale (Phase 2, Lot 2).
 *
 * Une seule barre active à la fois :
 * - `WebNavigationBar` : `BottomTabBar` (implémentation actuelle, WebView) ;
 * - `NativeNavigationBar` : UITabBar via plugin Capacitor — NON branchée.
 *
 * Le drapeau `NATIVE_TABBAR_ENABLED` reste désactivé tant que l'intégration
 * UIKit n'est pas vérifiée sur macOS (voir BOTTOM_BAR_ARCHITECTURE.md §5).
 * Toute bascule se fait ici, jamais dans les pages.
 */
export const NATIVE_TABBAR_ENABLED = false;

export default function NavigationBar() {
  return <BottomTabBar />;
}

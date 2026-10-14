'use client';

import WebNavigationBar from './navigation/WebNavigationBar';

/**
 * NavigationBar — contrat unique de la navigation principale (Phase 2, Lot 2).
 *
 * Une seule barre active à la fois :
 * - `WebNavigationBar` : implémentation actuelle (assemblage `navigation/`), WebView ;
 * - barre native iOS (UITabBar Liquid Glass via plugin Capacitor `NativeTabBar`)
 *   : POC sur branche `feature/ios-native-liquid-glass-tabbar`, pilotée par
 *   `NativeTabBarBridge` (monté dans `MobileNavWrapper`).
 *
 * Le drapeau `NATIVE_TABBAR_ENABLED` reste désactivé : le POC s'active
 * uniquement au runtime sur iOS natif via `lkdv:native-tabbar=1` (localStorage
 * ou `?native-tabbar=1`, voir `src/lib/native/tabBar.ts`). Rollback = retirer
 * le flag. Toute bascule se fait ici et dans le pont, jamais dans les pages.
 */
export const NATIVE_TABBAR_ENABLED = false;

export default function NavigationBar() {
  return <WebNavigationBar />;
}

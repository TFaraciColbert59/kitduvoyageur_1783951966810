'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  addNativeTabSelectedListener,
  hrefForTabId,
  isNativeTabBarHiddenRoute,
  isNativeTabBarSupported,
  setNativeSelectedTab,
  setNativeTabBarEnabled,
  setNativeTabBarVisible,
  tabIdForPathname,
} from '@/lib/native/tabBar';

/**
 * NativeTabBarBridge — pont bidirectionnel POC (iOS natif uniquement).
 *
 * Monté UNE fois dans `MobileNavWrapper` (toutes routes, y compris no-nav) :
 * - tap iOS → `router.push(href)` dans l'unique WebView (jamais window.location,
 *   jamais de rechargement) ;
 * - route React → `setSelectedTab(id)` (deep link `lkdv://`, retour, URL directe
 *   et réouverture couverts par l'effet pathname) ;
 * - no-nav routes (auth/checkout/publication) + `lkdv-toggle-bottom-bar` →
 *   `setVisible(false)` côté natif ;
 * - listeners retirés à la destruction.
 *
 * Repli : hors `isNativeTabBarSupported()` (web/PWA/Android, iOS flag OFF),
 * le composant ne fait strictement rien — ni style, ni dataset, ni appel plugin.
 * La barre web reste alors l'unique navigation, inchangée.
 *
 * Masquage web ciblé (flag ON seulement) : un `<style>` scopé
 * `html[data-native-tabbar="true"] nav.lkv-nav-surface .lkv-material-bar`
 * masque la rangée d'onglets web (pas de double barre) tout en conservant
 * plateaux secondaires, overlays, réservation `--bottom-nav-height` et
 * interactions existantes.
 */
const BRIDGE_STYLE_ID = 'lkdv-native-tabbar-bridge-style';
const BRIDGE_STYLE_CSS = [
  'html[data-native-tabbar="true"] nav.lkv-nav-surface .lkv-material-bar{display:none!important;}',
  'html[data-native-tabbar="true"] nav.lkv-nav-surface .lkv-nav-loading-dot{display:none!important;}',
].join('\n');

function ensureBridgeStyle(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(BRIDGE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BRIDGE_STYLE_ID;
  style.setAttribute('data-lkdv', 'native-tabbar-poc');
  style.textContent = BRIDGE_STYLE_CSS;
  document.head.appendChild(style);
}

function removeBridgeStyle(): void {
  if (typeof document === 'undefined') return;
  document.getElementById(BRIDGE_STYLE_ID)?.remove();
}

export default function NativeTabBarBridge() {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef<string | null>(null);
  pathnameRef.current = pathname;
  const hiddenByEventRef = useRef(false);
  const supportedRef = useRef<boolean | null>(null);

  // Montage unique : activation native + abonnement tap + style de masquage.
  useEffect(() => {
    if (!isNativeTabBarSupported()) {
      supportedRef.current = false;
      return;
    }
    supportedRef.current = true;
    let disposed = false;
    let removeTapListener: (() => void) | null = null;

    document.documentElement.dataset.nativeTabbar = 'true';
    ensureBridgeStyle();
    setNativeTabBarEnabled(true).catch(() => {});

    addNativeTabSelectedListener((tabId) => {
      const href = hrefForTabId(tabId);
      if (!href) return;
      // Pas de re-push sur l'onglet courant (évite les boucles + re-rendus).
      if (pathnameRef.current === href) return;
      router.push(href);
    }).then((remove) => {
      if (disposed) {
        remove();
        return;
      }
      removeTapListener = remove;
    }).catch(() => {});

    const onToggleBar = (event: Event) => {
      const hide = (event as CustomEvent<{ hide?: boolean }>).detail?.hide ?? false;
      hiddenByEventRef.current = hide === true;
      const hiddenRoute = isNativeTabBarHiddenRoute(pathnameRef.current);
      setNativeTabBarVisible(!hide && !hiddenRoute).catch(() => {});
    };
    window.addEventListener('lkdv-toggle-bottom-bar', onToggleBar);

    return () => {
      disposed = true;
      window.removeEventListener('lkdv-toggle-bottom-bar', onToggleBar);
      try {
        removeTapListener?.();
      } catch {
      }
      delete document.documentElement.dataset.nativeTabbar;
      removeBridgeStyle();
      // Retour instantané à la barre web (rollback) : le natif se désactive.
      setNativeTabBarEnabled(false).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync route → tab natif + visibilité (navigation in-page, deep link, retour).
  useEffect(() => {
    if (supportedRef.current === false) return;
    if (!isNativeTabBarSupported()) return;
    const tabId = tabIdForPathname(pathname);
    if (tabId) {
      setNativeSelectedTab(tabId).catch(() => {});
    }
    const visible = !isNativeTabBarHiddenRoute(pathname) && !hiddenByEventRef.current;
    setNativeTabBarVisible(visible).catch(() => {});
  }, [pathname]);

  return null;
}

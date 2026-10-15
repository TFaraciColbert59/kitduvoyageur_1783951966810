'use client';

import { useEffect, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

import OfflineBanner from '@/components/mobile-nav/OfflineBanner';
import SearchOverlay from '@/components/search/SearchOverlay';
import { HUB_DEPART_HREF } from '@/features/hub/registry/hubSectionRegistry';
import { isProtectedCompasRoute } from '@/components/mobile-nav/nativeAccountRoutes';

const NavigationBar = dynamic(() => import('@/components/mobile-nav/NavigationBar'), {
  ssr: false,
  loading: () => null,
});

export default function MobileNavWrapper() {
  const pathname = usePathname();

  // The global scenic canvas is inserted by root layout, not by individual
  // pages. Gate its opt-out in one place on every route change. useLayoutEffect
  // prevents a paint with cleanup styles on /compas during navigation.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (isProtectedCompasRoute(pathname)) root.removeAttribute('data-lkdv-clean-ui');
    else root.setAttribute('data-lkdv-clean-ui', '');
    return () => { root.removeAttribute('data-lkdv-clean-ui'); };
  }, [pathname]);

  // Any visible modal is above the web content and must hide the separate
  // UIKit bottom bar. Observe dialog changes once, throttled by animation
  // frame. The policy is entirely disabled on /compas.
  useEffect(() => {
    if (isProtectedCompasRoute(pathname)) return;
    let scheduled = 0;
    let modalOpen = false;
    const dispatch = (hide: boolean) => {
      window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', {
        detail: { hide, source: 'modal-observer' },
      }));
    };
    const scan = () => {
      scheduled = 0;
      const elements = document.querySelectorAll<HTMLElement>(
        '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"], dialog[open]',
      );
      const open = Array.from(elements).some((element) =>
        element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== 'hidden' &&
        element.getAttribute('data-state') !== 'closed',
      );
      if (open !== modalOpen) {
        modalOpen = open;
        dispatch(open);
      }
    };
    const observer = new MutationObserver(() => {
      if (!scheduled) scheduled = requestAnimationFrame(scan);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-modal', 'data-state', 'open', 'class', 'style', 'hidden'],
    });
    scan();
    return () => {
      observer.disconnect();
      if (scheduled) cancelAnimationFrame(scheduled);
      if (modalOpen) dispatch(false);
    };
  }, [pathname]);

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
    // Keep the bridge mounted so it explicitly hides UIKit for full-screen
    // auth/checkout/composer pages. An early return left the old native rail
    // visible while React remounted it with revision 0 on login.
    return (
      <>
        <NavigationBar />
        <OfflineBanner />
      </>
    );
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

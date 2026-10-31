'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { DESTINATIONS } from '@/components/mobile-nav/destinationRegistry';

const TAB_ROOTS = new Set(DESTINATIONS.map((destination) => destination.href));

/**
 * P1-3 (C-17) — Transition de page en CSS pur : framer-motion sort du graphe
 * du layout racine (exclu du bundle partagé des 272 routes). Courbe, durée et
 * prefers-reduced-motion identiques à l'ancienne version framer-motion
 * (opacité 0.92 -> 1, 80 ms, var(--ease-out)) — keyframes dans
 * globals.css (classe .lkv-page-fade).
 *
 * Les cinq onglets de la barre du bas changent sans aucun fondu, comme sur
 * Instagram : la page apparaît telle quelle (le glisser horizontal entre
 * onglets est porté par TabSwipeNavigator).
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const instant = pathname ? TAB_ROOTS.has(pathname) : false;

  return (
    <div
      key={pathname}
      data-page-root=""
      className={`w-full h-full min-h-full${instant ? '' : ' lkv-page-fade'}`}
    >
      {children}
    </div>
  );
}

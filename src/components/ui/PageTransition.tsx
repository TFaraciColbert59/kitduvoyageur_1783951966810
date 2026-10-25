'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

/**
 * P1-3 (C-17) — Transition de page en CSS pur : framer-motion sort du graphe
 * du layout racine (exclu du bundle partagé des 272 routes). Courbe, durée et
 * prefers-reduced-motion identiques à l'ancienne version framer-motion
 * (opacité 0.92 -> 1, 80 ms, cubic-bezier(.16,1,.3,1)) — keyframes dans
 * globals.css (classe .lkv-page-fade).
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="w-full h-full min-h-full lkv-page-fade">
      {children}
    </div>
  );
}

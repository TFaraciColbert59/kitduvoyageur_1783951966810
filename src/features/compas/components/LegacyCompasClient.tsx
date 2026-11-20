'use client';

import dynamic from 'next/dynamic';

/**
 * Chargeurs dynamiques côté client pour l'ancien Compas v4 (`?v5=0`).
 * Évite que Next.js n'inscrive les chunks v4 (~170 Ko gzip) dans le manifeste
 * initial de `/compas` quand l'écran v5 par défaut est servi.
 */
export const LegacyCompasScreen = dynamic(
  () => import('./CompasScreen').then((m) => ({ default: m.CompasScreen })),
  { ssr: false },
);

export const LegacyCompasStart = dynamic(
  () => import('./CompasStart').then((m) => ({ default: m.CompasStart })),
  { ssr: false },
);

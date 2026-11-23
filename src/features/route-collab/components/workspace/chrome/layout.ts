'use client';

import { useSyncExternalStore } from 'react';

/**
 * Mise en page selon la largeur (4.9) : téléphone = carte + tiroir en bas ; tablette (≥ 640 px) = deux colonnes
 * (carte, détail) ; bureau (≥ 1 024 px) = trois colonnes (étapes, carte, détail) côte à côte.
 */
export type RouteLayout = 'mobile' | 'tablet' | 'desktop';

export const TABLET_MIN_PX = 640;
export const DESKTOP_MIN_PX = 1024;

export function layoutForWidth(width: number): RouteLayout {
  if (width >= DESKTOP_MIN_PX) return 'desktop';
  if (width >= TABLET_MIN_PX) return 'tablet';
  return 'mobile';
}

const QUERIES = [`(min-width: ${TABLET_MIN_PX}px)`, `(min-width: ${DESKTOP_MIN_PX}px)`] as const;

function read(): RouteLayout {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'mobile';
  if (window.matchMedia(QUERIES[1]).matches) return 'desktop';
  return window.matchMedia(QUERIES[0]).matches ? 'tablet' : 'mobile';
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const lists = QUERIES.map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener('change', onChange));
  return () => lists.forEach((l) => l.removeEventListener('change', onChange));
}

export function useRouteLayout(): RouteLayout {
  return useSyncExternalStore(subscribe, read, () => 'mobile' as const);
}

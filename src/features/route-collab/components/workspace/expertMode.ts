'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Vue Simple / Expert de /compas/itineraire (amélioration 4.1).
 * Simple par défaut : une décision à la fois. Expert : chiffres, méthodes, sources et réglages.
 * Mémorisé sur l'appareil ; la synchronisation par compte passera par les préférences du profil.
 */
export type RouteViewMode = 'simple' | 'expert';

const STORAGE_KEY = 'lkdv:itineraire:viewMode:v1';
const EVENT = 'lkdv:itineraire:viewMode';

function read(): RouteViewMode {
  if (typeof window === 'undefined') return 'simple';
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'expert' ? 'expert' : 'simple';
  } catch {
    return 'simple';
  }
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function setRouteViewMode(mode: RouteViewMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* stockage indisponible : le réglage vaut pour la session seulement */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useRouteViewMode(): {
  mode: RouteViewMode;
  expert: boolean;
  setMode: (mode: RouteViewMode) => void;
  toggle: () => void;
} {
  const mode = useSyncExternalStore(subscribe, read, () => 'simple' as const);
  const setMode = useCallback((next: RouteViewMode) => setRouteViewMode(next), []);
  const toggle = useCallback(() => setRouteViewMode(read() === 'expert' ? 'simple' : 'expert'), []);
  return { mode, expert: mode === 'expert', setMode, toggle };
}

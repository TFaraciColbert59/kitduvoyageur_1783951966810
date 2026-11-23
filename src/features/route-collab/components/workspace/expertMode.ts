'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { readRouteViewMode, type RouteViewMode } from '../../uiPrefs';

/**
 * Vue Simple / Expert de /compas/itineraire (amélioration 4.1).
 * Simple par défaut : une décision à la fois. Expert : chiffres, méthodes, sources et réglages.
 * Mémorisé par compte (`/api/itineraire/prefs`, table `user_ui_prefs`) : lu au premier rendu, écrit à la bascule.
 * `localStorage` reste le repli hors ligne ou sans compte : une panne réseau ou une session absente ne change rien
 * au réglage local. Le compte gagne à la lecture (réglage suivi d'un appareil à l'autre) ; sans valeur au compte,
 * la valeur locale y est reportée une fois.
 */
export type { RouteViewMode };

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

const PREFS_URL = '/api/itineraire/prefs';

function remoteAvailable(): boolean {
  return typeof window !== 'undefined' && typeof fetch === 'function' && (typeof navigator === 'undefined' || navigator.onLine !== false);
}

/** Écriture au compte, silencieuse : hors ligne, sans session ou en erreur, le réglage local reste valable. */
async function pushToAccount(mode: RouteViewMode): Promise<void> {
  if (!remoteAvailable()) return;
  try {
    await fetch(PREFS_URL, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routeViewMode: mode }),
    });
  } catch {
    /* repli : localStorage */
  }
}

function writeLocal(mode: RouteViewMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* stockage indisponible : le réglage vaut pour la session seulement */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function setRouteViewMode(mode: RouteViewMode): void {
  if (typeof window === 'undefined') return;
  writeLocal(mode);
  void pushToAccount(mode);
}

let accountSynced = false;

/** Lecture du compte, une fois par chargement de page. Toute panne laisse le réglage local en place. */
export async function syncRouteViewModeFromAccount(): Promise<void> {
  if (accountSynced || !remoteAvailable()) return;
  accountSynced = true;
  try {
    const res = await fetch(PREFS_URL, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return;
    const remote = readRouteViewMode(await res.json());
    const local = read();
    if (remote && remote !== local) writeLocal(remote);
    else if (!remote && local === 'expert') void pushToAccount(local);
  } catch {
    accountSynced = false;
  }
}

/** Tests : rejoue la lecture du compte. */
export function resetRouteViewModeSyncForTests(): void {
  accountSynced = false;
}

export function useRouteViewMode(): {
  mode: RouteViewMode;
  expert: boolean;
  setMode: (mode: RouteViewMode) => void;
  toggle: () => void;
} {
  const mode = useSyncExternalStore(subscribe, read, () => 'simple' as const);
  useEffect(() => {
    void syncRouteViewModeFromAccount();
  }, []);
  const setMode = useCallback((next: RouteViewMode) => setRouteViewMode(next), []);
  const toggle = useCallback(() => setRouteViewMode(read() === 'expert' ? 'simple' : 'expert'), []);
  return { mode, expert: mode === 'expert', setMode, toggle };
}

'use client';
import { createContext, useContext, useSyncExternalStore } from 'react';

function subscribe(cb: () => void): () => void {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** true si le navigateur se déclare hors connexion (côté serveur : en ligne). */
export function useOffline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
}

/** Lu par les feuilles (Commande…) pour désactiver ce qui exige le réseau. */
export const OfflineContext = createContext(false);
export const useOfflineContext = (): boolean => useContext(OfflineContext);

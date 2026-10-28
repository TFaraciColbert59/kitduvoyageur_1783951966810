'use client';

import { useEffect, useState } from 'react';
import { decodeDepartCache, encodeDepartCache } from '@/features/materiel/domain/departCache';
import { flushOfflineQueue } from '@/features/materiel/offline/departOfflineQueue';

export interface DepartCachePayload<TDepart = unknown> {
  depart: TDepart;
  weather: unknown;
  cachedAt: number;
}

function isSameSnapshot(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * useDepartOfflineCache — cache local du départ (`lkdv_depart_cache_<id>`) + file d'actions.
 * Lecture à l'hydratation, écriture sur changement, flush de la file au retour réseau.
 * Aucune règle métier ici : encodage/décodage délégués à `domain/departCache`.
 */
export function useDepartOfflineCache<TDepart extends { id: string }>(
  depart: TDepart | null | undefined,
  weather: unknown
): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (depart?.id) {
      const key = `lkdv_depart_cache_${depart.id}`;
      let cachedAt = Date.now();
      try {
        const cached = decodeDepartCache<DepartCachePayload<TDepart>>(localStorage.getItem(key));
        if (
          cached &&
          isSameSnapshot(cached.depart, depart) &&
          isSameSnapshot(cached.weather, weather)
        ) {
          cachedAt = cached.cachedAt;
        }
        localStorage.setItem(key, encodeDepartCache({ depart, weather, cachedAt }));
      } catch {
        // stockage indisponible : le cache reste best-effort
      }
    }

    setIsOnline(navigator['onLine']);
    if (navigator['onLine']) {
      flushOfflineQueue().catch(() => {});
    }

    const handleOnline = () => {
      setIsOnline(true);
      flushOfflineQueue().catch(() => {});
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [depart, weather]);

  return { isOnline };
}

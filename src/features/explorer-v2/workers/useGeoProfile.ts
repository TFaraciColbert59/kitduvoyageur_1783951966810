'use client';

import { useEffect, useState } from 'react';
import type { ProfileResult } from './geo.worker';

/**
 * Profil altimétrique d'une trace, calculé dans le Web Worker géo.
 * Retombe sur un calcul dans le thread principal si les workers ne sont pas
 * disponibles (Safari ancien, WebView bridée) — même implémentation, même DEM.
 */
export function useGeoProfile(positions: Array<[number, number]> | null, enabled = true) {
  const [profile, setProfile] = useState<ProfileResult | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const key = positions && positions.length > 1 ? `${positions.length}:${positions[0].join(',')}` : '';

  useEffect(() => {
    if (!enabled || !positions || positions.length < 2) {
      setState('idle');
      setProfile(null);
      return;
    }
    let cancelled = false;
    setState('loading');

    // Le calcul tourne dans le thread principal, mais **par tranches** : chaque
    // tuile DEM rend la main au navigateur, la feuille reste réactive. Le même
    // module est utilisé par le worker et par le banc P9-05.
    const run = async () => {
      try {
        const { buildProfile } = await import('./geo.worker');
        const result = await buildProfile({ id: 1, positions });
        if (!cancelled) {
          setProfile(result);
          setState('ready');
        }
      } catch {
        if (!cancelled) setState('error');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { profile, state };
}

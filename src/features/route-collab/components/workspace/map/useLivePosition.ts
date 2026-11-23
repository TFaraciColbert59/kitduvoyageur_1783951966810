'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clearGeoWatch, watchGeoPosition } from '@/lib/native/geolocation';
import { headingOf, type LiveFix } from '../../../liveTrack';

export type LiveState = 'off' | 'starting' | 'on' | 'denied' | 'unavailable';

/**
 * Suivi de la position (2.9). Démarré par un geste (jamais au chargement : la permission se demande quand la
 * personne la veut). Le cap vient du capteur, sinon des deux dernières positions si l'on a vraiment bougé.
 */
export function useLivePosition() {
  const [state, setState] = useState<LiveState>('off');
  const [fix, setFix] = useState<(LiveFix & { heading: number | null }) | null>(null);
  const watchId = useRef<string | null>(null);
  const prev = useRef<LiveFix | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (watchId.current) void clearGeoWatch(watchId.current);
      watchId.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    if (watchId.current) void clearGeoWatch(watchId.current);
    watchId.current = null;
    prev.current = null;
    setFix(null);
    setState('off');
  }, []);

  const start = useCallback(async () => {
    if (watchId.current) return;
    setState('starting');
    try {
      const id = await watchGeoPosition((pos, error) => {
        if (!alive.current) return;
        if (error || !pos) {
          const msg = error?.message ?? '';
          setState(/denied|permission|refus/i.test(msg) ? 'denied' : 'unavailable');
          return;
        }
        const cur: LiveFix = {
          lat: pos.latitude,
          lon: pos.longitude,
          accuracyM: Number.isFinite(pos.accuracy) ? pos.accuracy : null,
          headingDeg: pos.heading,
          timestamp: pos.timestamp,
        };
        const heading = headingOf(prev.current, cur);
        // On ne garde l'ancienne position que si elle est assez loin pour donner un cap.
        if (heading != null || !prev.current) prev.current = cur;
        setFix({ ...cur, heading });
        setState('on');
      });
      if (!id) {
        setState('unavailable');
        return;
      }
      if (!alive.current) {
        void clearGeoWatch(id);
        return;
      }
      watchId.current = id;
    } catch {
      setState('unavailable');
    }
  }, []);

  return { state, fix, start, stop };
}

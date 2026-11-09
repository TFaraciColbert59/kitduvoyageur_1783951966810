'use client';

import { useCallback, useRef, useState } from 'react';
import type { GeoPermissionState, GeoPoint } from '../shared/types';
import { getCurrentGeoPosition } from '@/lib/native/geolocation';

export interface NearMeState {
  state: GeoPermissionState;
  point: GeoPoint | null;
  /** Demande la position (Capacitor si natif, sinon `navigator.geolocation`). */
  request: () => Promise<GeoPoint | null>;
}

function isDenied(error: unknown): boolean {
  if (!error) return false;
  const code = (error as { code?: unknown }).code;
  if (code === 1) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('denied') || message.includes('refus') || message.includes('permission');
}

/**
 * « Près de moi » (Recherche#17, filtres des trois volets) : la position n'est
 * demandée qu'au premier usage, jamais au montage. Un refus donne un état
 * explicatif avec bouton « Autoriser » — jamais une erreur muette.
 */
export function useNearMe(): NearMeState {
  const [state, setState] = useState<GeoPermissionState>('idle');
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const inFlight = useRef<Promise<GeoPoint | null> | null>(null);

  const request = useCallback(async (): Promise<GeoPoint | null> => {
    if (point) return point;
    if (inFlight.current) return inFlight.current;
    setState('prompt');
    const promise = (async () => {
      try {
        const position = await getCurrentGeoPosition({ enableHighAccuracy: false, timeout: 10000 });
        const next: GeoPoint = { lat: position.latitude, lng: position.longitude };
        setPoint(next);
        setState('granted');
        return next;
      } catch (error) {
        setState(isDenied(error) ? 'denied' : 'unavailable');
        return null;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = promise;
    return promise;
  }, [point]);

  return { state, point, request };
}

export default useNearMe;

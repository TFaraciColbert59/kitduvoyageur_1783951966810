'use client';

import { useEffect, useRef } from 'react';
import { ActivityTracker, type GpsFix } from './tracker';
import { haptic } from '../state/haptics';
import { evaluateOffRoute, type OffRouteState } from './offRoute';
import { useExplorerStore } from '../state/store';

/**
 * Suivi GPS d'une activité (04_CARTE §4, P2-11).
 *
 * - `watchPosition` réel quand la permission est accordée ;
 * - métriques calculées par `ActivityTracker` (précision, sauts, altitude) ;
 * - hors-trace évalué dès qu'un itinéraire est sélectionné ;
 * - en recette, `window.__xpPushFix` permet de rejouer un GPX sans GPS.
 */
export interface TrackerOptions {
  /** Distance à la trace courante, fournie par l'appelant (worker ou RPC). */
  distanceToRouteM?: (fix: GpsFix) => number | null;
  onFix?: (fix: GpsFix, metrics: ReturnType<ActivityTracker['addFix']>) => void;
}

export function useGpsTracker({ distanceToRouteM, onFix }: TrackerOptions = {}) {
  const activity = useExplorerStore((state) => state.activity);
  const permission = useExplorerStore((state) => state.locationPermission);
  const running = !!activity && !activity.paused;
  const trackerRef = useRef(new ActivityTracker());
  const offRouteRef = useRef<OffRouteState>({ offRoute: false, distanceM: 0, outSinceS: 0 });
  const samplesRef = useRef<Array<{ t: number; distanceM: number }>>([]);

  const handleFix = useRef<(fix: GpsFix) => void>(() => undefined);
  handleFix.current = (fix: GpsFix) => {
    const metrics = trackerRef.current.addFix(fix);
    useExplorerStore.setState((state) => ({
      activity: state.activity
        ? {
            ...state.activity,
            distanceM: metrics.distanceM,
            elevGainM: metrics.elevGainM,
            movingS: metrics.movingS,
          }
        : undefined,
      center: [fix.lng, fix.lat],
    }));

    if (distanceToRouteM) {
      const distance = distanceToRouteM(fix);
      if (distance !== null) {
        samplesRef.current.push({ t: fix.t, distanceM: distance });
        if (samplesRef.current.length > 40) samplesRef.current.shift();
        const next = evaluateOffRoute(samplesRef.current, offRouteRef.current);
        const wasOff = offRouteRef.current.offRoute;
        offRouteRef.current = next;
        if (next.offRoute !== wasOff) {
          haptic(next.offRoute ? 'off-route' : 'back-on-route');
          useExplorerStore.setState((state) => ({
            activity: state.activity ? { ...state.activity, offRoute: next.offRoute } : undefined,
            toast: {
              id: Date.now(),
              title: next.offRoute ? 'Hors itinéraire' : 'De retour sur la trace',
              sub: `${Math.round(next.distanceM)} m`,
              tone: next.offRoute ? 'warn' : 'good',
            },
          }));
        }
      }
    }

    onFix?.(fix, metrics);
  };

  // Hook de recette : rejoue une position sans GPS physique.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_EXPLORER_SCENES !== '1') return;
    const target = window as unknown as { __xpPushFix?: (fix: GpsFix) => void };
    target.__xpPushFix = (fix) => handleFix.current(fix);
    return () => {
      delete target.__xpPushFix;
    };
  }, []);

  useEffect(() => {
    if (!running || permission !== 'granted') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (position) => {
        handleFix.current({
          t: position.timestamp,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          ele: position.coords.altitude,
          acc: position.coords.accuracy,
          speed: position.coords.speed,
        });
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [running, permission]);

  useEffect(() => {
    if (!activity) {
      trackerRef.current = new ActivityTracker();
      samplesRef.current = [];
      offRouteRef.current = { offRoute: false, distanceM: 0, outSinceS: 0 };
    }
  }, [activity]);
}

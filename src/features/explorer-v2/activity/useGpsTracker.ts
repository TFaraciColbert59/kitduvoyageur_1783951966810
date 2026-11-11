'use client';

import { useEffect, useRef } from 'react';
import { ActivityTracker, autoPauseConfigForSport, type GpsFix } from './tracker';
import { haptic } from '../state/haptics';
import { evaluateOffRoute, type OffRouteState } from './offRoute';
import { useExplorerStore } from '../state/store';
import { gpsSimulationEnabled } from './gpsSimulation';

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

/** Horloge monotone de réception ; jamais l'horloge murale pour les durées. */
function monotonicNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function useGpsTracker({ distanceToRouteM, onFix }: TrackerOptions = {}) {
  const activity = useExplorerStore((state) => state.activity);
  const autoPauseEnabled = useExplorerStore((state) => state.autoPauseEnabled) ?? false;
  const permission = useExplorerStore((state) => state.locationPermission);
  const scene = useExplorerStore((state) => state.scene);
  const running = !!activity && !activity.paused;
  const trackerRef = useRef(new ActivityTracker());
  const trackerConfigRef = useRef<string>('');
  const manualPausedRef = useRef<boolean | null>(null);
  const offRouteRef = useRef<OffRouteState>({ offRoute: false, distanceM: 0, outSinceS: 0 });
  const samplesRef = useRef<Array<{ t: number; distanceM: number }>>([]);

  const handleFix = useRef<(fix: GpsFix) => void>(() => undefined);
  const lastFixTimeRef = useRef<number>(Date.now());

  handleFix.current = (fix: GpsFix) => {
    const current = useExplorerStore.getState().activity;
    // Pause manuelle : un fix tardif ne doit ni déplacer la carte ni avancer
    // les métriques, que la pause automatique soit activée ou non. La pause
    // automatique, elle, laisse passer les fixes pour détecter la reprise.
    if (!current || current.paused) return;
    lastFixTimeRef.current = Date.now();

    const metrics = trackerRef.current.addFix(fix);
    // Fix rejeté : ni métrique, ni carte, ni tracé, ni hors-trace. Le point
    // périmé (`maximumAge`) ou aberrant ne doit pas laisser de trace visuelle.
    if (!metrics.accepted) return;

    useExplorerStore.setState((state) => ({
      activity: state.activity
        ? {
            ...state.activity,
            distanceM: metrics.distanceM,
            elevGainM: metrics.elevGainM,
            movingS: metrics.movingS,
            autoPaused: metrics.autoPaused,
          }
        : undefined,
      // Pause automatique : la capture continue pour détecter la reprise, mais
      // la carte reste sur la dernière position de mouvement. Le tracé est
      // interrompu par l'appelant à partir de `metrics.autoPaused`.
      ...(metrics.autoPaused ? {} : { center: [fix.lng, fix.lat] as [number, number] }),
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

  // Permission réelle : le store peut être resté à « prompt » alors que le
  // navigateur a déjà refusé. Les scènes de recette gardent leur état simulé.
  useEffect(() => {
    if (scene) return;
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    let cancelled = false;
    let status: PermissionStatus | null = null;
    const apply = (state: PermissionState) => {
      if (cancelled) return;
      const next =
        state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt';
      const current = useExplorerStore.getState().locationPermission;
      // Un fix GPS réellement reçu ne doit pas être rétrogradé par un « prompt »
      // transitoire ; un refus réel doit toujours être affiché.
      if (current === 'granted' && next === 'prompt') return;
      if (current !== next) useExplorerStore.setState({ locationPermission: next });
    };
    try {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          if (cancelled) return;
          status = result;
          apply(result.state);
          result.onchange = () => apply(result.state);
        })
        .catch(() => undefined);
    } catch {
      // API Permissions absente ou refusée : le watchPosition reste la source.
    }
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, [scene]);

  // Profil de pause automatique : celui du sport courant, ou comportement
  // historique quand le réglage de préparation est désactivé.
  useEffect(() => {
    if (!activity) return;
    const key = `${activity.sport}:${autoPauseEnabled ? 'on' : 'off'}`;
    if (trackerConfigRef.current === key) return;
    trackerConfigRef.current = key;
    trackerRef.current.setConfig(autoPauseConfigForSport(activity.sport, autoPauseEnabled));
    if (!autoPauseEnabled && activity.autoPaused) {
      useExplorerStore.setState((state) =>
        state.activity ? { activity: { ...state.activity, autoPaused: false } } : {},
      );
    }
  }, [activity, autoPauseEnabled]);

  // Pause manuelle : une transition (aller ou retour) casse la continuité pour
  // que le trou ne soit compté ni en distance, ni en durée, ni en D+, que la
  // pause automatique soit activée ou non.
  useEffect(() => {
    if (!activity) {
      manualPausedRef.current = null;
      return;
    }
    const previous = manualPausedRef.current;
    manualPausedRef.current = activity.paused;
    if (previous === null || previous === activity.paused) return;
    trackerRef.current.breakContinuity();
    if (activity.paused && activity.autoPaused) {
      useExplorerStore.setState((state) =>
        state.activity ? { activity: { ...state.activity, autoPaused: false } } : {},
      );
    }
  }, [activity]);

  useEffect(() => {
    if (!running || permission === 'denied') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (position) => {
        useExplorerStore.setState({ locationPermission: 'granted' });
        handleFix.current({
          t: position.timestamp,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          ele: position.coords.altitude,
          acc: position.coords.accuracy,
          speed: position.coords.speed,
          receivedAt: monotonicNow(),
        });
      },
      (err) => {
        if (err.code === 1 /* PERMISSION_DENIED */) {
          useExplorerStore.setState({ locationPermission: 'denied' });
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [running, permission]);

  // Simulation continue de déplacement : réservée aux fixtures de recette/test.
  // Jamais en production (cf. incident P0 : traces fictives en session réelle).
  useEffect(() => {
    if (!running) return;
    if (!gpsSimulationEnabled()) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      // Si aucun fix GPS physique n'est arrivé depuis > 2,5 s
      if (now - lastFixTimeRef.current > 2500) {
        const act = useExplorerStore.getState().activity;
        if (!act || act.paused) return;
        const sport = act.sport;
        const speedMs =
          sport === 'velo' ? 5.2 : sport === 'trail' || sport === 'course' ? 3.1 : 1.3;
        const currentCenter = useExplorerStore.getState().center;
        const nextLng = currentCenter[0] + 0.000012 * (speedMs / 1.3);
        const nextLat = currentCenter[1] + 0.000007 * (speedMs / 1.3);
        handleFix.current({
          t: now,
          lat: nextLat,
          lng: nextLng,
          ele: 1045 + (act.movingS % 40) * 0.5,
          acc: 5,
          speed: speedMs,
          receivedAt: monotonicNow(),
        });
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!activity) {
      trackerRef.current = new ActivityTracker();
      trackerConfigRef.current = '';
      manualPausedRef.current = null;
      samplesRef.current = [];
      offRouteRef.current = { offRoute: false, distanceM: 0, outSinceS: 0 };
    }
  }, [activity]);
}

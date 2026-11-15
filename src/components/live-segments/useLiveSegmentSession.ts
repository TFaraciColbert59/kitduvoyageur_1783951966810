'use client';

/**
 * Lot S03-UI / S4.09 — liaison entre le GPS du navigateur et le moteur Live
 * Segments livré par le contrat.
 *
 * Le hook ne recalcule rien : il pousse des `GeoPoint` dans `LiveSegmentEngine`
 * et expose le `LiveSegmentSnapshot` tel quel. `geolocation` et `now` sont
 * injectables pour les tests, sans navigateur ni réseau.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LiveSegmentEngine,
  type GeoPoint,
  type LiveSegmentAlert,
  type LiveSegmentDefinition,
  type LiveSegmentEngineOptions,
  type LiveSegmentSnapshot,
  type PrivacyContext,
} from '@/features/live-segments';

export interface LiveSegmentSessionOptions {
  segments: readonly LiveSegmentDefinition[];
  privacy: PrivacyContext;
  engineOptions?: LiveSegmentEngineOptions;
  geolocation?: Geolocation | null;
  now?: () => number;
}

export interface LiveSegmentSession {
  snapshot: LiveSegmentSnapshot;
  alerts: LiveSegmentAlert[];
  selectedSegmentId: string | null;
  isTracking: boolean;
  isPaused: boolean;
  permissionError: string | null;
  start: (segmentId?: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  acknowledge: () => void;
  dismissAlert: (alert: LiveSegmentAlert) => void;
  pushPoint: (point: GeoPoint) => LiveSegmentSnapshot;
}

function defaultNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function alertKey(alert: LiveSegmentAlert): string {
  return `${alert.type}:${alert.segmentId}:${alert.timestampMs}`;
}

function geolocationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === 1) return 'Accès à la position refusé. Autorisez la géolocalisation pour lancer un segment.';
  if (error.code === 2) return 'Position indisponible. Vérifiez le GPS de l’appareil.';
  if (error.code === 3) return 'La position met trop de temps à répondre. Réessayez à l’extérieur.';
  return 'Impossible de lire la position.';
}

export function useLiveSegmentSession({
  segments,
  privacy,
  engineOptions,
  geolocation = typeof navigator !== 'undefined' ? navigator.geolocation : null,
  now = defaultNow,
}: LiveSegmentSessionOptions): LiveSegmentSession {
  const engineRef = useRef<LiveSegmentEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new LiveSegmentEngine(privacy, segments, engineOptions);
  }
  const engine = engineRef.current;

  const watchIdRef = useRef<number | null>(null);
  const [snapshot, setSnapshot] = useState<LiveSegmentSnapshot>(() =>
    engine.acknowledgeResolution(),
  );
  const [alerts, setAlerts] = useState<LiveSegmentAlert[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null && geolocation) {
      geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setIsTracking(false);
  }, [geolocation]);

  const activeSegments = useMemo(() => {
    if (!selectedSegmentId) return segments;
    const selected = segments.filter((segment) => segment.id === selectedSegmentId);
    return selected.length > 0 ? selected : segments;
  }, [segments, selectedSegmentId]);

  useEffect(() => {
    engine.setSegments(activeSegments);
  }, [engine, activeSegments]);

  useEffect(() => {
    engine.updatePrivacy(privacy);
  }, [engine, privacy]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && geolocation) {
        geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
    };
  }, [geolocation]);

  useEffect(() => {
    const alert = alerts[0];
    if (!alert) return;
    // Les incidents et le résultat restent affichés ; les nouvelles rassurantes
    // (approche, départ, retour GPS) s'effacent après quelques secondes.
    if (
      alert.type === 'off_route' ||
      alert.type === 'gps_lost' ||
      alert.type === 'finish' ||
      alert.type === 'aborted'
    ) {
      return;
    }
    const timer = setTimeout(() => {
      setAlerts((previous) => previous.filter((item) => alertKey(item) !== alertKey(alert)));
    }, 6_000);
    return () => clearTimeout(timer);
  }, [alerts]);

  const pushPoint = useCallback(
    (point: GeoPoint): LiveSegmentSnapshot => {
      const next = engine.ingestPoint(point);
      setSnapshot(next);

      if (next.alerts.length > 0) {
        setAlerts((previous) => {
          const seen = new Set(previous.map(alertKey));
          const fresh = next.alerts.filter((alert) => !seen.has(alertKey(alert))).reverse();
          if (fresh.length === 0) return previous;
          return [...fresh, ...previous].slice(0, 4);
        });
      }

      if (next.state === 'completed' || next.state === 'aborted') {
        if (watchIdRef.current !== null && geolocation) {
          geolocation.clearWatch(watchIdRef.current);
        }
        watchIdRef.current = null;
        setIsTracking(false);
      }

      return next;
    },
    [engine, geolocation],
  );

  const start = useCallback(
    (segmentId?: string) => {
      if (segmentId) setSelectedSegmentId(segmentId);
      setPermissionError(null);
      setIsPaused(false);
      setAlerts([]);

      if (!geolocation) {
        setPermissionError('La géolocalisation n’est pas disponible sur cet appareil.');
        setIsTracking(false);
        return;
      }

      if (watchIdRef.current !== null) {
        geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      engine.reset();
      engine.setSegments(
        segmentId
          ? segments.filter((segment) => segment.id === segmentId)
          : segments,
      );
      setSnapshot(engine.acknowledgeResolution());

      setIsTracking(true);
      watchIdRef.current = geolocation.watchPosition(
        (position) => {
          const point: GeoPoint = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            ...(typeof position.coords.altitude === 'number'
              ? { ele: position.coords.altitude }
              : {}),
            ...(typeof position.coords.accuracy === 'number'
              ? { accuracyM: position.coords.accuracy }
              : {}),
            timestampMs: position.timestamp || Date.now(),
            monotonicMs: now(),
          };
          pushPoint(point);
        },
        (error) => {
          setPermissionError(geolocationErrorMessage(error));
        },
        { enableHighAccuracy: true, maximumAge: 1_000, timeout: 20_000 },
      );
    },
    [engine, geolocation, now, pushPoint, segments],
  );

  const stop = useCallback(() => {
    stopWatch();
    engine.reset();
    setSnapshot(engine.acknowledgeResolution());
    setSelectedSegmentId(null);
    setIsPaused(false);
    setAlerts([]);
    setPermissionError(null);
  }, [engine, stopWatch]);

  const acknowledge = useCallback(() => {
    stopWatch();
    engine.reset();
    setSnapshot(engine.acknowledgeResolution());
    setSelectedSegmentId(null);
    setIsPaused(false);
    setAlerts([]);
    setPermissionError(null);
  }, [engine, stopWatch]);

  const pause = useCallback(() => {
    engine.pause(now());
    setIsPaused(true);
  }, [engine, now]);

  const resume = useCallback(() => {
    engine.resume(now());
    setIsPaused(false);
  }, [engine, now]);

  const dismissAlert = useCallback((alert: LiveSegmentAlert) => {
    const key = alertKey(alert);
    setAlerts((previous) => previous.filter((item) => alertKey(item) !== key));
  }, []);

  return {
    snapshot,
    alerts,
    selectedSegmentId,
    isTracking,
    isPaused,
    permissionError,
    start,
    stop,
    pause,
    resume,
    acknowledge,
    dismissAlert,
    pushPoint,
  };
}

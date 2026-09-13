'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { sharePosition, stopSharingPosition } from '@/features/tribu/actions/livePosition';

const PING_INTERVAL_MS = 45_000;
const MAX_FAILURES = 3;
const HIDDEN_AUTO_STOP_MS = 2 * 60 * 1000;

/**
 * Partage de position opt-in (Phase 7 TRIBU).
 * - ping throttle 45 s tant que l'onglet est visible ;
 * - arret sur desactivation, erreurs repetees (3) ou onglet masque > 2 min ;
 * - jamais de faux "actif" : l'indicateur ne passe vrai qu'apres un ping accepte.
 */
export function useLivePositionSharing(options: {
  sessionId: string | null;
  enabled: boolean;
  onFatalError?: (message: string) => void;
}) {
  const { sessionId, enabled, onFatalError } = options;
  const [active, setActive] = useState(false);
  const [lastFixAt, setLastFixAt] = useState<string | null>(null);
  const [sharingError, setSharingError] = useState<string | null>(null);

  const failuresRef = useRef(0);
  const lastPingRef = useRef(0);
  const fatalRef = useRef(onFatalError);
  fatalRef.current = onFatalError;

  useEffect(() => {
    if (!enabled || !sessionId) {
      setActive(false);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setSharingError('Géolocalisation indisponible sur cet appareil.');
      return;
    }

    let cancelled = false;
    failuresRef.current = 0;
    lastPingRef.current = 0;
    setSharingError(null);

    const ping = async (position: GeolocationPosition) => {
      if (cancelled) return;
      const now = Date.now();
      if (now - lastPingRef.current < PING_INTERVAL_MS) return;
      lastPingRef.current = now;

      const result = await sharePosition({
        sessionId,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyM: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        heading: Number.isFinite(position.coords.heading as number)
          ? (position.coords.heading as number)
          : null,
      });
      if (cancelled) return;

      if (result.ok) {
        failuresRef.current = 0;
        setSharingError(null);
        setActive(true);
        setLastFixAt(new Date().toISOString());
      } else {
        failuresRef.current += 1;
        setSharingError(result.error);
        if (failuresRef.current >= MAX_FAILURES) {
          setActive(false);
          fatalRef.current?.(result.error);
        }
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        void ping(position);
      },
      (error) => {
        if (cancelled) return;
        setSharingError(error.message || 'Géolocalisation refusée ou indisponible.');
      },
      { enableHighAccuracy: true, maximumAge: 20_000, timeout: 15_000 }
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
      setActive(false);
    };
  }, [enabled, sessionId]);

  useEffect(() => {
    if (!enabled || !sessionId || typeof document === 'undefined') return;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

    const handleVisibility = () => {
      if (document.hidden) {
        hiddenTimer = setTimeout(() => {
          void stopSharingPosition({ sessionId }).finally(() => setActive(false));
        }, HIDDEN_AUTO_STOP_MS);
      } else if (hiddenTimer) {
        clearTimeout(hiddenTimer);
        hiddenTimer = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (hiddenTimer) clearTimeout(hiddenTimer);
    };
  }, [enabled, sessionId]);

  const stop = useCallback(async () => {
    if (!sessionId) return;
    await stopSharingPosition({ sessionId });
    setActive(false);
  }, [sessionId]);

  return { active, lastFixAt, sharingError, stop };
}

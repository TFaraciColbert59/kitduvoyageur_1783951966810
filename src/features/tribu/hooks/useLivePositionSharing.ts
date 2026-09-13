'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { sharePosition, stopSharingPosition } from '@/features/tribu/actions/livePosition';

const PING_INTERVAL_MS = 45_000;
const MAX_FAILURES = 3;
const HIDDEN_AUTO_STOP_MS = 2 * 60 * 1000;
const STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Partage de position opt-in (Phase 7 TRIBU).
 * - ping throttle 45 s tant que l'onglet est visible ;
 * - l'indicateur n'est « actif » qu'après un ping accepté ET reste frais
 *   (< 5 min) ; toute erreur (GPS, RLS, reseau) est remontee ;
 * - arret confirme par le serveur (jamais de faux inactif) ;
 * - arret sur desactivation, 3 echecs, onglet masque > 2 min, demontage.
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

  const activeRef = useRef(false);
  const failuresRef = useRef(0);
  const lastPingRef = useRef(0);
  const lastAcceptedRef = useRef(0);
  const fatalRef = useRef(onFatalError);
  fatalRef.current = onFatalError;

  const setActiveSafe = useCallback((value: boolean) => {
    activeRef.current = value;
    setActive(value);
  }, []);

  const fail = useCallback(
    (message: string) => {
      failuresRef.current += 1;
      setSharingError(message);
      if (failuresRef.current >= MAX_FAILURES) {
        setActiveSafe(false);
        fatalRef.current?.(message);
      }
    },
    [setActiveSafe]
  );

  useEffect(() => {
    if (!enabled || !sessionId) {
      setActiveSafe(false);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setSharingError('Géolocalisation indisponible sur cet appareil.');
      return;
    }

    let cancelled = false;
    failuresRef.current = 0;
    lastPingRef.current = 0;
    lastAcceptedRef.current = 0;
    setSharingError(null);

    const ping = async (position: GeolocationPosition) => {
      if (cancelled) return;
      const now = Date.now();
      if (now - lastPingRef.current < PING_INTERVAL_MS) return;
      lastPingRef.current = now;

      try {
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
          lastAcceptedRef.current = Date.now();
          setSharingError(null);
          setActiveSafe(true);
          setLastFixAt(new Date().toISOString());
        } else {
          fail(result.error);
        }
      } catch (error) {
        if (cancelled) return;
        fail(error instanceof Error ? error.message : 'Partage interrompu.');
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        void ping(position);
      },
      (error) => {
        if (cancelled) return;
        fail(error.message || 'Géolocalisation refusée ou indisponible.');
      },
      { enableHighAccuracy: true, maximumAge: 20_000, timeout: 15_000 }
    );

    const watchdog = setInterval(() => {
      if (cancelled) return;
      if (
        activeRef.current &&
        lastAcceptedRef.current > 0 &&
        Date.now() - lastAcceptedRef.current > STALE_AFTER_MS
      ) {
        setActiveSafe(false);
        setSharingError('Partage interrompu : aucune position récente.');
        fatalRef.current?.('Partage interrompu : aucune position récente.');
      }
    }, 60_000);

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(watchdog);
      setActiveSafe(false);
      if (activeRef.current || lastAcceptedRef.current > 0) {
        // Arret confirme cote serveur (best effort) : ne jamais laisser une
        // position derriere soi apres avoir quitte la surface de partage.
        void stopSharingPosition({ sessionId }).catch(() => {});
      }
    };
  }, [enabled, sessionId, fail, setActiveSafe]);

  useEffect(() => {
    if (!enabled || !sessionId || typeof document === 'undefined') return;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

    const stopNow = async () => {
      try {
        const result = await stopSharingPosition({ sessionId });
        if (result.ok) {
          setActiveSafe(false);
          setSharingError(null);
        } else {
          setSharingError(`Arrêt impossible : ${result.error}`);
        }
      } catch {
        setSharingError('Arrêt impossible : réseau indisponible.');
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        hiddenTimer = setTimeout(() => {
          void stopNow();
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
  }, [enabled, sessionId, setActiveSafe]);

  const stop = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!sessionId) return { ok: false, error: 'Session inconnue.' };
    try {
      const result = await stopSharingPosition({ sessionId });
      if (result.ok) {
        setActiveSafe(false);
        setSharingError(null);
        return { ok: true };
      }
      setSharingError(result.error);
      return { ok: false, error: result.error };
    } catch {
      const message = 'Réseau indisponible.';
      setSharingError(message);
      return { ok: false, error: message };
    }
  }, [sessionId, setActiveSafe]);

  return { active, lastFixAt, sharingError, stop };
}

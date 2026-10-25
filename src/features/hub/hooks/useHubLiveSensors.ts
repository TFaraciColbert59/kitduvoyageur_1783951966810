'use client';

import { useEffect, useRef } from 'react';
import { useHubStore } from '../stores/useHubStore';

/**
 * H3.2 — Capteurs live du hub (extraction à l'identique de l'ancien HubShell).
 * Actif GPS/batterie/ultra-save : online/offline, Battery API (ultra-save sous
 * 15 %), geolocation haute précision + boussole en mode trek. Aucun changement
 * de comportement — D1 : l'actif est migré, pas reconstruit.
 */
export function useHubLiveSensors(isTrekActive: boolean): void {
  const updateAction = useHubStore((s) => s.updateAction);
  const toggleUltraSave = useHubStore((s) => s.toggleUltraSave);
  const watchIdRef = useRef<number | null>(null);

  // Network & Battery listeners
  useEffect(() => {
    const handleOnline = () => {
      useHubStore.setState({ isOnline: true });
    };
    const handleOffline = () => {
      useHubStore.setState({ isOnline: false });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Battery API check
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as unknown as { getBattery: () => Promise<{ level: number; addEventListener: (t: string, cb: () => void) => void }> })
        .getBattery()
        .then((battery) => {
          updateAction({ batteryLevel: battery.level });
          battery.addEventListener('levelchange', () => {
            updateAction({ batteryLevel: battery.level });
            if (battery.level <= 0.15) {
              toggleUltraSave(true);
            }
          });
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateAction, toggleUltraSave]);

  // Geolocation & Compass sensor tracking in Action Mode
  useEffect(() => {
    if (isTrekActive && typeof navigator !== 'undefined' && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, altitude, heading } = pos.coords;
          updateAction({
            currentPosition: {
              latitude,
              longitude,
              altitude: altitude ?? undefined,
              timestamp: pos.timestamp,
            },
            altitudeMeters: altitude ?? 1840,
            headingDegrees: heading ?? 42,
          });
        },
        () => {
          // Fallback if denied or unavailable
          useHubStore.setState({ gpsStatus: 'UNAVAILABLE' });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
      );

      // Orientation event for compass if supported
      const handleOrientation = (e: DeviceOrientationEvent) => {
        if (e.alpha !== null) {
          updateAction({ headingDegrees: Math.round(e.alpha) });
        }
      };
      if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
        window.addEventListener('deviceorientation', handleOrientation, true);
      }

      return () => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        if (typeof window !== 'undefined') {
          window.removeEventListener('deviceorientation', handleOrientation, true);
        }
      };
    }
  }, [isTrekActive, updateAction]);
}

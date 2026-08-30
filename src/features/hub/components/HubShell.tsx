'use client';

import React, { useEffect, useRef } from 'react';
import { useHubStore } from '../stores/useHubStore';
import { HubTopBar } from './HubTopBar';
import { BaseCampView } from './BaseCampView';
import { ActionModeView } from './ActionModeView';

export const HubShell: React.FC = () => {
  const isTrekActive = useHubStore((s) => s.isTrekActive);
  const baseCamp = useHubStore((s) => s.baseCamp);
  const action = useHubStore((s) => s.action);
  const isOnline = useHubStore((s) => s.isOnline);
  const setTrekActive = useHubStore((s) => s.setTrekActive);
  const toggleUltraSave = useHubStore((s) => s.toggleUltraSave);
  const dismissAlert = useHubStore((s) => s.dismissAlert);
  const updateAction = useHubStore((s) => s.updateAction);

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
      (navigator as any).getBattery().then((battery: any) => {
        updateAction({ batteryLevel: battery.level });
        battery.addEventListener('levelchange', () => {
          updateAction({ batteryLevel: battery.level });
          if (battery.level <= 0.15) {
            toggleUltraSave(true);
          }
        });
      }).catch(() => {});
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
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
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

  const isUltraSave = action.isUltraSaveActive;

  return (
    <div
      className={`min-h-[100dvh] w-full transition-colors duration-300 ${
        isUltraSave
          ? 'bg-black text-[#4ADE80]'
          : 'bg-[#FBFAF6] dark:bg-[#0B120E] text-[#17402C] dark:text-[#E7E3D6]'
      }`}
      style={{
        paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 16px))',
      }}
    >
      {/* Dynamic Top Bar */}
      <HubTopBar
        isTrekActive={isTrekActive}
        isOnline={isOnline}
        isUltraSaveActive={isUltraSave}
        batteryLevel={action.batteryLevel}
        onToggleUltraSave={() => toggleUltraSave()}
      />

      {/* Main Content Area */}
      <main className="max-w-lg mx-auto px-4 pt-4">
        {!isTrekActive ? (
          <BaseCampView
            state={baseCamp}
            onStartTrek={() => setTrekActive(true)}
            onDismissAlert={dismissAlert}
          />
        ) : (
          <ActionModeView
            trekName={baseCamp.trekName}
            state={action}
            onPause={() => updateAction({ isPaused: true })}
            onResume={() => updateAction({ isPaused: false })}
            onStop={() => setTrekActive(false)}
            onUpdateAction={updateAction}
          />
        )}
      </main>
    </div>
  );
};

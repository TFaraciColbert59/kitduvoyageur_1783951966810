'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useActiveHikeMode } from '@/hooks/useActiveHikeMode';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

// Dynamic import for map to avoid SSR issues
const ExplorerMap = dynamic(() => import('@/components/explorer/ExplorerMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', background: '#0d1a12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#8BAF7C', fontFamily: 'monospace', fontSize: 12 }}>Chargement carte...</span>
    </div>
  ),
});

interface BatteryManager {
  level: number;
  charging: boolean;
  addEventListener(type: 'levelchange' | 'chargingchange', listener: () => void): void;
  removeEventListener(type: 'levelchange' | 'chargingchange', listener: () => void): void;
}

declare global {
  interface Navigator {
    getBattery?: () => Promise<BatteryManager>;
  }
}

// Real bearing (0-360°) from point A to point B.
function bearingTo(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function cardinalLabel(bearingDeg: number): string {
  const dirs = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
  const idx = Math.round((((bearingDeg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx];
}

// Real phone heading (0-360°, north = 0) via DeviceOrientation if available.
function useDeviceHeading(): number | null {
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;

    const handler = (raw: DeviceOrientationEvent) => {
      const e = raw as DeviceOrientationEventWithHeading;
      if (typeof e.webkitCompassHeading === 'number') {
        setHeading(e.webkitCompassHeading);
      } else if (e.alpha != null) {
        // Android: alpha is clockwise from north; convert to degrees clockwise (0-360)
        setHeading((360 - e.alpha) % 360);
      }
    };

    window.addEventListener('deviceorientation', handler as EventListener);
    return () => window.removeEventListener('deviceorientation', handler as EventListener);
  }, []);

  return heading;
}

type DeviceOrientationEventWithHeading = DeviceOrientationEvent & { webkitCompassHeading?: number };

function DirectionArrow({ bearingDeg, heading }: { bearingDeg: number; heading: number | null }) {
  if (heading === null) return null;
  const relative = (((bearingDeg - heading) % 360) + 360) % 360;
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        transform: `rotate(${relative}deg)`,
        transition: 'transform 0.3s ease',
        fontSize: 26,
        lineHeight: 1,
      }}
    >
      ⬆
    </span>
  );
}

export default function RandonneeActiveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeId = searchParams?.get('route') ?? null;

  const {
    isActive,
    isPaused,
    stats,
    startHike,
    pauseHike,
    resumeHike,
    stopHike,
    dismissOffRoute,
    disableProgressTracking,
    routeData,
    isLoadingRoute,
    offlineUnavailable,
  } = useActiveHikeMode();

  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showReturnGuide, setShowReturnGuide] = useState(false);
  const [offAlertHidden, setOffAlertHidden] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const startedAtRef = useRef<string>(new Date().toISOString());
  const heading = useDeviceHeading();

  // Start hike on mount if routeId provided
  useEffect(() => {
    if (routeId && !isActive && !isLoadingRoute) {
      startHike(routeId);
    } else if (!isActive && !isLoadingRoute) {
      startHike();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  // Battery API
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.getBattery) {
      navigator.getBattery().then((battery) => {
        setBatteryLevel(Math.round(battery.level * 100));

        const updateBattery = () => setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', updateBattery);
        return () => battery.removeEventListener('levelchange', updateBattery);
      }).catch(() => {
        // Battery API not supported
      });
    }
  }, []);

  // Update user location from stats
  useEffect(() => {
    if (stats.positions.length > 0) {
      const last = stats.positions[stats.positions.length - 1];
      setUserLocation([last.latitude, last.longitude]);
    }
  }, [stats.positions]);

  const handleStop = useCallback(async () => {
    setSavingSession(true);
    const finalStats = stopHike();

    if (finalStats && finalStats.distanceKm > 0) {
      try {
        await fetch('/api/hike-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routeId: routeId || null,
            carnetId: null, // pas de carnet associé pour l'instant
            startedAt: startedAtRef.current,
            endedAt: new Date().toISOString(),
            distanceKm: finalStats.distanceKm,
            durationSeconds: finalStats.durationSeconds,
            elevationGainM: finalStats.elevationGainM,
            positions: finalStats.positions,
            poiEvents: finalStats.poiEvents,
          }),
        });
      } catch (err) {
        console.error('[handleStop] save session error:', err);
      }
    }

    setSavingSession(false);
    router.push('/explorer');
  }, [stopHike, router, routeId]);

  // "Nouvelle route" — stop progress tracking for the rest of the detour (no real routing).
  const handleNewRoute = useCallback(() => {
    disableProgressTracking();
    setOffAlertHidden(true);
    setShowReturnGuide(false);
  }, [disableProgressTracking]);

  // "Continuer librement" — keep tracking, but don't re-attach the alert for this deviation.
  const handleContinueFree = useCallback(() => {
    dismissOffRoute();
    setOffAlertHidden(true);
    setShowReturnGuide(false);
  }, [dismissOffRoute]);

  // Re-arm the alert once the user is back on route.
  useEffect(() => {
    if (!stats.isOffRoute) {
      setOffAlertHidden(false);
      setShowReturnGuide(false);
    }
  }, [stats.isOffRoute]);

  // Bearing toward the next POI (for the discreet POI guidance card).
  const lastPos = stats.positions.length > 0 ? stats.positions[stats.positions.length - 1] : null;
  const poiBearing = lastPos && stats.nextPoi
    ? bearingTo(lastPos.latitude, lastPos.longitude, stats.nextPoi.lat, stats.nextPoi.lon)
    : null;

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDistance = (km: number): string => {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1)} km`;
  };

  const formatPace = (minPerKm: number): string => {
    if (minPerKm === 0) return '--:--';
    const mins = Math.floor(minPerKm);
    const secs = Math.round((minPerKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <MobilePageShell>
      <div style={{ width: '100%', height: '100dvh', position: 'relative', background: '#0d1a12' }}>

        {/* Offline unavailable screen */}
        {offlineUnavailable && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 100,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: '#0d1a12', padding: 24, textAlign: 'center',
          }}>
            <span style={{ fontSize: 56, marginBottom: 20 }}>📵</span>
            <h2 style={{ color: '#F5F0E8', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Randonnée non disponible hors-ligne
            </h2>
            <p style={{ color: '#8BAF7C', fontSize: 13, lineHeight: 1.6, marginBottom: 28 }}>
              Cette randonnée n&apos;a pas été téléchargée avant le départ.
              Connecte-toi pour continuer, ou télécharge-la depuis la page Explorer.
            </p>
            <button
              onClick={() => router.push('/explorer')}
              style={{
                background: '#17402C', color: '#FBFAF6',
                border: 'none', borderRadius: 14,
                padding: '12px 24px', fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retour à Explorer
            </button>
          </div>
        )}

        {/* Map */}
        <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
          <ExplorerMap
            trails={[]}
            selectedTrailId={null}
            onTrailClick={() => {}}
            userLocation={userLocation}
          />
        </div>

        {/* Off-route alert */}
        {stats.isOffRoute && stats.deviation && !offAlertHidden && (
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              right: 16,
              zIndex: 50,
              background: 'rgba(58, 32, 8, 0.96)',
              backdropFilter: 'blur(24px) saturate(1.5)',
              border: '1px solid rgba(251, 191, 36, 0.6)',
              borderRadius: 16,
              padding: 16,
              boxShadow: '0 12px 32px rgba(11, 31, 23, 0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: showReturnGuide ? 12 : 8 }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <div>
                <div style={{ color: '#FDE68A', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Sortie de parcours
                </div>
                <div style={{ color: '#FBFAF6', fontSize: 13 }}>
                  Distance : {Math.round(stats.deviation.distanceM)} mètres
                </div>
              </div>
            </div>

            {showReturnGuide && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'rgba(251, 191, 36, 0.1)',
                  borderRadius: 12,
                  padding: '10px 14px',
                  marginBottom: 12,
                }}
              >
                <DirectionArrow bearingDeg={stats.deviation.bearingDeg} heading={heading} />
                <div>
                  <div style={{ color: '#FDE68A', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Revenir au sentier
                  </div>
                  <div style={{ color: '#FBFAF6', fontSize: 13 }}>
                    {heading !== null
                      ? 'Suivez la flèche'
                      : `Dirigez-vous vers le ${cardinalLabel(stats.deviation.bearingDeg)}`}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowReturnGuide(true)}
                style={{
                  flex: 1,
                  background: 'rgba(251, 191, 36, 0.2)',
                  border: '1px solid rgba(251, 191, 36, 0.5)',
                  borderRadius: 10,
                  padding: '10px 6px',
                  color: '#FDE68A',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                → Revenir
              </button>
              <button
                onClick={handleNewRoute}
                style={{
                  flex: 1,
                  background: 'rgba(163, 196, 163, 0.15)',
                  border: '1px solid rgba(163, 196, 163, 0.4)',
                  borderRadius: 10,
                  padding: '10px 6px',
                  color: '#A3C4A3',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                → Nouvelle route
              </button>
              <button
                onClick={handleContinueFree}
                style={{
                  flex: 1,
                  background: 'rgba(163, 196, 163, 0.15)',
                  border: '1px solid rgba(163, 196, 163, 0.4)',
                  borderRadius: 10,
                  padding: '10px 6px',
                  color: '#A3C4A3',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                → Continuer librement
              </button>
            </div>
          </div>
        )}

        {/* Stats Overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to top, rgba(11, 31, 23, 0.95) 0%, rgba(11, 31, 23, 0.8) 70%, transparent 100%)',
            padding: '24px 16px 16px',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        >
          {/* Route name */}
          {routeData && (
            <div style={{ marginBottom: 12, textAlign: 'center' }}>
              <span style={{ color: '#A3C4A3', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 16 }}>
                {routeData.name}
              </span>
            </div>
          )}

          {/* Main stats grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
              marginBottom: 12,
            }}
          >
            {/* Distance */}
            <div
              style={{
                background: 'rgba(23, 64, 44, 0.6)',
                borderRadius: 16,
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>🥾</span>
                <span style={{ color: '#A3C4A3', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Distance
                </span>
              </div>
              <div style={{ color: '#FBFAF6', fontSize: 24, fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>
                {formatDistance(stats.distanceKm)}
                {stats.routeTotalKm && (
                  <span style={{ color: '#6B7A72', fontSize: 14, marginLeft: 4 }}>
                    / {formatDistance(stats.routeTotalKm)}
                  </span>
                )}
              </div>
            </div>

            {/* Duration */}
            <div
              style={{
                background: 'rgba(23, 64, 44, 0.6)',
                borderRadius: 16,
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>⏱️</span>
                <span style={{ color: '#A3C4A3', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Durée
                </span>
              </div>
              <div style={{ color: '#FBFAF6', fontSize: 24, fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>
                {formatDuration(stats.durationSeconds)}
              </div>
            </div>

            {/* Elevation (only if available) */}
            {stats.elevationGainM !== null && (
              <div
                style={{
                  background: 'rgba(23, 64, 44, 0.6)',
                  borderRadius: 16,
                  padding: '12px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>↑</span>
                  <span style={{ color: '#A3C4A3', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Dénivelé
                  </span>
                </div>
                <div style={{ color: '#FBFAF6', fontSize: 24, fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>
                  {Math.round(stats.elevationGainM)} m
                </div>
              </div>
            )}

            {/* Pace */}
            <div
              style={{
                background: 'rgba(23, 64, 44, 0.6)',
                borderRadius: 16,
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>🏃</span>
                <span style={{ color: '#A3C4A3', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Allure
                </span>
              </div>
              <div style={{ color: '#FBFAF6', fontSize: 24, fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>
                {formatPace(stats.paceMinPerKm)} <span style={{ fontSize: 12, color: '#6B7A72' }}>min/km</span>
              </div>
            </div>
          </div>

          {/* Progress bar (only if route total known) */}
          {stats.routeTotalKm && stats.routeTotalKm > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  height: 8,
                  background: 'rgba(107, 122, 114, 0.3)',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${stats.progressPercent ?? 0}%`,
                    background: 'linear-gradient(90deg, #17402C, #2D6B4A)',
                    borderRadius: 4,
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ color: '#6B7A72', fontSize: 10, fontFamily: 'monospace' }}>
                  {Math.round(stats.progressPercent ?? 0)}%
                </span>
                <span style={{ color: '#6B7A72', fontSize: 10, fontFamily: 'monospace' }}>
                  {formatDistance(stats.routeTotalKm - stats.distanceKm)} restant
                </span>
              </div>
            </div>
          )}

          {/* Next POI */}
          {stats.nextPoi && (
            <div
              style={{
                background: 'rgba(23, 64, 44, 0.4)',
                border: '1px solid rgba(163, 196, 163, 0.3)',
                borderRadius: 12,
                padding: '10px 14px',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 20 }}>📍</span>
              <div>
                <div style={{ color: '#A3C4A3', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Prochain point
                </div>
                <div style={{ color: '#FBFAF6', fontSize: 14 }}>
                  {stats.nextPoi.name}
                </div>
              </div>
              {poiBearing !== null && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'right' }}>
                  <DirectionArrow bearingDeg={poiBearing} heading={heading} />
                  {heading === null && (
                    <span style={{ color: '#A3C4A3', fontSize: 11 }}>
                      vers le {cardinalLabel(poiBearing)}
                    </span>
                  )}
                  <div style={{ color: '#FBFAF6', fontSize: 16, fontFamily: 'ui-monospace, monospace' }}>
                    {Math.round(stats.nextPoi.distanceRemainingM)} m
                  </div>
                </div>
              )}
              {poiBearing === null && (
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ color: '#FBFAF6', fontSize: 16, fontFamily: 'ui-monospace, monospace' }}>
                    {Math.round(stats.nextPoi.distanceRemainingM)} m
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Battery (only if API supported) */}
          {batteryLevel !== null && (
            <div
              style={{
                position: 'absolute',
                top: -40,
                right: 16,
                background: 'rgba(23, 64, 44, 0.8)',
                borderRadius: 8,
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 14 }}>🔋</span>
              <span style={{ color: batteryLevel > 20 ? '#A3C4A3' : '#ef4444', fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>
                {batteryLevel}%
              </span>
            </div>
          )}

          {/* Control buttons */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {!isPaused ? (
              <button
                onClick={pauseHike}
                style={{
                  flex: 1,
                  background: 'rgba(163, 196, 163, 0.2)',
                  border: '1px solid rgba(163, 196, 163, 0.4)',
                  borderRadius: 12,
                  padding: '14px',
                  color: '#A3C4A3',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>⏸️</span>
                Pause
              </button>
            ) : (
              <button
                onClick={resumeHike}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #17402C, #2D6B4A)',
                  border: 'none',
                  borderRadius: 12,
                  padding: '14px',
                  color: '#FBFAF6',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>▶️</span>
                Reprendre
              </button>
            )}
            <button
              onClick={() => setShowStopConfirm(true)}
              style={{
                flex: 1,
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 12,
                padding: '14px',
                color: '#ef4444',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>⏹️</span>
              Arrêter
            </button>
          </div>
        </div>

        {/* Stop confirmation modal */}
        {showStopConfirm && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11, 31, 23, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              padding: 24,
            }}
          >
            <div
              style={{
                background: '#17402C',
                borderRadius: 20,
                padding: 24,
                maxWidth: 320,
                width: '100%',
                textAlign: 'center',
              }}
            >
              <h2 style={{ color: '#FBFAF6', fontSize: 20, marginBottom: 12 }}>
                Arrêter la randonnée ?
              </h2>
              <p style={{ color: '#A3C4A3', fontSize: 14, marginBottom: 24 }}>
                Tes statistiques seront sauvegardées.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setShowStopConfirm(false)}
                  style={{
                    flex: 1,
                    background: 'rgba(163, 196, 163, 0.2)',
                    border: '1px solid rgba(163, 196, 163, 0.4)',
                    borderRadius: 12,
                    padding: '12px',
                    color: '#A3C4A3',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleStop}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    border: 'none',
                    borderRadius: 12,
                    padding: '12px',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MobilePageShell>
  );
}

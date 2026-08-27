'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface NearbyPoi {
  id: number;
  name: string;
  category: string;
  distance_m: number;
  bearing_deg: number;
  elevation_m: string | null;
}

const CATEGORY_ICONS: Record<string, string> = {
  peak: '⛰️',
  viewpoint: '👁️',
  waterfall: '💧',
  shelter: '⛺',
  refuge: '🏡',
};

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    peak: 'Sommet', viewpoint: 'Belvédère', waterfall: 'Cascade',
    shelter: 'Abri', refuge: 'Refuge',
  };
  return map[cat] || cat;
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

/**
 * Calcule l'angle de l'horizon de la boussole vers lequel pointer le label.
 * bearingDeg : cap absolu vers le POI (0 = N)
 * deviceHeading : cap absolu où regarde l'appareil (0 = N)
 * → retourne l'angle relatif en degrés (−180 à +180)
 */
function relativeBearing(poiBearing: number, deviceHeading: number): number {
  let rel = poiBearing - deviceHeading;
  while (rel > 180) rel -= 360;
  while (rel < -180) rel += 360;
  return rel;
}

/** Map [-180,+180] → [0, 100]% pour la position horizontale */
function relToPercent(rel: number): number {
  return Math.max(2, Math.min(98, ((rel + 180) / 360) * 100));
}

export default function BoussoleAugmenteePage() {
  const [pois, setPois] = useState<NearbyPoi[]>([]);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<NearbyPoi | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Démarrer la caméra arrière
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('[Boussole] camera error:', err);
    }
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup camera on unmount
      cameraStream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraStream]);

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // Demander la permission géolocalisation et démarrer tout
  const requestAccess = useCallback(async () => {
    setPermissionState('checking');
    try {
      await startCamera();

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserPos({ lat, lng });
          setPermissionState('granted');

          // Charger les POIs via Supabase RPC
          const supabase = createClient();
          const { data, error } = await supabase.rpc('get_nearby_named_pois', {
            p_lat: lat,
            p_lon: lng,
            p_radius_m: 15000,
          });
          if (!error && data) {
            setPois(data as NearbyPoi[]);
          }
        },
        () => setPermissionState('denied'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } catch {
      setPermissionState('denied');
    }
  }, [startCamera]);

  // Orientation device (boussole)
  useEffect(() => {
    function handleOrientation(e: DeviceOrientationEvent) {
      // alpha = rotation autour de l'axe Z (boussole, 0 = N sur certains appareils)
      // Sur iOS: webkitCompassHeading est plus fiable
      const compassHeading = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      if (compassHeading != null) {
        setHeading(compassHeading);
      } else if (e.alpha != null) {
        setHeading((360 - e.alpha) % 360); // Approximation pour Android
      }
    }

    if (typeof DeviceOrientationEvent !== 'undefined' && 'requestPermission' in DeviceOrientationEvent) {
      // iOS 13+
      (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> })
        .requestPermission()
        .then((perm) => {
          if (perm === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
          }
        })
        .catch(() => {});
    } else {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  // Écran d'autorisation
  if (permissionState === 'checking' && !userPos) {
    return (
      <MobilePageShell>
        <div className="min-h-screen bg-[#000] flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-6 text-3xl">
            🧭
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Boussole Augmentée</h1>
          <p className="text-white/60 text-sm leading-relaxed mb-8 max-w-64">
            Pointe ton téléphone vers les montagnes pour voir les sommets, refuges et belvédères à proximité.
          </p>
          <button
            id="request-access-btn"
            onClick={requestAccess}
            className="glass-capsule-btn"
          >
            🎥 Activer la caméra
          </button>
          <Link href="/explorer" className="mt-4 text-white/40 text-xs underline">
            Retour à la carte
          </Link>
        </div>
      </MobilePageShell>
    );
  }

  if (permissionState === 'denied') {
    return (
      <MobilePageShell>
        <div className="min-h-screen bg-[#000] flex flex-col items-center justify-center px-6 text-center">
          <span className="text-4xl mb-4">📵</span>
          <h2 className="text-lg font-bold text-white mb-2">Accès refusé</h2>
          <p className="text-white/60 text-sm max-w-56">
            Autorise la caméra et la localisation dans les réglages de ton navigateur.
          </p>
          <button onClick={requestAccess} className="glass-capsule-btn secondary mt-6">
            Réessayer
          </button>
        </div>
      </MobilePageShell>
    );
  }

  // Vue principale : caméra + overlay AR
  const VISIBLE_POIS = pois.filter((p) => {
    const rel = relativeBearing(p.bearing_deg, heading);
    return Math.abs(rel) < 90; // POIs dans l'angle de vue de 180°
  });

  return (
    <MobilePageShell safeTop={false} hasBottomNav={false}>
      <div style={{ width: '100%', height: '100dvh', position: 'relative', background: '#000', overflow: 'hidden' }}>

        {/* Flux caméra */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Gradient bas */}
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
            background: 'linear-gradient(to top, rgba(23,64,44,0.85) 0%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Header */}
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
            paddingLeft: '16px',
            paddingRight: '16px',
            paddingBottom: '16px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link
              href="/explorer"
              aria-label="Retour à la carte"
              className="w-9 h-9 shrink-0 flex items-center justify-center text-[#17402C] transition-transform active:scale-90"
              style={{
                background: 'rgba(255,255,255,0.92)',
                border: '1px solid rgba(255,255,255,0.60)',
                borderRadius: 9999,
              }}
            >
              ←
            </Link>
            <div
              style={{
                background: 'rgba(255,255,255,0.92)',
                border: '1px solid rgba(255,255,255,0.60)',
                borderRadius: 12,
                padding: '6px 10px',
              }}
            >
              <p style={{ color: '#17402C', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Boussole Augmentée</p>
              <p style={{ color: '#5A7064', fontSize: 11, marginTop: 2 }}>
                {pois.length} point{pois.length !== 1 ? 's' : ''} · {Math.round(heading)}° N
              </p>
            </div>
          </div>
        </div>

        {/* Ligne d'horizon avec POIs */}
        <div
          style={{
            position: 'absolute',
            top: '42%',
            left: 0, right: 0,
            height: 2,
            background: 'rgba(255,255,255,0.2)',
            pointerEvents: 'none',
          }}
        />

        {/* Labels POIs sur l'horizon */}
        {VISIBLE_POIS.map((poi) => {
          const rel = relativeBearing(poi.bearing_deg, heading);
          const leftPct = relToPercent(rel);

          return (
            <button
              key={poi.id}
              id={`poi-ar-${poi.id}`}
              onClick={() => setSelectedPoi(selectedPoi?.id === poi.id ? null : poi)}
              style={{
                position: 'absolute',
                top: '30%',
                left: `${leftPct}%`,
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
              }}
            >
              {/* Icône */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.92)',
                  border: '1px solid rgba(255,255,255,0.60)',
                  borderRadius: 9,
                  padding: '6px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  minWidth: 60,
                }}
              >
                <span style={{ fontSize: 18 }}>{CATEGORY_ICONS[poi.category] || '📍'}</span>
                <span style={{ color: '#17402C', fontSize: 10, fontWeight: 700, textAlign: 'center', lineHeight: 1.2, maxWidth: 80 }}>
                  {poi.name.length > 14 ? poi.name.slice(0, 13) + '…' : poi.name}
                </span>
                <span style={{ color: '#5A7064', fontSize: 9 }}>
                  {formatDistance(poi.distance_m)}
                </span>
              </div>

              {/* Tige */}
              <div
                style={{
                  width: 1,
                  height: 20,
                  background: 'rgba(255,255,255,0.3)',
                }}
              />
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.6)' }} />
            </button>
          );
        })}

        {/* Détail POI sélectionné */}
        {selectedPoi && (
          <div
            style={{
              position: 'absolute',
              bottom: 100,
              left: 16, right: 16,
              background: 'rgba(255,255,255,0.92)',
              border: '1px solid rgba(255,255,255,0.60)',
              borderRadius: 12,
              padding: '16px 16px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 28 }}>{CATEGORY_ICONS[selectedPoi.category] || '📍'}</span>
              <div>
                <p style={{ color: '#17402C', fontWeight: 700, fontSize: 15 }}>{selectedPoi.name}</p>
                <p style={{ color: '#5A7064', fontSize: 11 }}>
                  {categoryLabel(selectedPoi.category)} · {formatDistance(selectedPoi.distance_m)}
                  {selectedPoi.elevation_m && ` · ${selectedPoi.elevation_m} m`}
                </p>
              </div>
              <button
                onClick={() => setSelectedPoi(null)}
                aria-label="Fermer les détails"
                style={{ marginLeft: 'auto', color: '#5A7064', fontSize: 20 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Distance', value: formatDistance(selectedPoi.distance_m), icon: '📏' },
                { label: 'Cap', value: `${Math.round(selectedPoi.bearing_deg)}°`, icon: '🧭' },
                { label: 'Altitude', value: selectedPoi.elevation_m ? `${selectedPoi.elevation_m} m` : '—', icon: '⛰️' },
                { label: 'Type', value: categoryLabel(selectedPoi.category), icon: '🏷️' },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: 'rgba(91,127,85,0.10)',
                    borderRadius: 12,
                    padding: '10px 12px',
                  }}
                >
                  <p style={{ color: '#5A7064', fontSize: 10, marginBottom: 2 }}>{s.icon} {s.label}</p>
                  <p style={{ color: '#17402C', fontSize: 13, fontWeight: 600 }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Liste bas de page */}
        {!selectedPoi && pois.length > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0, right: 0,
              padding: '0 16px 90px',
            }}
          >
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {pois.slice(0, 8).map((poi) => (
                <button
                  key={poi.id}
                  id={`poi-list-${poi.id}`}
                  onClick={() => setSelectedPoi(poi)}
                  style={{
                    flexShrink: 0,
                    background: 'rgba(255,255,255,0.92)',
                    border: '1px solid rgba(255,255,255,0.60)',
                    borderRadius: 9,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{CATEGORY_ICONS[poi.category] || '📍'}</span>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ color: '#17402C', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {poi.name.length > 16 ? poi.name.slice(0, 15) + '…' : poi.name}
                    </p>
                    <p style={{ color: '#5A7064', fontSize: 9 }}>
                      {formatDistance(poi.distance_m)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Aucun POI visible */}
        {VISIBLE_POIS.length === 0 && pois.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '42%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(255,255,255,0.92)',
              border: '1px solid rgba(255,255,255,0.60)',
              borderRadius: 9,
              padding: '8px 16px',
            }}
          >
            <p style={{ color: '#365233', fontSize: 12 }}>
              Tourne-toi pour voir les points d&apos;intérêt
            </p>
          </div>
        )}
      </div>
    </MobilePageShell>
  );
}

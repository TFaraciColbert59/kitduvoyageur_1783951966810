'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useHikingStore } from '../hooks/useHikingStore';
import DesktopTopBar from './DesktopTopBar';
import DesktopLeftPanel from './DesktopLeftPanel';
import DesktopRightPanel from './DesktopRightPanel';
import DesktopDockBar, { DesktopDockTab } from './DesktopDockBar';
import DesktopMapOverlay from './DesktopMapOverlay';
import ContextualInsight from './ContextualInsight';
import CompletionView from './CompletionView';
import SafetyCenterModal from './SafetyCenterModal';
import Terrain3DViewer from './Terrain3DViewer';
import GPXImportExportModal from './GPXImportExportModal';

import { createClient } from '@/lib/supabase/client';

import StatsSheet from './sheets/StatsSheet';
import CaptureSheet from './sheets/CaptureSheet';
import CopilotSheet from './sheets/CopilotSheet';
import MoreSheet from './sheets/MoreSheet';

export default function HikingCockpitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeIdParam = searchParams?.get('routeId');

  const hikingStore = useHikingStore();
  const [activeTab, setActiveTab] = useState<DesktopDockTab | null>(null);
  const [isNightMode, setIsNightMode] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [show3DTerrain, setShow3DTerrain] = useState(false);
  const [showGPXModal, setShowGPXModal] = useState(false);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(24);
  const [isCompleted, setIsCompleted] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);

  const [dbRouteData, setDbRouteData] = useState<{
    name: string;
    distanceKm: number;
    elevationGainM: number;
    startLat: number;
    startLon: number;
  } | null>(null);
  const [mapTrails, setMapTrails] = useState<any[]>([]);

  // Load Route data and trails from Supabase DB / Offline Cache
  useEffect(() => {
    async function loadDbRoute() {
      try {
        const supabase = createClient();
        let query = supabase
          .from('hiking_routes')
          .select('id, name, distance_km, elevation_gain_m, start_latitude, start_longitude, geometry');
        if (routeIdParam) {
          query = query.eq('id', routeIdParam);
        } else {
          query = query.limit(5);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const r = data[0];
          setDbRouteData({
            name: r.name || 'Chamechaude',
            distanceKm: Number(r.distance_km) || 14.2,
            elevationGainM: Number(r.elevation_gain_m) || 1200,
            startLat: Number(r.start_latitude) || 45.2833,
            startLon: Number(r.start_longitude) || 5.8667,
          });

          const formattedTrails = data.map((t: any) => ({
            id: String(t.id),
            name: t.name || 'Randonnée',
            lat: Number(t.start_latitude) || 45.2833,
            lng: Number(t.start_longitude) || 5.8667,
            distance_km: Number(t.distance_km) || 14.2,
            duration_hours: 4.5,
            difficulty: 'modérée',
            elevation_gain: Number(t.elevation_gain_m) || 1200,
            terrain_type: 'Montagne',
            family_friendly: false,
            geojson: t.geometry || null,
          }));
          setMapTrails(formattedTrails);
        }
      } catch {
        /* fallback to default */
      }
    }
    loadDbRoute();
  }, [routeIdParam]);

  // Fetch weather on mount
  const fetchWeather = hikingStore.fetchWeather;
  useEffect(() => {
    if (hikingStore.positions.length > 0) {
      const last = hikingStore.positions[hikingStore.positions.length - 1];
      fetchWeather(last.latitude, last.longitude);
    }
  }, [hikingStore.positions, fetchWeather]);

  // Listen to device orientation for compass heading
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const heading = (e as any).webkitCompassHeading ?? (e.alpha ? 360 - e.alpha : null);
      if (heading != null) setDeviceHeading(Math.round(heading));
    };

    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
    return () => {
      if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, []);

  const [geoPermissionState, setGeoPermissionState] = useState<'checking' | 'prompt' | 'granted' | 'denied'>('checking');
  const autoStartedRef = useRef(false);

  // Auto-start and geolocation permission management for URL routeIdParam
  useEffect(() => {
    if (!routeIdParam || hikingStore.isActive || hikingStore.state === 'COMPLETED' || autoStartedRef.current) {
      setGeoPermissionState('granted');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        if (status.state === 'granted') {
          setGeoPermissionState('granted');
          if (!autoStartedRef.current) {
            autoStartedRef.current = true;
            hikingStore.startHike(routeIdParam);
          }
        } else if (status.state === 'denied') {
          setGeoPermissionState('denied');
        } else {
          setGeoPermissionState('prompt');
        }

        status.onchange = () => {
          if (status.state === 'granted') {
            setGeoPermissionState('granted');
            if (!autoStartedRef.current) {
              autoStartedRef.current = true;
              hikingStore.startHike(routeIdParam);
            }
          } else if (status.state === 'denied') {
            setGeoPermissionState('denied');
          }
        };
      }).catch(() => {
        setGeoPermissionState('prompt');
      });
    } else {
      setGeoPermissionState('prompt');
    }
  }, [routeIdParam, hikingStore.isActive, hikingStore.state]);

  const handleStartHikeWithPermission = async () => {
    try {
      autoStartedRef.current = true;
      await hikingStore.startHike(routeIdParam || undefined);
      setGeoPermissionState('granted');
    } catch (err: any) {
      if (err?.code === 1 || err?.message?.toLowerCase().includes('denied')) {
        setGeoPermissionState('denied');
      } else {
        setGeoPermissionState('prompt');
      }
    }
  };

  const handleToggleHike = () => {
    if (hikingStore.isActive && !hikingStore.isPaused) {
      hikingStore.pauseHike();
    } else if (hikingStore.isPaused) {
      hikingStore.resumeHike();
    } else {
      hikingStore.startHike(routeIdParam || undefined);
    }
  };

  const handleConfirmStop = async () => {
    const result = await hikingStore.stopHike();
    if (result?.sessionId) {
      setSavedSessionId(result.sessionId);
    }
    setIsCompleted(true);
  };

  const currentPos = hikingStore.positions.length > 0
    ? hikingStore.positions[hikingStore.positions.length - 1]
    : null;

  const userLoc: [number, number] | null = currentPos
    ? [currentPos.latitude, currentPos.longitude]
    : [45.2833, 5.8667]; // Chartreuse default

  const showCompletionScreen = isCompleted || hikingStore.state === 'COMPLETED';

  return (
    <div className="w-full h-screen relative overflow-hidden bg-[#EAE6DF] text-[#0B1F17] select-none font-sans">
      <div className="relative w-full h-full overflow-hidden bg-[#FBFAF6]">
          {showCompletionScreen ? (
            <CompletionView
              routeName={routeIdParam ? `Itinéraire #${routeIdParam}` : 'Chamechaude'}
              distanceKm={hikingStore.distanceKm || 14.2}
              durationSeconds={hikingStore.durationSeconds || 19080}
              elevationGainM={hikingStore.elevationGainM || 620}
              averageSpeedKmH={hikingStore.averageSpeedKmH || 3.1}
              maxAltitudeM={2082}
              onViewCarnet={() => {
                if (savedSessionId) {
                  router.push(`/carnets?sessionId=${savedSessionId}`);
                } else {
                  router.push('/carnets');
                }
              }}
              onShare={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'Randonnée terminée !',
                    text: `J'ai terminé ma randonnée Chamechaude avec LKDV !`,
                    url: window.location.href,
                  }).catch(() => {});
                } else {
                  alert('Lien copié dans le presse-papier !');
                }
              }}
              onEditCarnet={() => router.push('/carnets')}
            />
          ) : (
            <>
              {/* Map Layer */}
              <DesktopMapOverlay
                userLoc={userLoc}
                trails={mapTrails}
                selectedTrailId={routeIdParam}
                isNightMode={isNightMode}
                nextPoi={hikingStore.nextPoi}
              />

              {/* Floating TopBar */}
              <DesktopTopBar
                gpsStatus="Précis · 4 m"
                headingDeg={deviceHeading || 24}
                cardinalDir="NNE"
                tempC={hikingStore.weather?.tempC ?? 21}
                weatherCondition={hikingStore.weather?.condition ?? 'Dégagé'}
                batteryLevel={hikingStore.batteryLevel ?? 74}
                batteryHours="6 h"
                userName="C"
                onOpenWeather={() => setActiveTab('copilot')}
              />

              {/* Left Panel: Waypoints & Progression */}
              <DesktopLeftPanel
                distanceKm={hikingStore.distanceKm || 6.8}
                totalDistanceKm={dbRouteData?.distanceKm || 14.2}
                progressPercent={hikingStore.progressPercent || 48}
                startTime="05:47"
                etaTime="15:42"
                elapsedTimeStr="2h18"
                maxAltitudeM={2082}
              />

              {/* Right Panel: Live Stats & Copilot */}
              <DesktopRightPanel
                averageSpeedKmH={hikingStore.averageSpeedKmH || 3.0}
                durationSeconds={hikingStore.durationSeconds || 8280}
                currentSpeedKmH={hikingStore.currentSpeedKmH || 3.4}
                elevationGainM={hikingStore.elevationGainM || 420}
                elevationLossM={45}
                distanceKm={hikingStore.distanceKm || 6.8}
                remainingDistanceKm={Math.max(0, 14.2 - (hikingStore.distanceKm || 6.8))}
                weatherCondition={hikingStore.weather?.condition || 'Ciel dégagé'}
              />

              {/* Off-Route / Weather Alert Banner */}
              <ContextualInsight
                isOffRoute={hikingStore.isOffRoute}
                deviationMeters={hikingStore.deviation?.distanceM ?? 80}
                nextPoi={hikingStore.nextPoi}
                weather={hikingStore.weather}
                isPaused={hikingStore.isPaused}
                onDismissOffRoute={() => hikingStore.dismissOffRoute()}
                onReturnToPath={() => hikingStore.dismissOffRoute()}
                onViewShelter={() => setActiveTab('copilot')}
              />

              {/* Central Floating Dock Bar */}
              <DesktopDockBar
                activeTab={activeTab}
                isActive={hikingStore.isActive}
                isPaused={hikingStore.isPaused}
                durationSeconds={hikingStore.durationSeconds || 8327}
                onTabSelect={(tab) => {
                  if (tab === 'voix' || tab === 'moment') {
                    setActiveTab('capture');
                  } else {
                    setActiveTab(tab);
                  }
                }}
                onToggleHike={handleToggleHike}
                onStopHike={handleConfirmStop}
              />

              {/* Interactive Modals */}
              <StatsSheet
                isOpen={activeTab === 'stats'}
                onClose={() => setActiveTab(null)}
                distanceKm={hikingStore.distanceKm || 6.8}
                durationSeconds={hikingStore.durationSeconds || 8280}
                elevationGainM={hikingStore.elevationGainM || 420}
                currentSpeedKmH={hikingStore.currentSpeedKmH || 3.4}
                averageSpeedKmH={hikingStore.averageSpeedKmH || 3.0}
                paceMinPerKm={hikingStore.paceMinPerKm || 18.6}
              />

              <CaptureSheet
                isOpen={activeTab === 'capture' || activeTab === 'carnet'}
                onClose={() => setActiveTab(null)}
                onCaptureAction={() => setActiveTab(null)}
              />

              <CopilotSheet
                isOpen={activeTab === 'copilot'}
                onClose={() => setActiveTab(null)}
                distanceKm={hikingStore.distanceKm || 6.8}
                remainingDistanceKm={Math.max(0, 14.2 - (hikingStore.distanceKm || 6.8))}
                elevationGainM={hikingStore.elevationGainM ?? 420}
                weatherCondition={hikingStore.weather?.condition}
              />

              <MoreSheet
                isOpen={activeTab === 'more'}
                onClose={() => setActiveTab(null)}
                isNightMode={isNightMode}
                onToggleNightMode={() => setIsNightMode((v) => !v)}
                onOpenSafety={() => setShowSafetyModal(true)}
                onOpenWeather={() => setActiveTab('copilot')}
                onOpenARCompass={() => router.push('/boussole')}
                onOpen3DTerrain={() => setShow3DTerrain(true)}
                onOpenGPXModal={() => setShowGPXModal(true)}
                onStopHike={handleConfirmStop}
              />

              <SafetyCenterModal
                isOpen={showSafetyModal}
                onClose={() => setShowSafetyModal(false)}
                currentPos={currentPos}
                batteryLevel={74}
                isOffline={false}
              />

              <Terrain3DViewer
                isOpen={show3DTerrain}
                onClose={() => setShow3DTerrain(false)}
                elevationGainM={hikingStore.elevationGainM || 420}
              />

              <GPXImportExportModal
                isOpen={showGPXModal}
                onClose={() => setShowGPXModal(false)}
                positions={hikingStore.positions}
                onImportParsedGPX={(parsed) => {
                  console.info('[Cockpit] GPX Imported:', parsed.title, parsed.positions.length);
                }}
              />

              {/* Geolocation Permission Request Modal */}
              {routeIdParam && !hikingStore.isActive && geoPermissionState === 'prompt' && (
                <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
                  <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E4E0D4] text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-[#EBF2EA] text-[#2D5A27] flex items-center justify-center mx-auto text-2xl shadow-inner">
                      📍
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#1C2620]">
                        Géolocalisation requise
                      </h3>
                      <p className="text-xs text-[#5A6A5D] mt-2 leading-relaxed">
                        Cette fonctionnalité a besoin de ta position pour te guider le long du tracé, détecter les sorties d'itinéraire et indiquer les prochains POIs.
                      </p>
                    </div>
                    <button
                      onClick={handleStartHikeWithPermission}
                      className="w-full py-3.5 bg-[#2D5A27] text-white text-sm font-bold rounded-2xl shadow-lg hover:bg-[#1E3E1B] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      <span>🚀</span>
                      <span>Autoriser la position & Démarrer</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Geolocation Permission Denied Modal */}
              {routeIdParam && !hikingStore.isActive && geoPermissionState === 'denied' && (
                <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
                  <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-200 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto text-2xl">
                      ⚠️
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#1C2620]">
                        Accès à la position refusé
                      </h3>
                      <p className="text-xs text-[#5A6A5D] mt-2 leading-relaxed">
                        Le suivi GPS ne peut pas fonctionner sans localisation. Veuillez accorder la permission dans les paramètres de votre navigateur pour démarrer la navigation.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <button
                        onClick={handleStartHikeWithPermission}
                        className="w-full py-3 bg-[#2D5A27] text-white text-sm font-bold rounded-2xl shadow-md hover:bg-[#1E3E1B] active:scale-[0.98] transition-all"
                      >
                        Réessayer
                      </button>
                      <button
                        onClick={() => setGeoPermissionState('granted')}
                        className="w-full py-2.5 bg-[#F5F2EA] text-[#5A6A5D] text-xs font-semibold rounded-2xl hover:bg-[#EAE6D8] transition-all"
                      >
                        Consulter sans le suivi GPS
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
    </div>
  );
}

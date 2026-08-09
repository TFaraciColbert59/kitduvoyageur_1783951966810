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
import { loadRouteDetail } from '../services/RouteService';
import { routeStartPoint, nextTurnOnRoute } from '../services/RouteGeom';
import { getRouteOffline } from '@/lib/offlineStorage';

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
  const [autoFollow, setAutoFollow] = useState(true);

  const [dbRouteData, setDbRouteData] = useState<{
    name: string | null;
    distanceKm: number | null;
    elevationGainM: number | null;
    startLat: number | null;
    startLon: number | null;
  } | null>(null);
  const [mapTrails, setMapTrails] = useState<any[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  // Détection réseau réelle (transportée à la SafetyCenterModal, plus de faux "Connecté")
  useEffect(() => {
    const update = () => setIsOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // Load Route data and trails from Supabase DB / Offline Cache
  useEffect(() => {
    let isMounted = true;

    async function loadDbRoute() {
      try {
        if (routeIdParam) {
          const supabase = createClient();
          const route = await loadRouteDetail(supabase, routeIdParam);

          if (isMounted && route) {
            setDbRouteData({
              name: route.name || 'Itinéraire',
              distanceKm: route.distanceKm ?? 0,
              elevationGainM: route.elevationGainM ?? 0,
              startLat: route.start?.lat ?? null,
              startLon: route.start?.lng ?? null,
            });

            const formattedTrails = [
              {
                id: route.id,
                name: route.name || 'Randonnée',
                lat: route.start?.lat ?? null,
                lng: route.start?.lng ?? null,
                distance_km: route.distanceKm,
                duration_hours: route.durationHours,
                difficulty: route.difficulty,
                elevation_gain: route.elevationGainM,
                terrain_type: route.terrainType,
                family_friendly: route.familyFriendly,
                geojson: route.geojson ?? null,
              },
            ];
            setMapTrails(formattedTrails);
            return;
          }

          // Hors-ligne : servir depuis le cache IndexedDB quand la route a été
          // téléchargée avant le départ.
          const cached = await getRouteOffline(routeIdParam).catch(() => undefined);
          if (isMounted && cached) {
            const cachedStart = cached.geojson ? routeStartPoint(cached.geojson) : null;
            setDbRouteData({
              name: cached.name,
              distanceKm: cached.distanceKm || 0,
              elevationGainM: null,
              startLat: cachedStart?.lat ?? null,
              startLon: cachedStart?.lng ?? null,
            });
            setMapTrails([
              {
                id: routeIdParam,
                name: cached.name,
                lat: cachedStart?.lat ?? null,
                lng: cachedStart?.lng ?? null,
                distance_km: cached.distanceKm || null,
                duration_hours: null,
                difficulty: null,
                elevation_gain: null,
                geojson: cached.geojson ?? null,
              },
            ]);
          }
        } else {
          // Suivi libre : pas de route, pas de tracé à afficher.
          setDbRouteData(null);
          setMapTrails([]);
        }
      } catch {
        /* aucune donnée disponible : on reste sur l'état vide */
      }
    }
    loadDbRoute();
    return () => {
      isMounted = false;
    };
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
    : dbRouteData?.startLat != null && dbRouteData?.startLon != null
    ? [dbRouteData.startLat, dbRouteData.startLon]
    : null;

  const totalDistanceKm = dbRouteData?.distanceKm || hikingStore.routeTotalKm || 0;
  const currentDistanceKm = hikingStore.distanceKm || 0;
  const remainingDistanceKm = totalDistanceKm > 0 ? Math.max(0, totalDistanceKm - currentDistanceKm) : 0;
  const progressPct = totalDistanceKm > 0 ? Math.min(100, Math.round((currentDistanceKm / totalDistanceKm) * 100)) : 0;

  const gpsStatusStr = currentPos?.accuracy
    ? `Précis · ${Math.round(currentPos.accuracy)} m`
    : hikingStore.isActive
    ? 'GPS Actif'
    : 'Recherche GPS…';

  const formatDurationStr = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
    return `${m}m`;
  };

  const startTimeStr = hikingStore.positions.length > 0
    ? new Date(hikingStore.positions[0].timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const etaTimeStr = hikingStore.estimatedEtaMinutes != null && Number.isFinite(hikingStore.estimatedEtaMinutes)
    ? new Date(Date.now() + hikingStore.estimatedEtaMinutes * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '—';

  const waypointsList = [
    {
      id: 'wp-start',
      name: 'Départ ·',
      italicPart: dbRouteData?.name || 'Début',
      meta: `0 KM · ${dbRouteData?.startLat != null ? `${dbRouteData.startLat.toFixed(2)}°N` : 'Départ'}`,
      status: currentDistanceKm > 0 ? ('done' as const) : ('current' as const),
      iconType: 'check' as const,
    },
    ...(currentDistanceKm > 0 ? [{
      id: 'wp-current',
      name: 'En cours ·',
      italicPart: 'position GPS',
      meta: `${currentDistanceKm.toFixed(1)} KM · ${hikingStore.elevationGainM != null ? `+${Math.round(hikingStore.elevationGainM)}m` : 'D+ —'}`,
      status: 'current' as const,
      iconType: 'dot' as const,
    }] : []),
    ...(totalDistanceKm > 0 ? [{
      id: 'wp-end',
      name: 'Arrivée ·',
      italicPart: dbRouteData?.name || 'Sommet',
      meta: `${totalDistanceKm.toFixed(1)} KM · ${dbRouteData?.elevationGainM != null ? `+${Math.round(dbRouteData.elevationGainM)}m` : 'D+ —'}`,
      status: 'future' as const,
      iconType: 'summit' as const,
    }] : []),
  ];

  const showCompletionScreen = isCompleted || hikingStore.state === 'COMPLETED';

  return (
    <div className="w-full h-[100dvh] relative overflow-hidden bg-[#EAE6DF] text-[#0B1F17] select-none font-sans">
      <div className="relative w-full h-full overflow-hidden bg-[#FBFAF6]">
          {showCompletionScreen ? (
            <CompletionView
              routeName={dbRouteData?.name || (routeIdParam ? `Itinéraire #${routeIdParam}` : 'Randonnée')}
              distanceKm={currentDistanceKm}
              durationSeconds={hikingStore.durationSeconds}
              elevationGainM={hikingStore.elevationGainM}
              averageSpeedKmH={hikingStore.averageSpeedKmH}
              maxAltitudeM={currentPos?.altitude ? Math.round(currentPos.altitude) : null}
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
                    text: `J'ai terminé ma randonnée ${dbRouteData?.name || ''} avec LKDV !`,
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
                userPositions={hikingStore.positions}
                userAccuracy={currentPos?.accuracy ?? null}
                trails={mapTrails}
                selectedTrailId={routeIdParam}
                isNightMode={isNightMode}
                nextPoi={hikingStore.nextPoi}
                nextTurn={mapTrails[0]?.geojson ? nextTurnOnRoute(mapTrails[0].geojson, progressPct / 100) : null}
                headingDeg={deviceHeading}
                routeBearingDeg={hikingStore.guidanceBearingDeg}
                gpsHeadingDeg={currentPos?.heading != null ? (((currentPos.heading % 360) + 360) % 360) : null}
                progressFrac={progressPct / 100}
                autoFollow={autoFollow}
                onAutoFollowChange={setAutoFollow}
                onRecentre={() => setAutoFollow(true)}
              />

              {/* Floating TopBar */}
              <DesktopTopBar
                gpsStatus={gpsStatusStr}
                headingDeg={deviceHeading}
                tempC={hikingStore.weather?.tempC ?? null}
                weatherCondition={hikingStore.weather?.condition ?? 'Supervision active'}
                batteryLevel={hikingStore.batteryLevel}
                routeName={dbRouteData?.name || hikingStore.routeName || (routeIdParam ? `Itinéraire #${routeIdParam}` : 'Suivi libre')}
                totalDistanceKm={totalDistanceKm}
                elevationGainM={dbRouteData?.elevationGainM || hikingStore.elevationGainM || 0}
                onOpenWeather={() => setActiveTab('copilot')}
              />

              {/* Left Panel: Waypoints & Progression */}
              <DesktopLeftPanel
                distanceKm={currentDistanceKm}
                totalDistanceKm={totalDistanceKm}
                progressPercent={progressPct}
                startTime={startTimeStr}
                etaTime={etaTimeStr}
                elapsedTimeStr={formatDurationStr(hikingStore.durationSeconds)}
                waypoints={waypointsList}
              />

              {/* Right Panel: Live Stats & Copilot */}
              <DesktopRightPanel
                averageSpeedKmH={hikingStore.averageSpeedKmH}
                durationSeconds={hikingStore.durationSeconds}
                currentSpeedKmH={hikingStore.currentSpeedKmH}
                elevationGainM={hikingStore.elevationGainM ?? 0}
                elevationLossM={0}
                distanceKm={currentDistanceKm}
                remainingDistanceKm={remainingDistanceKm}
                weatherCondition={hikingStore.weather?.condition || 'Supervision météo active'}
                routeName={dbRouteData?.name || hikingStore.routeName || 'votre randonnée'}
              />

              {/* Off-Route / Weather Alert Banner */}
              <ContextualInsight
                isOffRoute={hikingStore.isOffRoute}
                deviationMeters={hikingStore.deviation?.distanceM ?? null}
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
                durationSeconds={hikingStore.durationSeconds}
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
                distanceKm={currentDistanceKm}
                durationSeconds={hikingStore.durationSeconds}
                routeTotalKm={totalDistanceKm}
                progressPercent={progressPct}
                elevationGainM={hikingStore.elevationGainM}
                currentSpeedKmH={hikingStore.currentSpeedKmH}
                averageSpeedKmH={hikingStore.averageSpeedKmH}
                paceMinPerKm={hikingStore.paceMinPerKm}
              />

              <CaptureSheet
                isOpen={activeTab === 'capture' || activeTab === 'carnet'}
                onClose={() => setActiveTab(null)}
                onCaptureAction={() => setActiveTab(null)}
              />

              <CopilotSheet
                isOpen={activeTab === 'copilot'}
                onClose={() => setActiveTab(null)}
                routeName={dbRouteData?.name || hikingStore.routeName}
                distanceKm={currentDistanceKm}
                remainingDistanceKm={remainingDistanceKm}
                elevationGainM={hikingStore.elevationGainM}
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
                batteryLevel={hikingStore.batteryLevel}
                isOffline={isOffline}
              />

              <Terrain3DViewer
                isOpen={show3DTerrain}
                onClose={() => setShow3DTerrain(false)}
                elevationGainM={hikingStore.elevationGainM}
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

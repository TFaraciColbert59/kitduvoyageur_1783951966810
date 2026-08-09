import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getRouteOffline } from '@/lib/offlineStorage';

export interface PoiEvent {
  poiName: string;
  reachedAt: string;
  lat: number;
  lon: number;
}

export interface NextPoi {
  name: string;
  distanceRemainingM: number;
  lat: number;
  lon: number;
}

export interface DeviationInfo {
  distanceM: number;
  closestLat: number;
  closestLon: number;
  bearingDeg: number;
}

export interface HikeStats {
  distanceKm: number;
  durationSeconds: number;
  paceMinPerKm: number;
  positions: { latitude: number; longitude: number; altitude?: number; altitudeAccuracy?: number }[];
  elevationGainM: number | null;
  progressPercent: number | null;
  nextPoi: NextPoi | null;
  routeTotalKm: number | null;
  poiEvents: PoiEvent[];
  isOffRoute: boolean;
  deviation: DeviationInfo | null;
}

interface RoutePoi {
  name: string;
  lat: number;
  lon: number;
  distanceM: number;
}

interface RouteData {
  id: string;
  name: string;
  distanceKm: number;
  pois: RoutePoi[];
}

interface ActiveHikeModeState {
  isActive: boolean;
  isPaused: boolean;
  stats: HikeStats;
  startHike: (routeId?: string) => Promise<void>;
  pauseHike: () => void;
  resumeHike: () => void;
  stopHike: () => HikeStats | null;
  emergencyContact: string | null;
  setEmergencyContact: (contact: string) => void;
  routeData: RouteData | null;
  isLoadingRoute: boolean;
  dismissOffRoute: () => void;
  disableProgressTracking: () => void;
  /** true when the device is offline and the requested route has no cached data */
  offlineUnavailable: boolean;
}

const STORAGE_KEY = 'lkdv_hike_state';
const CONTACT_KEY = 'lkdv_emergency_contact';

function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return calcDistance(lat1, lon1, lat2, lon2) * 1000;
}

export function useActiveHikeMode(): ActiveHikeModeState {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [stats, setStats] = useState<HikeStats>({
    distanceKm: 0,
    durationSeconds: 0,
    paceMinPerKm: 0,
    positions: [],
    elevationGainM: null,
    progressPercent: null,
    nextPoi: null,
    routeTotalKm: null,
    poiEvents: [],
    isOffRoute: false,
    deviation: null,
  });
  const [emergencyContact, setEmergencyContactState] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [offRouteDismissed, setOffRouteDismissed] = useState(false);
  const [offlineUnavailable, setOfflineUnavailable] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const pausedDurationRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const deviationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const altitudeBufferRef = useRef<number[]>([]);
  const lastElevationRef = useRef<number | null>(null);
  const reachedPoisRef = useRef<Set<string>>(new Set());
  const deviationBufferRef = useRef<number[]>([]);
  const latestPositionRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const progressDisabledRef = useRef(false);

  // Restore state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONTACT_KEY);
      if (saved) setEmergencyContactState(saved);
    } catch { /* ignore */ }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          isActive?: boolean;
          startTime?: number;
          pausedDuration?: number;
          routeId?: string;
        };
        if (parsed.isActive && parsed.startTime) {
          setIsActive(true);
          startTimeRef.current = parsed.startTime;
          pausedDurationRef.current = parsed.pausedDuration || 0;
          if (parsed.routeId) {
            fetchRouteData(parsed.routeId);
          }
        }
      }
    } catch { /* ignore */ }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchIdRef.current !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch route data — with offline fallback from IndexedDB
  const fetchRouteData = async (routeId: string) => {
    setIsLoadingRoute(true);
    setOfflineUnavailable(false);
    try {
      // If offline, try to serve from IndexedDB cache first
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getRouteOffline(routeId).catch(() => undefined);
        if (cached) {
          const routePois: RoutePoi[] = (cached.pois || []).map((p) => ({
            name: p.name,
            lat: p.lat,
            lon: p.lng,
            distanceM: 0,
          }));
          setRouteData({
            id: routeId,
            name: cached.name,
            distanceKm: cached.distanceKm || 0,
            pois: routePois,
          });
          setIsLoadingRoute(false);
          return;
        } else {
          // Offline and no cached data
          setOfflineUnavailable(true);
          setIsLoadingRoute(false);
          return;
        }
      }

      const supabase = createClient();

      // Fetch route
      const { data: route, error: routeError } = await supabase
        .from('hiking_routes')
        .select('id, name, distance_km')
        .eq('id', routeId)
        .single();

      if (routeError || !route) {
        console.error('Route not found:', routeError);
        setIsLoadingRoute(false);
        return;
      }

      // Fetch POIs for this route (using trail_pois with proximity)
      // Note: trail_route_pois doesn't exist, so we query nearby POIs
      const { data: pois } = await supabase
        .from('trail_pois')
        .select('name, geom')
        .not('name', 'is', null)
        .limit(20);

      const routePois: RoutePoi[] = (pois || [])
        .filter((poi: { geom?: string; name: string }) => poi.geom)
        .map((poi: { geom: string; name: string }) => {
          // Parse PostGIS point - format is "POINT(lon lat)"
          const match = poi.geom.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
          if (match) {
            return {
              name: poi.name,
              lon: parseFloat(match[1]),
              lat: parseFloat(match[2]),
              distanceM: 0, // Will be calculated during hike
            };
          }
          return null;
        })
        .filter((poi): poi is RoutePoi => poi !== null);

      setRouteData({
        id: String(route.id),
        name: route.name || 'Randonnée',
        distanceKm: route.distance_km || 0,
        pois: routePois,
      });
    } catch (err) {
      console.error('Error fetching route:', err);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // Main tracking effect
  useEffect(() => {
    if (isActive && !isPaused) {
      if (!startTimeRef.current) startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - (startTimeRef.current ?? Date.now()) - pausedDurationRef.current) / 1000);
        setStats((prev) => {
          const pace = prev.distanceKm > 0.05 ? elapsed / 60 / prev.distanceKm : 0;

          // Calculate progress percentage
          let progressPercent = prev.progressPercent;
          if (progressDisabledRef.current) {
            progressPercent = null;
          } else if (routeData?.distanceKm && routeData.distanceKm > 0) {
            progressPercent = Math.min(100, (prev.distanceKm / routeData.distanceKm) * 100);
          }

          return { ...prev, durationSeconds: elapsed, paceMinPerKm: pace, progressPercent };
        });
      }, 1000);

      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, altitude, altitudeAccuracy } = pos.coords;
            latestPositionRef.current = { latitude, longitude };

            setStats((prev) => {
              const newPositions = [
                ...prev.positions,
                { latitude, longitude, altitude: altitude ?? undefined, altitudeAccuracy: altitudeAccuracy ?? undefined },
              ];

              // Calculate distance
              let totalDist = prev.distanceKm;
              if (newPositions.length >= 2) {
                const last = newPositions[newPositions.length - 2];
                const curr = newPositions[newPositions.length - 1];
                totalDist += calcDistance(last.latitude, last.longitude, curr.latitude, curr.longitude);
              }

              // Calculate elevation gain with smoothing
              let elevationGainM = prev.elevationGainM;
              if (altitude != null && altitudeAccuracy != null && altitudeAccuracy <= 25) {
                altitudeBufferRef.current.push(altitude);
                if (altitudeBufferRef.current.length > 5) {
                  altitudeBufferRef.current.shift();
                }

                if (altitudeBufferRef.current.length >= 3) {
                  const smoothedAlt = altitudeBufferRef.current.reduce((a, b) => a + b, 0) / altitudeBufferRef.current.length;

                  if (lastElevationRef.current !== null) {
                    const delta = smoothedAlt - lastElevationRef.current;
                    if (delta > 2 && elevationGainM !== null) {
                      elevationGainM += delta;
                    }
                  }
                  lastElevationRef.current = smoothedAlt;

                  if (elevationGainM === null) {
                    elevationGainM = 0;
                  }
                }
              }

              // Calculate progress
              let progressPercent = prev.progressPercent;
              if (progressDisabledRef.current) {
                progressPercent = null;
              } else if (routeData?.distanceKm && routeData.distanceKm > 0) {
                progressPercent = Math.min(100, (totalDist / routeData.distanceKm) * 100);
              }

              // Find next POI
              let nextPoi = prev.nextPoi;
              if (progressDisabledRef.current) {
                nextPoi = null;
              } else if (routeData?.pois.length) {
                for (const poi of routeData.pois) {
                  const poiKey = `${poi.lat}-${poi.lon}`;
                  if (!reachedPoisRef.current.has(poiKey)) {
                    const distM = calcDistanceMeters(latitude, longitude, poi.lat, poi.lon);
                    if (distM < 30) {
                      // POI reached
                      reachedPoisRef.current.add(poiKey);
                      prev.poiEvents.push({
                        poiName: poi.name,
                        reachedAt: new Date().toISOString(),
                        lat: poi.lat,
                        lon: poi.lon,
                      });
                    } else {
                      nextPoi = {
                        name: poi.name,
                        distanceRemainingM: distM,
                        lat: poi.lat,
                        lon: poi.lon,
                      };
                      break;
                    }
                  }
                }
              }

              return {
                ...prev,
                positions: newPositions,
                distanceKm: totalDist,
                elevationGainM,
                progressPercent,
                nextPoi,
                routeTotalKm: routeData?.distanceKm ?? null,
              };
            });
          },
          (error) => {
            console.error('Geolocation error:', error);
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
      }

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          isActive: true,
          startTime: startTimeRef.current,
          pausedDuration: pausedDurationRef.current,
          routeId: routeData?.id,
        }));
      } catch { /* ignore */ }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (watchIdRef.current !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (!isActive) {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch { /* ignore */ }
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isActive, isPaused, routeData]);

  // Deviation detection: poll distance from route every 15s (Prompt #3)
  useEffect(() => {
    if (deviationTimerRef.current) {
      clearInterval(deviationTimerRef.current);
      deviationTimerRef.current = null;
    }
    deviationBufferRef.current = [];

    if (!isActive || isPaused || !routeData) return;

    deviationTimerRef.current = setInterval(async () => {
      const pos = latestPositionRef.current;
      if (!pos) return;

      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc('get_route_deviation', {
          p_route_id: Number(routeData.id),
          p_lat: pos.latitude,
          p_lon: pos.longitude,
        });

        if (error) {
          console.error('Error checking route deviation:', error);
          return;
        }

        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return;

        const distanceM = Number(row.distance_m);
        const closestLat = Number(row.closest_lat);
        const closestLon = Number(row.closest_lon);
        const bearingDeg = Number(row.bearing_deg);

        // Debounce: 2 consecutive readings > 50m triggers off-route, 2 < 30m clears it
        deviationBufferRef.current.push(distanceM);
        if (deviationBufferRef.current.length > 2) {
          deviationBufferRef.current.shift();
        }
        if (deviationBufferRef.current.length < 2) return;

        const a = deviationBufferRef.current[0];
        const b = deviationBufferRef.current[1];
        const consistentlyFar = a > 50 && b > 50;
        const consistentlyNear = a < 30 && b < 30;

        if (consistentlyNear) {
          setOffRouteDismissed(false);
          setStats((prev) =>
            prev.isOffRoute || prev.deviation !== null
              ? { ...prev, isOffRoute: false, deviation: null }
              : prev
          );
          return;
        }

        if (consistentlyFar) {
          const deviation: DeviationInfo = { distanceM, closestLat, closestLon, bearingDeg };
          setStats((prev) =>
            prev.isOffRoute
              ? { ...prev, deviation }
              : { ...prev, isOffRoute: !offRouteDismissed, deviation }
          );
        }
      } catch (err) {
        console.error('Route deviation poll error:', err);
      }
    }, 15000);

    return () => {
      if (deviationTimerRef.current) {
        clearInterval(deviationTimerRef.current);
        deviationTimerRef.current = null;
      }
    };
  }, [isActive, isPaused, routeData, offRouteDismissed]);

  const startHike = useCallback(async (routeId?: string) => {
    startTimeRef.current = Date.now();
    pausedDurationRef.current = 0;
    altitudeBufferRef.current = [];
    lastElevationRef.current = null;
    reachedPoisRef.current = new Set();
    deviationBufferRef.current = [];
    latestPositionRef.current = null;
    progressDisabledRef.current = false;
    setOffRouteDismissed(false);

    setStats({
      distanceKm: 0,
      durationSeconds: 0,
      paceMinPerKm: 0,
      positions: [],
      elevationGainM: null,
      progressPercent: null,
      nextPoi: null,
      routeTotalKm: null,
      poiEvents: [],
      isOffRoute: false,
      deviation: null,
    });

    if (routeId) {
      await fetchRouteData(routeId);
    } else {
      setRouteData(null);
    }

    setIsActive(true);
    setIsPaused(false);
  }, []);

  const pauseHike = useCallback(() => {
    if (isActive && !isPaused) {
      setIsPaused(true);
    }
  }, [isActive, isPaused]);

  const resumeHike = useCallback(() => {
    if (isActive && isPaused) {
      pausedDurationRef.current += Date.now() - (startTimeRef.current || 0);
      setIsPaused(false);
    }
  }, [isActive, isPaused]);

  const stopHike = useCallback(() => {
    const finalStats = { ...stats };
    setIsActive(false);
    setIsPaused(false);
    startTimeRef.current = null;
    pausedDurationRef.current = 0;
    if (deviationTimerRef.current) {
      clearInterval(deviationTimerRef.current);
      deviationTimerRef.current = null;
    }
    deviationBufferRef.current = [];
    latestPositionRef.current = null;
    progressDisabledRef.current = false;
    setOffRouteDismissed(false);
    setRouteData(null);
    return finalStats;
  }, [stats]);

  // "Continuer librement" / close alert without losing tracking:
  // keeps off-route known internally so the alert doesn't re-trigger for the same deviation.
  const dismissOffRoute = useCallback(() => {
    setOffRouteDismissed(true);
    deviationBufferRef.current = [];
  }, []);

  // "Nouvelle route": stop progress tracking (no real rerouting in this project).
  const disableProgressTracking = useCallback(() => {
    progressDisabledRef.current = true;
    setStats((prev) => ({ ...prev, progressPercent: null, nextPoi: null }));
  }, []);

  const setEmergencyContact = useCallback((contact: string) => {
    setEmergencyContactState(contact);
    try {
      localStorage.setItem(CONTACT_KEY, contact);
    } catch { /* ignore */ }
  }, []);

  return {
    isActive,
    isPaused,
    stats,
    startHike,
    pauseHike,
    resumeHike,
    stopHike,
    dismissOffRoute,
    disableProgressTracking,
    emergencyContact,
    setEmergencyContact,
    routeData,
    isLoadingRoute,
    offlineUnavailable,
  };
}

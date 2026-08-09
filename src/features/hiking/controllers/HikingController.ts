import { HikingStateMachine } from '../engine/HikingStateMachine';
import { TrackingEngine } from '../engine/TrackingEngine';
import { GPSService } from '../services/GPSService';
import { WeatherService } from '../services/WeatherService';
import { HikeSessionService } from '../services/HikeSessionService';
import { loadRouteDetail } from '../services/RouteService';
import { closestOnRoute, computeRoutePois, haversineMeters, initialBearingDeg, routeBearingAt } from '../services/RouteGeom';
import { getRouteOffline } from '@/lib/offlineStorage';
import { createClient } from '@/lib/supabase/client';
import {
  HikingState,
  GPSPosition,
  POI,
  WeatherSnapshot,
  SafetyAlert,
} from '../types';

export interface HikingControllerState {
  state: HikingState;
  isActive: boolean;
  isPaused: boolean;
  distanceKm: number;
  durationSeconds: number;
  elevationGainM: number | null;
  paceMinPerKm: number;
  currentSpeedKmH: number;
  averageSpeedKmH: number;
  estimatedEtaMinutes: number | null;
  positions: GPSPosition[];
  progressPercent: number | null;
  /** Bearing de la route (géométrie) juste devant l'utilisateur — direction générale réelle. */
  guidanceBearingDeg: number | null;
  nextPoi: (POI & { distanceRemainingM: number }) | null;
  isOffRoute: boolean;
  deviation: { distanceM: number; bearingDeg: number } | null;
  weather: WeatherSnapshot | null;
  safetyAlerts: SafetyAlert[];
  batteryLevel: number | null;
  routeId: string | null;
  routeTotalKm: number | null;
  routeName: string | null;
}

interface PoiEvent {
  poiName: string;
  reachedAt: string;
  lat: number;
  lon: number;
}

const PERSISTENCE_KEY = 'lkdv_active_hike_session';
const DEVIATION_POLL_MS = 15000;
const OFF_ROUTE_THRESHOLD_M = 50;
const BACK_ON_ROUTE_THRESHOLD_M = 30;
const POI_REACHED_THRESHOLD_M = 30;

export class HikingController {
  private stateMachine: HikingStateMachine;
  private gpsService: GPSService;
  private trackingEngine: TrackingEngine;
  private state: HikingControllerState;
  private listeners: ((state: HikingControllerState) => void)[] = [];

  private timerId: NodeJS.Timeout | null = null;
  private deviationTimerId: NodeJS.Timeout | null = null;
  private unbindGPSPosition: (() => void) | null = null;
  private unbindGPSError: (() => void) | null = null;

  private routeGeojson: unknown = null;
  private routePois: (POI & { progressFrac: number })[] = [];
  private reachedPois: Set<string> = new Set();
  private poiEvents: PoiEvent[] = [];
  private offRouteBuffer: number[] = [];
  private offRouteDismissed = false;
  private lastProjectedFrac: number | null = null;

  constructor() {
    this.stateMachine = new HikingStateMachine('IDLE');
    this.gpsService = new GPSService();
    this.trackingEngine = new TrackingEngine();

    this.state = {
      state: 'IDLE',
      isActive: false,
      isPaused: false,
      distanceKm: 0,
      durationSeconds: 0,
      elevationGainM: null,
      paceMinPerKm: 0,
      currentSpeedKmH: 0,
      averageSpeedKmH: 0,
      estimatedEtaMinutes: null,
      positions: [],
      progressPercent: null,
      guidanceBearingDeg: null,
      nextPoi: null,
      isOffRoute: false,
      deviation: null,
      weather: null,
      safetyAlerts: [],
      batteryLevel: null,
      routeId: null,
      routeTotalKm: null,
      routeName: null,
    };

    this.stateMachine.subscribe((nextState) => {
      this.updateState({
        state: nextState,
        isActive: ['TRACKING', 'PAUSED', 'OFF_ROUTE', 'GPS_WEAK', 'LOW_BATTERY', 'WEATHER_ALERT', 'SAFETY_ALERT'].includes(nextState),
        isPaused: nextState === 'PAUSED',
      });
    });

    this.restoreSession();
  }

  public getState(): HikingControllerState {
    return this.state;
  }

  public subscribe(listener: (state: HikingControllerState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public async startHike(routeId?: string): Promise<void> {
    if (!this.stateMachine.transitionTo('PREPARING')) return;

    this.trackingEngine.reset();
    this.reachedPois.clear();
    this.poiEvents = [];
    this.offRouteBuffer = [];
    this.offRouteDismissed = false;
    this.routeGeojson = null;
    this.routePois = [];
    this.lastProjectedFrac = null;

    this.updateState({
      routeId: routeId || null,
      routeName: null,
      routeTotalKm: null,
      distanceKm: 0,
      durationSeconds: 0,
      elevationGainM: null,
      paceMinPerKm: 0,
      currentSpeedKmH: 0,
      averageSpeedKmH: 0,
      estimatedEtaMinutes: null,
      positions: [],
      safetyAlerts: [],
      progressPercent: null,
      guidanceBearingDeg: null,
      isOffRoute: false,
      deviation: null,
      nextPoi: null,
    });

    if (routeId) {
      await this.loadRouteDetails(routeId);
    }

    this.stateMachine.transitionTo('READY');
    this.stateMachine.transitionTo('TRACKING');

    this.bindGPS();
    this.startTimer();
    this.startDeviationPolling();
    this.initBattery();
    this.persistSession();
  }

  public pauseHike(): void {
    if (!this.stateMachine.transitionTo('PAUSED')) return;
    this.persistSession();
  }

  public resumeHike(): void {
    if (this.stateMachine.transitionTo('TRACKING')) {
      this.persistSession();
    }
  }

  public async stopHike(carnetId?: string): Promise<{ sessionId: string } | null> {
    if (!this.stateMachine.transitionTo('FINISHING')) return null;

    this.stopTimer();
    this.stopDeviationPolling();
    this.unbindGPS();

    const endedAt = new Date().toISOString();
    const positions = this.trackingEngine.getValidPositions();
    const startedAt = positions.length > 0 ? new Date(positions[0].timestamp).toISOString() : new Date().toISOString();

    let sessionId: string | null = null;

    if (positions.length > 1 && this.state.distanceKm > 0) {
      try {
        const res = await HikeSessionService.saveSession({
          routeId: this.state.routeId,
          carnetId: carnetId || null,
          startedAt,
          endedAt,
          distanceKm: this.state.distanceKm,
          durationSeconds: this.state.durationSeconds,
          elevationGainM: this.state.elevationGainM,
          positions,
          poiEvents: this.poiEvents,
        });
        sessionId = res.sessionId;
      } catch (err) {
        console.error('[HikingController] stopHike save error:', err);
      }
    }

    this.clearPersistedSession();
    this.stateMachine.transitionTo('COMPLETED');
    this.stateMachine.transitionTo('IDLE');

    return sessionId ? { sessionId } : null;
  }

  public dismissOffRoute(): void {
    this.offRouteDismissed = true;
    this.updateState({ isOffRoute: false, deviation: null });
    this.offRouteBuffer = [];
    if (this.stateMachine.getState() === 'OFF_ROUTE') {
      this.stateMachine.transitionTo('TRACKING');
    }
    this.persistSession();
  }

  public async fetchWeather(lat: number, lon: number): Promise<WeatherSnapshot | null> {
    const weather = await WeatherService.fetchWeather(lat, lon);
    if (weather) {
      this.updateState({ weather });
      if (weather.isAlert && weather.alertMessage) {
        this.addAlert({
          id: `weather-${Date.now()}`,
          type: 'weather',
          severity: 'warning',
          message: weather.alertMessage,
          timestamp: new Date().toISOString(),
          location: { lat, lon },
        });
      }
    }
    return weather;
  }

  // ── PRIVATE HELPERS ─────────────────────────────────────────────────────────

  private async loadRouteDetails(routeId: string): Promise<void> {
    try {
      const supabase = createClient();
      const route = await loadRouteDetail(supabase, routeId).catch(() => null);

      if (route) {
        this.applyRouteData({
          id: route.id,
          name: route.name,
          distanceKm: route.distanceKm,
          geojson: route.geojson,
          pois: route.pois,
        });
        return;
      }

      // Hors-ligne : servir la route téléchargée (IndexedDB) — géométrie + POI
      // réellement mis en cache au moment du téléchargement.
      if (typeof window !== 'undefined') {
        const cached = await getRouteOffline(routeId).catch(() => undefined);
        if (cached && cached.geojson) {
          const geojson = cached.geojson ?? null;
          const pois = geojson
            ? computeRoutePois(
                geojson,
                cached.pois.map((p) => ({
                  id: p.id,
                  name: p.name,
                  category: p.category || null,
                  lat: p.lat,
                  lng: p.lng,
                }))
              )
            : [];
          this.applyRouteData({
            id: routeId,
            name: cached.name,
            distanceKm: cached.distanceKm,
            geojson,
            pois,
          });
        }
      }
    } catch (err) {
      console.warn('[HikingController] Failed to load route details:', err);
    }
  }

  private applyRouteData(data: {
    id: string;
    name: string | null;
    distanceKm: number | null;
    geojson: unknown | null;
    pois: { id: string; name: string; category: string; lat: number; lon: number; distanceM: number; progressFrac: number }[];
  }): void {
    this.routeGeojson = data.geojson;
    this.routePois = data.pois.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      lat: p.lat,
      lon: p.lon,
      distance_m: p.distanceM,
      bearing_deg: 0,
      progressFrac: p.progressFrac,
    }));

    this.updateState({
      routeName: data.name || null,
      routeTotalKm: data.distanceKm,
    });
  }

  private updateState(partial: Partial<HikingControllerState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l(this.state));
  }

  private bindGPS(): void {
    this.unbindGPS();

    this.unbindGPSPosition = this.gpsService.onPosition((pos) => {
      if (this.state.isPaused) return;

      const accepted = this.trackingEngine.processPosition(pos);
      if (accepted) {
        const current = this.routeGeojson
          ? closestOnRoute(this.routeGeojson, pos.latitude, pos.longitude)
          : null;
        const projectedFrac = current?.progressFrac ?? null;
        this.lastProjectedFrac = projectedFrac;

        const remainingKm =
          this.state.routeTotalKm != null
            ? projectedFrac != null
              ? Math.max(0, this.state.routeTotalKm * (1 - projectedFrac))
              : Math.max(0, this.state.routeTotalKm - this.state.distanceKm)
            : null;
        const metrics = this.trackingEngine.getMetrics(remainingKm);

        const validPosList = this.trackingEngine.getValidPositions();

        // Progression projetée sur la vraie géométrie : le pourcentage reflète
        // la position sur le parcours (même si le GPS a légèrement dérivé).
        const progressPct =
          this.state.routeTotalKm != null && this.state.routeTotalKm > 0 && projectedFrac != null
            ? Math.min(100, Math.max(0, Math.round(projectedFrac * 100)))
            : null;

        // Direction générale réelle : bearing de la route juste devant le hiker.
        const guidanceBearingDeg =
          projectedFrac != null ? routeBearingAt(this.routeGeojson, projectedFrac) : null;

        // Auto-récupération : un fix valide après un GPS faible repasse en tracking.
        if (this.stateMachine.getState() === 'GPS_WEAK') {
          this.stateMachine.transitionTo('TRACKING');
        }

        const nextPoi = this.computeNextPoi(pos);

        this.updateState({
          distanceKm: metrics.distanceKm,
          elevationGainM: metrics.elevationGainM,
          currentSpeedKmH: metrics.currentSpeedKmH,
          averageSpeedKmH: metrics.averageSpeedKmH,
          paceMinPerKm: metrics.paceMinPerKm,
          estimatedEtaMinutes: metrics.estimatedEtaMinutes,
          positions: validPosList,
          progressPercent: progressPct,
          guidanceBearingDeg,
          nextPoi,
        });

        this.persistSession();
      }
    });

    this.unbindGPSError = this.gpsService.onError((err) => {
      if (err.code === 3 || err.code === 2) {
        if (this.stateMachine.getState() === 'TRACKING') {
          this.stateMachine.transitionTo('GPS_WEAK');
        }
      }
    });

    this.gpsService.startTracking();
  }

  private computeNextPoi(pos: GPSPosition): (POI & { distanceRemainingM: number }) | null {
    if (this.routePois.length === 0) return null;

    const current = this.routeGeojson
      ? closestOnRoute(this.routeGeojson, pos.latitude, pos.longitude)
      : null;
    const currentFrac = current?.progressFrac ?? 0;
    const currentProgressBehindThreshold = currentFrac - 0.03;

    for (const poi of this.routePois) {
      if (this.reachedPois.has(String(poi.id))) continue;

      const distM = haversineMeters(pos.latitude, pos.longitude, poi.lat, poi.lon);

      if (distM < POI_REACHED_THRESHOLD_M) {
        this.reachedPois.add(String(poi.id));
        this.poiEvents.push({
          poiName: poi.name,
          reachedAt: new Date().toISOString(),
          lat: poi.lat,
          lon: poi.lon,
        });
        continue;
      }

      // POI clairement derrière la progression actuelle → déjà passé sans le frôler.
      if (poi.progressFrac != null && poi.progressFrac < currentProgressBehindThreshold) {
        this.reachedPois.add(String(poi.id));
        continue;
      }

      return {
        ...poi,
        distanceRemainingM: Math.round(distM),
        bearing_deg: initialBearingDeg(pos.latitude, pos.longitude, poi.lat, poi.lon),
      };
    }

    return null;
  }

  private unbindGPS(): void {
    this.gpsService.stopTracking();
    if (this.unbindGPSPosition) {
      this.unbindGPSPosition();
      this.unbindGPSPosition = null;
    }
    if (this.unbindGPSError) {
      this.unbindGPSError();
      this.unbindGPSError = null;
    }
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerId = setInterval(() => {
      if (this.state.isPaused) return;

      const remainingKm =
        this.state.routeTotalKm != null
          ? this.lastProjectedFrac != null
            ? Math.max(0, this.state.routeTotalKm * (1 - this.lastProjectedFrac))
            : Math.max(0, this.state.routeTotalKm - this.state.distanceKm)
          : null;
      const metrics = this.trackingEngine.getMetrics(remainingKm);

      this.updateState({
        durationSeconds: metrics.activeDurationSeconds,
        paceMinPerKm: metrics.paceMinPerKm,
        averageSpeedKmH: metrics.averageSpeedKmH,
      });
      this.persistSession();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Détection de sortie d'itinéraire via la fonction PostGIS get_route_deviation :
   * polling toutes les 15 s, debounce sur 2 lectures (2 × > 50 m → OFF_ROUTE,
   * 2 × < 30 m → retour sur parcours).
   */
  private startDeviationPolling(): void {
    this.stopDeviationPolling();
    this.offRouteBuffer = [];

    this.deviationTimerId = setInterval(async () => {
      if (!this.state.routeId || this.state.isPaused || !this.state.isActive) return;

      const positions = this.trackingEngine.getValidPositions();
      const last = positions[positions.length - 1];
      if (!last) return;

      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc('get_route_deviation', {
          p_route_id: Number(this.state.routeId),
          p_lat: last.latitude,
          p_lon: last.longitude,
        });
        if (error) return;

        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return;

        const distanceM = Number(row.distance_m);
        const bearingDeg = Number(row.bearing_deg);

        this.offRouteBuffer.push(distanceM);
        if (this.offRouteBuffer.length > 2) this.offRouteBuffer.shift();
        if (this.offRouteBuffer.length < 2) return;

        const [a, b] = this.offRouteBuffer;
        const consistentlyFar = a > OFF_ROUTE_THRESHOLD_M && b > OFF_ROUTE_THRESHOLD_M;
        const consistentlyNear = a < BACK_ON_ROUTE_THRESHOLD_M && b < BACK_ON_ROUTE_THRESHOLD_M;

        if (consistentlyNear) {
          this.offRouteDismissed = false;
          if (this.stateMachine.getState() === 'OFF_ROUTE') {
            this.stateMachine.transitionTo('TRACKING');
          }
          this.updateState({ isOffRoute: false, deviation: null });
          return;
        }

        if (consistentlyFar && !this.offRouteDismissed) {
          if (this.stateMachine.getState() === 'TRACKING') {
            this.stateMachine.transitionTo('OFF_ROUTE');
          }
          this.updateState({
            isOffRoute: true,
            deviation: { distanceM: Math.round(distanceM), bearingDeg },
          });
        }
      } catch {
        /* hors-ligne ou erreur réseau : on ignore ce cycle */
      }
    }, DEVIATION_POLL_MS);
  }

  private stopDeviationPolling(): void {
    if (this.deviationTimerId) {
      clearInterval(this.deviationTimerId);
      this.deviationTimerId = null;
    }
    this.offRouteBuffer = [];
  }

  private initBattery(): void {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const updateBattery = () => {
          const level = Math.round(battery.level * 100);
          this.updateState({ batteryLevel: level });
          if (level <= 15) {
            this.addAlert({
              id: `battery-${Date.now()}`,
              type: 'battery',
              severity: 'warning',
              message: `Batterie faible (${level}%)`,
              timestamp: new Date().toISOString(),
            });
            if (this.stateMachine.getState() === 'TRACKING') {
              this.stateMachine.transitionTo('LOW_BATTERY');
            }
          }
        };
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
      }).catch(() => {});
    }
  }

  private addAlert(alert: SafetyAlert): void {
    this.updateState({
      safetyAlerts: [...this.state.safetyAlerts, alert],
    });
  }

  private persistSession(): void {
    if (typeof window === 'undefined') return;
    try {
      if (this.state.isActive) {
        localStorage.setItem(
          PERSISTENCE_KEY,
          JSON.stringify({
            routeId: this.state.routeId,
            routeName: this.state.routeName,
            routeTotalKm: this.state.routeTotalKm,
            distanceKm: this.state.distanceKm,
            durationSeconds: this.state.durationSeconds,
            elevationGainM: this.state.elevationGainM,
            isPaused: this.state.isPaused,
            positions: this.state.positions.slice(-200),
          })
        );
      }
    } catch {
      /* ignore storage errors */
    }
  }

  private restoreSession(): void {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(PERSISTENCE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.positions && parsed.positions.length > 0) {
          this.updateState({
            routeId: parsed.routeId ?? null,
            routeName: parsed.routeName ?? null,
            routeTotalKm: parsed.routeTotalKm != null ? Number(parsed.routeTotalKm) : null,
            distanceKm: Number(parsed.distanceKm) || 0,
            durationSeconds: Number(parsed.durationSeconds) || 0,
            elevationGainM: parsed.elevationGainM != null ? Number(parsed.elevationGainM) : null,
            positions: parsed.positions,
          });
        }
      }
    } catch {
      /* ignore restore errors */
    }
  }

  private clearPersistedSession(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(PERSISTENCE_KEY);
    } catch {
      /* ignore */
    }
  }
}
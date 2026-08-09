import { HikingStateMachine } from '../engine/HikingStateMachine';
import { TrackingEngine } from '../engine/TrackingEngine';
import { GPSService } from '../services/GPSService';
import { WeatherService } from '../services/WeatherService';
import { HikeSessionService } from '../services/HikeSessionService';
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

const PERSISTENCE_KEY = 'lkdv_active_hike_session';

export class HikingController {
  private stateMachine: HikingStateMachine;
  private gpsService: GPSService;
  private trackingEngine: TrackingEngine;
  private state: HikingControllerState;
  private listeners: ((state: HikingControllerState) => void)[] = [];
  
  private timerId: NodeJS.Timeout | null = null;
  private unbindGPSPosition: (() => void) | null = null;
  private unbindGPSError: (() => void) | null = null;
  private routePois: POI[] = [];
  private reachedPois: Set<string> = new Set();
  private offRouteBuffer: number[] = [];

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
    this.offRouteBuffer = [];

    this.updateState({
      routeId: routeId || null,
      distanceKm: 0,
      durationSeconds: 0,
      elevationGainM: null,
      paceMinPerKm: 0,
      currentSpeedKmH: 0,
      averageSpeedKmH: 0,
      estimatedEtaMinutes: null,
      positions: [],
      safetyAlerts: [],
      progressPercent: 0,
      isOffRoute: false,
      deviation: null,
    });

    if (routeId) {
      await this.loadRouteDetails(routeId);
    } else {
      this.updateState({ routeName: 'Chamechaude', routeTotalKm: 14.2 });
    }

    this.stateMachine.transitionTo('READY');
    this.stateMachine.transitionTo('TRACKING');

    this.bindGPS();
    this.startTimer();
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
    this.unbindGPS();

    const endedAt = new Date().toISOString();
    const positions = this.trackingEngine.getValidPositions();
    const startedAt = positions.length > 0 ? new Date(positions[0].timestamp).toISOString() : new Date().toISOString();

    let sessionId: string | null = null;

    if (positions.length > 0 && this.state.distanceKm > 0) {
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
          poiEvents: [],
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
      const { data: route } = await supabase
        .from('hiking_routes')
        .select('id, name, distance_km, elevation_gain_m')
        .eq('id', routeId)
        .single();

      if (route) {
        this.updateState({
          routeName: route.name || 'Itinéraire',
          routeTotalKm: Number(route.distance_km) || 14.2,
        });
      }

      const { data: pois } = await supabase
        .from('trail_pois')
        .select('name, geom, category')
        .limit(10);

      if (pois && pois.length > 0) {
        this.routePois = pois
          .filter((p) => p.name && p.geom)
          .map((p, idx) => {
            const match = p.geom?.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
            const lon = match ? parseFloat(match[1]) : 5.8667;
            const lat = match ? parseFloat(match[2]) : 45.2833;
            return {
              id: `poi-${idx}`,
              name: p.name,
              category: p.category || 'waypoint',
              lat,
              lon,
              distance_m: 0,
              bearing_deg: 0,
            };
          });
      }
    } catch (err) {
      console.warn('[HikingController] Failed to load route details:', err);
    }
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
        const remainingKm = this.state.routeTotalKm
          ? Math.max(0, this.state.routeTotalKm - this.state.distanceKm)
          : null;
        const metrics = this.trackingEngine.getMetrics(remainingKm);

        const validPosList = this.trackingEngine.getValidPositions();
        const totalKm = this.state.routeTotalKm || 14.2;
        const progressPct = Math.min(100, Math.max(0, (metrics.distanceKm / totalKm) * 100));

        // Next POI calculation
        let nextPoi: (POI & { distanceRemainingM: number }) | null = null;
        if (this.routePois.length > 0) {
          for (const poi of this.routePois) {
            if (!this.reachedPois.has(poi.name)) {
              const dM = this.calcDistM(pos.latitude, pos.longitude, poi.lat, poi.lon);
              if (dM < 30) {
                this.reachedPois.add(poi.name);
              } else {
                nextPoi = { ...poi, distanceRemainingM: Math.round(dM) };
                break;
              }
            }
          }
        }

        this.updateState({
          distanceKm: metrics.distanceKm,
          elevationGainM: metrics.elevationGainM,
          currentSpeedKmH: metrics.currentSpeedKmH,
          averageSpeedKmH: metrics.averageSpeedKmH,
          paceMinPerKm: metrics.paceMinPerKm,
          estimatedEtaMinutes: metrics.estimatedEtaMinutes,
          positions: validPosList,
          progressPercent: progressPct,
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

  private calcDistM(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
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

      const remainingKm = this.state.routeTotalKm
        ? Math.max(0, this.state.routeTotalKm - this.state.distanceKm)
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
            routeId: parsed.routeId || null,
            routeName: parsed.routeName || 'Chamechaude',
            routeTotalKm: parsed.routeTotalKm || 14.2,
            distanceKm: parsed.distanceKm || 0,
            durationSeconds: parsed.durationSeconds || 0,
            elevationGainM: parsed.elevationGainM || null,
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

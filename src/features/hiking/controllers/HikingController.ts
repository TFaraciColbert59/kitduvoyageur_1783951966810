import { HikingStateMachine } from '../engine/HikingStateMachine';
import { TrackingEngine } from '../engine/TrackingEngine';
import { GPSService } from '../services/GPSService';
import { WeatherService } from '../services/WeatherService';
import { HikeSessionService } from '../services/HikeSessionService';
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
}

export class HikingController {
  private stateMachine: HikingStateMachine;
  private gpsService: GPSService;
  private trackingEngine: TrackingEngine;
  private state: HikingControllerState;
  private listeners: ((state: HikingControllerState) => void)[] = [];
  
  private timerId: NodeJS.Timeout | null = null;
  private unbindGPSPosition: (() => void) | null = null;
  private unbindGPSError: (() => void) | null = null;

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
    };

    this.stateMachine.subscribe((nextState) => {
      this.updateState({
        state: nextState,
        isActive: ['TRACKING', 'PAUSED', 'OFF_ROUTE', 'GPS_WEAK', 'LOW_BATTERY', 'WEATHER_ALERT', 'SAFETY_ALERT'].includes(nextState),
        isPaused: nextState === 'PAUSED',
      });
    });
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
    });

    this.stateMachine.transitionTo('READY');
    this.stateMachine.transitionTo('TRACKING');

    this.bindGPS();
    this.startTimer();
    this.initBattery();
  }

  public pauseHike(): void {
    if (!this.stateMachine.transitionTo('PAUSED')) return;
  }

  public resumeHike(): void {
    this.stateMachine.transitionTo('TRACKING');
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

    this.stateMachine.transitionTo('COMPLETED');
    this.stateMachine.transitionTo('IDLE');

    return sessionId ? { sessionId } : null;
  }

  public dismissOffRoute(): void {
    this.updateState({ isOffRoute: false, deviation: null });
    if (this.stateMachine.getState() === 'OFF_ROUTE') {
      this.stateMachine.transitionTo('TRACKING');
    }
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
        const metrics = this.trackingEngine.getMetrics();
        this.updateState({
          distanceKm: metrics.distanceKm,
          elevationGainM: metrics.elevationGainM,
          currentSpeedKmH: metrics.currentSpeedKmH,
          averageSpeedKmH: metrics.averageSpeedKmH,
          paceMinPerKm: metrics.paceMinPerKm,
          estimatedEtaMinutes: metrics.estimatedEtaMinutes,
          positions: this.trackingEngine.getValidPositions(),
        });
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

      const metrics = this.trackingEngine.getMetrics();
      this.updateState({
        durationSeconds: metrics.activeDurationSeconds,
        paceMinPerKm: metrics.paceMinPerKm,
        averageSpeedKmH: metrics.averageSpeedKmH,
      });
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
}

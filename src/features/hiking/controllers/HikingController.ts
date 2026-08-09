import { HikingStateMachine } from '../engine/HikingStateMachine';
import { HikeEngine } from '../engine/HikeEngine';
import { WeatherService } from '../services/WeatherService';
import { HikeSessionService } from '../services/HikeSessionService';
import {
  HikingState,
  GPSPosition,
  POI,
  WeatherSnapshot,
  SafetyAlert,
  NavigationInstruction,
} from '../types';

export interface HikingControllerState {
  state: HikingState;
  isActive: boolean;
  isPaused: boolean;
  distanceKm: number;
  durationSeconds: number;
  elevationGainM: number | null;
  paceMinPerKm: number;
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
  private state: HikingControllerState;
  private listeners: ((state: HikingControllerState) => void)[] = [];
  private watchId: number | null = null;
  private timerId: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private pausedDuration: number = 0;
  private pauseStartTime: number | null = null;

  constructor() {
    this.stateMachine = new HikingStateMachine('IDLE');
    this.state = {
      state: 'IDLE',
      isActive: false,
      isPaused: false,
      distanceKm: 0,
      durationSeconds: 0,
      elevationGainM: null,
      paceMinPerKm: 0,
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

    this.startTime = Date.now();
    this.pausedDuration = 0;
    this.pauseStartTime = null;

    this.updateState({
      routeId: routeId || null,
      distanceKm: 0,
      durationSeconds: 0,
      elevationGainM: null,
      paceMinPerKm: 0,
      positions: [],
      safetyAlerts: [],
    });

    this.stateMachine.transitionTo('READY');
    this.stateMachine.transitionTo('TRACKING');

    this.startTimer();
    this.startGPSWatch();
    this.initBattery();
  }

  public pauseHike(): void {
    if (!this.stateMachine.transitionTo('PAUSED')) return;
    this.pauseStartTime = Date.now();
  }

  public resumeHike(): void {
    if (this.pauseStartTime) {
      this.pausedDuration += Date.now() - this.pauseStartTime;
      this.pauseStartTime = null;
    }
    this.stateMachine.transitionTo('TRACKING');
  }

  public async stopHike(carnetId?: string): Promise<{ sessionId: string } | null> {
    if (!this.stateMachine.transitionTo('FINISHING')) return null;

    this.stopTimer();
    this.stopGPSWatch();

    const endedAt = new Date().toISOString();
    const startedAt = new Date(this.startTime).toISOString();

    let sessionId: string | null = null;

    if (this.state.positions.length > 0 && this.state.distanceKm > 0) {
      try {
        const res = await HikeSessionService.saveSession({
          routeId: this.state.routeId,
          carnetId: carnetId || null,
          startedAt,
          endedAt,
          distanceKm: this.state.distanceKm,
          durationSeconds: this.state.durationSeconds,
          elevationGainM: this.state.elevationGainM,
          positions: this.state.positions,
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

  private startTimer(): void {
    this.stopTimer();
    this.timerId = setInterval(() => {
      if (this.state.isPaused) return;

      const elapsedMs = Date.now() - this.startTime - this.pausedDuration;
      const durationSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
      const paceMinPerKm = HikeEngine.calculatePaceMinPerKm(durationSeconds, this.state.distanceKm);

      this.updateState({ durationSeconds, paceMinPerKm });
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private startGPSWatch(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    this.stopGPSWatch();
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handleGPSUpdate(pos),
      (err) => console.warn('[HikingController] GPS error:', err?.message || err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }

  private stopGPSWatch(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  private handleGPSUpdate(pos: GeolocationPosition): void {
    if (this.state.isPaused) return;

    const newPos: GPSPosition = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      altitude: pos.coords.altitude,
      accuracy: pos.coords.accuracy,
      altitudeAccuracy: pos.coords.altitudeAccuracy,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      timestamp: pos.timestamp,
    };

    const prevPositions = this.state.positions;
    const lastPos = prevPositions.length > 0 ? prevPositions[prevPositions.length - 1] : null;

    let addedDistKm = 0;
    if (lastPos) {
      addedDistKm = HikeEngine.calculateDistanceKm(
        lastPos.latitude,
        lastPos.longitude,
        newPos.latitude,
        newPos.longitude
      );
      // Filter out small jitter (< 5 meters)
      if (addedDistKm < 0.005) addedDistKm = 0;
    }

    const updatedPositions = [...prevPositions, newPos];
    const totalDistKm = this.state.distanceKm + addedDistKm;
    const elevationGainM = HikeEngine.calculateElevationGain(updatedPositions);

    this.updateState({
      positions: updatedPositions,
      distanceKm: totalDistKm,
      elevationGainM,
    });
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

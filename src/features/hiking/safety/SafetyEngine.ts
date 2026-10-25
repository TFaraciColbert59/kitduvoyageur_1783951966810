import { GPSPosition, WeatherSnapshot, SafetyAlert } from '../types';
import { HikeEngine } from '../engine/HikeEngine';

export type SafetySeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface SafetyStatus {
  alerts: SafetyAlert[];
  highestSeverity: SafetySeverity | 'NONE';
  isImmobile: boolean;
  immobileDurationMinutes: number;
  isNightApproaching: boolean;
  lastValidPosition: GPSPosition | null;
}

export class SafetyEngine {
  private alerts: Map<string, SafetyAlert> = new Map();
  private lastMovementPosition: GPSPosition | null = null;
  private lastMovementTimestampMs: number = Date.now();
  private static readonly IMMOBILITY_THRESHOLD_MINUTES = 15;

  /**
   * Evaluates current hiker safety conditions.
   */
  public evaluateSafety(
    currentPos: GPSPosition | null,
    batteryLevel: number | null,
    weather: WeatherSnapshot | null,
    isOffline: boolean,
    isOffRoute: boolean
  ): SafetyStatus {
    const now = Date.now();

    // 1. Immobility Check
    let isImmobile = false;
    let immobileDurationMinutes = 0;

    if (currentPos) {
      if (!this.lastMovementPosition) {
        this.lastMovementPosition = currentPos;
        this.lastMovementTimestampMs = now;
      } else {
        const distM = HikeEngine.calculateDistanceKm(
          this.lastMovementPosition.latitude,
          this.lastMovementPosition.longitude,
          currentPos.latitude,
          currentPos.longitude
        ) * 1000;

        if (distM > 15) {
          // Reset immobility timer when user moves > 15m
          this.lastMovementPosition = currentPos;
          this.lastMovementTimestampMs = now;
        } else {
          immobileDurationMinutes = Math.floor((now - this.lastMovementTimestampMs) / (60 * 1000));
          if (immobileDurationMinutes >= SafetyEngine.IMMOBILITY_THRESHOLD_MINUTES) {
            isImmobile = true;
            this.setAlert({
              id: 'immobility-warning',
              type: 'sos',
              severity: 'warning',
              message: `Immobilité détectée depuis ${immobileDurationMinutes} minutes. Tout va bien ?`,
              timestamp: new Date().toISOString(),
              location: { lat: currentPos.latitude, lon: currentPos.longitude },
            });
          }
        }
      }
    }

    // 2. Battery Check
    if (batteryLevel != null) {
      if (batteryLevel <= 5) {
        this.setAlert({
          id: 'battery-critical',
          type: 'battery',
          severity: 'critical',
          message: `Batterie critique (${batteryLevel}%). Activez l'économie d'énergie.`,
          timestamp: new Date().toISOString(),
        });
      } else if (batteryLevel <= 15) {
        this.setAlert({
          id: 'battery-warning',
          type: 'battery',
          severity: 'warning',
          message: `Batterie faible (${batteryLevel}%).`,
          timestamp: new Date().toISOString(),
        });
      } else {
        this.removeAlert('battery-critical');
        this.removeAlert('battery-warning');
      }
    }

    // 3. Off-Route Check
    if (isOffRoute && currentPos) {
      this.setAlert({
        id: 'offroute-warning',
        type: 'off-route',
        severity: 'warning',
        message: 'Vous vous êtes éloigné du sentier prévu.',
        timestamp: new Date().toISOString(),
        location: { lat: currentPos.latitude, lon: currentPos.longitude },
      });
    } else {
      this.removeAlert('offroute-warning');
    }

    // 4. Dangerous Weather Check
    if (weather?.isAlert && weather.alertMessage) {
      this.setAlert({
        id: 'weather-alert',
        type: 'weather',
        severity: weather.condition.includes('Orage') ? 'critical' : 'warning',
        message: weather.alertMessage,
        timestamp: new Date().toISOString(),
      });
    } else {
      this.removeAlert('weather-alert');
    }

    // 5. Nightfall Approach Check (Time between 19:00 and 06:00)
    const currentHour = new Date().getHours();
    const isNightApproaching = currentHour >= 19 || currentHour < 6;
    if (isNightApproaching) {
      this.setAlert({
        id: 'night-info',
        type: 'weather',
        severity: 'info',
        message: 'La nuit approche. Assurez-vous d\'avoir votre lampe frontale.',
        timestamp: new Date().toISOString(),
      });
    } else {
      this.removeAlert('night-info');
    }

    // Calculate Highest Severity
    const alertList = Array.from(this.alerts.values());
    let highestSeverity: SafetySeverity | 'NONE' = 'NONE';
    if (alertList.some((a) => a.severity === 'critical')) {
      highestSeverity = 'CRITICAL';
    } else if (alertList.some((a) => a.severity === 'warning')) {
      highestSeverity = 'WARNING';
    } else if (alertList.length > 0) {
      highestSeverity = 'INFO';
    }

    return {
      alerts: alertList,
      highestSeverity,
      isImmobile,
      immobileDurationMinutes,
      isNightApproaching,
      lastValidPosition: currentPos,
    };
  }

  /**
   * Format GPS coordinates into standard WGS84 and DMS format for emergency radio/phone transmission.
   */
  public static formatEmergencyCoordinates(lat: number, lon: number, altitudeM?: number | null): string {
    const latStr = `${lat >= 0 ? 'N' : 'S'} ${Math.abs(lat).toFixed(5)}°`;
    const lonStr = `${lon >= 0 ? 'E' : 'W'} ${Math.abs(lon).toFixed(5)}°`;
    const altStr = altitudeM != null ? ` · Alt: ${Math.round(altitudeM)} m` : '';
    return `${latStr}, ${lonStr}${altStr}`;
  }

  private setAlert(alert: SafetyAlert): void {
    this.alerts.set(alert.id, alert);
  }

  private removeAlert(id: string): void {
    this.alerts.delete(id);
  }
}

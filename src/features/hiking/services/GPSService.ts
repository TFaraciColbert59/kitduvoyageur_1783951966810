import { GPSPosition } from '../types';

export type GPSServiceCallback = (position: GPSPosition) => void;
export type GPSServiceErrorCallback = (error: { code: number; message: string }) => void;

export interface GPSServiceOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export class GPSService {
  private watchId: number | null = null;
  private onPositionCallbacks: Set<GPSServiceCallback> = new Set();
  private onErrorCallbacks: Set<GPSServiceErrorCallback> = new Set();
  private isTrackingActive: boolean = false;

  /**
   * Request permission to use Geolocation API.
   */
  public async requestPermission(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return false;
    }

    // Permission API check where available
    if ('permissions' in navigator && typeof navigator.permissions.query === 'function') {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        return result.state === 'granted' || result.state === 'prompt';
      } catch {
        // Fallback to basic check
      }
    }

    return true;
  }

  /**
   * Get single current GPS position.
   */
  public async getCurrentPosition(options?: GPSServiceOptions): Promise<GPSPosition> {
    const opts = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
      ...options,
    };

    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('Géolocalisation non supportée par le navigateur.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(this.formatPosition(pos)),
        (err) => reject({ code: err.code, message: err.message }),
        opts
      );
    });
  }

  /**
   * Start watching continuous GPS positions.
   */
  public startTracking(options?: GPSServiceOptions): void {
    if (this.isTrackingActive || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    const opts = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 3000,
      ...options,
    };

    this.isTrackingActive = true;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const formatted = this.formatPosition(pos);
        this.onPositionCallbacks.forEach((cb) => cb(formatted));
      },
      (err) => {
        const formattedErr = { code: err.code, message: err.message };
        this.onErrorCallbacks.forEach((cb) => cb(formattedErr));
      },
      opts
    );
  }

  /**
   * Stop watching GPS positions.
   */
  public stopTracking(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTrackingActive = false;
  }

  public onPosition(callback: GPSServiceCallback): () => void {
    this.onPositionCallbacks.add(callback);
    return () => this.onPositionCallbacks.delete(callback);
  }

  public onError(callback: GPSServiceErrorCallback): () => void {
    this.onErrorCallbacks.add(callback);
    return () => this.onErrorCallbacks.delete(callback);
  }

  public injectPosition(pos: GPSPosition): void {
    this.onPositionCallbacks.forEach((cb) => cb(pos));
  }

  public isTracking(): boolean {
    return this.isTrackingActive;
  }

  private formatPosition(pos: GeolocationPosition): GPSPosition {
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      altitude: pos.coords.altitude,
      accuracy: pos.coords.accuracy,
      altitudeAccuracy: pos.coords.altitudeAccuracy,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      timestamp: pos.timestamp || Date.now(),
    };
  }
}

import { Geolocation, Position, PositionOptions } from "@capacitor/geolocation";
import { isNative } from "./platform";

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

/**
 * Recupere la position GPS actuelle (Natif Capacitor ou Web navigator.geolocation)
 */
export async function getCurrentGeoPosition(options?: PositionOptions): Promise<GeoCoordinates> {
  const defaultOpts: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 5000,
    ...options,
  };

  if (isNative()) {
    // Demander la permission si necessaire
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location !== "granted") {
        await Geolocation.requestPermissions();
      }
    } catch {
      // Continuer tentative
    }

    const pos = await Geolocation.getCurrentPosition(defaultOpts);
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      altitude: pos.coords.altitude ?? null,
      altitudeAccuracy: pos.coords.altitudeAccuracy ?? null,
      heading: pos.coords.heading ?? null,
      speed: pos.coords.speed ?? null,
      timestamp: pos.timestamp,
    };
  }

  // Web fallback
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("Géolocalisation non supportée sur ce navigateur"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        });
      },
      (err) => reject(err),
      defaultOpts
    );
  });
}

/**
 * Suivi en temps reel de la position GPS (utile pour mode navigation / rando active)
 */
export async function watchGeoPosition(
  callback: (pos: GeoCoordinates | null, error?: Error) => void,
  options?: PositionOptions
): Promise<string> {
  const defaultOpts: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 3000,
    ...options,
  };

  if (isNative()) {
    return await Geolocation.watchPosition(defaultOpts, (position, err) => {
      if (err) {
        callback(null, new Error(err.message));
        return;
      }
      if (position) {
        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude ?? null,
          altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
          heading: position.coords.heading ?? null,
          speed: position.coords.speed ?? null,
          timestamp: position.timestamp,
        });
      }
    });
  }

  // Web fallback
  if (typeof window !== "undefined" && "geolocation" in navigator) {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        callback({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        });
      },
      (err) => callback(null, new Error(err.message)),
      defaultOpts
    );
    return `web_${watchId}`;
  }

  return "";
}

/**
 * Arrete le suivi de position
 */
export async function clearGeoWatch(watchId: string): Promise<void> {
  if (!watchId) return;

  if (watchId.startsWith("web_")) {
    const id = parseInt(watchId.replace("web_", ""), 10);
    if (!isNaN(id) && typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(id);
    }
    return;
  }

  if (isNative()) {
    await Geolocation.clearWatch({ id: watchId });
  }
}

"use client";

import { useState, useCallback } from "react";
import { getCurrentGeoPosition } from "@/lib/native/geolocation";

interface GeolocationState {
  position: GeolocationPosition | null;
  error: GeolocationPositionError | Error | null;
  loading: boolean;
  requestPermission: () => Promise<void>;
}

export function useGeolocation(): GeolocationState {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<GeolocationPositionError | Error | null>(null);
  const [loading, setLoading] = useState(false);

  const requestPermission = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const geo = await getCurrentGeoPosition({ enableHighAccuracy: true });
      const posObj: GeolocationPosition = {
        coords: {
          latitude: geo.latitude,
          longitude: geo.longitude,
          accuracy: geo.accuracy,
          altitude: geo.altitude,
          altitudeAccuracy: geo.altitudeAccuracy,
          heading: geo.heading,
          speed: geo.speed,
          toJSON: () => ({ ...geo }),
        },
        timestamp: geo.timestamp,
        toJSON: () => ({
          coords: { ...geo },
          timestamp: geo.timestamp,
        }),
      };
      setPosition(posObj);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  return { position, error, loading, requestPermission };
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { HikingController, HikingControllerState } from '../controllers/HikingController';

// Global singleton instance of HikingController for app-wide continuity
const controllerInstance = new HikingController();

export function useHikingStore(): HikingControllerState & {
  startHike: (routeId?: string) => Promise<void>;
  pauseHike: () => void;
  resumeHike: () => void;
  stopHike: (carnetId?: string) => Promise<{ sessionId: string } | null>;
  dismissOffRoute: () => void;
  fetchWeather: (lat: number, lon: number) => Promise<unknown>;
} {
  const [state, setState] = useState<HikingControllerState>(() => controllerInstance.getState());
  const controllerRef = useRef<HikingController>(controllerInstance);

  useEffect(() => {
    const unsubscribe = controllerRef.current.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  return {
    ...state,
    startHike: (routeId?: string) => controllerRef.current.startHike(routeId),
    pauseHike: () => controllerRef.current.pauseHike(),
    resumeHike: () => controllerRef.current.resumeHike(),
    stopHike: (carnetId?: string) => controllerRef.current.stopHike(carnetId),
    dismissOffRoute: () => controllerRef.current.dismissOffRoute(),
    fetchWeather: (lat: number, lon: number) => controllerRef.current.fetchWeather(lat, lon),
  };
}

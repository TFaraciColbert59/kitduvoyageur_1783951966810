'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { HikingController, HikingControllerState } from '../controllers/HikingController';

// Global singleton instance of HikingController for app-wide continuity
const controllerInstance = new HikingController();

export interface HikingActions {
  startHike: (routeId?: string, kitId?: string | null, tripId?: string | null) => Promise<void>;
  pauseHike: () => void;
  resumeHike: () => void;
  stopHike: (carnetId?: string) => Promise<{ sessionId: string; carnetId?: string | null } | null>;
  setKit: (kitId: string | null) => void;
  dismissOffRoute: () => void;
  fetchWeather: (lat: number, lon: number) => Promise<unknown>;
}

export function useHikingStore(): HikingControllerState & HikingActions {
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
    startHike: (routeId?: string, kitId?: string | null, tripId?: string | null) =>
      controllerRef.current.startHike(routeId, kitId, tripId),
    pauseHike: () => controllerRef.current.pauseHike(),
    resumeHike: () => controllerRef.current.resumeHike(),
    stopHike: (carnetId?: string) => controllerRef.current.stopHike(carnetId),
    setKit: (kitId: string | null) => controllerRef.current.setKit(kitId),
    dismissOffRoute: () => controllerRef.current.dismissOffRoute(),
    fetchWeather: (lat: number, lon: number) => controllerRef.current.fetchWeather(lat, lon),
  };
}

/**
 * Lecture ponctuelle de l'etat du traceur, SANS abonnement.
 *
 * Le controleur publie a chaque point GPS : s'y abonner re-rend l'ecran
 * environ une fois par seconde. Reserve aux ecrans qui ont besoin d'une
 * valeur ponctuelle (un resume, une proposition) et pas d'un flux vivant.
 */
export function getHikingSnapshot(): HikingControllerState {
  return controllerInstance.getState();
}

/**
 * Actions seules, a identite stable, sans abonnement a l'etat.
 *
 * Un ecran qui ne fait que *declencher* une action ne doit pas se re-rendre a
 * chaque point GPS : les identites stables gardent ses `useCallback` utiles.
 */
export function useHikingActions(): HikingActions {
  return useMemo(
    () => ({
      startHike: (routeId?: string, kitId?: string | null, tripId?: string | null) =>
        controllerInstance.startHike(routeId, kitId, tripId),
      pauseHike: () => controllerInstance.pauseHike(),
      resumeHike: () => controllerInstance.resumeHike(),
      stopHike: (carnetId?: string) => controllerInstance.stopHike(carnetId),
      setKit: (kitId: string | null) => controllerInstance.setKit(kitId),
      dismissOffRoute: () => controllerInstance.dismissOffRoute(),
      fetchWeather: (lat: number, lon: number) => controllerInstance.fetchWeather(lat, lon),
    }),
    [],
  );
}

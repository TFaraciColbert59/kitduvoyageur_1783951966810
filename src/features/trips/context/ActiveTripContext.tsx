'use client';

import React, { createContext, useContext, useState, useTransition, useCallback, useEffect } from 'react';
import type { ActiveTripData } from './activeTripSchema';
import { setActiveTripAction, clearActiveTripAction } from './activeTripServer';

export interface ActiveTripContextValue {
  activeTrip: ActiveTripData | null;
  setActiveTrip: (trip: ActiveTripData) => Promise<boolean>;
  clearActiveTrip: () => Promise<boolean>;
  isCurrentTripActive: (tripId: string) => boolean;
  isPending: boolean;
}

const ActiveTripContext = createContext<ActiveTripContextValue | undefined>(undefined);

export interface ActiveTripProviderProps {
  initialTrip?: ActiveTripData | null;
  children: React.ReactNode;
}

export function ActiveTripProvider({ initialTrip = null, children }: ActiveTripProviderProps) {
  const [activeTrip, setActiveTripState] = useState<ActiveTripData | null>(initialTrip);
  const [isPending, startTransition] = useTransition();

  // Synchronisation client au montage pour les pages statiques
  useEffect(() => {
    if (!initialTrip) {
      try {
        const stored = localStorage.getItem('lkdv_active_trip');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.id && parsed?.slug && parsed?.title) {
            setActiveTripState(parsed);
          }
        }
      } catch {
        // Ignorer les erreurs d'accès stockage local
      }
    }
  }, [initialTrip]);

  const setActiveTrip = useCallback(async (trip: ActiveTripData): Promise<boolean> => {
    setActiveTripState(trip);
    try {
      localStorage.setItem('lkdv_active_trip', JSON.stringify(trip));
    } catch {
      // Ignorer erreur localStorage
    }
    return new Promise(resolve => {
      startTransition(async () => {
        const res = await setActiveTripAction(trip);
        resolve(res.success);
      });
    });
  }, []);

  const clearActiveTrip = useCallback(async (): Promise<boolean> => {
    setActiveTripState(null);
    try {
      localStorage.removeItem('lkdv_active_trip');
    } catch {
      // Ignorer erreur localStorage
    }
    return new Promise(resolve => {
      startTransition(async () => {
        const res = await clearActiveTripAction();
        resolve(res.success);
      });
    });
  }, []);

  const isCurrentTripActive = useCallback(
    (tripId: string) => {
      return activeTrip?.id === tripId;
    },
    [activeTrip]
  );

  return (
    <ActiveTripContext.Provider
      value={{
        activeTrip,
        setActiveTrip,
        clearActiveTrip,
        isCurrentTripActive,
        isPending,
      }}
    >
      {children}
    </ActiveTripContext.Provider>
  );
}

const fallbackActiveTripContext: ActiveTripContextValue = {
  activeTrip: null,
  setActiveTrip: async () => false,
  clearActiveTrip: async () => false,
  isCurrentTripActive: () => false,
  isPending: false,
};

export function useActiveTrip(): ActiveTripContextValue {
  const context = useContext(ActiveTripContext);
  if (!context) {
    return fallbackActiveTripContext;
  }
  return context;
}

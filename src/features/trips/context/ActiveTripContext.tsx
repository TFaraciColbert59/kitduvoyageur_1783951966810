'use client';

import React, { createContext, useContext, useState, useTransition, useCallback, useEffect } from 'react';
import type { ActiveTripData, TripLite } from './activeTripSchema';
import { setActiveTripAction, clearActiveTripAction } from './activeTripServer';

export interface ActiveTripContextValue {
  activeTrip: ActiveTripData | null;
  setActiveTrip: (trip: ActiveTripData) => Promise<boolean>;
  /** Y3.3 — active un voyage par slug (recherche dans la liste utilisateur). */
  setActiveTripBySlug: (slug: string) => Promise<boolean>;
  clearActiveTrip: () => Promise<boolean>;
  isCurrentTripActive: (tripId: string) => boolean;
  isPending: boolean;
  /** Y3.3 — liste des voyages de l'utilisateur (sélecteur, §2.4). */
  userTrips: TripLite[];
  reloadUserTrips: () => Promise<void>;
  /** Y3.3/Y5.2 — dernière section visitée par voyage (mémoire locale). */
  getLastSection: (slug: string) => string | null;
  setLastSection: (slug: string, sectionId: string) => void;
}

const LAST_SECTION_KEY = 'lkdv_trip_last_section';
const USER_TRIPS_KEY = 'lkdv_user_trips_cache';

const ActiveTripContext = createContext<ActiveTripContextValue | undefined>(undefined);

export interface ActiveTripProviderProps {
  initialTrip?: ActiveTripData | null;
  children: React.ReactNode;
}

function readLastSections(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LAST_SECTION_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function ActiveTripProvider({ initialTrip = null, children }: ActiveTripProviderProps) {
  const [activeTrip, setActiveTripState] = useState<ActiveTripData | null>(initialTrip);
  const [userTrips, setUserTrips] = useState<TripLite[]>([]);
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

  // Y3.3 — cache userTrips (localStorage) + premier chargement serveur
  const reloadUserTrips = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/voyages/mine', { cache: 'no-store' });
      const data = await res.json();
      const trips = (data?.trips ?? []) as TripLite[];
      setUserTrips(trips);
      try {
        localStorage.setItem(USER_TRIPS_KEY, JSON.stringify({ at: Date.now(), trips }));
      } catch {
        /* stockage indisponible */
      }
    } catch {
      // fallback sur le cache local
      try {
        const cached = localStorage.getItem(USER_TRIPS_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed?.trips)) setUserTrips(parsed.trips);
        }
      } catch {
        /* ignoré */
      }
    }
  }, []);

  useEffect(() => {
    reloadUserTrips();
  }, [reloadUserTrips]);

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

  const setActiveTripBySlug = useCallback(
    async (slug: string): Promise<boolean> => {
      const trip = userTrips.find((t) => t.slug === slug);
      if (!trip) return false;
      return setActiveTrip({ id: trip.id, slug: trip.slug, title: trip.title });
    },
    [userTrips, setActiveTrip]
  );

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

  const getLastSection = useCallback((slug: string): string | null => {
    try {
      return readLastSections()[slug] ?? null;
    } catch {
      return null;
    }
  }, []);

  const setLastSection = useCallback((slug: string, sectionId: string) => {
    try {
      const map = readLastSections();
      map[slug] = sectionId;
      localStorage.setItem(LAST_SECTION_KEY, JSON.stringify(map));
    } catch {
      /* ignoré */
    }
  }, []);

  return (
    <ActiveTripContext.Provider
      value={{
        activeTrip,
        setActiveTrip,
        setActiveTripBySlug,
        clearActiveTrip,
        isCurrentTripActive,
        isPending,
        userTrips,
        reloadUserTrips,
        getLastSection,
        setLastSection,
      }}
    >
      {children}
    </ActiveTripContext.Provider>
  );
}

const fallbackActiveTripContext: ActiveTripContextValue = {
  activeTrip: null,
  setActiveTrip: async () => false,
  setActiveTripBySlug: async () => false,
  clearActiveTrip: async () => false,
  isCurrentTripActive: () => false,
  isPending: false,
  userTrips: [],
  reloadUserTrips: async () => {},
  getLastSection: () => null,
  setLastSection: () => {},
};

export function useActiveTrip(): ActiveTripContextValue {
  const context = useContext(ActiveTripContext);
  if (!context) {
    return fallbackActiveTripContext;
  }
  return context;
}

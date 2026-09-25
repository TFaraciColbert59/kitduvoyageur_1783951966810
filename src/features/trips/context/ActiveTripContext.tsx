'use client';

import React, { createContext, useContext, useState, useTransition, useCallback, useEffect } from 'react';
import type { ActiveTripData, TripLite } from './activeTripSchema';
import { setActiveTripAction, clearActiveTripAction } from './activeTripServer';
import { useAuth } from '@/contexts/AuthContext';

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
const ACTIVE_KEY = 'lkdv_active_trip';
const PRIVATE_CONTEXT_KEYS = [
  ACTIVE_KEY,
  USER_TRIPS_KEY,
  LAST_SECTION_KEY,
  'lkdv_active_adventure',
  'lkdv_hub_adventures_cache',
  'lkdv_adventure_last_section',
] as const;

export function tripStorageKey(base: string, userId: string | null): string | null {
  return userId ? `${base}:${userId}` : null;
}

/** Legacy unscoped data is discarded; an account's scoped data is discarded on exit. */
export function clearPrivateContextStorage(userId: string | null, storage: Pick<Storage, 'removeItem'>): void {
  for (const base of PRIVATE_CONTEXT_KEYS) {
    storage.removeItem(userId ? `${base}:${userId}` : base);
  }
}

const ActiveTripContext = createContext<ActiveTripContextValue | undefined>(undefined);

export interface ActiveTripProviderProps {
  initialTrip?: ActiveTripData | null;
  children: React.ReactNode;
}

function readLastSections(storageKey: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

export function ActiveTripProvider({ initialTrip = null, children }: ActiveTripProviderProps) {
  const { user, loading } = useAuth();
  const userId = loading ? null : user?.id ?? null;
  const previousUserId = React.useRef<string | null | undefined>(undefined);
  useEffect(() => {
    try {
      if (previousUserId.current === undefined) clearPrivateContextStorage(null, localStorage);
      else if (previousUserId.current !== userId && previousUserId.current) {
        clearPrivateContextStorage(previousUserId.current, localStorage);
      }
    } catch {
      // Storage may be unavailable in private browsing.
    }
    previousUserId.current = userId;
  }, [userId]);
  return <ActiveTripProviderForUser key={userId ?? 'no-auth'} userId={userId} initialTrip={initialTrip}>{children}</ActiveTripProviderForUser>;
}

function ActiveTripProviderForUser({ userId, initialTrip, children }: ActiveTripProviderProps & { userId: string | null }) {
  const [activeTrip, setActiveTripState] = useState<ActiveTripData | null>(null);
  const [userTrips, setUserTrips] = useState<TripLite[]>([]);
  const [isPending, startTransition] = useTransition();
  const mountedRef = React.useRef(true);
  const initialSelectionResolved = React.useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const activeKey = tripStorageKey(ACTIVE_KEY, userId);
  const tripsKey = tripStorageKey(USER_TRIPS_KEY, userId);
  const sectionsKey = tripStorageKey(LAST_SECTION_KEY, userId);

  // Synchronisation client au montage pour les pages statiques
  useEffect(() => {
    if (activeKey) {
      try {
        const stored = localStorage.getItem(activeKey);
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
  }, [activeKey]);

  // Y3.3 — cache userTrips (localStorage) + premier chargement serveur
  const reloadUserTrips = useCallback(async (): Promise<void> => {
    if (!userId || !tripsKey) return;
    try {
      const res = await fetch('/api/voyages/mine', { cache: 'no-store' });
      if (!res.ok) throw new Error('Trip list unavailable');
      const data = await res.json();
      if (!mountedRef.current) return;
      const trips = (Array.isArray(data?.trips) ? data.trips : []) as TripLite[];
      setUserTrips(trips);
      if (!initialSelectionResolved.current && initialTrip && trips.some((trip) => trip.id === initialTrip.id)) {
        setActiveTripState((current) => current ?? initialTrip);
      }
      initialSelectionResolved.current = true;
      try {
        localStorage.setItem(tripsKey, JSON.stringify({ at: Date.now(), trips }));
      } catch {
        /* stockage indisponible */
      }
    } catch {
      // fallback sur le cache local
      try {
        if (!mountedRef.current) return;
        const cached = localStorage.getItem(tripsKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed?.trips)) setUserTrips(parsed.trips);
        }
      } catch {
        /* ignoré */
      }
    }
  }, [userId, tripsKey, initialTrip]);

  useEffect(() => {
    reloadUserTrips();
  }, [reloadUserTrips]);

  const setActiveTrip = useCallback(async (trip: ActiveTripData): Promise<boolean> => {
    if (!activeKey || !mountedRef.current) return false;
    initialSelectionResolved.current = true;
    setActiveTripState(trip);
    try {
      localStorage.setItem(activeKey, JSON.stringify(trip));
    } catch {
      // Ignorer erreur localStorage
    }
    return new Promise(resolve => {
      startTransition(async () => {
        const res = await setActiveTripAction(trip);
        resolve(res.success);
      });
    });
  }, [activeKey]);

  const setActiveTripBySlug = useCallback(
    async (slug: string): Promise<boolean> => {
      const trip = userTrips.find((t) => t.slug === slug);
      if (!trip) return false;
      return setActiveTrip({ id: trip.id, slug: trip.slug, title: trip.title });
    },
    [userTrips, setActiveTrip]
  );

  const clearActiveTrip = useCallback(async (): Promise<boolean> => {
    if (!activeKey || !mountedRef.current) return false;
    initialSelectionResolved.current = true;
    setActiveTripState(null);
    try {
      localStorage.removeItem(activeKey);
    } catch {
      // Ignorer erreur localStorage
    }
    return new Promise(resolve => {
      startTransition(async () => {
        const res = await clearActiveTripAction();
        resolve(res.success);
      });
    });
  }, [activeKey]);

  const isCurrentTripActive = useCallback(
    (tripId: string) => {
      return activeTrip?.id === tripId;
    },
    [activeTrip]
  );

  const getLastSection = useCallback((slug: string): string | null => {
    if (!sectionsKey) return null;
    try {
      return readLastSections(sectionsKey)[slug] ?? null;
    } catch {
      return null;
    }
  }, [sectionsKey]);

  const setLastSection = useCallback((slug: string, sectionId: string) => {
    if (!sectionsKey) return;
    try {
      const map = { ...readLastSections(sectionsKey), [slug]: sectionId };
      localStorage.setItem(sectionsKey, JSON.stringify(map));
    } catch {
      /* ignoré */
    }
  }, [sectionsKey]);

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

'use client';

import React, { createContext, useContext, useState, useTransition, useCallback, useEffect, useMemo } from 'react';
import { useActiveTrip } from '@/features/trips/context/ActiveTripContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  parseStoredAdventure,
  type ActiveAdventureData,
} from './adventureSchema';
import { setActiveAdventureAction, clearActiveAdventureAction } from './activeAdventureServer';
import {
  adventureKey,
  groupAdventures,
  type AdventureEntry,
  type AdventureGroups,
  type GroupLite,
  type PossessionSummary,
} from './adventureLists';
import {
  suggestActiveAdventure,
  type AdventureSuggestion,
} from '../engine/suggestAdventure';

/**
 * H2.2 — Contexte d'aventure active du hub (généralisation d'ActiveTripContext).
 * Union des 3 natures : possession (singleton local), sortie (via le contexte
 * Y existant — jamais re-fetché), collectif (groupes servis par
 * /api/hub/adventures, cache localStorage). Mémoire de section par aventure :
 * le hub réinitialise sur la bonne dernière section et survit au rechargement.
 */

export interface ActiveAdventureContextValue {
  activeAdventure: ActiveAdventureData | null;
  setActiveAdventure: (adventure: ActiveAdventureData) => Promise<boolean>;
  /** Active par clé stable (`possession`, `sortie:slug`, `collectif:kind:id`). */
  setActiveAdventureByKey: (key: string) => Promise<boolean>;
  clearActiveAdventure: () => Promise<boolean>;
  isCurrentAdventure: (key: string) => boolean;
  isPending: boolean;
  /** Listes groupées par nature (jamais restreintes — §2.3). */
  groups: AdventureGroups;
  reloadAdventures: () => Promise<void>;
  /** Suggestion IA déterministe (jamais restrictive — §H5). */
  suggestion: AdventureSuggestion | null;
  /** Mémoire de section par aventure (clé stable → sectionId). */
  getLastSection: (key: string) => string | null;
  setLastSection: (key: string, sectionId: string) => void;
}

const ACTIVE_KEY = 'lkdv_active_adventure';
const LAST_SECTION_KEY = 'lkdv_adventure_last_section';
const ADVENTURES_CACHE_KEY = 'lkdv_hub_adventures_cache';

export function adventureStorageKey(base: string, userId: string | null): string | null {
  return userId ? `${base}:${userId}` : null;
}

const ActiveAdventureContext = createContext<ActiveAdventureContextValue | undefined>(undefined);

export interface ActiveAdventureProviderProps {
  initialAdventure?: ActiveAdventureData | null;
  children: React.ReactNode;
}

interface AdventuresCache {
  groups: GroupLite[];
  possession: PossessionSummary;
  pendingInvites: number;
}

const EMPTY_CACHE: AdventuresCache = {
  groups: [],
  possession: { itemsCount: 0, loansCount: 0, alertsCount: 0 },
  pendingInvites: 0,
};

function readLastSections(storageKey: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

function keyOf(data: ActiveAdventureData): string {
  const entry = dataToEntry(data);
  return adventureKey(entry);
}

/** Convertit une aventure persistée en entrée de liste (recherche par clé). */
function dataToEntry(data: ActiveAdventureData): AdventureEntry {
  switch (data.nature) {
    case 'possession':
      return { nature: 'possession', itemsCount: 0, loansCount: 0, alertsCount: 0 };
    case 'sortie':
      return { nature: 'sortie', id: data.id, slug: data.slug, title: data.title };
    case 'collectif':
      return { nature: 'collectif', id: data.id, title: data.title, membersCount: 0, subtitle: '', linkedTripSlug: null };
  }
}

export function ActiveAdventureProvider({ initialAdventure = null, children }: ActiveAdventureProviderProps) {
  const { user, loading } = useAuth();
  const userId = loading ? null : user?.id ?? null;
  return <ActiveAdventureProviderForUser key={userId ?? 'no-auth'} userId={userId} initialAdventure={initialAdventure}>{children}</ActiveAdventureProviderForUser>;
}

function ActiveAdventureProviderForUser({ userId, initialAdventure, children }: ActiveAdventureProviderProps & { userId: string | null }) {
  const { userTrips, reloadUserTrips } = useActiveTrip();
  const [activeAdventure, setActiveAdventureState] = useState<ActiveAdventureData | null>(null);
  const [cache, setCache] = useState<AdventuresCache>(EMPTY_CACHE);
  const [isPending, startTransition] = useTransition();
  const mountedRef = React.useRef(true);
  const initialSelectionResolved = React.useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const activeKey = adventureStorageKey(ACTIVE_KEY, userId);
  const cacheKey = adventureStorageKey(ADVENTURES_CACHE_KEY, userId);
  const sectionsKey = adventureStorageKey(LAST_SECTION_KEY, userId);

  // Restauration au montage (le hub s'ouvre sur l'aventure, jamais une liste d'abord).
  useEffect(() => {
    if (activeKey) {
      try {
        const stored = localStorage.getItem(activeKey);
        const parsed = parseStoredAdventure(stored);
        if (parsed) setActiveAdventureState(parsed);
      } catch {
        /* stockage indisponible */
      }
    }
  }, [activeKey]);

  const reloadAdventures = useCallback(async (): Promise<void> => {
    if (!userId || !cacheKey) return;
    await reloadUserTrips();
    if (!mountedRef.current) return;
    try {
      const res = await fetch('/api/hub/adventures', { cache: 'no-store' });
      if (!res.ok) throw new Error('Adventures unavailable');
      const data = await res.json();
      if (!mountedRef.current) return;
      const next: AdventuresCache = {
        groups: Array.isArray(data?.groups) ? data.groups : [],
        possession: {
          itemsCount: Number(data?.possession?.items ?? 0),
          loansCount: Number(data?.possession?.loans ?? 0),
          alertsCount: Number(data?.possession?.alerts ?? 0),
        },
        pendingInvites: Number(data?.pendingInvites ?? 0),
      };
      setCache(next);
      if (!initialSelectionResolved.current && initialAdventure?.nature === 'collectif' && next.groups.some((group) => group.id === initialAdventure.id)) {
        setActiveAdventureState((current) => current ?? initialAdventure);
      } else if (!initialSelectionResolved.current && initialAdventure?.nature === 'possession') {
        setActiveAdventureState((current) => current ?? initialAdventure);
      }
      if (initialAdventure?.nature !== 'sortie') initialSelectionResolved.current = true;
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), ...next }));
      } catch {
        /* stockage indisponible */
      }
    } catch {
      try {
        if (!mountedRef.current) return;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          setCache({
            groups: Array.isArray(parsed?.groups) ? parsed.groups : [],
            possession: {
              itemsCount: Number(parsed?.possession?.itemsCount ?? 0),
              loansCount: Number(parsed?.possession?.loansCount ?? 0),
              alertsCount: Number(parsed?.possession?.alertsCount ?? 0),
            },
            pendingInvites: Number(parsed?.pendingInvites ?? 0),
          });
        }
      } catch {
        /* ignoré */
      }
    }
  }, [userId, cacheKey, reloadUserTrips, initialAdventure]);

  useEffect(() => {
    if (!userId || initialSelectionResolved.current || initialAdventure?.nature !== 'sortie') return;
    if (userTrips.some((trip) => trip.id === initialAdventure.id)) {
      setActiveAdventureState((current) => current ?? initialAdventure);
      initialSelectionResolved.current = true;
    }
  }, [userId, userTrips, initialAdventure]);

  useEffect(() => {
    reloadAdventures();
  }, [reloadAdventures]);

  const groups: AdventureGroups = useMemo(
    () =>
      groupAdventures(
        userTrips.map((t) => ({ id: t.id, slug: t.slug, title: t.title, status: t.status, primary_activity: t.primary_activity })),
        cache.groups,
        cache.possession,
      ),
    [userTrips, cache],
  );

  // Suggestion IA déterministe (règles pures, mêmes entrées → même sortie).
  const suggestion: AdventureSuggestion | null = useMemo(
    () =>
      suggestActiveAdventure(
        {
          trips: userTrips.map((t) => ({ id: t.id, slug: t.slug, title: t.title, start_date: t.start_date ?? null })),
          groups: cache.groups.map((g) => ({ id: g.id, name: g.name, member_count: g.member_count })),
          possession: cache.possession,
          pendingInvites: cache.pendingInvites,
        },
        new Date(),
      ),
    [userTrips, cache],
  );

  const activeAdventureRef = React.useRef<ActiveAdventureData | null>(null);
  useEffect(() => {
    activeAdventureRef.current = activeAdventure;
  }, [activeAdventure]);

  const persist = useCallback(async (data: ActiveAdventureData | null): Promise<boolean> => {
    if (!activeKey || !mountedRef.current) return false;
    initialSelectionResolved.current = true;
    const previous = activeAdventureRef.current;
    const applyLocal = (value: ActiveAdventureData | null) => {
      setActiveAdventureState(value);
      try {
        if (value) localStorage.setItem(activeKey, JSON.stringify(value));
        else localStorage.removeItem(activeKey);
      } catch {
        /* stockage indisponible */
      }
    };
    applyLocal(data);
    // Robustesse (réseau / PWA) : l'action peut rejeter ou ne jamais répondre —
    // on résout toujours (jamais de hang), et en échec on annule l'optimisme
    // (état + localStorage reviennent à l'aventure précédente, cookie = serveur).
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (!ok && mountedRef.current) applyLocal(previous);
        resolve(ok);
      };
      const timer = setTimeout(() => done(false), 15000);
      startTransition(async () => {
        try {
          const res = data ? await setActiveAdventureAction(data) : await clearActiveAdventureAction();
          clearTimeout(timer);
          done(!!res?.success);
        } catch {
          clearTimeout(timer);
          done(false);
        }
      });
    });
  }, [activeKey]);

  const setActiveAdventure = useCallback(
    (data: ActiveAdventureData) => persist(data),
    [persist],
  );

  const allEntries: AdventureEntry[] = useMemo(
    () => [...groups.possession, ...groups.sorties, ...groups.collectifs],
    [groups],
  );

  const setActiveAdventureByKey = useCallback(
    async (key: string): Promise<boolean> => {
      const found = allEntries.find((e) => adventureKey(e) === key);
      if (!found) return false;
      if (found.nature === 'possession') return persist({ nature: 'possession' });
      if (found.nature === 'sortie')
        return persist({ nature: 'sortie', id: found.id, slug: found.slug, title: found.title });
      return persist({ nature: 'collectif', id: found.id, title: found.title });
    },
    [allEntries, persist],
  );

  const clearActiveAdventure = useCallback(() => persist(null), [persist]);

  const isCurrentAdventure = useCallback(
    (key: string) => (activeAdventure ? keyOf(activeAdventure) === key : false),
    [activeAdventure],
  );

  const getLastSection = useCallback((key: string): string | null => {
    if (!sectionsKey) return null;
    try {
      return readLastSections(sectionsKey)[key] ?? null;
    } catch {
      return null;
    }
  }, [sectionsKey]);

  const setLastSection = useCallback((key: string, sectionId: string) => {
    if (!sectionsKey) return;
    try {
      const map = { ...readLastSections(sectionsKey), [key]: sectionId };
      localStorage.setItem(sectionsKey, JSON.stringify(map));
    } catch {
      /* ignoré */
    }
  }, [sectionsKey]);

  return (
    <ActiveAdventureContext.Provider
      value={{
        activeAdventure,
        setActiveAdventure,
        setActiveAdventureByKey,
        clearActiveAdventure,
        isCurrentAdventure,
        isPending,
        groups,
        reloadAdventures,
        suggestion,
        getLastSection,
        setLastSection,
      }}
    >
      {children}
    </ActiveAdventureContext.Provider>
  );
}

const fallbackGroups: AdventureGroups = {
  possession: [{ nature: 'possession', itemsCount: 0, loansCount: 0, alertsCount: 0 }],
  sorties: [],
  collectifs: [],
};

const fallbackActiveAdventureContext: ActiveAdventureContextValue = {
  activeAdventure: null,
  setActiveAdventure: async () => false,
  setActiveAdventureByKey: async () => false,
  clearActiveAdventure: async () => false,
  isCurrentAdventure: () => false,
  isPending: false,
  groups: fallbackGroups,
  reloadAdventures: async () => {},
  suggestion: null,
  getLastSection: () => null,
  setLastSection: () => {},
};

export function useActiveAdventure(): ActiveAdventureContextValue {
  const context = useContext(ActiveAdventureContext);
  if (!context) {
    return fallbackActiveAdventureContext;
  }
  return context;
}

'use client';
import React, { ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { hydrate, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { isNative } from '@/lib/native';
import {
  clearCriticalSnapshot,
  readCriticalSnapshot,
  trackCriticalQueryChanges,
  writeCriticalSnapshot,
} from '@/lib/storage/criticalQuerySnapshot';

const NATIVE_CACHE_WAIT_MS = 300;
const PERSIST_DEBOUNCE_MS = 500;
const CriticalCacheReadyContext = createContext(true);

export const useCriticalCacheReady = () => useContext(CriticalCacheReadyContext);

/** A client remains stable during a session and changes immediately with the account. */
export default function ReactQueryProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const userId = loading ? null : user?.id ?? null;
  const identity = loading ? 'pending' : userId ? `user:${userId}` : 'guest';
  const [restoredIdentity, setRestoredIdentity] = useState<string | null>(null);
  const previousRef = useRef<{ userId: string | null; client: QueryClient } | null>(null);
  const pendingWriteRef = useRef<Promise<void>>(Promise.resolve());

  const queryClient = useMemo(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60_000,
          gcTime: 5 * 60_000,
          retry: 1,
          refetchOnWindowFocus: false,
          refetchOnReconnect: true,
        },
      },
    }),
    [identity],
  );

  useEffect(() => {
    const previous = previousRef.current;
    if (previous && previous.client !== queryClient) {
      void previous.client.cancelQueries();
      previous.client.clear();
      if (previous.userId && previous.userId !== userId) {
        const previousUserId = previous.userId;
        const writesFinished = pendingWriteRef.current;
        void writesFinished
          .catch(() => {})
          .then(() => clearCriticalSnapshot(previousUserId))
          .catch((error) => console.warn('[ReactQueryProvider] cache purge failed', error));
      }
    }
    previousRef.current = { userId, client: queryClient };
  }, [queryClient, userId]);

  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let persistTimer: ReturnType<typeof setTimeout> | undefined;
    const bootTimer = setTimeout(() => setRestoredIdentity(identity), NATIVE_CACHE_WAIT_MS);
    const tracker = trackCriticalQueryChanges(queryClient, () => {
      clearTimeout(persistTimer);
      persistTimer = setTimeout(() => {
        pendingWriteRef.current = pendingWriteRef.current
          .catch(() => {})
          .then(() => writeCriticalSnapshot(queryClient, userId));
        void pendingWriteRef.current.catch((error) =>
          console.warn('[ReactQueryProvider] cache persist failed', error),
        );
      }, PERSIST_DEBOUNCE_MS);
    });

    readCriticalSnapshot(userId)
      .then((snapshot) => {
        if (disposed) return;
        if (snapshot) tracker.runWithoutTracking(() => hydrate(queryClient, snapshot));
      })
      .catch((error) => console.warn('[ReactQueryProvider] cache restore failed', error))
      .finally(() => {
        if (disposed) return;
        clearTimeout(bootTimer);
        setRestoredIdentity(identity);
        tracker.finishRestore();
      });

    return () => {
      disposed = true;
      clearTimeout(bootTimer);
      clearTimeout(persistTimer);
      tracker.dispose();
    };
  }, [identity, queryClient, userId]);

  // Screens may mount and fetch during restoration. TanStack hydration keeps
  // whichever result is newer; the native splash waits for this bounded phase.
  const ready = !isNative() || (!loading && (!userId || restoredIdentity === identity));
  return (
    <QueryClientProvider client={queryClient}>
      <CriticalCacheReadyContext.Provider value={ready}>
        {children}
      </CriticalCacheReadyContext.Provider>
    </QueryClientProvider>
  );
}

import { dehydrate, type DehydratedState, type Query, type QueryClient } from '@tanstack/react-query';
import { deleteCacheEntry, getCacheEntry, setCacheEntry } from './cacheDB';

const SCHEMA_VERSION = 1;
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0';
const MAX_AGE_MS = 24 * 60 * 60_000;
const KEY_PREFIX = 'lkdv-critical-query';

// Keep this list short. In particular, realtime messages, location-based map
// results, and provider data fetched with no-store must never be persisted.
const PERSISTED_KEYS = new Set([
  'hub-adventures',
  'carnets',
  'country-practical-guide',
]);

export interface CriticalQuerySnapshot {
  schemaVersion: number;
  appVersion: string;
  userId: string;
  savedAt: number;
  clientState: DehydratedState;
}

const storageKey = (userId: string) => `${KEY_PREFIX}:${encodeURIComponent(userId)}`;

export const isCriticalQueryKey = (queryKey: readonly unknown[]): boolean =>
  typeof queryKey[0] === 'string' && PERSISTED_KEYS.has(queryKey[0]);

/** Subscribe before hydration so fast first-load queries are not missed. */
export function trackCriticalQueryChanges(client: QueryClient, persist: () => void) {
  let restoring = true;
  let changedDuringRestore = false;
  let suppressed = false;
  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (suppressed || !isCriticalQueryKey(event.query.queryKey)) return;
    if (event.type === 'updated' && event.query.state.status !== 'success') return;
    if (event.type !== 'updated' && event.type !== 'removed') return;
    if (restoring) changedDuringRestore = true;
    else persist();
  });

  return {
    runWithoutTracking<T>(work: () => T): T {
      suppressed = true;
      try {
        return work();
      } finally {
        suppressed = false;
      }
    },
    finishRestore(): void {
      restoring = false;
      if (changedDuringRestore) persist();
      changedDuringRestore = false;
    },
    dispose(): void {
      unsubscribe();
    },
  };
}

export function createCriticalSnapshot(
  client: QueryClient,
  userId: string,
  now = Date.now(),
): CriticalQuerySnapshot | null {
  if (!userId) return null;
  const clientState = dehydrate(client, {
    shouldDehydrateMutation: () => false,
    shouldDehydrateQuery: (query: Query) =>
      query.state.status === 'success' &&
      isCriticalQueryKey(query.queryKey),
  });
  if (clientState.queries.length === 0) return null;
  return { schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION, userId, savedAt: now, clientState };
}

export function getHydratableState(
  snapshot: CriticalQuerySnapshot | null,
  userId: string,
  now = Date.now(),
): DehydratedState | null {
  if (!snapshot || snapshot.userId !== userId || !userId) return null;
  if (snapshot.schemaVersion !== SCHEMA_VERSION || snapshot.appVersion !== APP_VERSION) return null;
  if (!Number.isFinite(snapshot.savedAt) || snapshot.savedAt > now || now - snapshot.savedAt > MAX_AGE_MS) return null;
  if (!snapshot.clientState || !Array.isArray(snapshot.clientState.queries)) return null;
  const queries = snapshot.clientState.queries.filter((query) =>
    Array.isArray(query?.queryKey) &&
    isCriticalQueryKey(query.queryKey) &&
    query.state?.status === 'success',
  );
  return { mutations: [], queries };
}

export async function readCriticalSnapshot(userId: string): Promise<DehydratedState | null> {
  const snapshot = await getCacheEntry<CriticalQuerySnapshot>(storageKey(userId));
  return getHydratableState(snapshot, userId);
}

export async function writeCriticalSnapshot(client: QueryClient, userId: string): Promise<void> {
  const snapshot = createCriticalSnapshot(client, userId);
  if (snapshot) await setCacheEntry(storageKey(userId), snapshot, MAX_AGE_MS);
  else await clearCriticalSnapshot(userId);
}

export async function clearCriticalSnapshot(userId: string): Promise<void> {
  if (userId) await deleteCacheEntry(storageKey(userId));
}

import { describe, expect, it } from 'vitest';
import { hydrate, QueryClient } from '@tanstack/react-query';
import {
  createCriticalSnapshot,
  getHydratableState,
  isCriticalQueryKey,
  trackCriticalQueryChanges,
} from '@/lib/storage/criticalQuerySnapshot';

describe('critical query snapshot', () => {
  it('keeps only successful critical queries and binds them to one user', () => {
    const client = new QueryClient();
    client.setQueryData(['hub-adventures'], { groups: ['private-trip'] });
    client.setQueryData(['discovery', 'provider', 'FR'], { items: ['uncached'] });

    const snapshot = createCriticalSnapshot(client, 'user-a', 1_000);

    expect(snapshot?.userId).toBe('user-a');
    expect(snapshot?.clientState.queries.map((query) => query.queryKey)).toEqual([
      ['hub-adventures'],
    ]);
    expect(getHydratableState(snapshot, 'user-b', 1_001)).toBeNull();
    expect(getHydratableState(snapshot, 'user-a', 1_001)?.queries).toHaveLength(1);
  });

  it('restores the cached data without restoring unrelated queries or mutations', () => {
    const client = new QueryClient();
    client.setQueryData(['country-practical-guide', 'FR'], { sections: { visa: 'guide' } });
    const snapshot = createCriticalSnapshot(client, 'user-a', 1_000)!;
    const unrelated = {
      ...snapshot.clientState.queries[0],
      queryKey: ['messages', 'private'],
    };
    const state = getHydratableState({
      ...snapshot,
      clientState: {
        queries: [...snapshot.clientState.queries, unrelated],
        mutations: [{ mutationKey: ['send-message'], state: {} } as never],
      },
    }, 'user-a', 1_001);
    const restored = new QueryClient();
    hydrate(restored, state!);

    expect(restored.getQueryData(['country-practical-guide', 'FR'])).toEqual({
      sections: { visa: 'guide' },
    });
    expect(restored.getQueryData(['messages', 'private'])).toBeUndefined();
    expect(restored.getMutationCache().getAll()).toHaveLength(0);
  });

  it('rejects expired and mismatched schema snapshots', () => {
    const client = new QueryClient();
    client.setQueryData(['country-practical-guide', 'FR'], { sections: {} });
    const snapshot = createCriticalSnapshot(client, 'user-a', 1_000);

    expect(getHydratableState(snapshot, 'user-a', 1_000 + 24 * 60 * 60_000 + 1)).toBeNull();
    expect(getHydratableState({ ...snapshot!, schemaVersion: -1 }, 'user-a', 1_001)).toBeNull();
  });

  it('excludes country regions and trails fetched with no-store', () => {
    const client = new QueryClient();
    client.setQueryData(['pays-regions', 'FR'], { items: ['old-region'] });
    client.setQueryData(['pays-trails', 'FR'], { items: ['old-trail'] });
    client.setQueryData(['country-practical-guide', 'FR'], { sections: {} });

    expect(isCriticalQueryKey(['pays-regions', 'FR'])).toBe(false);
    expect(isCriticalQueryKey(['pays-trails', 'FR'])).toBe(false);
    expect(createCriticalSnapshot(client, 'user-a')?.clientState.queries.map((query) => query.queryKey))
      .toEqual([['country-practical-guide', 'FR']]);
  });

  it('persists a critical query that succeeds before snapshot restore finishes', () => {
    const client = new QueryClient();
    let persists = 0;
    const tracker = trackCriticalQueryChanges(client, () => { persists += 1; });

    client.setQueryData(['hub-adventures'], { groups: ['early'] });
    expect(persists).toBe(0);
    tracker.finishRestore();
    expect(persists).toBe(1);

    client.setQueryData(['hub-adventures'], { groups: ['newer'] });
    expect(persists).toBe(2);
    tracker.dispose();
  });

  it('does not rewrite a snapshot merely because it was hydrated', () => {
    const original = new QueryClient();
    original.setQueryData(['hub-adventures'], { groups: ['cached'] });
    const snapshot = createCriticalSnapshot(original, 'user-a')!;
    const restored = new QueryClient();
    let persists = 0;
    const tracker = trackCriticalQueryChanges(restored, () => { persists += 1; });

    tracker.runWithoutTracking(() => hydrate(restored, snapshot.clientState));
    tracker.finishRestore();
    expect(persists).toBe(0);
    tracker.dispose();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidateProgressionQueries, progressionProfileQuery, progressionCityRankQuery, progressionQueryKey, PROGRESSION_REFRESH_MS } from '@/features/progression/client/progressionQuery';
import type { UserProgressionProfile } from '@/features/progression/domain/types';

let client: QueryClient;
const fetchMock = vi.fn<typeof fetch>();
const owner = (userId: string) => ({ userId, hasData: false } as UserProgressionProfile);
const response = (userId: string) => ({ ok: true, json: async () => ({ success: true, profile: owner(userId) }) } as Response);
beforeEach(() => {
  client = new QueryClient();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { client.clear(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('private progression query', () => {
  it('deduplicates concurrent reads per account and never reuses another owner cache', async () => {
    fetchMock.mockResolvedValueOnce(response('alice')).mockResolvedValueOnce(response('bob'));
    const [one, two] = await Promise.all([client.fetchQuery(progressionProfileQuery('alice')), client.fetchQuery(progressionProfileQuery('alice'))]);
    expect(one).toEqual(two);
    await client.fetchQuery(progressionProfileQuery('alice'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await client.fetchQuery(progressionProfileQuery('bob'))).userId).toBe('bob');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.getQueryData([...progressionQueryKey('alice'), 'profile'])).toEqual(owner('alice'));
  });

  it('revalidates a stale cache without optimistic additions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T17:00:00Z'));
    fetchMock.mockResolvedValueOnce(response('alice')).mockResolvedValueOnce(response('alice'));
    await client.fetchQuery(progressionProfileQuery('alice'));
    vi.setSystemTime(new Date(Date.now() + PROGRESSION_REFRESH_MS + 1));
    await client.fetchQuery(progressionProfileQuery('alice'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.cache).toBe('no-store');
  });

  it('invalidates only the confirmed gain owner, both profile and rank', async () => {
    client.setQueryData([...progressionQueryKey('alice'), 'profile'], owner('alice'));
    client.setQueryData([...progressionQueryKey('alice'), 'city-rank'], 3);
    client.setQueryData([...progressionQueryKey('bob'), 'profile'], owner('bob'));
    await invalidateProgressionQueries(client, 'alice');
    expect(client.getQueryState([...progressionQueryKey('alice'), 'profile'])?.isInvalidated).toBe(true);
    expect(client.getQueryState([...progressionQueryKey('alice'), 'city-rank'])?.isInvalidated).toBe(true);
    expect(client.getQueryState([...progressionQueryKey('bob'), 'profile'])?.isInvalidated).toBe(false);
  });

  it('rejects an ownership mismatch without storing success or inventing zero', async () => {
    fetchMock.mockResolvedValueOnce(response('bob'));
    await expect(client.fetchQuery(progressionProfileQuery('alice'))).rejects.toThrow('Invalid progression owner');
    expect(client.getQueryData([...progressionQueryKey('alice'), 'profile'])).toBeUndefined();
  });

  it('cancels requests on client purge and cannot repopulate with a late network completion', async () => {
    let complete!: (result: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
    const pending = client.fetchQuery(progressionProfileQuery('alice')).catch(() => undefined);
    const signal = fetchMock.mock.calls[0][1]?.signal;
    client.clear();
    expect(signal?.aborted).toBe(true);
    complete(response('alice'));
    await pending;
    expect(client.getQueryData([...progressionQueryKey('alice'), 'profile'])).toBeUndefined();
  });

  it('rejects an unavailable leaderboard instead of caching a fabricated rank', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ success: false }) } as Response);
    await expect(client.fetchQuery(progressionCityRankQuery('alice'))).rejects.toThrow('Invalid leaderboard payload');
    expect(client.getQueryData([...progressionQueryKey('alice'), 'city-rank'])).toBeUndefined();
  });
});

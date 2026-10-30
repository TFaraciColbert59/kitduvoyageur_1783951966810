import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMyTripsCached, setMyTripsAuthUser, invalidateMyTripsSession } from '../fetchMyTrips';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const response = (owner: string) => ({ ok: true, json: async () => ({ trips: [owner] }) }) as Response;
beforeEach(() => { setMyTripsAuthUser(null); invalidateMyTripsSession(); });
afterEach(() => vi.unstubAllGlobals());
describe('trip session isolation', () => {
  it('requires a confirmed authenticated owner and separates cached accounts', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response('A')).mockResolvedValueOnce(response('B'));
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchMyTripsCached('A')).rejects.toThrow('owner');
    setMyTripsAuthUser('A');
    expect(await fetchMyTripsCached('A')).toEqual({ trips: ['A'] });
    expect(await fetchMyTripsCached('A')).toEqual({ trips: ['A'] });
    setMyTripsAuthUser('B');
    expect(await fetchMyTripsCached('B')).toEqual({ trips: ['B'] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects A in flight and its finally cannot clear B in flight', async () => {
    const a = deferred<Response>(), b = deferred<Response>();
    const fetcher = vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    vi.stubGlobal('fetch', fetcher);
    setMyTripsAuthUser('A');
    const old = fetchMyTripsCached('A');
    const rejected = expect(old).rejects.toThrow('session changed');
    setMyTripsAuthUser('B');
    const current = fetchMyTripsCached('B');
    a.resolve(response('A'));
    await rejected;
    const deduplicated = fetchMyTripsCached('B');
    expect(fetcher).toHaveBeenCalledTimes(2);
    b.resolve(response('B'));
    expect(await current).toEqual({ trips: ['B'] });
    expect(await deduplicated).toEqual({ trips: ['B'] });
  });
  it('rejects an earlier login even when the same account signs in again', async () => {
    const pending = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(response('fresh A')));
    setMyTripsAuthUser('A');
    const old = expect(fetchMyTripsCached('A')).rejects.toThrow('session changed');
    setMyTripsAuthUser(null);
    setMyTripsAuthUser('A');
    pending.resolve(response('old A'));
    await old;
    expect(await fetchMyTripsCached('A')).toEqual({ trips: ['fresh A'] });
  });
});

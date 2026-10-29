// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveAdventureProvider, useActiveAdventure, type ActiveAdventureContextValue } from '../ActiveAdventureContext';

const mocks = vi.hoisted(() => ({
  auth: { user: { id: 'alice' } as { id: string } | null, loading: false },
  reloadUserTrips: vi.fn<() => Promise<void>>(),
  userTrips: [],
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/features/trips/context/ActiveTripContext', () => ({
  useActiveTrip: () => ({ userTrips: mocks.userTrips, reloadUserTrips: mocks.reloadUserTrips }),
}));
vi.mock('../activeAdventureServer', () => ({
  setActiveAdventureAction: vi.fn(), clearActiveAdventureAction: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const payload = (id: string) => ({
  groups: [{ id, name: id, member_count: 2 }],
  possession: { items: 4, loans: 1, alerts: 2 }, pendingInvites: 1,
});
const response = (id: string) => ({ ok: true, json: async () => payload(id) }) as Response;
const cacheKey = (id: string) => `lkdv_hub_adventures_cache:${id}`;
let current: ActiveAdventureContextValue;
function Probe() { current = useActiveAdventure(); return null; }
function App() { return <ActiveAdventureProvider><Probe /></ActiveAdventureProvider>; }

beforeEach(() => {
  localStorage.clear();
  mocks.auth.user = { id: 'alice' };
  mocks.auth.loading = false;
  mocks.reloadUserTrips.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('initial')));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('adventure reload concurrency and identity', () => {
  it('starts the hub request while the trip reload is still pending', async () => {
    const trips = deferred<void>();
    mocks.reloadUserTrips.mockReturnValue(trips.promise);
    const view = render(<App />);
    expect(mocks.reloadUserTrips).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/hub/adventures', { cache: 'no-store' });
    await act(async () => { trips.resolve(); });
    expect(current.groups.collectifs[0]?.id).toBe('initial');
    view.unmount();
  });

  it.each(['hub', 'trips'] as const)('waits for both reloads when %s finishes first', async (first) => {
    render(<App />);
    await act(async () => {});
    const trips = deferred<void>();
    const hub = deferred<Response>();
    mocks.reloadUserTrips.mockReturnValue(trips.promise);
    vi.mocked(fetch).mockReturnValue(hub.promise);
    let done = false;
    let reload!: Promise<void>;
    act(() => { reload = current.reloadAdventures().then(() => { done = true; }); });
    await act(async () => {
      if (first === 'hub') hub.resolve(response('fresh'));
      else trips.resolve();
    });
    expect(done).toBe(false);
    await act(async () => {
      if (first === 'hub') trips.resolve();
      else hub.resolve(response('fresh'));
      await reload;
    });
    expect(done).toBe(true);
    expect(current.groups.collectifs[0]?.id).toBe('fresh');
    expect(JSON.parse(localStorage.getItem(cacheKey('alice'))!).groups[0].id).toBe('fresh');
  });

  it('restores the current account cache on an HTTP error', async () => {
    localStorage.setItem(cacheKey('alice'), JSON.stringify({
      groups: [{ id: 'cached', name: 'Cached', member_count: 3 }],
      possession: { itemsCount: 8, loansCount: 2, alertsCount: 1 }, pendingInvites: 2,
    }));
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    render(<App />);
    await act(async () => {});
    expect(current.groups.collectifs[0]?.id).toBe('cached');
    expect(current.groups.possession[0].itemsCount).toBe(8);
  });

  it.each([true, false])('ignores Alice late HTTP completion (ok=%s) after switching to Bob', async (ok) => {
    const aliceHub = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(aliceHub.promise).mockResolvedValue(response('bob-group'));
    localStorage.setItem(cacheKey('alice'), JSON.stringify({ groups: [{ id: 'alice-cached', name: 'Alice', member_count: 1 }] }));
    const before = localStorage.getItem(cacheKey('alice'));
    const view = render(<App />);
    await act(async () => {});
    mocks.auth.user = { id: 'bob' };
    view.rerender(<App />);
    await act(async () => {});
    await act(async () => { aliceHub.resolve(ok ? response('alice-late') : { ok: false } as Response); });
    expect(current.groups.collectifs.map((group) => group.id)).toEqual(['bob-group']);
    expect(localStorage.getItem(cacheKey('alice'))).toBe(before);
    expect(JSON.parse(localStorage.getItem(cacheKey('bob'))!).groups[0].id).toBe('bob-group');
  });

  it('does not start work from a callback retained after unmount', async () => {
    const view = render(<App />);
    await act(async () => {});
    const retained = current.reloadAdventures;
    view.unmount();
    vi.mocked(fetch).mockClear();
    mocks.reloadUserTrips.mockClear();
    await retained();
    expect(mocks.reloadUserTrips).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([false, true])('does not reload private data for guest/loading authentication (loading=%s)', async (loading) => {
    mocks.auth.loading = loading;
    if (!loading) mocks.auth.user = null;
    render(<App />);
    await act(async () => { await current.reloadAdventures(); });
    expect(mocks.reloadUserTrips).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(current.groups.collectifs).toEqual([]);
  });
});

// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
const mocks = vi.hoisted(() => ({
  callback: null as null | ((event: string, session: Session | null) => void),
  getSession: vi.fn(), query: vi.fn(), signOut: vi.fn(), purge: vi.fn(),
}));
vi.mock('@/lib/offlineStorage', () => ({ purgeCompasSnapshots: mocks.purge }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({
  auth: { getSession: mocks.getSession, signOut: mocks.signOut, onAuthStateChange: (callback: typeof mocks.callback) => {
    mocks.callback = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  } },
  from: () => ({ select: () => ({ eq: (_: string, id: string) => ({
    maybeSingle: () => mocks.query(id), single: () => mocks.query(id),
  }) }), upsert: () => { throw new Error('Unexpected stale profile creation'); } }),
}) }));
import { AuthProvider, useAuth } from '../AuthContext';
import { fetchMyTripsCached } from '@/features/trips/client/fetchMyTrips';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const session = (id: string) => ({ user: { id, email: `${id}@example.test`, user_metadata: {} } }) as Session;
const profile = (id: string, full_name = id) => ({ id, full_name });
let auth: ReturnType<typeof useAuth>;
function Consumer() {
  auth = useAuth();
  return <div data-testid="identity">{auth.user?.id ?? '-'}:{auth.profile?.full_name ?? '-'}</div>;
}
const mount = () => render(<AuthProvider><Consumer /></AuthProvider>);
const emit = async (id: string | null, event = id ? 'SIGNED_IN' : 'SIGNED_OUT') => { await act(async () => { mocks.callback?.(event, id ? session(id) : null); }); };
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.query.mockImplementation((id: string) => Promise.resolve({ data: profile(id), error: null }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('authenticated profile ownership', () => {
  it('does not paint legacy unscoped data before auth confirmation', async () => {
    const initial = deferred<{ data: { session: Session | null } }>();
    mocks.getSession.mockReturnValue(initial.promise);
    sessionStorage.setItem('lkdv:profile:current', JSON.stringify(profile('A')));
    mount();
    expect(screen.getByTestId('identity').textContent).toBe('-:-');
    expect(sessionStorage.getItem('lkdv:profile:current')).toBeNull();
    await act(async () => initial.resolve({ data: { session: null } }));
  });
  it('ignores initial getSession when a newer auth event has confirmed B', async () => {
    const initial = deferred<{ data: { session: Session | null } }>();
    mocks.getSession.mockReturnValue(initial.promise);
    mount();
    await emit('B');
    await act(async () => initial.resolve({ data: { session: session('A') } }));
    expect(screen.getByTestId('identity').textContent).toBe('B:B');
    expect(mocks.query).not.toHaveBeenCalledWith('A');
  });
  it('starts B independently and rejects A profile completion and refresh', async () => {
    const a = deferred<{ data: ReturnType<typeof profile>; error: null }>();
    mocks.query.mockImplementation((id: string) => id === 'A' ? a.promise : Promise.resolve({ data: profile(id), error: null }));
    mount();
    await emit('A');
    const refresh = auth.getUserProfile();
    await emit('B');
    await act(async () => a.resolve({ data: profile('A'), error: null }));
    expect(await refresh).toBeNull();
    expect(screen.getByTestId('identity').textContent).toBe('B:B');
    expect(sessionStorage.getItem('lkdv:profile:A')).toBeNull();
    expect(JSON.parse(sessionStorage.getItem('lkdv:profile:B')!).id).toBe('B');
  });
  it('does not create a missing profile after its session has changed', async () => {
    const a = deferred<{ data: null; error: null }>();
    mocks.query.mockImplementation((id: string) => id === 'A' ? a.promise : Promise.resolve({ data: profile(id), error: null }));
    mount();
    await emit('A');
    await emit('B');
    await act(async () => a.resolve({ data: null, error: null }));
    expect(screen.getByTestId('identity').textContent).toBe('B:B');
  });
  it('rejects an older profile request after logout and login to the same account', async () => {
    const old = deferred<{ data: ReturnType<typeof profile>; error: null }>();
    mocks.query.mockReturnValueOnce(old.promise).mockResolvedValue({ data: profile('A', 'new login'), error: null });
    mount();
    await emit('A');
    await act(async () => { await auth.signOut(); });
    await emit('A');
    await act(async () => old.resolve({ data: profile('A', 'old login'), error: null }));
    expect(screen.getByTestId('identity').textContent).toBe('A:new login');
    expect(JSON.parse(sessionStorage.getItem('lkdv:profile:A')!).full_name).toBe('new login');
  });
  it('an older completion cannot clear the newer account profile request', async () => {
    const a = deferred<{ data: ReturnType<typeof profile>; error: null }>();
    const b = deferred<{ data: ReturnType<typeof profile>; error: null }>();
    mocks.query.mockImplementation((id: string) => id === 'A' ? a.promise : b.promise);
    mount();
    await emit('A');
    await emit('B');
    await act(async () => a.resolve({ data: profile('A'), error: null }));
    await emit('B', 'TOKEN_REFRESHED');
    expect(mocks.query.mock.calls.filter(([id]) => id === 'B')).toHaveLength(1);
    await act(async () => b.resolve({ data: profile('B'), error: null }));
    expect(screen.getByTestId('identity').textContent).toBe('B:B');
  });
  it('a fresh SIGNED_IN for the same identity rejects earlier trip and profile work', async () => {
    const oldProfile = deferred<{ data: ReturnType<typeof profile>; error: null }>();
    const oldTrips = deferred<Response>();
    mocks.query.mockReturnValueOnce(oldProfile.promise).mockResolvedValue({ data: profile('A', 'new session'), error: null });
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(oldTrips.promise).mockResolvedValue({ ok: true, json: async () => ({ trips: ['new session'] }) }));
    mount();
    await emit('A');
    const rejected = expect(fetchMyTripsCached('A')).rejects.toThrow('session changed');
    await emit('A');
    await act(async () => {
      oldProfile.resolve({ data: profile('A', 'old session'), error: null });
      oldTrips.resolve({ ok: true, json: async () => ({ trips: ['old session'] }) } as Response);
    });
    await rejected;
    expect(screen.getByTestId('identity').textContent).toBe('A:new session');
    expect(await fetchMyTripsCached('A')).toEqual({ trips: ['new session'] });
  });
  it('TOKEN_REFRESHED preserves in-flight work for the current session', async () => {
    const pending = deferred<{ data: ReturnType<typeof profile>; error: null }>();
    const trips = deferred<Response>();
    mocks.query.mockReturnValue(pending.promise);
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(trips.promise));
    mount();
    await emit('A');
    const request = fetchMyTripsCached('A');
    await emit('A', 'TOKEN_REFRESHED');
    await act(async () => {
      pending.resolve({ data: profile('A'), error: null });
      trips.resolve({ ok: true, json: async () => ({ trips: ['A'] }) } as Response);
    });
    expect(await request).toEqual({ trips: ['A'] });
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('identity').textContent).toBe('A:A');
  });
  it('retains same-account offline fallback but explicit logout clears the last owner after offline null', async () => {
    mount();
    await emit('A');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await emit(null);
    expect(sessionStorage.getItem('lkdv:profile:A')).not.toBeNull();
    mocks.query.mockRejectedValue(new Error('offline'));
    await emit('A');
    expect(screen.getByTestId('identity').textContent).toBe('A:A');
    await emit(null);
    await act(async () => { await auth.signOut(); });
    expect(sessionStorage.getItem('lkdv:profile:A')).toBeNull();
    await waitFor(() => expect(mocks.purge).toHaveBeenCalledWith(null));
  });
});

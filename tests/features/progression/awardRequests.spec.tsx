// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { listenForConfirmedProgressionAwards, PROGRESSION_AWARD_CONFIRMED_EVENT, requestCarnetPublicationAward, requestChecklistCompletionAward } from '@/lib/progression-award-requests';
import { progressionProfileQuery, progressionQueryKey } from '@/features/progression/client/progressionQuery';

const auth = vi.hoisted(() => ({ user: { id: 'alice' } as { id: string } | null, loading: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/native', () => ({ isNative: () => false }));
vi.mock('@/lib/storage/criticalQuerySnapshot', () => ({
  clearCriticalSnapshot: vi.fn(async () => {}), readCriticalSnapshot: vi.fn(async () => null),
  writeCriticalSnapshot: vi.fn(async () => {}),
  trackCriticalQueryChanges: () => ({ runWithoutTracking: (work: () => void) => work(), finishRestore: () => {}, dispose: () => {} }),
}));
import ReactQueryProvider from '@/components/ReactQueryProvider';
const fetchMock = vi.fn<typeof fetch>();
let liveClient: QueryClient;
function ClientProbe() { liveClient = useQueryClient(); return null; }
const response = (payload: unknown, ok = true) => ({ ok, json: async () => payload } as Response);
let dispose: (() => void) | undefined;
beforeEach(() => { auth.user = { id: 'alice' }; auth.loading = false; fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { dispose?.(); dispose = undefined; cleanup(); liveClient?.clear(); vi.unstubAllGlobals(); });

describe('confirmed award requests', () => {
  it.each(['awarded', 'awarded_lifetime_only', 'duplicate'])('signals only the captured owner for confirmed %s', async (outcome) => {
    const notified = vi.fn();
    dispose = listenForConfirmedProgressionAwards('alice', notified);
    fetchMock.mockResolvedValueOnce(response({ ok: true, awarded: true, outcome }));
    requestCarnetPublicationAward('carnet-1', 'alice');
    await waitFor(() => expect(notified).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', keepalive: true, cache: 'no-store' });
  });

  it.each([
    null, {}, { ok: true }, { ok: true, awarded: false, outcome: 'refused' },
    { ok: true, awarded: true, outcome: 'refused' },
    { ok: true, awarded: 'true', outcome: 'awarded' },
    { ok: false, awarded: true, outcome: 'awarded' },
    { ok: true, awarded: true },
  ])('does not equate a 200 or malformed/refused payload with a grant: %j', async (payload) => {
    const notified = vi.fn();
    dispose = listenForConfirmedProgressionAwards('alice', notified);
    fetchMock.mockResolvedValueOnce(response(payload));
    requestChecklistCompletionAward('trip-1', 'alice');
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(notified).not.toHaveBeenCalled();
  });

  it.each(['http', 'network', 'json'])('silences %s failure and emits no confirmation', async (failure) => {
    const notified = vi.fn();
    dispose = listenForConfirmedProgressionAwards('alice', notified);
    if (failure === 'network') fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    else if (failure === 'json') fetchMock.mockResolvedValueOnce(new Response('invalid json', { status: 200 }));
    else fetchMock.mockResolvedValueOnce(response({ ok: true, awarded: true, outcome: 'awarded' }, false));
    requestCarnetPublicationAward('carnet-1', 'alice');
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(notified).not.toHaveBeenCalled();
  });

  it('does not request a grant without an explicit initiating owner', () => {
    requestChecklistCompletionAward('trip-1', '');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('validates event detail, refuses other owners and removes the subscription', () => {
    const notified = vi.fn();
    const unsubscribe = listenForConfirmedProgressionAwards('alice', notified);
    for (const detail of [null, 'alice', {}, { ownerId: 'bob', outcome: 'awarded' }, { ownerId: 'alice', outcome: 'refused' }]) {
      window.dispatchEvent(new CustomEvent(PROGRESSION_AWARD_CONFIRMED_EVENT, { detail }));
    }
    expect(notified).not.toHaveBeenCalled();
    unsubscribe();
    window.dispatchEvent(new CustomEvent(PROGRESSION_AWARD_CONFIRMED_EVENT, { detail: { ownerId: 'alice', outcome: 'awarded' } }));
    expect(notified).not.toHaveBeenCalled();
  });
});

describe('existing ReactQueryProvider private gain bridge', () => {
  it('invalidates the current owner after an actual successful award response', async () => {
    render(<ReactQueryProvider><ClientProbe /></ReactQueryProvider>);
    const profileKey = [...progressionQueryKey('alice'), 'profile'];
    liveClient.setQueryData(profileKey, { userId: 'alice' });
    fetchMock.mockResolvedValueOnce(response({ ok: true, awarded: true, outcome: 'awarded' }));
    requestChecklistCompletionAward('trip-1', 'alice');
    await waitFor(() => expect(liveClient.getQueryState(profileKey)?.isInvalidated).toBe(true));
  });

  it('requeries after confirmation without inventing XP while the projection is pending', async () => {
    function ProjectedPoints() {
      const query = useQuery(progressionProfileQuery('alice'));
      return <span>{query.data ? `${query.data.points.lifetime} XP lus` : 'pending'}</span>;
    }
    const projected = { ok: true, json: async () => ({ success: true, profile: { userId: 'alice', points: { lifetime: 0 } } }) } as Response;
    fetchMock.mockResolvedValueOnce(projected)
      .mockResolvedValueOnce(response({ ok: true, awarded: true, outcome: 'awarded' }))
      .mockResolvedValueOnce(projected);
    const view = render(<ReactQueryProvider><ClientProbe /><ProjectedPoints /></ReactQueryProvider>);
    await waitFor(() => expect(view.getByText('0 XP lus')).toBeTruthy());
    requestCarnetPublicationAward('carnet-1', 'alice');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(view.getByText('0 XP lus')).toBeTruthy();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/progression', '/api/carnets/carnet-1/publish', '/api/progression']);
  });

  it.each(['switch', 'logout'])('cannot invalidate another live cache after delayed old-account confirmation (%s)', async (transition) => {
    let complete!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
    const view = render(<ReactQueryProvider><ClientProbe /></ReactQueryProvider>);
    const oldClient = liveClient;
    oldClient.setQueryData([...progressionQueryKey('alice'), 'profile'], { userId: 'alice' });
    requestCarnetPublicationAward('carnet-1', 'alice');
    auth.user = transition === 'switch' ? { id: 'bob' } : null;
    view.rerender(<ReactQueryProvider><ClientProbe /></ReactQueryProvider>);
    expect(liveClient).not.toBe(oldClient);
    expect(oldClient.getQueryCache().getAll()).toHaveLength(0);
    const newKey = [...progressionQueryKey('bob'), 'profile'];
    liveClient.setQueryData(newKey, { userId: 'bob' });
    await act(async () => complete(response({ ok: true, awarded: true, outcome: 'awarded' })));
    expect(liveClient.getQueryState(newKey)?.isInvalidated).toBe(false);
    expect(liveClient.getQueryData([...progressionQueryKey('alice'), 'profile'])).toBeUndefined();
  });
});

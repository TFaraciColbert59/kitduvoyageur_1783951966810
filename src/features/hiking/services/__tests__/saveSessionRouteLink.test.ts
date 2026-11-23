// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HANDOFF_KEY } from '@/features/route-collab/depart/activityHandoff';
import { HikeSessionService } from '../HikeSessionService';

const base = {
  tripId: 'trip-1',
  startedAt: '2026-07-10T08:00:00Z',
  endedAt: '2026-07-10T12:00:00Z',
  distanceKm: 10,
  durationSeconds: 14400,
  positions: [],
  poiEvents: [],
};
let sent: Record<string, unknown> | null = null;

beforeEach(() => {
  sent = null;
  window.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
    sent = JSON.parse(init.body);
    return new Response(JSON.stringify({ sessionId: 's1' }), { status: 200 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('HikeSessionService.saveSession · version suivie et sac emporté (9.8)', () => {
  it('sans passation, le corps reste celui d’avant (rétrocompatible)', async () => {
    await HikeSessionService.saveSession(base);
    expect(sent).not.toHaveProperty('routeWorkspaceId');
    expect(sent).not.toHaveProperty('kitSnapshot');
  });

  it('avec la passation du même voyage : version et sac joints, puis passation effacée', async () => {
    window.localStorage.setItem(HANDOFF_KEY, JSON.stringify({ tripId: 'trip-1', workspaceId: 'w1', revisionId: 'r1', revisionNo: 2, kitSnapshot: [{ id: 'k1', name: 'Tente', category: 'abri', weightGrams: 1000, quantity: 1, shared: true, assigneeUserId: null }], startedAt: new Date().toISOString() }));
    await HikeSessionService.saveSession(base);
    expect(sent).toMatchObject({ routeWorkspaceId: 'w1', routeRevisionId: 'r1' });
    expect((sent as { kitSnapshot: unknown[] }).kitSnapshot).toHaveLength(1);
    expect(window.localStorage.getItem(HANDOFF_KEY)).toBeNull();
  });

  it('la passation d’un autre voyage n’est ni jointe ni effacée', async () => {
    window.localStorage.setItem(HANDOFF_KEY, JSON.stringify({ tripId: 'trip-AUTRE', workspaceId: 'w1', revisionId: 'r1', revisionNo: 2, kitSnapshot: [], startedAt: new Date().toISOString() }));
    await HikeSessionService.saveSession(base);
    expect(sent).not.toHaveProperty('routeWorkspaceId');
    expect(window.localStorage.getItem(HANDOFF_KEY)).not.toBeNull();
  });

  it('9.8 passation lue au départ par le cockpit : jointe telle quelle, sans être mise dans le corps sous « handoff »', async () => {
    const handoff = { tripId: 'trip-1', workspaceId: 'w9', revisionId: 'r9', revisionNo: 4, kitSnapshot: [], startedAt: new Date().toISOString() };
    await HikeSessionService.saveSession({ ...base, handoff });
    expect(sent).toMatchObject({ routeWorkspaceId: 'w9', routeRevisionId: 'r9' });
    expect(sent).not.toHaveProperty('handoff');
  });
});

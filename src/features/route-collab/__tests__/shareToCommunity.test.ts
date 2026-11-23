import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceRecord, publishWorkspace, resetRouteCollabStoreForTests } from '../serverStore';
import type { RouteWorkspaceState } from '../types';

const NOW = '2026-11-19T08:00:00.000Z';
const CLUB = '22222222-2222-4222-8222-222222222222';
const coords: Array<[number, number]> = Array.from({ length: 40 }, (_, i) => [6.1 + i * 0.01, 45.6 + i * 0.0005]);

const state: {
  user: string | null;
  workspace: RouteWorkspaceState | null;
  clubs: Array<{ id: string; name: string }>;
  rpcs: Array<{ name: string; p: Record<string, unknown> }>;
  stories: Array<Record<string, unknown>>;
  rpcError: Record<string, { code: string } | null>;
  storyError: { code: string } | null;
} = { user: 'alice', workspace: null, clubs: [], rpcs: [], stories: [], rpcError: {}, storyError: null };

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user ? { id: state.user } : null } }) },
    rpc: async (name: string, args: { p: Record<string, unknown> }) => {
      state.rpcs.push({ name, p: args.p });
      const error = state.rpcError[name] ?? null;
      return error ? { data: null, error } : { data: { id: `${name}-id`, idempotent: false }, error: null };
    },
    from: (table: string) => {
      if (table === 'club_members') {
        return { select: () => ({ eq: () => ({ eq: async () => ({ data: state.clubs.map((c) => ({ club_id: c.id, clubs: c })), error: null }) }) }) };
      }
      return { insert: async (row: Record<string, unknown>) => { if (!state.storyError) state.stories.push(row); return { error: state.storyError }; } };
    },
  }),
}));
vi.mock('../store', () => ({
  getRouteCollabStore: async () => ({
    getWorkspaceForActor: async () => (state.workspace ? { ok: true, workspace: state.workspace } : { ok: false, error: 'x' }),
  }),
}));

import { publishRouteToCommunity } from '../server/shareToCommunity';

function ws(owner: string): RouteWorkspaceState {
  const id = 'ws-s2c';
  return {
    id, tripId: 'trip-secret', title: 'Crête du Mont', status: 'draft', sport: 'marche', shapeMode: 'one_way', routingOptions: {},
    headSeq: 0, reviewedSeq: null, publishedRevisionId: null, publishedRevisionNo: null, sourceOrigin: { kind: 'blank' },
    points: [
      { id: 'p1', workspaceId: id, kind: 'start', orderKey: 'A', lat: coords[0][1], lon: coords[0][0], eleM: 900, name: 'Chez moi', entityVersion: 1 },
      { id: 'p2', workspaceId: id, kind: 'finish', orderKey: 'Z', lat: coords[39][1], lon: coords[39][0], eleM: 1500, name: 'Sommet', entityVersion: 1 },
    ],
    sections: [{ id: 's1', workspaceId: id, fromPointId: 'p1', toPointId: 'p2', mode: 'routed', geometry: { type: 'LineString', coordinates: coords }, distanceKm: 30, durationMin: 400, ascentM: 700, descentM: 100, surfaceSegments: [], routingInputHash: null, provenance: { provider: 'valhalla', calculatedAt: NOW, profile: 'marche', confidence: 'verified' }, warnings: [], entityVersion: 1 }],
    stages: [], variants: [], proposals: [], comments: [], kitItems: [],
    members: [{ userId: owner, displayName: 'Alice', role: 'owner' }, { userId: 'bob', displayName: 'Bob', role: 'contributor' }],
    revisions: [], packs: [], participantPacks: [], updatedAt: NOW,
  } as RouteWorkspaceState;
}

describe('10.9 publishRouteToCommunity : post, story et carnet', () => {
  beforeEach(() => {
    resetRouteCollabStoreForTests();
    state.user = 'alice';
    state.clubs = [];
    state.rpcs = [];
    state.stories = [];
    state.rpcError = {};
    state.storyError = null;
    const rec = createWorkspaceRecord(ws('alice'));
    const res = publishWorkspace({ workspaceId: rec.id, actorId: 'alice', actorName: 'Alice', expectedHeadSeq: 0, summary: 'v1' });
    if (res.status !== 'published') throw new Error('publication refusée');
    state.workspace = res.workspace;
  });

  it('sans cibles : le post seul (comportement d’origine)', async () => {
    const r = await publishRouteToCommunity('ws-s2c', { audience: 'abonnies' });
    expect(r).toMatchObject({ status: 'ok', postId: 'create_community_post-id' });
    expect(state.rpcs.map((x) => x.name)).toEqual(['create_community_post']);
    expect(state.stories).toHaveLength(0);
  });

  it('post + story + carnet : carnet d’abord, post et story liés au carnet, aucune position ni voyage', async () => {
    const r = await publishRouteToCommunity('ws-s2c', { audience: 'public', clientRequestId: '11111111-1111-4111-8111-111111111111' }, { post: true, story: true, carnet: true });
    expect(r.status).toBe('ok');
    expect(state.rpcs.map((x) => x.name)).toEqual(['create_carnet_v2', 'create_community_post']);
    expect(state.rpcs[1].p).toMatchObject({ linked_carnet_id: 'create_carnet_v2-id' });
    expect(state.stories[0]).toMatchObject({ linked_carnet_id: 'create_carnet_v2-id', author_id: 'alice', media_type: 'text', visibility: 'public' });
    const all = JSON.stringify([state.rpcs, state.stories]);
    expect(all).not.toContain('trip-secret');
    expect(all).not.toContain('Chez moi');
    expect(all).not.toMatch(/start_lat|place_lat/);
  });

  it('audience club : refusée si la personne n’est pas membre actif ; acceptée sinon, carnet privé', async () => {
    const denied = await publishRouteToCommunity('ws-s2c', { audience: 'club', clubId: CLUB }, { post: true, story: true, carnet: true });
    expect(denied.status).toBe('not_club_member');
    expect(state.rpcs).toHaveLength(0);
    state.clubs = [{ id: CLUB, name: 'Les Marcheurs' }];
    const ok = await publishRouteToCommunity('ws-s2c', { audience: 'club', clubId: CLUB }, { post: true, story: true, carnet: true });
    expect(ok.status).toBe('ok');
    expect(state.rpcs[0].p).toMatchObject({ visibility: 'private' });
    expect(state.rpcs[1].p).toMatchObject({ audience: 'club', club_id: CLUB });
    expect(state.stories[0]).toMatchObject({ visibility: 'club', club_id: CLUB });
  });

  it('propriétaire seulement : un contributeur est refusé, rien n’est écrit', async () => {
    state.user = 'bob';
    const r = await publishRouteToCommunity('ws-s2c', { audience: 'public' }, { post: true, story: true, carnet: true });
    expect(r.status).toBe('forbidden');
    expect(state.rpcs).toHaveLength(0);
    expect(state.stories).toHaveLength(0);
  });

  it('version publiée seulement ; visiteur refusé', async () => {
    state.workspace = createWorkspaceRecord({ ...ws('alice'), id: 'ws-draft' });
    expect((await publishRouteToCommunity('ws-draft', { audience: 'public' }, { post: true, story: true, carnet: true })).status).toBe('no_published');
    state.user = null;
    expect((await publishRouteToCommunity('ws-s2c', { audience: 'public' })).status).toBe('unauthenticated');
    expect(state.rpcs).toHaveLength(0);
  });

  it('échec partiel dit par cible, jamais présenté comme réussi ; double story = idempotent', async () => {
    state.storyError = { code: '42501' };
    const partial = await publishRouteToCommunity('ws-s2c', { audience: 'abonnies' }, { post: true, story: true, carnet: false });
    expect(partial).toMatchObject({ status: 'partial', results: { post: { status: 'ok' }, story: { status: 'rejected' } } });
    state.storyError = { code: '23505' };
    const dup = await publishRouteToCommunity('ws-s2c', { audience: 'abonnies' }, { post: false, story: true, carnet: false });
    expect(dup).toMatchObject({ status: 'ok', idempotent: true });
    state.rpcError.create_carnet_v2 = { code: 'P0001' };
    const nothing = await publishRouteToCommunity('ws-s2c', { audience: 'abonnies' }, { post: false, story: false, carnet: true });
    expect(nothing.status).toBe('rejected');
  });
});

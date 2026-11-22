import { beforeEach, describe, expect, it } from 'vitest';
import { getRouteCollabStore, shouldUseSupabaseRouteCollabStore } from '../store';
import { memoryRouteCollabStore } from '../store/memoryStore';
import { resetRouteCollabStoreForTests } from '../serverStore';
import type { RouteWorkspaceState } from '../types';

const SUPABASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
} as unknown as NodeJS.ProcessEnv;

describe('sélection du store', () => {
  it('Supabase seulement si URL + clé anon, hors Vitest, et sans ROUTE_COLLAB_STORE=memory', () => {
    expect(shouldUseSupabaseRouteCollabStore({ ...SUPABASE_ENV })).toBe(true);
    expect(shouldUseSupabaseRouteCollabStore({ ...SUPABASE_ENV, VITEST: 'true' } as NodeJS.ProcessEnv)).toBe(false);
    expect(
      shouldUseSupabaseRouteCollabStore({ ...SUPABASE_ENV, ROUTE_COLLAB_STORE: 'memory' } as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      shouldUseSupabaseRouteCollabStore({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(shouldUseSupabaseRouteCollabStore({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it('sous Vitest, getRouteCollabStore renvoie le store mémoire', async () => {
    const store = await getRouteCollabStore();
    expect(store).toBe(memoryRouteCollabStore);
    expect(store.kind).toBe('memory');
  });
});

describe('store mémoire asynchrone', () => {
  beforeEach(() => resetRouteCollabStoreForTests());

  it('enveloppe serverStore : création, lecture, refus d’un non-membre', async () => {
    const now = '2026-11-22T10:00:00.000Z';
    const workspace: RouteWorkspaceState = {
      id: 'ws-memory-1',
      tripId: 'trip-1',
      title: 'Test mémoire',
      status: 'draft',
      sport: 'marche',
      routingOptions: {},
      headSeq: 0,
      reviewedSeq: null,
      publishedRevisionId: null,
      publishedRevisionNo: null,
      sourceOrigin: { kind: 'blank', importedAt: now },
      points: [],
      sections: [],
      stages: [],
      variants: [],
      proposals: [],
      comments: [],
      kitItems: [],
      members: [{ userId: 'u-owner', displayName: 'Owen', role: 'owner' }],
      revisions: [],
      packs: [],
      participantPacks: [],
      updatedAt: now,
    };
    const store = await getRouteCollabStore();
    await store.createWorkspaceRecord(workspace);
    const read = await store.getWorkspaceForActor('ws-memory-1', 'u-owner');
    expect(read.ok).toBe(true);
    expect(await store.getWorkspaceForActor('ws-memory-1', 'u-other')).toMatchObject({ ok: false, status: 403 });
    expect(await store.listWorkspacesForActor('u-owner')).toHaveLength(1);
  });
});

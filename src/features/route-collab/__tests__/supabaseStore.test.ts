import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { stableHash } from '../engine';
import { createSupabaseRouteCollabStore } from '../store/supabaseStore';
import { RouteCollabStoreError } from '../store/types';
import type { RouteWorkspaceState } from '../types';

const WS_ID = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const EDITOR = '33333333-3333-4333-8333-333333333333';
const CO_ORG = '44444444-4444-4444-8444-444444444444';
const VIEWER = '55555555-5555-4555-8555-555555555555';
const NOW = '2026-11-22T10:00:00.000Z';

function makeWorkspace(overrides: Partial<RouteWorkspaceState> = {}): RouteWorkspaceState {
  return {
    id: WS_ID,
    tripId: 'trip-local',
    title: 'Vercors',
    status: 'draft',
    sport: 'marche',
    routingOptions: {},
    headSeq: 3,
    reviewedSeq: null,
    publishedRevisionId: null,
    publishedRevisionNo: null,
    sourceOrigin: { kind: 'blank', importedAt: NOW },
    points: [
      { id: 'pt-1', workspaceId: WS_ID, kind: 'start', orderKey: 'A', lat: 45.05, lon: 5.51, eleM: 1100, name: 'Départ', entityVersion: 1 },
      { id: 'pt-2', workspaceId: WS_ID, kind: 'finish', orderKey: 'Z', lat: 45.07, lon: 5.53, eleM: 1500, name: 'Arrivée', entityVersion: 1 },
    ],
    sections: [
      {
        id: 'sec-1',
        workspaceId: WS_ID,
        fromPointId: 'pt-1',
        toPointId: 'pt-2',
        mode: 'routed',
        geometry: { type: 'LineString', coordinates: [[5.51, 45.05], [5.53, 45.07]] },
        distanceKm: 10,
        durationMin: 180,
        ascentM: 400,
        descentM: 0,
        surfaceSegments: [],
        routingInputHash: null,
        provenance: { provider: 'compas', calculatedAt: NOW, profile: 'marche', confidence: 'estimated' },
        warnings: [],
        entityVersion: 1,
      },
    ],
    stages: [
      {
        id: 'stage-1',
        workspaceId: WS_ID,
        orderKey: '001',
        dayNumber: 1,
        title: 'Jour 1',
        dateIso: '2026-11-23',
        departureTimeLocal: '08:30',
        timezone: 'Europe/Paris',
        startPointId: 'pt-1',
        endPointId: 'pt-2',
        overnightPlace: null,
        notes: '',
        waterObservations: [],
        weatherSlice: null,
        hazards: [],
        entityVersion: 1,
      },
    ],
    variants: [],
    proposals: [],
    comments: [],
    kitItems: [],
    members: [
      { userId: OWNER, displayName: 'Owen', role: 'owner' },
      { userId: EDITOR, displayName: 'Edith', role: 'editor' },
      { userId: CO_ORG, displayName: 'Coco', role: 'co_organizer' },
      { userId: VIEWER, displayName: 'Vic', role: 'external_viewer' },
    ],
    revisions: [],
    packs: [],
    participantPacks: [],
    updatedAt: NOW,
    ...overrides,
  };
}

interface FakeOptions {
  /** Retourne la ligne `route_workspaces` visible via RLS (null = invisible). Appelé à chaque lecture. */
  readonly workspaceRow?: () => RouteWorkspaceState | null;
  readonly stateVersion?: () => number;
  readonly operationById?: unknown;
  readonly operations?: readonly unknown[];
  readonly rpc?: Record<string, (args: Record<string, unknown>) => unknown>;
}

function makeFake(options: FakeOptions) {
  const fromCalls: string[] = [];
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const gtFilters: unknown[] = [];

  function builder(table: string) {
    const filters: Record<string, unknown> = {};
    const single = () => {
      if (table === 'route_workspaces') {
        const ws = options.workspaceRow?.() ?? null;
        return ws
          ? { id: ws.id, head_seq: ws.headSeq, state_version: options.stateVersion?.() ?? 7, state_snapshot: ws }
          : null;
      }
      if (table === 'route_operations') return options.operationById ?? null;
      return null;
    };
    const many = () => {
      if (table === 'route_workspaces') {
        const row = single();
        return row ? [row] : [];
      }
      return [...(options.operations ?? [])];
    };
    const b = {
      select: () => b,
      eq: (key: string, value: unknown) => {
        filters[key] = value;
        return b;
      },
      gt: (key: string, value: unknown) => {
        gtFilters.push([key, value]);
        return b;
      },
      order: () => b,
      limit: () => b,
      maybeSingle: () => Promise.resolve({ data: single(), error: null }),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve({ data: many(), error: null }).then(resolve, reject),
    };
    return b;
  }

  const client = {
    from: vi.fn((table: string) => {
      fromCalls.push(table);
      return builder(table);
    }),
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      const out = options.rpc?.[name]?.(args);
      if (out && typeof out === 'object' && 'error' in out) {
        return { data: null, error: (out as { error: unknown }).error };
      }
      return { data: out ?? null, error: null };
    }),
  };
  return {
    store: createSupabaseRouteCollabStore(client as unknown as SupabaseClient),
    client,
    fromCalls,
    rpcCalls,
    gtFilters,
  };
}

const stageNoteOp = { type: 'update_stage_note', stageId: 'stage-1', notes: 'Départ à 7 h' } as const;

describe('supabaseStore — lecture', () => {
  it('rejette un identifiant non UUID par un 404 sans requête', async () => {
    const fake = makeFake({});
    const res = await fake.store.getWorkspaceForActor('ws-local-1', OWNER);
    expect(res).toMatchObject({ ok: false, status: 404 });
    expect(fake.client.from).not.toHaveBeenCalled();
  });

  it('ligne invisible (RLS) : 403 pour un connecté, 401 pour un anonyme', async () => {
    const fake = makeFake({ workspaceRow: () => null });
    expect(await fake.store.getWorkspaceForActor(WS_ID, OWNER)).toMatchObject({ ok: false, status: 403 });
    expect(await fake.store.getWorkspaceForActor(WS_ID, null)).toMatchObject({ ok: false, status: 401 });
  });

  it('lit l’état depuis state_snapshot et reflète head_seq de la colonne', async () => {
    const ws = makeWorkspace({ headSeq: 99 });
    const fake = makeFake({
      workspaceRow: () => ({ ...ws, headSeq: 3, notifications: [{ id: 'n1' }] } as unknown as RouteWorkspaceState),
    });
    const res = await fake.store.getWorkspaceForActor(WS_ID, OWNER);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.accessMode).toBe('member');
    expect(res.workspace.headSeq).toBe(3);
    expect(res.notifications).toEqual([{ id: 'n1' }]);
    expect('notifications' in res.workspace).toBe(false);
  });

  it('lien de partage : lecture via RPC publique, révocation et expiration mappées en 403', async () => {
    const snapshot = { ...makeWorkspace(), headSeq: 3 };
    const fake = makeFake({
      workspaceRow: () => null,
      rpc: { get_shared_route_workspace_tx: () => ({ status: 'ok', snapshot }) },
    });
    const ok = await fake.store.getWorkspaceForActor(WS_ID, null, 'shr-token');
    expect(ok).toMatchObject({ ok: true, accessMode: 'share_link', notifications: [], presence: [] });

    const revoked = makeFake({
      workspaceRow: () => null,
      rpc: { get_shared_route_workspace_tx: () => ({ status: 'revoked' }) },
    });
    expect(await revoked.store.getWorkspaceForActor(WS_ID, null, 'shr-token')).toMatchObject({
      ok: false,
      status: 403,
      error: 'Ce lien de partage a été révoqué.',
    });

    const expired = makeFake({
      workspaceRow: () => null,
      rpc: { get_shared_route_workspace_tx: () => ({ status: 'expired' }) },
    });
    expect(await expired.store.getWorkspaceForActor(WS_ID, null, 'shr-token')).toMatchObject({
      ok: false,
      status: 403,
      error: 'Ce lien de partage a expiré.',
    });
  });

  it('lien de partage : la vue de la base est revérifiée côté Next (aucune fuite même si la base se trompait)', async () => {
    const leaky = {
      ...makeWorkspace({ headSeq: 3 }),
      tripId: 'trip-prive',
      comments: [{ id: 'c' }],
      members: [{ userId: OWNER, displayName: 'Owen', role: 'owner', delegatedPublish: true }],
      sourceOrigin: { kind: 'gpx_import', sourceUrl: 'https://exemple.test/prive', originalGpxXml: '<gpx/>' },
    };
    const fake = makeFake({
      workspaceRow: () => null,
      rpc: { get_shared_route_workspace_tx: () => ({ status: 'ok', snapshot: leaky, hideRadiusM: 300 }) },
    });
    const res = await fake.store.getWorkspaceForActor(WS_ID, null, 'shr-token');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const json = JSON.stringify(res.workspace);
    expect(json).not.toContain(OWNER);
    expect(json).not.toContain('trip-prive');
    expect(json).not.toContain('exemple.test');
    expect(res.workspace.comments).toEqual([]);
    // Départ (45.05, 5.51) masqué : aucun point à moins de 300 m de l'origine.
    for (const p of res.workspace.points) {
      expect(Math.hypot((p.lat - 45.05) * 111_195, (p.lon - 5.51) * 78_000)).toBeGreaterThan(300);
    }
  });

  it('external_viewer membre : pas de lecture directe, vue assainie de la base (accessMode share_link)', async () => {
    const fake = makeFake({
      workspaceRow: () => null,
      rpc: {
        get_route_external_view_tx: () => ({
          status: 'ok',
          snapshot: { ...makeWorkspace(), members: [{ displayName: 'Vic', role: 'external_viewer' }] },
          hideRadiusM: 500,
        }),
      },
    });
    const res = await fake.store.getWorkspaceForActor(WS_ID, VIEWER);
    expect(res).toMatchObject({ ok: true, accessMode: 'share_link', notifications: [], presence: [] });
    expect(fake.rpcCalls[0]).toMatchObject({ name: 'get_route_external_view_tx', args: { p_workspace_id: WS_ID } });
    if (res.ok) expect(JSON.stringify(res.workspace)).not.toContain(VIEWER);

    // Sans lien ni rôle externe : accès refusé.
    const denied = makeFake({
      workspaceRow: () => null,
      rpc: { get_route_external_view_tx: () => ({ status: 'not_found' }) },
    });
    expect(await denied.store.getWorkspaceForActor(WS_ID, OWNER)).toMatchObject({ ok: false, status: 403 });
  });

  it('external_viewer dont la ligne serait visible : même vue assainie côté Next', async () => {
    const fake = makeFake({ workspaceRow: () => makeWorkspace({ headSeq: 3 }) });
    const res = await fake.store.getWorkspaceForActor(WS_ID, VIEWER);
    expect(res).toMatchObject({ ok: true, accessMode: 'share_link', notifications: [] });
    if (!res.ok) return;
    expect(res.workspace.members.some((m) => m.userId === OWNER)).toBe(false);
    expect(res.workspace.tripId).toBe('');
  });

  it('un membre ne relit jamais le jeton de partage (token vide dans le snapshot)', async () => {
    const withLink = makeWorkspace({
      shareLink: {
        token: 'doit-etre-ignore',
        audience: 'external_viewer',
        expiresAt: null,
        revokedAt: null,
        hidePrivateStartRadiusM: 500,
        createdBy: OWNER,
        createdAt: NOW,
      },
    });
    const fake = makeFake({ workspaceRow: () => withLink });
    const res = await fake.store.getWorkspaceForActor(WS_ID, OWNER);
    expect(res.ok && res.workspace.shareLink?.token).toBe('');
  });

  it('journal d’opérations : mappe route_operations vers RouteOperationRecord', async () => {
    const fake = makeFake({
      workspaceRow: () => makeWorkspace({ headSeq: 4 }),
      operations: [
        {
          seq: 4,
          op_id: 'op-4',
          actor_id: EDITOR,
          base_seq: 3,
          payload: stageNoteOp,
          payload_hash: stableHash(stageNoteOp),
          entity_versions: { 'stage-1': 1 },
          created_at: NOW,
        },
      ],
    });
    const res = await fake.store.getWorkspaceChangesAfter(WS_ID, OWNER, 3);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.resyncRequired).toBe(false);
    expect(res.operations).toHaveLength(1);
    expect(res.operations[0]).toMatchObject({ seq: 4, opId: 'op-4', actorName: 'Edith', baseSeq: 3 });
    expect(fake.gtFilters).toEqual([['seq', 3]]);
  });
});

describe('supabaseStore — création', () => {
  it('attribue un UUID, réécrit workspaceId et ne transmet un trip_id que s’il est UUID', async () => {
    const initial = makeWorkspace({ id: 'ws-abc', tripId: 'trip-ws-abc' });
    let created: RouteWorkspaceState | null = null;
    const fake = makeFake({
      workspaceRow: () => created,
      rpc: {
        create_route_workspace_tx: (args) => {
          created = { ...(args.p_snapshot as RouteWorkspaceState), headSeq: 0 };
          return args.p_id;
        },
      },
    });
    const res = await fake.store.createWorkspaceRecord(initial);
    const call = fake.rpcCalls[0];
    expect(call.name).toBe('create_route_workspace_tx');
    expect(call.args.p_trip_id).toBeNull();
    expect(call.args.p_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.id).toBe(call.args.p_id);
    expect(res.points.every((p) => p.workspaceId === res.id)).toBe(true);

    const tripUuid = '66666666-6666-4666-8666-666666666666';
    const withTrip = makeFake({
      workspaceRow: () => null,
      rpc: { create_route_workspace_tx: (args) => args.p_id },
    });
    await withTrip.store.createWorkspaceRecord(makeWorkspace({ tripId: tripUuid }));
    expect(withTrip.rpcCalls[0].args.p_trip_id).toBe(tripUuid);
    expect(withTrip.rpcCalls[0].args.p_id).toBe(WS_ID);
  });

  it('droit d’édition du voyage refusé en base (42501) : RouteCollabStoreError 403', async () => {
    const fake = makeFake({
      rpc: { create_route_workspace_tx: () => ({ error: { code: '42501', message: 'trip_edit_required' } }) },
    });
    await expect(fake.store.createWorkspaceRecord(makeWorkspace())).rejects.toMatchObject({
      name: 'RouteCollabStoreError',
      status: 403,
    });
  });
});

describe('supabaseStore — opérations', () => {
  it('opération acceptée : transmet head_seq lu, version lue, hash stable, et sans members', async () => {
    const fake = makeFake({
      workspaceRow: () => makeWorkspace(),
      rpc: { apply_route_operation_tx: () => ({ status: 'accepted', seq: 4 }) },
    });
    const res = await fake.store.submitWorkspaceOperation(
      WS_ID,
      { opId: 'op-1', baseSeq: 3, actorId: EDITOR, actorName: 'Edith', operation: stageNoteOp },
      NOW,
    );
    expect(res).toMatchObject({ status: 'accepted', seq: 4 });
    const args = fake.rpcCalls[0].args;
    expect(args).toMatchObject({
      p_workspace_id: WS_ID,
      p_op_id: 'op-1',
      p_base_seq: 3,
      p_expected_version: 7,
      p_operation_type: 'update_stage_note',
      p_payload_hash: stableHash(stageNoteOp),
    });
    expect(args.p_next_snapshot).not.toHaveProperty('members');
    expect(args.p_next_snapshot).toHaveProperty('stages');
  });

  it('concurrence : conflit de la base => relecture puis nouvel essai accepté', async () => {
    let reads = 0;
    let rpcs = 0;
    const fake = makeFake({
      workspaceRow: () => {
        reads += 1;
        return makeWorkspace({ headSeq: 3 + (reads - 1) });
      },
      rpc: {
        apply_route_operation_tx: () => {
          rpcs += 1;
          return rpcs === 1 ? { status: 'conflict', reason: 'head_moved', currentSeq: 4 } : { status: 'accepted', seq: 5 };
        },
      },
    });
    const res = await fake.store.submitWorkspaceOperation(
      WS_ID,
      { opId: 'op-2', baseSeq: 3, actorId: OWNER, actorName: 'Owen', operation: stageNoteOp },
      NOW,
    );
    expect(res).toMatchObject({ status: 'accepted', seq: 5 });
    expect(rpcs).toBe(2);
    expect(fake.rpcCalls[1].args.p_base_seq).toBe(4);
  });

  it('concurrence persistante : renvoie un conflit avec l’état courant (409 côté route)', async () => {
    const fake = makeFake({
      workspaceRow: () => makeWorkspace({ headSeq: 8 }),
      rpc: { apply_route_operation_tx: () => ({ status: 'conflict', reason: 'head_moved', currentSeq: 8 }) },
    });
    const res = await fake.store.submitWorkspaceOperation(
      WS_ID,
      { opId: 'op-3', baseSeq: 3, actorId: OWNER, actorName: 'Owen', operation: stageNoteOp },
      NOW,
    );
    expect(res.status).toBe('conflict');
    if (res.status !== 'conflict') return;
    expect(res.currentSeq).toBe(8);
    expect(res.currentWorkspace.headSeq).toBe(8);
    expect(res.conflicts[0].entityType).toBe('workspace');
    expect(fake.rpcCalls).toHaveLength(4);
  });

  it('conflit de version d’entité détecté par le moteur : aucun appel RPC', async () => {
    const fake = makeFake({ workspaceRow: () => makeWorkspace() });
    const res = await fake.store.submitWorkspaceOperation(
      WS_ID,
      {
        opId: 'op-4',
        baseSeq: 2,
        actorId: OWNER,
        actorName: 'Owen',
        operation: stageNoteOp,
        expectedVersions: { 'stage-1': 0 },
      },
      NOW,
    );
    expect(res.status).toBe('conflict');
    expect(fake.client.rpc).not.toHaveBeenCalled();
  });

  it('refus du moteur (lecteur externe) : denied sans RPC ; refus de la base : denied mappé', async () => {
    const engineDenied = makeFake({ workspaceRow: () => makeWorkspace() });
    const denied = await engineDenied.store.submitWorkspaceOperation(
      WS_ID,
      { opId: 'op-5', baseSeq: 3, actorId: VIEWER, actorName: 'Vic', operation: stageNoteOp },
      NOW,
    );
    expect(denied.status).toBe('denied');
    expect(engineDenied.client.rpc).not.toHaveBeenCalled();

    // Le snapshot dit « editor » mais la base (source de vérité) a révoqué l'accès.
    const dbDenied = makeFake({
      workspaceRow: () => makeWorkspace(),
      rpc: {
        apply_route_operation_tx: () => ({ status: 'denied', reason: 'insufficient_permissions_or_revoked' }),
      },
    });
    const res = await dbDenied.store.submitWorkspaceOperation(
      WS_ID,
      { opId: 'op-6', baseSeq: 3, actorId: EDITOR, actorName: 'Edith', operation: stageNoteOp },
      NOW,
    );
    expect(res).toEqual({ status: 'denied', reason: 'Accès insuffisant ou révoqué pour cette action.' });
  });

  it('idempotence : opération déjà journalisée avec le même hash => already_applied sans RPC', async () => {
    const fake = makeFake({
      workspaceRow: () => makeWorkspace({ headSeq: 4 }),
      operationById: {
        seq: 4,
        op_id: 'op-7',
        actor_id: EDITOR,
        base_seq: 3,
        payload: stageNoteOp,
        payload_hash: stableHash(stageNoteOp),
        entity_versions: {},
        created_at: NOW,
      },
    });
    const res = await fake.store.submitWorkspaceOperation(
      WS_ID,
      { opId: 'op-7', baseSeq: 3, actorId: EDITOR, actorName: 'Edith', operation: stageNoteOp },
      NOW,
    );
    expect(res).toMatchObject({ status: 'already_applied', seq: 4 });
    expect(fake.client.rpc).not.toHaveBeenCalled();
  });

  it('workspace inconnu : not_found', async () => {
    const fake = makeFake({ workspaceRow: () => null });
    const res = await fake.store.submitWorkspaceOperation(
      WS_ID,
      { opId: 'op-8', baseSeq: 0, actorId: OWNER, actorName: 'Owen', operation: stageNoteOp },
      NOW,
    );
    expect(res).toEqual({ status: 'not_found' });
  });
});

describe('supabaseStore — publication', () => {
  it('publie via la RPC (tête relue, snapshot de publication) puis notifie', async () => {
    const fake = makeFake({
      workspaceRow: () =>
        makeWorkspace({
          participantPacks: [
            { userId: EDITOR, displayName: 'Edith', preparedRevisionNo: null, downloadedRevisionNo: null, verifiedLocalAt: null, status: 'not_downloaded' },
          ],
        }),
      rpc: {
        publish_route_revision_tx: () => ({ status: 'published', revisionNo: 1 }),
        write_route_workspace_part_tx: () => ({ status: 'ok' }),
      },
    });
    const res = await fake.store.publishWorkspace({
      workspaceId: WS_ID,
      actorId: OWNER,
      actorName: 'Owen',
      expectedHeadSeq: 3,
      summary: 'v1',
      nowIso: NOW,
    });
    expect(res.status).toBe('published');
    const publish = fake.rpcCalls.find((c) => c.name === 'publish_route_revision_tx');
    expect(publish?.args).toMatchObject({ p_expected_head_seq: 3, p_expected_version: 7, p_summary: 'v1' });
    expect(publish?.args.p_next_snapshot).toHaveProperty('revisions');
    expect(publish?.args.p_next_snapshot).not.toHaveProperty('members');
    const notif = fake.rpcCalls.find((c) => c.name === 'write_route_workspace_part_tx');
    expect(notif?.args.p_part).toBe('notifications');
  });

  it('publication bloquée si la tête a changé entre la lecture et la RPC', async () => {
    const fake = makeFake({
      workspaceRow: () => makeWorkspace(),
      rpc: {
        publish_route_revision_tx: () => ({ status: 'blocked', reason: 'head_changed_requires_review', currentHeadSeq: 4 }),
      },
    });
    const res = await fake.store.publishWorkspace({
      workspaceId: WS_ID,
      actorId: OWNER,
      actorName: 'Owen',
      expectedHeadSeq: 3,
      summary: '',
      nowIso: NOW,
    });
    expect(res.status).toBe('blocked');
    if (res.status !== 'blocked') return;
    expect(res.blockingIssues).toEqual(['head_changed_requires_review']);
    expect(fake.rpcCalls.some((c) => c.name === 'write_route_workspace_part_tx')).toBe(false);
  });

  it('publication bloquée par le moteur si expectedHeadSeq est périmé (aucune RPC)', async () => {
    const fake = makeFake({ workspaceRow: () => makeWorkspace({ headSeq: 5 }) });
    const res = await fake.store.publishWorkspace({
      workspaceId: WS_ID,
      actorId: OWNER,
      actorName: 'Owen',
      expectedHeadSeq: 3,
      summary: '',
      nowIso: NOW,
    });
    expect(res).toMatchObject({ status: 'blocked', blockingIssues: ['head_changed_requires_review'] });
    expect(fake.client.rpc).not.toHaveBeenCalled();
  });

  it('droit de publication refusé en base : blocked permission_denied', async () => {
    const fake = makeFake({
      workspaceRow: () => makeWorkspace(),
      rpc: { publish_route_revision_tx: () => ({ status: 'blocked', reason: 'publish_permission_required' }) },
    });
    const res = await fake.store.publishWorkspace({
      workspaceId: WS_ID,
      actorId: OWNER,
      actorName: 'Owen',
      expectedHeadSeq: 3,
      summary: '',
      nowIso: NOW,
    });
    expect(res).toMatchObject({ status: 'blocked', blockingIssues: ['permission_denied'] });
  });

  it('workspace introuvable : not_found', async () => {
    const fake = makeFake({ workspaceRow: () => null });
    expect(
      await fake.store.publishWorkspace({
        workspaceId: WS_ID,
        actorId: OWNER,
        actorName: 'Owen',
        expectedHeadSeq: 0,
        summary: '',
      }),
    ).toEqual({ status: 'not_found' });
  });
});

describe('supabaseStore — parties, membres, partage', () => {
  const anchor = {
    anchorType: 'point',
    entityId: 'pt-1',
    entityVersion: 1,
    originalLat: 45.05,
    originalLon: 5.51,
    maxRelocateMeters: 250,
  } as const;

  it('commentaire : écrit la partie comments avec la version lue', async () => {
    const fake = makeFake({
      workspaceRow: () => makeWorkspace(),
      rpc: { write_route_workspace_part_tx: () => ({ status: 'ok' }) },
    });
    const res = await fake.store.addWorkspaceComment({
      workspaceId: WS_ID,
      actorId: EDITOR,
      actorName: 'Edith',
      body: 'Source à vérifier',
      anchor,
      nowIso: NOW,
    });
    expect(res.ok).toBe(true);
    const call = fake.rpcCalls[0];
    expect(call.args).toMatchObject({ p_workspace_id: WS_ID, p_part: 'comments', p_expected_version: 7 });
    expect(call.args.p_value).toHaveLength(1);
    if (res.ok) expect(res.workspace.comments).toHaveLength(1);
  });

  it('commentaire : lecteur externe refusé localement, refus de la base mappé en 403', async () => {
    const local = makeFake({ workspaceRow: () => makeWorkspace() });
    expect(
      await local.store.addWorkspaceComment({ workspaceId: WS_ID, actorId: VIEWER, actorName: 'Vic', body: 'x', anchor }),
    ).toMatchObject({ ok: false, status: 403 });
    expect(local.client.rpc).not.toHaveBeenCalled();

    const remote = makeFake({
      workspaceRow: () => makeWorkspace(),
      rpc: { write_route_workspace_part_tx: () => ({ status: 'denied', reason: 'insufficient_permissions_or_revoked' }) },
    });
    expect(
      await remote.store.addWorkspaceComment({ workspaceId: WS_ID, actorId: EDITOR, actorName: 'Edith', body: 'x', anchor }),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it('modification concurrente persistante d’une partie : RouteCollabStoreError 409', async () => {
    const fake = makeFake({
      workspaceRow: () => makeWorkspace(),
      rpc: { write_route_workspace_part_tx: () => ({ status: 'conflict', reason: 'state_version_moved' }) },
    });
    const attempt = fake.store.addWorkspaceComment({
      workspaceId: WS_ID,
      actorId: EDITOR,
      actorName: 'Edith',
      body: 'x',
      anchor,
    });
    await expect(attempt).rejects.toBeInstanceOf(RouteCollabStoreError);
    await expect(attempt).rejects.toMatchObject({ status: 409 });
  });

  it('membres : identifiant non UUID => 404 ; non-responsable => 403 ; sinon RPC set_route_member_tx', async () => {
    const fake = makeFake({
      workspaceRow: () => makeWorkspace(),
      rpc: { set_route_member_tx: () => ({ status: 'ok' }) },
    });
    expect(
      await fake.store.updateMemberRoleOrRevoke({ workspaceId: WS_ID, actorId: OWNER, targetUserId: 'pas-un-uuid' }),
    ).toMatchObject({ ok: false, status: 404 });
    expect(
      await fake.store.updateMemberRoleOrRevoke({ workspaceId: WS_ID, actorId: EDITOR, targetUserId: VIEWER }),
    ).toMatchObject({ ok: false, status: 403 });
    expect(fake.client.rpc).not.toHaveBeenCalled();

    const res = await fake.store.updateMemberRoleOrRevoke({
      workspaceId: WS_ID,
      actorId: OWNER,
      targetUserId: EDITOR,
      role: 'contributor',
      revoke: false,
    });
    expect(res.ok).toBe(true);
    expect(fake.rpcCalls[0]).toMatchObject({
      name: 'set_route_member_tx',
      args: { p_workspace_id: WS_ID, p_user_id: EDITOR, p_role: 'contributor', p_revoke: false, p_delegated_publish: null },
    });
  });

  it('membres : une étape confiée (stageScopeIds) est refusée franchement tant que la base ne sait pas l’écrire', async () => {
    const fake = makeFake({
      workspaceRow: () => makeWorkspace(),
      rpc: { set_route_member_tx: () => ({ status: 'ok' }) },
    });
    const res = await fake.store.updateMemberRoleOrRevoke({
      workspaceId: WS_ID,
      actorId: OWNER,
      targetUserId: EDITOR,
      stageScopeIds: ['st1'],
    });
    expect(res).toMatchObject({ ok: false, status: 501 });
    // rien n'est annoncé comme enregistré : aucun appel d'écriture
    expect(fake.rpcCalls).toEqual([]);
  });

  it('membres : refus de la base (co_organizer ne révoque pas un owner) mappé en 403', async () => {
    const fake = makeFake({
      workspaceRow: () => makeWorkspace(),
      rpc: { set_route_member_tx: () => ({ status: 'denied', reason: 'owner_protected' }) },
    });
    const res = await fake.store.updateMemberRoleOrRevoke({
      workspaceId: WS_ID,
      actorId: OWNER,
      targetUserId: CO_ORG,
      revoke: true,
    });
    expect(res).toEqual({
      ok: false,
      status: 403,
      error: 'Seul un responsable peut nommer ou révoquer un responsable.',
    });
  });

  it('lien de partage : jeton généré par la base (aucun jeton envoyé), renvoyé une seule fois', async () => {
    const TOKEN = `shr-${'a'.repeat(64)}`;
    const link = {
      audience: 'external_viewer',
      expiresAt: null,
      revokedAt: null,
      hidePrivateStartRadiusM: 300,
      createdBy: OWNER,
      createdAt: NOW,
    };
    const fake = makeFake({
      workspaceRow: () => makeWorkspace(),
      rpc: { manage_route_share_link_tx: () => ({ status: 'ok', shareLink: link, token: TOKEN }) },
    });
    const res = await fake.store.manageShareLink({
      workspaceId: WS_ID,
      actorId: OWNER,
      action: 'create',
      expiresInHours: 24,
      hidePrivateStartRadiusM: 300,
    });
    expect(res.ok).toBe(true);
    const args = fake.rpcCalls[0].args;
    expect(args).not.toHaveProperty('p_token');
    expect(Date.parse(String(args.p_expires_at))).toBeGreaterThan(Date.now());
    expect(args.p_hide_radius_m).toBe(300);
    if (!res.ok) return;
    // Le jeton n'est présent que dans la réponse de création.
    expect(res.shareLink?.token).toBe(TOKEN);
    expect(res.workspace.shareLink?.token).toBe(TOKEN);
    expect(JSON.stringify(fake.rpcCalls.map((c) => c.args))).not.toContain(TOKEN);

    const revoke = makeFake({
      workspaceRow: () => makeWorkspace(),
      rpc: { manage_route_share_link_tx: () => ({ status: 'ok', shareLink: { ...link, revokedAt: NOW } }) },
    });
    const revoked = await revoke.store.manageShareLink({ workspaceId: WS_ID, actorId: OWNER, action: 'revoke' });
    expect(revoked.ok && revoked.shareLink?.token).toBe('');
    expect(revoke.rpcCalls[0].args.p_expires_at).toBeNull();

    const missing = makeFake({ workspaceRow: () => null });
    expect(
      await missing.store.manageShareLink({ workspaceId: WS_ID, actorId: OWNER, action: 'revoke' }),
    ).toMatchObject({ ok: false, status: 404 });
  });

  it('lien de partage : refus de la base (rayon < 200 m) mappé en 403 avec un message précis', async () => {
    const fake = makeFake({
      workspaceRow: () => makeWorkspace(),
      rpc: { manage_route_share_link_tx: () => ({ status: 'denied', reason: 'invalid_radius' }) },
    });
    expect(
      await fake.store.manageShareLink({ workspaceId: WS_ID, actorId: OWNER, action: 'create', hidePrivateStartRadiusM: 50 }),
    ).toEqual({ ok: false, status: 403, error: 'Rayon de la zone de départ privée invalide (200 m minimum).' });
  });

  it('membres : « not_eligible » (hors voyage) mappé en 403 sans révéler l’existence du compte', async () => {
    const fake = makeFake({
      workspaceRow: () => makeWorkspace(),
      rpc: { set_route_member_tx: () => ({ status: 'denied', reason: 'not_eligible' }) },
    });
    const res = await fake.store.updateMemberRoleOrRevoke({
      workspaceId: WS_ID,
      actorId: OWNER,
      targetUserId: '66666666-6666-4666-8666-666666666666',
      role: 'editor',
    });
    expect(res).toMatchObject({ ok: false, status: 403 });
    expect(res.ok === false && res.error).not.toMatch(/introuvable|n’existe pas/);
  });

  it('toutes les RPC d’écriture reçoivent une version attendue (jamais NULL)', async () => {
    const fake = makeFake({
      workspaceRow: () =>
        makeWorkspace({
          participantPacks: [
            { userId: EDITOR, displayName: 'Edith', preparedRevisionNo: null, downloadedRevisionNo: null, verifiedLocalAt: null, status: 'not_downloaded' },
          ],
        }),
      rpc: {
        apply_route_operation_tx: () => ({ status: 'accepted', seq: 4 }),
        publish_route_revision_tx: () => ({ status: 'published', revisionNo: 1 }),
        write_route_workspace_part_tx: () => ({ status: 'ok' }),
      },
    });
    await fake.store.submitWorkspaceOperation(
      WS_ID,
      { opId: 'op-v', baseSeq: 3, actorId: EDITOR, actorName: 'Edith', operation: stageNoteOp },
      NOW,
    );
    await fake.store.addWorkspaceComment({ workspaceId: WS_ID, actorId: EDITOR, actorName: 'Edith', body: 'x', anchor });
    await fake.store.publishWorkspace({ workspaceId: WS_ID, actorId: OWNER, actorName: 'Owen', expectedHeadSeq: 3, summary: 's', nowIso: NOW });
    const writes = fake.rpcCalls.filter((c) =>
      ['apply_route_operation_tx', 'publish_route_revision_tx', 'write_route_workspace_part_tx'].includes(c.name),
    );
    expect(writes.length).toBeGreaterThanOrEqual(4);
    for (const call of writes) expect(call.args.p_expected_version).toBe(7);
  });

  it('idempotence : le même contenu avec un ordre de clés différent (jsonb) reste reconnu', async () => {
    const reordered = { notes: 'Départ à 7 h', stageId: 'stage-1', type: 'update_stage_note' };
    const fake = makeFake({
      workspaceRow: () => makeWorkspace({ headSeq: 4 }),
      operationById: {
        seq: 4,
        op_id: 'op-9',
        actor_id: EDITOR,
        base_seq: 3,
        payload: reordered,
        // SHA-256 calculé par la base : n'est plus comparable au stableHash du moteur.
        payload_hash: 'a'.repeat(64),
        entity_versions: {},
        created_at: NOW,
      },
    });
    const res = await fake.store.submitWorkspaceOperation(
      WS_ID,
      { opId: 'op-9', baseSeq: 3, actorId: EDITOR, actorName: 'Edith', operation: stageNoteOp },
      NOW,
    );
    expect(res).toMatchObject({ status: 'already_applied', seq: 4 });

    const different = makeFake({
      workspaceRow: () => makeWorkspace({ headSeq: 4 }),
      operationById: {
        seq: 4,
        op_id: 'op-9',
        actor_id: EDITOR,
        base_seq: 3,
        payload: { ...reordered, notes: 'autre contenu' },
        payload_hash: 'a'.repeat(64),
        entity_versions: {},
        created_at: NOW,
      },
    });
    const mismatch = await different.store.submitWorkspaceOperation(
      WS_ID,
      { opId: 'op-9', baseSeq: 3, actorId: EDITOR, actorName: 'Edith', operation: stageNoteOp },
      NOW,
    );
    expect(mismatch.status).toBe('denied');
  });
});

describe('supabaseStore — présence', () => {
  it('reste en mémoire process : aucun appel RPC, accès refusé si membre révoqué', async () => {
    const fake = makeFake({
      workspaceRow: () =>
        makeWorkspace({
          members: [
            { userId: OWNER, displayName: 'Owen', role: 'owner' },
            { userId: EDITOR, displayName: 'Edith', role: 'editor', revokedAt: NOW },
          ],
        }),
    });
    const ok = await fake.store.updateWorkspacePresence({ workspaceId: WS_ID, actorId: OWNER, actorName: 'Owen' });
    expect(ok.ok).toBe(true);
    const revoked = await fake.store.updateWorkspacePresence({ workspaceId: WS_ID, actorId: EDITOR, actorName: 'Edith' });
    expect(revoked).toMatchObject({ ok: false, status: 403 });
    expect(fake.client.rpc).not.toHaveBeenCalled();
  });
});

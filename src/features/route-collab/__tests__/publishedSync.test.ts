import { beforeEach, describe, expect, it } from 'vitest';
import { readRouteDraft } from '@/features/adventure-prep/routeRevision';
import {
  PUBLISHED_ROUTE_ENGINE,
  publishedRevisionOf,
  publishedRevisionToRouteDraft,
  summarizePublishedRouteForHub,
} from '../integrations';
import { planRouteDraftSync } from '../publishedSync';
import { createWorkspaceRecord, publishWorkspace, resetRouteCollabStoreForTests } from '../serverStore';
import type { RouteWorkspaceState } from '../types';

const NOW = '2026-11-19T08:00:00.000Z';

function makeWorkspace(): RouteWorkspaceState {
  const wsId = 'ws-sync-1';
  return {
    id: wsId,
    tripId: 'trip-sync-1',
    title: 'Traversée',
    status: 'draft',
    sport: 'marche',
    shapeMode: 'one_way',
    routingOptions: {},
    headSeq: 0,
    reviewedSeq: null,
    publishedRevisionId: null,
    publishedRevisionNo: null,
    sourceOrigin: { kind: 'blank' },
    points: [
      { id: 'p1', workspaceId: wsId, kind: 'start', orderKey: 'A', lat: 45.65, lon: 6.1, eleM: 900, name: 'École', entityVersion: 1 },
      { id: 'p2', workspaceId: wsId, kind: 'finish', orderKey: 'Z', lat: 45.69, lon: 6.15, eleM: 1450, name: 'Refuge', entityVersion: 1 },
    ],
    sections: [
      {
        id: 's1', workspaceId: wsId, fromPointId: 'p1', toPointId: 'p2', mode: 'routed',
        geometry: { type: 'LineString', coordinates: [[6.1, 45.65], [6.12, 45.67], [6.15, 45.69]] },
        distanceKm: 9.2, durationMin: 165, ascentM: 550, descentM: 40,
        surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'trail', source: 'OSM' }],
        routingInputHash: null,
        provenance: { provider: 'valhalla', calculatedAt: NOW, profile: 'marche', confidence: 'verified' },
        warnings: [], entityVersion: 1,
      },
    ],
    stages: [],
    variants: [], proposals: [], comments: [], kitItems: [],
    members: [{ userId: 'alice', displayName: 'Alice', role: 'owner' }],
    revisions: [], packs: [], participantPacks: [],
    updatedAt: NOW,
  };
}

function published(): RouteWorkspaceState {
  const ws = createWorkspaceRecord(makeWorkspace());
  const res = publishWorkspace({ workspaceId: ws.id, actorId: 'alice', actorName: 'Alice', expectedHeadSeq: 0, summary: 'v1' });
  if (res.status !== 'published') throw new Error('publication de test refusée');
  return res.workspace;
}

describe('un seul tracé par voyage (P4 / 10.1)', () => {
  beforeEach(() => resetRouteCollabStoreForTests());

  it('sans espace publié, le routeDraft du Compas reste la source', () => {
    const plan = planRouteDraftSync({ tripId: 'trip-sync-1', metadata: {}, workspaces: [createWorkspaceRecord(makeWorkspace())] });
    expect(plan).toEqual({ action: 'none', reason: 'no_published' });
  });

  it('la version publiée devient le routeDraft (points nommés, géométrie et distance intacts)', () => {
    const ws = published();
    const plan = planRouteDraftSync({ tripId: ws.tripId, metadata: {}, workspaces: [ws] });
    expect(plan.action).toBe('write');
    if (plan.action !== 'write') return;
    expect(plan.draft.engine).toBe(PUBLISHED_ROUTE_ENGINE);
    expect(plan.draft.points.map((p) => p.name)).toEqual(['École', 'Refuge']);
    expect(plan.draft.distanceKm).toBe(9.2);
    expect(plan.draft.geometry.coordinates).toHaveLength(3);
    expect(plan.replacesEditorDraft).toBe(false);
    // Le brouillon dérivé est relisible par le lecteur du Compas.
    expect(readRouteDraft({ compas: { routeDraft: plan.draft } })?.distanceKm).toBe(9.2);
  });

  it('est idempotent : la copie issue de cette version n\'est pas réécrite', () => {
    const ws = published();
    const first = planRouteDraftSync({ tripId: ws.tripId, metadata: {}, workspaces: [ws] });
    if (first.action !== 'write') throw new Error('écriture attendue');
    const again = planRouteDraftSync({ tripId: ws.tripId, metadata: { compas: { routeDraft: first.draft } }, workspaces: [ws] });
    expect(again).toEqual({ action: 'none', reason: 'up_to_date' });
  });

  it('ne perd jamais un tracé enregistré dans l\'éditeur après la publication', () => {
    const ws = published();
    const rev = publishedRevisionOf(ws)!;
    const later = new Date(Date.parse(rev.createdAt) + 60_000).toISOString();
    const editorDraft = {
      id: 'draft-x', version: 2, sport: 'marche', engine: 'lkdv-route-editor/2', savedAt: later,
      points: [
        { id: 'a', lat: 45, lon: 6, kind: 'start' },
        { id: 'b', lat: 45.1, lon: 6.1, kind: 'end' },
      ],
      geometry: { type: 'LineString', coordinates: [[6, 45], [6.1, 45.1]] },
      distanceKm: 5, durationMin: null, provider: null, warnings: [],
    };
    const plan = planRouteDraftSync({ tripId: ws.tripId, metadata: { compas: { routeDraft: editorDraft } }, workspaces: [ws] });
    expect(plan).toEqual({ action: 'none', reason: 'editor_newer' });
  });

  it('remplace un tracé de l\'éditeur plus ancien que la publication, et le signale', () => {
    const ws = published();
    const editorDraft = {
      id: 'draft-old', version: 1, sport: 'marche', engine: 'lkdv-route-editor/2', savedAt: '2020-01-01T00:00:00.000Z',
      points: [
        { id: 'a', lat: 45, lon: 6, kind: 'start' },
        { id: 'b', lat: 45.1, lon: 6.1, kind: 'end' },
      ],
      geometry: { type: 'LineString', coordinates: [[6, 45], [6.1, 45.1]] },
      distanceKm: 5, durationMin: null, provider: null, warnings: [],
    };
    const plan = planRouteDraftSync({ tripId: ws.tripId, metadata: { compas: { routeDraft: editorDraft } }, workspaces: [ws] });
    expect(plan.action).toBe('write');
    if (plan.action === 'write') expect(plan.replacesEditorDraft).toBe(true);
  });

  it('ignore l\'espace d\'un autre voyage', () => {
    const ws = published();
    expect(planRouteDraftSync({ tripId: 'autre-voyage', metadata: {}, workspaces: [ws] }).action).toBe('none');
  });

  it('une version sans tracé exploitable ne produit pas de routeDraft', () => {
    expect(publishedRevisionToRouteDraft({ id: 'r', revisionNo: 1, createdAt: NOW, points: [], sections: [] }, 'marche')).toBeNull();
  });
});

describe('le HUB lit la version publiée (10.3)', () => {
  beforeEach(() => resetRouteCollabStoreForTests());

  it('résume la version publiée et pointe vers /compas/itineraire?trip=', () => {
    const ws = published();
    const s = summarizePublishedRouteForHub(ws);
    expect(s).not.toBeNull();
    expect(s?.revisionNo).toBe(1);
    expect(s?.distanceKm).toBe(9.2);
    expect(s?.hasNewerDraft).toBe(false);
    expect(s?.href).toBe('/compas/itineraire?trip=trip-sync-1');
  });

  it('rien sans publication (le HUB n\'invente pas d\'itinéraire)', () => {
    expect(summarizePublishedRouteForHub(createWorkspaceRecord(makeWorkspace()))).toBeNull();
  });
});

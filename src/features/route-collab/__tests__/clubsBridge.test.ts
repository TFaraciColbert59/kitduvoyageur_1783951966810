import { beforeEach, describe, expect, it } from 'vitest';
import { clubRouteFromPublished, rsvpGrantsRouteEdit } from '../integrations';
import { createWorkspaceRecord, publishWorkspace, resetRouteCollabStoreForTests } from '../serverStore';
import type { RouteWorkspaceState } from '../types';

const NOW = '2026-11-19T08:00:00.000Z';
function ws(): RouteWorkspaceState {
  const id = 'ws-club-1';
  return {
    id, tripId: 'trip-club-1', title: 'Sortie club', status: 'draft', sport: 'marche', shapeMode: 'one_way',
    routingOptions: {}, headSeq: 0, reviewedSeq: null, publishedRevisionId: null, publishedRevisionNo: null, sourceOrigin: { kind: 'blank' },
    points: [
      { id: 'p1', workspaceId: id, kind: 'start', orderKey: 'A', lat: 45.6, lon: 6.1, eleM: null, name: 'Parking', entityVersion: 1 },
      { id: 'p2', workspaceId: id, kind: 'finish', orderKey: 'Z', lat: 45.7, lon: 6.2, eleM: null, name: 'Sommet', entityVersion: 1 },
    ],
    sections: [{
      id: 's1', workspaceId: id, fromPointId: 'p1', toPointId: 'p2', mode: 'routed',
      geometry: { type: 'LineString', coordinates: [[6.1, 45.6], [6.2, 45.7]] },
      distanceKm: 12, durationMin: 200, ascentM: 600, descentM: 20,
      surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'trail', source: 'OSM' }], routingInputHash: null,
      provenance: { provider: 'valhalla', calculatedAt: NOW, profile: 'marche', confidence: 'verified' }, warnings: [], entityVersion: 1,
    }],
    stages: [], variants: [], proposals: [], comments: [], kitItems: [],
    members: [{ userId: 'alice', displayName: 'Alice', role: 'owner' }],
    revisions: [], packs: [], participantPacks: [], updatedAt: NOW,
  };
}

describe('Clubs : la sortie reprend la version publiée (10.5)', () => {
  beforeEach(() => resetRouteCollabStoreForTests());

  it('sans publication, rien à proposer au club', () => {
    expect(clubRouteFromPublished(createWorkspaceRecord(ws()), 'ev-1')).toEqual({ status: 'no_published' });
  });

  it('reprend distance, dénivelé, version et contrôle de la version publiée', () => {
    const rec = createWorkspaceRecord(ws());
    const res = publishWorkspace({ workspaceId: rec.id, actorId: 'alice', actorName: 'Alice', expectedHeadSeq: 0, summary: 'v1' });
    if (res.status !== 'published') throw new Error('publication refusée');
    const out = clubRouteFromPublished(res.workspace, 'ev-1');
    expect(out.status).toBe('ok');
    if (out.status !== 'ok') return;
    expect(out.snapshot).toMatchObject({ eventId: 'ev-1', routeId: rec.id, revision: 1, distanceM: 12000, elevationGainM: 600, requiresParticipantDecision: true });
    expect(out.snapshot.checksum).toBe(res.pack.checksum);
  });

  it('s\'inscrire ne donne pas le droit de modifier ni de publier le tracé', () => {
    expect(rsvpGrantsRouteEdit()).toBe(false);
  });
});

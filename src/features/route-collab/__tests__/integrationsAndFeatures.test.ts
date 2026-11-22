import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildCarnetComparisonView,
  inventoryItemToCollabKitItem,
  summarizeWorkspaceForHub,
  toClubRouteRevisionSnapshot,
  toTrailMessageMeta,
} from '../integrations';
import {
  commitVerifiedPack,
  finishActivityToCarnet,
  startActivityFromRevision,
} from '../offlinePackStore';
import {
  createWorkspaceRecord,
  getWorkspaceForActor,
  manageShareLink,
  publishWorkspace,
  resetRouteCollabStoreForTests,
  submitWorkspaceOperation,
  updateWorkspaceKitItem,
  updateWorkspacePresence,
  voteWorkspaceProposal,
  createWorkspaceProposal,
} from '../serverStore';
import type { RouteWorkspaceState } from '../types';

function makeWorkspace(): RouteWorkspaceState {
  const now = '2026-11-19T08:00:00.000Z';
  const wsId = 'ws-int-1';
  return {
    id: wsId,
    tripId: 'trip-int-1',
    title: 'Traversée Bauges 2J',
    status: 'draft',
    sport: 'marche',
    shapeMode: 'one_way',
    routingOptions: {},
    headSeq: 0,
    reviewedSeq: null,
    publishedRevisionId: null,
    publishedRevisionNo: null,
    sourceOrigin: { kind: 'explorer_route', sourceId: 'exp-99', sourceTitle: 'Bauges', importedAt: now },
    points: [
      { id: 'p1', workspaceId: wsId, kind: 'start', orderKey: 'A', lat: 45.65, lon: 6.1, eleM: 900, name: 'École', entityVersion: 1 },
      { id: 'p2', workspaceId: wsId, kind: 'finish', orderKey: 'Z', lat: 45.69, lon: 6.15, eleM: 1450, name: 'Refuge de la Plate', entityVersion: 1 },
    ],
    sections: [
      {
        id: 's1',
        workspaceId: wsId,
        fromPointId: 'p1',
        toPointId: 'p2',
        mode: 'routed',
        geometry: { type: 'LineString', coordinates: [[6.1, 45.65], [6.15, 45.69]] },
        distanceKm: 9.2,
        durationMin: 165,
        ascentM: 550,
        descentM: 40,
        surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'trail', source: 'OSM' }],
        routingInputHash: null,
        provenance: { provider: 'valhalla', calculatedAt: now, profile: 'marche', confidence: 'verified' },
        warnings: [],
        entityVersion: 1,
      },
    ],
    stages: [
      {
        id: 'st1',
        workspaceId: wsId,
        orderKey: '001',
        dayNumber: 1,
        title: 'Jour 1',
        dateIso: '2026-11-25',
        departureTimeLocal: '08:00',
        timezone: 'Europe/Paris',
        startPointId: 'p1',
        endPointId: 'p2',
        overnightPlace: null,
        notes: 'Montée soutenue',
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
      { userId: 'alice', displayName: 'Alice', role: 'owner' },
      { userId: 'eloi', displayName: 'Éloi', role: 'editor' },
      { userId: 'paul', displayName: 'Paul', role: 'contributor' },
    ],
    revisions: [],
    packs: [],
    participantPacks: [],
    updatedAt: now,
  };
}

describe('Intégrations LKDV (Clubs, Messagerie, Inventaire, Hub, Carnet) & Variantes/Formes/Partage', () => {
  beforeEach(() => {
    resetRouteCollabStoreForTests();
  });

  it('gère boucle, aller-retour, variantes, présence soft-lock et liens de partage révocables', () => {
    const ws = createWorkspaceRecord(makeWorkspace());

    // Forme boucle ajoute un point de fermeture stable
    const loopRes = submitWorkspaceOperation(ws.id, {
      opId: 'op-loop',
      baseSeq: 0,
      actorId: 'alice',
      actorName: 'Alice',
      operation: { type: 'set_shape_mode', shapeMode: 'loop' },
    });
    expect(loopRes.status).toBe('accepted');
    if (loopRes.status === 'accepted') {
      expect(loopRes.workspace.points.length).toBe(3);
      expect(loopRes.workspace.shapeMode).toBe('loop');
    }

    // Variante comparable + application
    const addVar = submitWorkspaceOperation(ws.id, {
      opId: 'op-var-1',
      baseSeq: 1,
      actorId: 'paul',
      actorName: 'Paul',
      operation: {
        type: 'add_variant',
        variant: {
          id: 'var-detour',
          baseRevisionNo: 0,
          scope: 'section',
          title: 'Détour alpage',
          replacements: [
            {
              sectionId: 's1',
              geometry: { type: 'LineString', coordinates: [[6.1, 45.65], [6.13, 45.67], [6.15, 45.69]] },
              distanceKm: 11.4,
              durationMin: 205,
              ascentM: 680,
              descentM: 120,
              surfaceKnownRatio: 0.8,
              provenance: { provider: 'compas', calculatedAt: '2026-11-19T08:01:00Z', profile: 'marche', confidence: 'estimated' },
            },
          ],
          deltaDistanceKm: 2.2,
          deltaAscentM: 130,
          deltaDurationMin: 40,
          status: 'draft',
          createdBy: 'paul',
          createdAt: '2026-11-19T08:01:00Z',
        },
      },
    });
    expect(addVar.status).toBe('accepted');

    // Présence légère avec soft lock
    const pres = updateWorkspacePresence({
      workspaceId: ws.id,
      actorId: 'eloi',
      actorName: 'Éloi',
      activeStageId: 'st1',
      softLockEntityId: 'p2',
      mode: 'editing',
    });
    expect(pres.ok).toBe(true);
    if (pres.ok) {
      expect(pres.presence[0]?.softLockEntityId).toBe('p2');
    }

    // Votes sur proposition
    const prop = createWorkspaceProposal({
      workspaceId: ws.id,
      actorId: 'paul',
      actorName: 'Paul',
      title: 'Passer par le col',
      rationale: 'Moins de route',
      operations: [{ type: 'update_stage_note', stageId: 'st1', notes: 'Via le col' }],
    });
    expect(prop.ok).toBe(true);
    if (prop.ok) {
      const voted = voteWorkspaceProposal({
        workspaceId: ws.id,
        proposalId: prop.proposal.id,
        actorId: 'eloi',
        vote: 'up',
      });
      expect(voted.ok).toBe(true);
      if (voted.ok) expect(voted.proposal.votes['eloi']).toBe('up');
    }

    // Lien de partage lecture seule + révocation
    const link = manageShareLink({ workspaceId: ws.id, actorId: 'alice', action: 'create', expiresInHours: 24 });
    expect(link.ok).toBe(true);
    if (link.ok && link.shareLink) {
      const extRead = getWorkspaceForActor(ws.id, null, link.shareLink.token);
      expect(extRead.ok).toBe(true);
      if (extRead.ok) expect(extRead.accessMode).toBe('share_link');

      manageShareLink({ workspaceId: ws.id, actorId: 'alice', action: 'revoke' });
      const extAfterRevoke = getWorkspaceForActor(ws.id, null, link.shareLink.token);
      expect(extAfterRevoke.ok).toBe(false);
    }
  });

  it('relie Inventaire, Hub, Clubs, Messagerie et Carnet sans altération après nouvelle publication', () => {
    const ws = createWorkspaceRecord(makeWorkspace());
    const kitItem = inventoryItemToCollabKitItem({
      inventoryItemId: 'inv-42',
      name: 'Filtre à eau Katadyn',
      category: 'hydratation',
      weightGrams: 65,
      ownerUserId: 'alice',
      ownerDisplayName: 'Alice',
      shared: true,
      dependsOn: ['water'],
    });
    const added = updateWorkspaceKitItem({
      workspaceId: ws.id,
      actorId: 'alice',
      action: 'add',
      newItem: kitItem,
    });
    expect(added.ok).toBe(true);

    const pub1 = publishWorkspace({
      workspaceId: ws.id,
      actorId: 'alice',
      actorName: 'Alice',
      expectedHeadSeq: 0,
      summary: 'Départ v1',
    });
    expect(pub1.status).toBe('published');
    if (pub1.status !== 'published') return;

    // Ponts Clubs, Messagerie & Hub
    const clubSnap = toClubRouteRevisionSnapshot(pub1.revision, 'club-event-1', pub1.pack.checksum);
    expect(clubSnap.eventId).toBe('club-event-1');
    expect(clubSnap.routeId).toBe(ws.id);
    expect(clubSnap.revision).toBe(1);

    const chatMeta = toTrailMessageMeta(pub1.workspace);
    expect(chatMeta.workspace_id).toBe(ws.id);
    expect(chatMeta.revision_no).toBe(1);

    const hubSummary = summarizeWorkspaceForHub(pub1.workspace);
    expect(hubSummary.publishedRevisionNo).toBe(1);
    expect(hubSummary.href).toContain(`/compas/itineraire?workspaceId=${ws.id}`);

    // Activité v1 -> Carnet, puis publication v2 ne change pas le Carnet v1
    commitVerifiedPack('alice', pub1.pack, pub1.revision, '2026-11-19T08:10:00Z');
    startActivityFromRevision('alice', pub1.revision, '2026-11-19T08:15:00Z');
    const carnet = finishActivityToCarnet({
      userId: 'alice',
      carnetId: 'carnet-bauges-1',
      recordedDistanceKm: 9.7,
      recordedAscentM: 570,
      recordedCoords: [[6.1, 45.65], [6.15, 45.69]],
      nowIso: '2026-11-19T15:00:00Z',
    });
    expect(carnet).not.toBeNull();

    submitWorkspaceOperation(ws.id, {
      opId: 'op-v2',
      baseSeq: 0,
      actorId: 'alice',
      actorName: 'Alice',
      operation: { type: 'update_stage_note', stageId: 'st1', notes: 'Post-sortie v2' },
    });
    const pub2 = publishWorkspace({
      workspaceId: ws.id,
      actorId: 'alice',
      actorName: 'Alice',
      expectedHeadSeq: 1,
      summary: 'Départ v2',
    });
    expect(pub2.status).toBe('published');
    if (pub2.status !== 'published') return;

    const comp = buildCarnetComparisonView(carnet!, pub2.workspace);
    expect(comp.plannedRevisionNo).toBe(1);
    expect(comp.latestPublishedRevisionNo).toBe(2);
    expect(comp.kitItemsCount).toBe(1);
    expect(comp.kitTotalWeightGrams).toBe(65);
    expect(comp.unchangedByNewerRevision).toBe(true);
  });
});

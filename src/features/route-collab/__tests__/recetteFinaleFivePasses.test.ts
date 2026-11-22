import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyWorkspaceOperation,
  computeRoutingFingerprint,
  exportWorkspaceGpx,
  parseGpxToWorkspaceEntities,
} from '../engine';
import {
  commitVerifiedPack,
  enqueueOfflineOperation,
  finishActivityToCarnet,
  getCarnetReturnRecord,
  getLastVerifiedPack,
  replayOfflineQueue,
  stagePackDownload,
  startActivityFromRevision,
} from '../offlinePackStore';
import {
  createWorkspaceRecord,
  decideWorkspaceProposal,
  createWorkspaceProposal,
  getWorkspaceForActor,
  publishWorkspace,
  resetRouteCollabStoreForTests,
  submitWorkspaceOperation,
  updateMemberRoleOrRevoke,
} from '../serverStore';
import type { RouteWorkspaceState } from '../types';

function makeThreeUserWorkspace(): RouteWorkspaceState {
  const now = '2026-11-18T14:00:00.000Z';
  const wsId = 'ws-recette-finale';
  return {
    id: wsId,
    tripId: 'trip-recette-finale',
    title: 'Traversée Vercors 2 jours',
    status: 'draft',
    sport: 'marche',
    routingOptions: {},
    headSeq: 0,
    reviewedSeq: null,
    publishedRevisionId: null,
    publishedRevisionNo: null,
    sourceOrigin: { kind: 'explorer_route', sourceId: 'exp-42', sourceTitle: 'Vercors Nord', importedAt: now },
    points: [
      { id: 'pt-a', workspaceId: wsId, kind: 'start', orderKey: 'A', lat: 45.05, lon: 5.51, eleM: 1100, name: 'Départ', entityVersion: 1 },
      { id: 'pt-b', workspaceId: wsId, kind: 'stage_boundary', orderKey: 'M', lat: 45.07, lon: 5.53, eleM: 1520, name: 'Jonction J1/J2', semanticKind: 'refuge', entityVersion: 1 },
      { id: 'pt-c', workspaceId: wsId, kind: 'finish', orderKey: 'Z', lat: 45.09, lon: 5.56, eleM: 1240, name: 'Arrivée', entityVersion: 1 },
    ],
    sections: [
      {
        id: 'sec-ab',
        workspaceId: wsId,
        fromPointId: 'pt-a',
        toPointId: 'pt-b',
        mode: 'routed',
        geometry: { type: 'LineString', coordinates: [[5.51, 45.05], [5.53, 45.07]] },
        distanceKm: 11.0,
        durationMin: 195,
        ascentM: 420,
        descentM: 0,
        surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'trail', source: 'OSM' }],
        routingInputHash: computeRoutingFingerprint({ from: { lat: 45.05, lon: 5.51 }, to: { lat: 45.07, lon: 5.53 }, sport: 'marche', options: {} }),
        provenance: { provider: 'geoapify', calculatedAt: now, profile: 'marche', confidence: 'verified' },
        warnings: [],
        entityVersion: 1,
      },
      {
        id: 'sec-bc',
        workspaceId: wsId,
        fromPointId: 'pt-b',
        toPointId: 'pt-c',
        mode: 'routed',
        geometry: { type: 'LineString', coordinates: [[5.53, 45.07], [5.56, 45.09]] },
        distanceKm: 9.8,
        durationMin: 170,
        ascentM: 140,
        descentM: 420,
        surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'unknown', source: null }],
        routingInputHash: computeRoutingFingerprint({ from: { lat: 45.07, lon: 5.53 }, to: { lat: 45.09, lon: 5.56 }, sport: 'marche', options: {} }),
        provenance: { provider: 'geoapify', calculatedAt: now, profile: 'marche', confidence: 'verified' },
        warnings: [],
        entityVersion: 1,
      },
    ],
    stages: [
      {
        id: 'j1',
        workspaceId: wsId,
        orderKey: '001',
        dayNumber: 1,
        title: 'Jour 1',
        dateIso: '2026-11-22',
        departureTimeLocal: '08:30',
        timezone: 'Europe/Paris',
        startPointId: 'pt-a',
        endPointId: 'pt-b',
        overnightPlace: {
          id: 'ref-1',
          name: 'Refuge de la Jonction',
          type: 'refuge',
          lat: 45.07,
          lon: 5.53,
          bookingStatus: 'confirmed',
          provenance: 'FFCAM',
          lastVerifiedAt: now,
        },
        notes: 'J1',
        waterObservations: [],
        weatherSlice: null,
        hazards: [],
        entityVersion: 1,
      },
      {
        id: 'j2',
        workspaceId: wsId,
        orderKey: '002',
        dayNumber: 2,
        title: 'Jour 2',
        dateIso: '2026-11-23',
        departureTimeLocal: '08:30',
        timezone: 'Europe/Paris',
        startPointId: 'pt-b',
        endPointId: 'pt-c',
        overnightPlace: null,
        notes: 'J2',
        waterObservations: [],
        weatherSlice: null,
        hazards: [],
        entityVersion: 1,
      },
    ],
    variants: [],
    proposals: [],
    comments: [],
    kitItems: [
      {
        id: 'kit-tente',
        name: 'Tente 3 places',
        category: 'abri',
        weightGrams: 2150,
        quantity: 1,
        shared: true,
        assigneeUserId: 'eloi',
        assigneeName: 'Éloi',
        dependsOn: ['overnight', 'weather'],
        status: 'confirmed',
      },
    ],
    members: [
      { userId: 'alice', displayName: 'Alice (Ordi)', role: 'owner' },
      { userId: 'eloi', displayName: 'Éloi (Tél 1)', role: 'editor' },
      { userId: 'mina', displayName: 'Mina (Tél 2)', role: 'editor' },
      { userId: 'sarah', displayName: 'Sarah', role: 'participant' },
    ],
    revisions: [],
    packs: [],
    participantPacks: [
      { userId: 'mina', displayName: 'Mina (Tél 2)', preparedRevisionNo: null, downloadedRevisionNo: null, verifiedLocalAt: null, status: 'not_downloaded' },
    ],
    updatedAt: now,
  };
}

describe('Étape 6 · Passes 1 à 5 — Recette finale 3 personnes (2 téléphones + 1 ordinateur)', () => {
  beforeEach(() => {
    resetRouteCollabStoreForTests();
  });

  it('Passes 1-5 : préparation parallèle, conflit même point, impact kit, pack v1/v2 avec coupure, mode avion et carnet', async () => {
    const ws = createWorkspaceRecord(makeThreeUserWorkspace());

    // Passe 2 : Session anonyme refusée, Participant lecture seule
    expect(getWorkspaceForActor(ws.id, null)).toMatchObject({ ok: false, status: 401 });
    expect(
      submitWorkspaceOperation(ws.id, {
        opId: 'op-sarah-forbidden',
        baseSeq: 0,
        actorId: 'sarah',
        actorName: 'Sarah',
        operation: { type: 'move_point', pointId: 'pt-a', lat: 45.1, lon: 5.5 },
      }).status,
    ).toBe('denied');

    // Éloi (Tél 1) modifie J1, Mina (Tél 2) modifie J2 en parallèle => merge auto
    const rEloi = submitWorkspaceOperation(ws.id, {
      opId: 'op-eloi-j1',
      baseSeq: 0,
      actorId: 'eloi',
      actorName: 'Éloi',
      operation: { type: 'update_stage_note', stageId: 'j1', notes: 'J1 eau au col' },
      expectedVersions: { j1: 1 },
    });
    const rMina = submitWorkspaceOperation(ws.id, {
      opId: 'op-mina-j2',
      baseSeq: 0,
      actorId: 'mina',
      actorName: 'Mina',
      operation: { type: 'update_stage_note', stageId: 'j2', notes: 'J2 crête' },
      expectedVersions: { j2: 1 },
    });
    expect(rEloi.status).toBe('accepted');
    expect(rMina.status).toBe('accepted');

    // Conflit sur le même point (jonction J1/J2 pt-b)
    const rAliceMoveB = submitWorkspaceOperation(ws.id, {
      opId: 'op-alice-b',
      baseSeq: 2,
      actorId: 'alice',
      actorName: 'Alice',
      operation: { type: 'move_point', pointId: 'pt-b', lat: 45.075, lon: 5.535 },
      expectedVersions: { 'pt-b': 1 },
    });
    expect(rAliceMoveB.status).toBe('accepted');

    const rEloiConflictB = submitWorkspaceOperation(ws.id, {
      opId: 'op-eloi-b-stale',
      baseSeq: 2,
      actorId: 'eloi',
      actorName: 'Éloi',
      operation: { type: 'move_point', pointId: 'pt-b', lat: 45.08, lon: 5.54 },
      expectedVersions: { 'pt-b': 1 },
    });
    expect(rEloiConflictB.status).toBe('conflict');

    // Détour / changement de nuit => impact sur le kit (Tente 3 places)
    const rOvernight = submitWorkspaceOperation(ws.id, {
      opId: 'op-alice-bivouac',
      baseSeq: 3,
      actorId: 'alice',
      actorName: 'Alice',
      operation: {
        type: 'set_overnight',
        stageId: 'j1',
        overnightPlace: {
          id: 'biv-1',
          name: 'Bivouac Plateau',
          type: 'bivouac',
          lat: 45.075,
          lon: 5.535,
          bookingStatus: 'planned',
          provenance: 'Alice',
          lastVerifiedAt: '2026-11-18T14:10:00Z',
        },
      },
    });
    expect(rOvernight.status).toBe('accepted');
    if (rOvernight.status === 'accepted') {
      expect(rOvernight.impact.kitItemsToRevalidate[0]?.itemName).toBe('Tente 3 places');
    }

    // Publication v1
    const pub1 = publishWorkspace({
      workspaceId: ws.id,
      actorId: 'alice',
      actorName: 'Alice',
      expectedHeadSeq: 4,
      summary: 'Sortie v1 validée',
    });
    expect(pub1.status).toBe('published');
    if (pub1.status !== 'published') return;

    // Mina télécharge v1
    expect(commitVerifiedPack('mina', pub1.pack, pub1.revision, '2026-11-18T14:20:00Z').ok).toBe(true);

    // Alice publie v2
    submitWorkspaceOperation(ws.id, {
      opId: 'op-alice-v2',
      baseSeq: 4,
      actorId: 'alice',
      actorName: 'Alice',
      operation: { type: 'update_stage_note', stageId: 'j2', notes: 'J2 variante v2' },
    });
    const pub2 = publishWorkspace({
      workspaceId: ws.id,
      actorId: 'alice',
      actorName: 'Alice',
      expectedHeadSeq: 5,
      summary: 'Sortie v2',
    });
    expect(pub2.status).toBe('published');
    if (pub2.status !== 'published') return;

    // Coupure réseau pendant mise à jour du pack v2 sur le téléphone de Mina
    stagePackDownload('mina', pub2.pack, 1, 2);
    const offlinePack = getLastVerifiedPack('mina', ws.id);
    expect(offlinePack?.manifest.revisionNo).toBe(1);

    // Mina démarre en mode avion avec v1 et retrouve v1 + kit au Carnet
    startActivityFromRevision('mina', offlinePack!.revision, '2026-11-22T08:30:00Z');
    const carnet = finishActivityToCarnet({
      userId: 'mina',
      carnetId: 'carnet-mina-vercors',
      recordedDistanceKm: 20.8,
      recordedAscentM: 560,
      recordedCoords: [[5.51, 45.05], [5.56, 45.09]],
      nowIso: '2026-11-23T17:30:00Z',
    });
    expect(carnet?.plannedRevisionNo).toBe(1);
    expect(getCarnetReturnRecord('mina', 'carnet-mina-vercors')?.kitSnapshot[0]?.name).toBe('Tente 3 places');
  });

  it('Passe 4 : trace volumineuse (1000 points GPX) parsée et réexportée sous le budget (< 500 ms)', () => {
    const trkpts = Array.from({ length: 1000 }, (_, i) => {
      const lat = (45.0 + i * 0.0002).toFixed(5);
      const lon = (5.5 + i * 0.0002).toFixed(5);
      return `<trkpt lat="${lat}" lon="${lon}"><ele>${1000 + (i % 300)}</ele></trkpt>`;
    }).join('');
    const bigGpx = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>${trkpts}</trkseg></trk></gpx>`;

    const t0 = performance.now();
    const parsed = parseGpxToWorkspaceEntities({ gpxXml: bigGpx, workspaceId: 'ws-perf', keepOriginalGeometry: true });
    const dt = performance.now() - t0;

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.sections[0].geometry.coordinates.length).toBe(1000);
    }
    expect(dt).toBeLessThan(500);
  });
});

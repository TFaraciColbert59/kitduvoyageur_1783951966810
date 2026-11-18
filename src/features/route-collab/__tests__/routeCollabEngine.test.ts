import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearPendingStartDraft,
  readPendingStartDraft,
  savePendingStartDraft,
} from '@/features/compas/engine/pendingDraft';
import {
  applyWorkspaceOperation,
  computeRoutingFingerprint,
  exportWorkspaceGpx,
  parseGpxToWorkspaceEntities,
  publishWorkspaceRevision,
} from '../engine';
import {
  commitVerifiedPack,
  duplicateWorkspaceWithProvenance,
  enqueueOfflineOperation,
  finishActivityToCarnet,
  getCarnetReturnRecord,
  getLastVerifiedPack,
  replayOfflineQueue,
  stagePackDownload,
  startActivityFromRevision,
} from '../offlinePackStore';
import {
  hasRoutePermission,
  resolveEffectiveRole,
  validateRouteInvitation,
} from '../permissions';
import {
  addWorkspaceComment,
  createWorkspaceProposal,
  createWorkspaceRecord,
  decideWorkspaceProposal,
  getWorkspaceChangesAfter,
  getWorkspaceForActor,
  markParticipantPackState,
  publishWorkspace,
  resetRouteCollabStoreForTests,
  submitWorkspaceOperation,
  updateMemberRoleOrRevoke,
} from '../serverStore';
import type { RouteWorkspaceState } from '../types';

function makeTwoDayWorkspace(): RouteWorkspaceState {
  const now = '2026-11-18T10:00:00.000Z';
  const wsId = 'ws-vercors-20-10';
  return {
    id: wsId,
    tripId: 'trip-vercors-1',
    title: 'Vercors 2 jours',
    status: 'draft',
    sport: 'marche',
    routingOptions: {},
    headSeq: 0,
    reviewedSeq: null,
    publishedRevisionId: null,
    publishedRevisionNo: null,
    sourceOrigin: { kind: 'blank', importedAt: now },
    points: [
      {
        id: 'pt-1',
        workspaceId: wsId,
        kind: 'start',
        orderKey: 'A',
        lat: 45.05,
        lon: 5.51,
        eleM: 1100,
        name: 'Corrençon',
        entityVersion: 1,
      },
      {
        id: 'pt-2',
        workspaceId: wsId,
        kind: 'stage_boundary',
        orderKey: 'M',
        lat: 45.07,
        lon: 5.53,
        eleM: 1520,
        name: 'Refuge des Aigles',
        semanticKind: 'refuge',
        entityVersion: 1,
      },
      {
        id: 'pt-3',
        workspaceId: wsId,
        kind: 'finish',
        orderKey: 'Z',
        lat: 45.09,
        lon: 5.56,
        eleM: 1240,
        name: 'Villard-de-Lans',
        entityVersion: 1,
      },
    ],
    sections: [
      {
        id: 'sec-1',
        workspaceId: wsId,
        fromPointId: 'pt-1',
        toPointId: 'pt-2',
        mode: 'routed',
        geometry: {
          type: 'LineString',
          coordinates: [
            [5.51, 45.05],
            [5.53, 45.07],
          ],
        },
        distanceKm: 10.2,
        durationMin: 180,
        ascentM: 420,
        descentM: 0,
        surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'trail', source: 'OSM' }],
        routingInputHash: computeRoutingFingerprint({
          from: { lat: 45.05, lon: 5.51 },
          to: { lat: 45.07, lon: 5.53 },
          sport: 'marche',
          options: {},
        }),
        provenance: { provider: 'geoapify', calculatedAt: now, profile: 'marche', confidence: 'verified' },
        warnings: [],
        entityVersion: 1,
      },
      {
        id: 'sec-2',
        workspaceId: wsId,
        fromPointId: 'pt-2',
        toPointId: 'pt-3',
        mode: 'routed',
        geometry: {
          type: 'LineString',
          coordinates: [
            [5.53, 45.07],
            [5.56, 45.09],
          ],
        },
        distanceKm: 9.4,
        durationMin: 165,
        ascentM: 120,
        descentM: 400,
        surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'unknown', source: null }],
        routingInputHash: computeRoutingFingerprint({
          from: { lat: 45.07, lon: 5.53 },
          to: { lat: 45.09, lon: 5.56 },
          sport: 'marche',
          options: {},
        }),
        provenance: { provider: 'geoapify', calculatedAt: now, profile: 'marche', confidence: 'verified' },
        warnings: [],
        entityVersion: 1,
      },
    ],
    stages: [
      {
        id: 'stage-1',
        workspaceId: wsId,
        orderKey: '001',
        dayNumber: 1,
        title: 'Jour 1',
        dateIso: '2026-11-20',
        departureTimeLocal: '08:30',
        timezone: 'Europe/Paris',
        startPointId: 'pt-1',
        endPointId: 'pt-2',
        overnightPlace: {
          id: 'refuge-aigles',
          name: 'Refuge des Aigles',
          type: 'refuge',
          lat: 45.07,
          lon: 5.53,
          bookingStatus: 'confirmed',
          provenance: 'FFCAM',
          lastVerifiedAt: now,
        },
        notes: 'Départ matinal',
        waterObservations: [],
        weatherSlice: null,
        hazards: [],
        entityVersion: 1,
      },
      {
        id: 'stage-2',
        workspaceId: wsId,
        orderKey: '002',
        dayNumber: 2,
        title: 'Jour 2',
        dateIso: '2026-11-21',
        departureTimeLocal: '08:30',
        timezone: 'Europe/Paris',
        startPointId: 'pt-2',
        endPointId: 'pt-3',
        overnightPlace: null,
        notes: 'Descente vers Villard',
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
        id: 'kit-tent',
        name: 'Tente 3P',
        category: 'abri',
        weightGrams: 2200,
        quantity: 1,
        shared: true,
        assigneeUserId: 'paul',
        assigneeName: 'Paul',
        dependsOn: ['overnight'],
        status: 'confirmed',
      },
      {
        id: 'kit-boots',
        name: 'Chaussures rando',
        category: 'chaussant',
        weightGrams: 980,
        quantity: 1,
        shared: false,
        assigneeUserId: 'alice',
        assigneeName: 'Alice',
        dependsOn: [],
        status: 'confirmed',
      },
    ],
    members: [
      { userId: 'alice', displayName: 'Alice', role: 'owner' },
      { userId: 'eloi', displayName: 'Éloi', role: 'editor' },
      { userId: 'mina', displayName: 'Mina', role: 'editor' },
      { userId: 'paul', displayName: 'Paul', role: 'contributor' },
      { userId: 'sarah', displayName: 'Sarah', role: 'participant' },
    ],
    revisions: [],
    packs: [],
    participantPacks: [
      {
        userId: 'sarah',
        displayName: 'Sarah',
        preparedRevisionNo: null,
        downloadedRevisionNo: null,
        verifiedLocalAt: null,
        status: 'not_downloaded',
      },
    ],
    updatedAt: now,
  };
}

describe('Mission LKDV 20/10 — Moteur collaboratif, Concurrence, Impact, Offline & Carnet', () => {
  beforeEach(() => {
    resetRouteCollabStoreForTests();
    clearPendingStartDraft();
  });

  it('Lot 0 : sauvegarde et restaure le brouillon Compas après connexion', () => {
    savePendingStartDraft({ text: '2 jours dans le Vercors, max 700 m D+' });
    const restored = readPendingStartDraft();
    expect(restored?.text).toBe('2 jours dans le Vercors, max 700 m D+');
    clearPendingStartDraft();
    expect(readPendingStartDraft()).toBeNull();
  });

  it('Étape 1 : import GPX invalide, import avec "garder ma trace", et export GPX complet + par étape', () => {
    expect(parseGpxToWorkspaceEntities({ gpxXml: '', workspaceId: 'ws-1' }).ok).toBe(false);
    expect(parseGpxToWorkspaceEntities({ gpxXml: '<xml>bad</xml>', workspaceId: 'ws-1' }).ok).toBe(false);

    const gpxXml = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg><trkpt lat="45.05" lon="5.51"><ele>1100</ele></trkpt><trkpt lat="45.07" lon="5.53"><ele>1520</ele></trkpt></trkseg></trk></gpx>`;
    const parsed = parseGpxToWorkspaceEntities({
      gpxXml,
      workspaceId: 'ws-1',
      keepOriginalGeometry: true,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.originalGpxXml).toBe(gpxXml);
      expect(parsed.sections[0].mode).toBe('imported_preserved');
    }

    const ws = makeTwoDayWorkspace();
    const fullGpx = exportWorkspaceGpx(ws);
    const stage1Gpx = exportWorkspaceGpx(ws, 'stage-1');
    expect(fullGpx).toContain('<gpx version="1.1"');
    expect(fullGpx).toContain('45.09');
    expect(stage1Gpx).toContain('Jour 1');
    expect(stage1Gpx).not.toContain('45.09');
  });

  it('Étape 1 : rejette un résultat de routage tardif dont l’empreinte ne correspond plus', () => {
    const ws = makeTwoDayWorkspace();
    const staleHash = computeRoutingFingerprint({
      from: { lat: 45.05, lon: 5.51 },
      to: { lat: 45.07, lon: 5.53 },
      sport: 'marche',
      options: {},
    });

    // Alice déplace pt-2 entre-temps
    const moved = applyWorkspaceOperation(
      ws,
      [],
      {
        opId: 'op-move-1',
        baseSeq: 0,
        actorId: 'alice',
        actorName: 'Alice',
        operation: { type: 'move_point', pointId: 'pt-2', lat: 45.08, lon: 5.54 },
      },
      '2026-11-18T10:01:00Z',
    );
    expect(moved.result.status).toBe('accepted');
    if (moved.result.status !== 'accepted') return;

    // Le routeur répond tardivement avec l'ancien hash
    const lateRouting = applyWorkspaceOperation(
      moved.result.workspace,
      moved.nextOpLog,
      {
        opId: 'op-route-late',
        baseSeq: 1,
        actorId: 'alice',
        actorName: 'Alice',
        operation: {
          type: 'apply_routing_result',
          sectionId: 'sec-1',
          routingInputHash: staleHash,
          geometry: { type: 'LineString', coordinates: [[5.51, 45.05], [5.53, 45.07]] },
          distanceKm: 10.2,
          durationMin: 180,
          ascentM: 420,
          descentM: 0,
          provenance: { provider: 'geoapify', calculatedAt: '2026-11-18T10:00:30Z', profile: 'marche', confidence: 'verified' },
        },
      },
      '2026-11-18T10:02:00Z',
    );
    expect(lateRouting.result.status).toBe('stale_routing_discarded');
  });

  it('Étape 2 : droits, RSVP club sans édition, invitations et révocation immédiate', () => {
    expect(resolveEffectiveRole({ clubEventRsvp: 'going' })).toBe('participant');
    expect(
      hasRoutePermission({ userId: 'u1', displayName: 'U1', role: 'participant' }, 'route.edit_geometry'),
    ).toBe(false);

    expect(
      validateRouteInvitation({
        status: 'pending',
        expiresAt: '2026-11-01T00:00:00Z',
        invitedUserId: 'u1',
        currentUserId: 'u1',
        nowIso: '2026-11-18T00:00:00Z',
      }),
    ).toEqual({ valid: false, reason: 'expired' });

    expect(
      validateRouteInvitation({
        status: 'pending',
        expiresAt: null,
        invitedUserId: 'u1',
        currentUserId: 'u2',
      }),
    ).toEqual({ valid: false, reason: 'wrong_account' });

    const ws = createWorkspaceRecord(makeTwoDayWorkspace());
    // Révocation d'Éloi
    const rev = updateMemberRoleOrRevoke({
      workspaceId: ws.id,
      actorId: 'alice',
      targetUserId: 'eloi',
      revoke: true,
    });
    expect(rev.ok).toBe(true);
    expect(getWorkspaceForActor(ws.id, 'eloi').ok).toBe(false);
    expect(
      submitWorkspaceOperation(ws.id, {
        opId: 'op-eloi-after-revoke',
        baseSeq: 0,
        actorId: 'eloi',
        actorName: 'Éloi',
        operation: { type: 'move_point', pointId: 'pt-1', lat: 45.06, lon: 5.51 },
      }).status,
    ).toBe('denied');
  });

  it('Étape 2 & 3 : idempotence, fusion indépendante, conflit même point, ancre commentaire & impact kit', () => {
    const ws = createWorkspaceRecord(makeTwoDayWorkspace());

    // 1. Édition indépendante : Mina modifie la note de J2, Éloi déplace le point 1 (J1)
    const r1 = submitWorkspaceOperation(ws.id, {
      opId: 'op-mina-j2',
      baseSeq: 0,
      actorId: 'mina',
      actorName: 'Mina',
      operation: { type: 'update_stage_note', stageId: 'stage-2', notes: 'Prévoir frontale' },
      expectedVersions: { 'stage-2': 1 },
    });
    expect(r1.status).toBe('accepted');

    const r2 = submitWorkspaceOperation(ws.id, {
      opId: 'op-eloi-j1',
      baseSeq: 0,
      actorId: 'eloi',
      actorName: 'Éloi',
      operation: { type: 'move_point', pointId: 'pt-1', lat: 45.055, lon: 5.512 },
      expectedVersions: { 'pt-1': 1 },
    });
    expect(r2.status).toBe('accepted');

    // Idempotence : même opId + même payload => already_applied
    const r2Replay = submitWorkspaceOperation(ws.id, {
      opId: 'op-eloi-j1',
      baseSeq: 0,
      actorId: 'eloi',
      actorName: 'Éloi',
      operation: { type: 'move_point', pointId: 'pt-1', lat: 45.055, lon: 5.512 },
      expectedVersions: { 'pt-1': 1 },
    });
    expect(r2Replay.status).toBe('already_applied');

    // Même opId + payload différent => denied
    const r2Tampered = submitWorkspaceOperation(ws.id, {
      opId: 'op-eloi-j1',
      baseSeq: 0,
      actorId: 'eloi',
      actorName: 'Éloi',
      operation: { type: 'move_point', pointId: 'pt-1', lat: 46.0, lon: 6.0 },
      expectedVersions: { 'pt-1': 1 },
    });
    expect(r2Tampered.status).toBe('denied');

    // 2. Conflit sur le même point : Alice tente de déplacer pt-1 en pensant qu'il est encore v1
    const rConflict = submitWorkspaceOperation(ws.id, {
      opId: 'op-alice-conflict',
      baseSeq: 0,
      actorId: 'alice',
      actorName: 'Alice',
      operation: { type: 'move_point', pointId: 'pt-1', lat: 45.06, lon: 5.52 },
      expectedVersions: { 'pt-1': 1 },
    });
    expect(rConflict.status).toBe('conflict');

    // 3. Commentaire ancré sur pt-2, puis déplacement > 250 m => needs_relocation
    const cmt = addWorkspaceComment({
      workspaceId: ws.id,
      actorId: 'paul',
      actorName: 'Paul',
      body: 'Attention névé au refuge',
      anchor: {
        anchorType: 'point',
        entityId: 'pt-2',
        entityVersion: 1,
        originalLat: 45.07,
        originalLon: 5.53,
        maxRelocateMeters: 250,
      },
    });
    expect(cmt.ok).toBe(true);

    const rMoveBig = submitWorkspaceOperation(ws.id, {
      opId: 'op-move-pt2-far',
      baseSeq: 2,
      actorId: 'alice',
      actorName: 'Alice',
      operation: { type: 'move_point', pointId: 'pt-2', lat: 45.12, lon: 5.58 },
    });
    expect(rMoveBig.status).toBe('accepted');
    if (rMoveBig.status === 'accepted') {
      expect(rMoveBig.workspace.comments[0].status).toBe('needs_relocation');
    }

    // 4. Changement de nuit (overnight) => revalide uniquement Tente 3P (dependsOn: ['overnight']), garde Chaussures rando confirmed !
    const rNight = submitWorkspaceOperation(ws.id, {
      opId: 'op-night-bivouac',
      baseSeq: 3,
      actorId: 'alice',
      actorName: 'Alice',
      operation: {
        type: 'set_overnight',
        stageId: 'stage-1',
        overnightPlace: {
          id: 'bivouac-col',
          name: 'Bivouac du Col',
          type: 'bivouac',
          lat: 45.12,
          lon: 5.58,
          bookingStatus: 'planned',
          provenance: 'Alice',
          lastVerifiedAt: '2026-11-18T11:00:00Z',
        },
      },
    });
    expect(rNight.status).toBe('accepted');
    if (rNight.status === 'accepted') {
      const tent = rNight.workspace.kitItems.find((i) => i.id === 'kit-tent');
      const boots = rNight.workspace.kitItems.find((i) => i.id === 'kit-boots');
      expect(tent?.status).toBe('needs_revalidation');
      expect(boots?.status).toBe('confirmed');
      expect(rNight.impact.affectedMembers.some((m) => m.userId === 'paul')).toBe(true);
    }

    // 5. Proposition obsolète bloquée si headSeq a avancé sans revalidation
    const prop = createWorkspaceProposal({
      workspaceId: ws.id,
      actorId: 'paul',
      actorName: 'Paul',
      title: 'Variante crête',
      rationale: 'Plus panoramique',
      operations: [{ type: 'update_stage_note', stageId: 'stage-1', notes: 'Passer par la crête' }],
    });
    expect(prop.ok).toBe(true);
    if (!prop.ok) return;

    // Head avance entre-temps
    submitWorkspaceOperation(ws.id, {
      opId: 'op-advance-head',
      baseSeq: 4,
      actorId: 'alice',
      actorName: 'Alice',
      operation: { type: 'update_stage_note', stageId: 'stage-1', notes: 'Autre note' },
    });

    const staleAccept = decideWorkspaceProposal({
      workspaceId: ws.id,
      proposalId: prop.proposal.id,
      actorId: 'alice',
      actorName: 'Alice',
      decision: 'accept',
    });
    expect(staleAccept.ok).toBe(false);

    // Rattrapage de séquence
    const changes = getWorkspaceChangesAfter(ws.id, 'sarah', 2);
    expect(changes.ok).toBe(true);
    if (changes.ok) {
      expect(changes.operations.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('Étape 4 (Recette finale) : publication v1 -> pack v1 -> coupure pendant v2 -> mode avion sur v1 -> replay -> Carnet & reprise', async () => {
    const ws = createWorkspaceRecord(makeTwoDayWorkspace());

    // Publication v1
    const pub1 = publishWorkspace({
      workspaceId: ws.id,
      actorId: 'alice',
      actorName: 'Alice',
      expectedHeadSeq: 0,
      summary: 'Version initiale validée',
    });
    expect(pub1.status).toBe('published');
    if (pub1.status !== 'published') return;

    // Sarah télécharge et vérifie v1
    const committed1 = commitVerifiedPack('sarah', pub1.pack, pub1.revision, '2026-11-18T12:00:00Z');
    expect(committed1.ok).toBe(true);
    markParticipantPackState({
      workspaceId: ws.id,
      userId: 'sarah',
      displayName: 'Sarah',
      downloadedRevisionNo: 1,
      preparedRevisionNo: 1,
      status: 'ready',
      verifiedLocalAt: '2026-11-18T12:00:00Z',
    });

    // Alice publie v2 (tête avancée d'abord)
    submitWorkspaceOperation(ws.id, {
      opId: 'op-v2-note',
      baseSeq: 0,
      actorId: 'alice',
      actorName: 'Alice',
      operation: { type: 'update_stage_note', stageId: 'stage-2', notes: 'Variante v2' },
    });
    // Publication avec ancien expectedHeadSeq=0 refusée
    const blockedPub = publishWorkspace({
      workspaceId: ws.id,
      actorId: 'alice',
      actorName: 'Alice',
      expectedHeadSeq: 0,
      summary: 'Pub v2 périmée',
    });
    expect(blockedPub.status).toBe('blocked');

    const pub2 = publishWorkspace({
      workspaceId: ws.id,
      actorId: 'alice',
      actorName: 'Alice',
      expectedHeadSeq: 1,
      summary: 'Version 2',
    });
    expect(pub2.status).toBe('published');
    if (pub2.status !== 'published') return;

    // Sarah commence à télécharger v2 mais le réseau coupe !
    stagePackDownload('sarah', pub2.pack, 1, 2);
    // En mode avion après redémarrage, Sarah retrouve v1 complète et vérifiée !
    const fallbackV1 = getLastVerifiedPack('sarah', ws.id);
    expect(fallbackV1?.manifest.revisionNo).toBe(1);

    // Mina travaille hors ligne puis revient en ligne : replay causal
    enqueueOfflineOperation('mina', {
      opId: 'op-mina-offline-1',
      workspaceId: ws.id,
      baseSeq: 1,
      operation: { type: 'update_stage_note', stageId: 'stage-2', notes: 'Note hors ligne Mina' },
      expectedVersions: {},
      queuedAt: '2026-11-18T13:00:00Z',
    });
    const replayed = await replayOfflineQueue('mina', ws.id, async (queued) => {
      const res = submitWorkspaceOperation(ws.id, {
        opId: queued.opId,
        baseSeq: queued.baseSeq,
        actorId: 'mina',
        actorName: 'Mina',
        operation: queued.operation,
        expectedVersions: queued.expectedVersions,
      });
      if (res.status === 'not_found') return { status: 'denied', reason: 'not_found' };
      return res;
    });
    expect(replayed.appliedCount).toBe(1);

    // Sarah démarre son activité avec v1 et le kit snapshot v1
    const link = startActivityFromRevision('sarah', fallbackV1!.revision, '2026-11-19T08:00:00Z');
    expect(link.revisionNo).toBe(1);

    // Retour au Carnet : garde v1 et le kit emporté même si v2 existe
    const carnet = finishActivityToCarnet({
      userId: 'sarah',
      carnetId: 'carnet-vercors-1',
      recordedDistanceKm: 20.1,
      recordedAscentM: 560,
      recordedCoords: [
        [5.51, 45.05],
        [5.56, 45.09],
      ],
      nowIso: '2026-11-20T17:00:00Z',
    });
    expect(carnet?.plannedRevisionNo).toBe(1);
    expect(getCarnetReturnRecord('sarah', 'carnet-vercors-1')?.kitSnapshot.length).toBe(2);

    // Reprendre cette sortie => nouveau brouillon indépendant avec provenance
    const replayDraft = duplicateWorkspaceWithProvenance({
      sourceWorkspace: pub2.workspace,
      newWorkspaceId: 'ws-replay-1',
      newTripId: 'trip-replay-1',
      ownerId: 'sarah',
      ownerName: 'Sarah',
      nowIso: '2026-11-21T09:00:00Z',
    });
    expect(replayDraft.sourceOrigin.kind).toBe('activity_replay');
    expect(replayDraft.sourceOrigin.sourceId).toBe(ws.id);
    expect(replayDraft.publishedRevisionNo).toBeNull();
  });
});

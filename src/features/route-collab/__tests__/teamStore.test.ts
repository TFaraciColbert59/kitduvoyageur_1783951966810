import { beforeEach, describe, expect, it } from 'vitest';
import {
  createWorkspaceRecord,
  getWorkspaceForActor,
  resetRouteCollabStoreForTests,
  submitWorkspaceOperation,
  updateMemberRoleOrRevoke,
} from '../serverStore';
import type { RouteWorkspaceState } from '../types';

const NOW = '2026-11-20T10:00:00.000Z';

function twoDays(): RouteWorkspaceState {
  const ws = 'ws-team-store';
  const pt = (id: string, order: string, lat: number, lon: number, kind: 'start' | 'via' | 'finish') => ({
    id, workspaceId: ws, kind, orderKey: order, lat, lon, eleM: 1000, name: id, entityVersion: 1,
  });
  const sec = (id: string, a: string, b: string, coords: [number, number][]) => ({
    id, workspaceId: ws, fromPointId: a, toPointId: b, mode: 'manual' as const,
    geometry: { type: 'LineString' as const, coordinates: coords }, distanceKm: 7, durationMin: 140, ascentM: 100, descentM: 50,
    surfaceSegments: [], routingInputHash: null,
    provenance: { provider: 'compas', calculatedAt: NOW, profile: 'marche', confidence: 'estimated' as const },
    warnings: [], entityVersion: 1,
  });
  const stage = (id: string, day: number, a: string, b: string) => ({
    id, workspaceId: ws, orderKey: `00${day}`, dayNumber: day, title: `Jour ${day}`, dateIso: null, departureTimeLocal: '08:00',
    timezone: 'Europe/Paris', startPointId: a, endPointId: b, overnightPlace: null, notes: '', waterObservations: [],
    weatherSlice: null, hazards: [], entityVersion: 1,
  });
  return {
    id: ws, tripId: 'trip-1', title: 'Traversée', status: 'draft', sport: 'marche', shapeMode: 'one_way', routingOptions: {},
    headSeq: 0, reviewedSeq: null, publishedRevisionId: null, publishedRevisionNo: null, sourceOrigin: { kind: 'blank', importedAt: NOW },
    points: [pt('p1', 'A', 45, 6, 'start'), pt('p2', 'M', 45.05, 6.05, 'via'), pt('p3', 'Z', 45.1, 6.1, 'finish')],
    sections: [sec('s1', 'p1', 'p2', [[6, 45], [6.05, 45.05]]), sec('s2', 'p2', 'p3', [[6.05, 45.05], [6.1, 45.1]])],
    stages: [stage('st1', 1, 'p1', 'p2'), stage('st2', 2, 'p2', 'p3')],
    variants: [], proposals: [], comments: [], kitItems: [],
    members: [
      { userId: 'alice', displayName: 'Alice', role: 'owner' },
      { userId: 'mina', displayName: 'Mina', role: 'editor' },
    ],
    revisions: [], packs: [], participantPacks: [], updatedAt: NOW,
  } as RouteWorkspaceState;
}

beforeEach(() => resetRouteCollabStoreForTests());

describe('8.3 étape confiée : stockée dans stageScopeIds du membre', () => {
  it('le responsable confie le jour 2 à Mina ; la portée est relue, puis retirée', () => {
    const ws = createWorkspaceRecord(twoDays());
    const set = updateMemberRoleOrRevoke({ workspaceId: ws.id, actorId: 'alice', targetUserId: 'mina', stageScopeIds: ['st2'] });
    expect(set.ok).toBe(true);
    const read = getWorkspaceForActor(ws.id, 'alice');
    expect(read.ok && read.workspace.members.find((m) => m.userId === 'mina')?.stageScopeIds).toEqual(['st2']);
    // le rôle n'a pas bougé
    expect(read.ok && read.workspace.members.find((m) => m.userId === 'mina')?.role).toBe('editor');
    updateMemberRoleOrRevoke({ workspaceId: ws.id, actorId: 'alice', targetUserId: 'mina', stageScopeIds: [] });
    const cleared = getWorkspaceForActor(ws.id, 'alice');
    expect(cleared.ok && cleared.workspace.members.find((m) => m.userId === 'mina')?.stageScopeIds).toEqual([]);
  });

  it('seul un responsable confie un jour ; un éditeur reçoit un refus', () => {
    const ws = createWorkspaceRecord(twoDays());
    const res = updateMemberRoleOrRevoke({ workspaceId: ws.id, actorId: 'mina', targetUserId: 'mina', stageScopeIds: ['st1'] });
    expect(res).toMatchObject({ ok: false, status: 403 });
  });

  it('une étape confiée limite vraiment l’éditeur à ses jours (le moteur applique la portée)', () => {
    const ws = createWorkspaceRecord(twoDays());
    updateMemberRoleOrRevoke({ workspaceId: ws.id, actorId: 'alice', targetUserId: 'mina', stageScopeIds: ['st2'] });
    const own = submitWorkspaceOperation(ws.id, {
      opId: 'op-j2', baseSeq: 0, actorId: 'mina', actorName: 'Mina', operation: { type: 'update_stage_note', stageId: 'st2', notes: 'Eau au refuge' },
    });
    expect(own.status).toBe('accepted');
    const other = submitWorkspaceOperation(ws.id, {
      opId: 'op-j1', baseSeq: 1, actorId: 'mina', actorName: 'Mina', operation: { type: 'update_stage_note', stageId: 'st1', notes: 'Pas mon jour' },
    });
    expect(other.status).toBe('denied');
  });
});

describe('8.5 conflit : le store répond « conflict » avec l’état courant (le client affiche les deux positions)', () => {
  it('deux déplacements du même point sur la même base : le second reçoit le point en place', () => {
    const ws = createWorkspaceRecord(twoDays());
    const first = submitWorkspaceOperation(ws.id, {
      opId: 'op-a', baseSeq: 0, actorId: 'alice', actorName: 'Alice',
      operation: { type: 'move_point', pointId: 'p2', lat: 45.06, lon: 6.05 }, expectedVersions: { p2: 1 },
    });
    expect(first.status).toBe('accepted');
    const second = submitWorkspaceOperation(ws.id, {
      opId: 'op-b', baseSeq: 0, actorId: 'mina', actorName: 'Mina',
      operation: { type: 'move_point', pointId: 'p2', lat: 45.04, lon: 6.05 }, expectedVersions: { p2: 1 },
    });
    expect(second.status).toBe('conflict');
    if (second.status === 'conflict') {
      const theirs = second.currentWorkspace.points.find((p) => p.id === 'p2');
      expect(theirs?.lat).toBe(45.06);
      expect(second.conflicts[0].entityId).toBe('p2');
    }
  });
});

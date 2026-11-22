import { describe, expect, it } from 'vitest';
import { applyWorkspaceOperation } from '../engine';
import { baseWorkspace } from '../insights/__tests__/fixtures';
import { activePointsOf } from '../pointOrder';
import { planLineDrag, planPointInsertion, planStageBoundary } from '../pointInsertion';
import type { RouteOperationInput, RouteWorkspaceState } from '../types';

function owned(over: Partial<RouteWorkspaceState> = {}): RouteWorkspaceState {
  return baseWorkspace({
    sport: 'marche',
    members: [{ userId: 'u', displayName: 'Moi', role: 'owner' }],
    ...over,
  });
}

function play(ws: RouteWorkspaceState, ops: readonly RouteOperationInput[]): RouteWorkspaceState {
  let cur = ws;
  let log: Parameters<typeof applyWorkspaceOperation>[1] = [];
  ops.forEach((operation, i) => {
    const { result, nextOpLog } = applyWorkspaceOperation(
      cur,
      log,
      { opId: `op-${i}`, baseSeq: cur.headSeq, actorId: 'u', actorName: 'Moi', operation },
      '2026-11-22T10:00:00.000Z',
    );
    if (result.status !== 'accepted') throw new Error(`${operation.type}: ${result.status}`);
    cur = result.workspace;
    log = nextOpLog;
  });
  return cur;
}

describe('pointInsertion · insertion dans le tronçon voisin (2.3)', () => {
  it('un point posé près du 2e tronçon s’insère entre B et C, pas en fin de liste', () => {
    const ws = owned();
    const plan = planPointInsertion(ws, { pointId: 'n', role: 'waypoint', lat: 45.9006, lon: 6.2, thresholdM: 150 });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.afterPointId).toBe('b');
    expect(plan.needsRouting).toBe(true);
    const next = play(ws, plan.ops);
    expect(activePointsOf(next).map((p) => p.id)).toEqual(['a', 'b', 'n', 'c']);
  });

  it('loin du tracé, le point s’ajoute en fin de liste', () => {
    const ws = owned();
    const plan = planPointInsertion(ws, { pointId: 'n', role: 'waypoint', lat: 46.2, lon: 6.2, thresholdM: 150 });
    expect(plan.ok && plan.afterPointId).toBe('c');
    expect(plan.ok && plan.target).toBeNull();
  });

  it('sur un tronçon GPX gardé tel quel, la géométrie est coupée au point (pas remplacée par une droite)', () => {
    const base = owned();
    const gpx = { ...base.sections[0], mode: 'imported_preserved' as const };
    const ws = owned({ sections: [gpx, base.sections[1]] });
    const plan = planPointInsertion(ws, { pointId: 'n', role: 'waypoint', lat: 45.9004, lon: 6.05, thresholdM: 150 });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.needsRouting).toBe(false);
    // Le point est ramené sur le tracé importé.
    expect(plan.lat).toBeCloseTo(45.9, 3);
    const next = play(ws, plan.ops);
    const left = next.sections.find((s) => s.id === 'sec-a-n')!;
    const right = next.sections.find((s) => s.id === 'sec-n-b')!;
    expect(left.mode).toBe('imported_preserved');
    expect(right.mode).toBe('imported_preserved');
    expect(left.geometry.coordinates[left.geometry.coordinates.length - 1]).toEqual(right.geometry.coordinates[0]);
    expect(right.geometry.coordinates[right.geometry.coordinates.length - 1]).toEqual([6.13, 45.9]);
  });

  it('le premier point d’une carte vide est le départ, le deuxième l’arrivée', () => {
    const empty = owned({ points: [], sections: [], stages: [] });
    const first = planPointInsertion(empty, { pointId: 'p1', role: 'waypoint', lat: 45.9, lon: 6, thresholdM: 100 });
    expect(first.ok && first.ops[0]).toMatchObject({ type: 'insert_point', kind: 'start', name: 'Départ' });
    const one = play(empty, first.ok ? first.ops : []);
    const second = planPointInsertion(one, { pointId: 'p2', role: 'waypoint', lat: 45.95, lon: 6, thresholdM: 100 });
    expect(second.ok && second.ops[0]).toMatchObject({ kind: 'finish', name: 'Arrivée' });
  });

  it('les rôles du menu donnent le bon type de point', () => {
    const ws = owned();
    const stop = planPointInsertion(ws, { pointId: 's', role: 'stop', lat: 45.9005, lon: 6.05, thresholdM: 150 });
    expect(stop.ok && stop.ops[0]).toMatchObject({ kind: 'stop', name: 'Arrêt 1' });
    const mark = planPointInsertion(ws, { pointId: 'm', role: 'landmark', lat: 45.9005, lon: 6.05, thresholdM: 150 });
    expect(mark.ok && mark.ops[0]).toMatchObject({ semanticKind: 'custom', name: 'Repère 1' });
  });
});

describe('pointInsertion · fin d’étape', () => {
  it('au milieu de la 1re journée : la limite avec la 2e se déplace au point', () => {
    const ws = owned();
    const plan = planPointInsertion(ws, { pointId: 'e', role: 'stage_end', lat: 45.9005, lon: 6.05, thresholdM: 150 });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const next = play(ws, plan.ops);
    const g1 = next.stages.find((s) => s.id === 'g1')!;
    const g2 = next.stages.find((s) => s.id === 'g2')!;
    expect(g1.endPointId).toBe('e');
    expect(g2.startPointId).toBe('e');
  });

  it('dans la dernière journée : une journée de plus, les limites d’avant restent', () => {
    const ws = owned();
    const plan = planPointInsertion(ws, { pointId: 'e', role: 'stage_end', lat: 45.9005, lon: 6.2, thresholdM: 150 });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const next = play(ws, plan.ops);
    expect(next.stages).toHaveLength(3);
    const byDay = next.stages.slice().sort((a, b) => a.dayNumber - b.dayNumber);
    expect(byDay[0]).toMatchObject({ startPointId: 'a', endPointId: 'b' });
    expect(byDay[1]).toMatchObject({ startPointId: 'b', endPointId: 'e' });
    expect(byDay[2]).toMatchObject({ startPointId: 'e', endPointId: 'c' });
  });

  it('sans étape existante : crée deux journées coupées au point', () => {
    const ws = owned({ stages: [] });
    const plan = planPointInsertion(ws, { pointId: 'e', role: 'stage_end', lat: 45.9005, lon: 6.2, thresholdM: 150 });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const next = play(ws, plan.ops);
    expect(next.stages).toHaveLength(2);
    expect(next.stages[0].endPointId).toBe('e');
  });

  it('refuse une fin d’étape loin du tracé, avec la raison', () => {
    const plan = planPointInsertion(owned(), { pointId: 'e', role: 'stage_end', lat: 46.5, lon: 6.2, thresholdM: 150 });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toMatch(/tracé/);
  });

  it('planStageBoundary rend null pour un point inconnu', () => {
    expect(planStageBoundary([{ id: 'a' }], [], 'zz')).toBeNull();
  });
});

describe('pointInsertion · glisser la ligne (2.4)', () => {
  it('insère le point déposé après le départ du tronçon glissé et nomme les deux nouveaux tronçons', () => {
    const ws = owned();
    const plan = planLineDrag(ws, 's2', 'd', 45.91, 6.2);
    expect(plan?.afterPointId).toBe('b');
    expect(plan?.newSectionIds).toEqual(['sec-b-d', 'sec-d-c']);
    const next = play(ws, plan!.ops);
    expect(next.sections.some((s) => s.id === 'sec-b-d')).toBe(true);
    expect(next.sections.some((s) => s.id === 'sec-d-c')).toBe(true);
  });

  it('refuse un tronçon inconnu', () => {
    expect(planLineDrag(owned(), 'nope', 'd', 45.9, 6.2)).toBeNull();
  });
});

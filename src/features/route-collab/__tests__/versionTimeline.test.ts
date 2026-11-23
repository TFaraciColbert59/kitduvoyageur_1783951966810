import { describe, expect, it } from 'vitest';
import { applyWorkspaceOperation, publishWorkspaceRevision } from '../engine';
import { buildVersionTimeline, contentHash, describeRevertEffect, revertOperation } from '../versionTimeline';
import { baseWorkspace, pt, section, stage } from '../insights/__tests__/fixtures';
import type { RouteWorkspaceState } from '../types';

const NOW = '2026-11-22T10:00:00.000Z';
let n = 0;

function start(): RouteWorkspaceState {
  const a = pt('a', 'a', 45.9, 6.0);
  const b = pt('b', 'b', 45.9, 6.13);
  const c = pt('c', 'c', 45.9, 6.26);
  return {
    ...baseWorkspace({ sport: 'marche', points: [a, b, c], sections: [section('s1', a, b), section('s2', b, c)], stages: [stage('g1', 1, 'a', 'c')] }),
    members: [{ userId: 'alice', displayName: 'Alice', role: 'owner' }],
  };
}

function edit(ws: RouteWorkspaceState, operation: Parameters<typeof applyWorkspaceOperation>[2]['operation']): RouteWorkspaceState {
  n += 1;
  const r = applyWorkspaceOperation(ws, [], { opId: `o${n}`, baseSeq: ws.headSeq, actorId: 'alice', actorName: 'Alice', operation }, NOW).result;
  if (r.status !== 'accepted') throw new Error(JSON.stringify(r));
  return r.workspace;
}

function publish(ws: RouteWorkspaceState, summary: string): RouteWorkspaceState {
  const r = publishWorkspaceRevision({ workspace: ws, actorId: 'alice', actorName: 'Alice', expectedHeadSeq: ws.headSeq, summary, nowIso: NOW });
  if (r.status !== 'published') throw new Error(r.reason);
  return r.workspace;
}

describe('5.10 frise des versions', () => {
  it('du plus récent au plus ancien : brouillon, puis chaque version publiée', () => {
    let ws = publish(start(), 'Première version');
    ws = edit(ws, { type: 'delete_point', pointId: 'b' });
    ws = publish(ws, 'Sans le col');
    ws = edit(ws, { type: 'insert_point', pointId: 'x', afterPointId: 'a', lat: 45.91, lon: 6.05 });
    const frise = buildVersionTimeline(ws, true);
    expect(frise.map((e) => e.title)).toEqual(['Brouillon en cours', 'Version 2', 'Version 1']);
    expect(frise[2].pointCount).toBe(3);
    expect(frise[1].pointCount).toBe(2);
    expect(frise[0].pointCount).toBe(3);
    expect(frise[1].isPublished).toBe(true);
    expect(frise[2].isPublished).toBe(false);
    expect(frise[0].revertible).toBe(false);
    expect(frise[1].revertible).toBe(true);
    expect(frise[1].authorName).toBe('Alice');
  });

  it('sans droit de publier, aucun retour n’est proposé', () => {
    const ws = publish(start(), 'v1');
    const moved = edit(ws, { type: 'delete_point', pointId: 'b' });
    expect(buildVersionTimeline(moved, false).every((e) => !e.revertible)).toBe(true);
  });

  it('revenir à une version crée une nouvelle séquence et laisse l’historique entier', () => {
    let ws = publish(start(), 'v1');
    ws = edit(ws, { type: 'delete_point', pointId: 'b' });
    ws = publish(ws, 'v2');
    const v1 = ws.revisions.find((r) => r.revisionNo === 1)!;
    expect(describeRevertEffect(ws, v1)).toMatch(/\+1 point/);
    const before = ws.headSeq;
    const reverted = edit(ws, revertOperation(v1));
    expect(reverted.headSeq).toBe(before + 1);
    expect(reverted.revisions.length).toBe(2); // rien n'est effacé
    const frise = buildVersionTimeline(reverted, true);
    // le brouillon a de nouveau le contenu de la version 1, et la frise le dit
    expect(frise.find((e) => e.revisionNo === 1)?.matchesDraft).toBe(true);
    expect(frise.find((e) => e.revisionNo === 1)?.revertible).toBe(false);
    expect(frise.find((e) => e.revisionNo === 2)?.revertible).toBe(true);
    expect(contentHash(reverted)).toBe(contentHash(v1));
  });

  it('plusieurs allers-retours restent possibles (v1 → v2 → v1 → v2)', () => {
    let ws = publish(start(), 'v1');
    ws = edit(ws, { type: 'delete_point', pointId: 'b' });
    ws = publish(ws, 'v2');
    ws = edit(ws, revertOperation(ws.revisions[0]));
    expect(ws.points.filter((p) => !p.deletedAt).length).toBe(3);
    ws = edit(ws, revertOperation(ws.revisions[1]));
    expect(ws.points.filter((p) => !p.deletedAt).length).toBe(2);
    expect(ws.revisions.length).toBe(2);
  });
});

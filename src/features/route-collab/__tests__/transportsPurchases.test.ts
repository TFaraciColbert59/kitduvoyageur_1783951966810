import { describe, expect, it, vi } from 'vitest';
import { RouteOperationSchema, StageSchema, KitItemSchema } from '@/app/api/routes/_schemas';
import { applyWorkspaceOperation } from '../engine';
import { baseWorkspace, kit, stage } from '../insights/__tests__/fixtures';
import { describeOperation, planUndo, type JournalEntry } from '../undo';
import { createWorkspaceRecord, resetRouteCollabStoreForTests, updateWorkspaceKitItem } from '../serverStore';
import type { RouteOperationInput, RouteWorkspaceState, StageTransport } from '../types';

vi.mock('server-only', () => ({}));

const NOW = '2026-11-23T10:00:00.000Z';
const tr = (over: Partial<StageTransport> = {}): StageTransport => ({ id: 'tr-1', direction: 'aller', mode: 'train', amount: 38, currency: 'EUR', ...over });

function ws(): RouteWorkspaceState {
  return baseWorkspace({
    stages: [stage('st-1', 1, 'a', 'b'), stage('st-2', 2, 'b', 'c')],
    kitItems: [kit('k1')],
    members: [{ userId: 'alice', displayName: 'Alice', role: 'owner' }],
  });
}
const apply = (w: RouteWorkspaceState, operation: RouteOperationInput, actorId = 'alice') =>
  applyWorkspaceOperation(w, [], { opId: `op-${Math.random()}`, baseSeq: w.headSeq, actorId, actorName: actorId, operation }, NOW);

describe('Transports par journée (10.6)', () => {
  it('pose, remplace et retire les transports d’une journée sans toucher aux autres', () => {
    const r = apply(ws(), { type: 'set_stage_transports', stageId: 'st-1', transports: [tr(), tr({ id: 'tr-2', direction: 'retour', amount: null })] });
    expect(r.result.status).toBe('accepted');
    if (r.result.status !== 'accepted') return;
    const w = r.result.workspace;
    expect(w.stages[0].transports).toHaveLength(2);
    expect(w.stages[0].transports?.[1].amount).toBeNull(); // « à estimer » conservé tel quel
    expect(w.stages[1].transports).toBeUndefined();
    const cleared = apply(w, { type: 'set_stage_transports', stageId: 'st-1', transports: [] });
    if (cleared.result.status === 'accepted') expect(cleared.result.workspace.stages[0].transports).toBeUndefined();
  });

  it('refuse une étape inconnue, plus de six transports, un montant négatif ; un lecteur n’écrit pas', () => {
    expect(apply(ws(), { type: 'set_stage_transports', stageId: 'x', transports: [] }).result.status).not.toBe('accepted');
    expect(apply(ws(), { type: 'set_stage_transports', stageId: 'st-1', transports: Array.from({ length: 7 }, (_, i) => tr({ id: `t${i}` })) }).result.status).not.toBe('accepted');
    expect(apply(ws(), { type: 'set_stage_transports', stageId: 'st-1', transports: [tr({ amount: -5 })] }).result.status).not.toBe('accepted');
    const readonlyWs = { ...ws(), members: [{ userId: 'bob', displayName: 'Bob', role: 'participant' as const }] };
    expect(apply(readonlyWs, { type: 'set_stage_transports', stageId: 'st-1', transports: [tr()] }, 'bob').result.status).toBe('denied');
  });

  it('annulable : le geste inverse remet les transports d’avant', () => {
    const before = ws();
    const op: RouteOperationInput = { type: 'set_stage_transports', stageId: 'st-1', transports: [tr()] };
    expect(describeOperation(op, before)).toBe('transports de la journée');
    const r = apply(before, op);
    if (r.result.status !== 'accepted') throw new Error('refusée');
    const entry = { seq: 1, opId: 'o1', actorId: 'alice', operation: op, createdAt: NOW, before, after: r.result.workspace } as unknown as JournalEntry;
    const plan = planUndo([entry], { workspace: r.result.workspace, actorId: 'alice' } as never);
    expect(JSON.stringify(plan)).toContain('set_stage_transports');
  });

  it('le schéma de réception est strict : devise, type, montant, six au plus', () => {
    const ok = { type: 'set_stage_transports', stageId: 'st-1', transports: [tr()] };
    expect(RouteOperationSchema.safeParse(ok).success).toBe(true);
    expect(RouteOperationSchema.safeParse({ ...ok, transports: [tr({ currency: 'XYZ' as never })] }).success).toBe(false);
    expect(RouteOperationSchema.safeParse({ ...ok, transports: [tr({ mode: 'fusée' as never })] }).success).toBe(false);
    expect(RouteOperationSchema.safeParse({ ...ok, transports: [{ ...tr(), extra: 1 }] }).success).toBe(false);
    expect(RouteOperationSchema.safeParse({ ...ok, transports: Array.from({ length: 7 }, (_, i) => tr({ id: `t${i}` })) }).success).toBe(false);
    expect(StageSchema.shape.transports).toBeDefined();
  });
});

describe('Achat prévu dans le sac (10.6)', () => {
  it('le schéma accepte un montant saisi et refuse le reste', () => {
    const base = { id: 'k1', name: 'Réchaud', category: 'cuisine', weightGrams: 100, quantity: 1, shared: true, assigneeUserId: null, assigneeName: null, dependsOn: [], status: 'confirmed' };
    expect(KitItemSchema.safeParse({ ...base, plannedPurchase: { amount: 35, currency: 'EUR' } }).success).toBe(true);
    expect(KitItemSchema.safeParse({ ...base, plannedPurchase: null }).success).toBe(true);
    expect(KitItemSchema.safeParse({ ...base }).success).toBe(true);
    expect(KitItemSchema.safeParse({ ...base, plannedPurchase: { amount: -1, currency: 'EUR' } }).success).toBe(false);
    expect(KitItemSchema.safeParse({ ...base, plannedPurchase: { amount: 5, currency: 'EUR', x: 1 } }).success).toBe(false);
  });

  it('set_purchase pose puis retire le montant ; refusé sans droit d’édition', () => {
    resetRouteCollabStoreForTests();
    const rec = createWorkspaceRecord(ws());
    const set = updateWorkspaceKitItem({ workspaceId: rec.id, actorId: 'alice', action: 'set_purchase', itemId: 'k1', purchase: { amount: 35, currency: 'EUR' } });
    expect(set.ok && set.workspace.kitItems[0].plannedPurchase).toEqual({ amount: 35, currency: 'EUR' });
    const clear = updateWorkspaceKitItem({ workspaceId: rec.id, actorId: 'alice', action: 'set_purchase', itemId: 'k1', purchase: null });
    expect(clear.ok && clear.workspace.kitItems[0].plannedPurchase).toBeNull();
    const denied = updateWorkspaceKitItem({ workspaceId: rec.id, actorId: 'intrus', action: 'set_purchase', itemId: 'k1', purchase: { amount: 1, currency: 'EUR' } });
    expect(denied.ok).toBe(false);
  });
});

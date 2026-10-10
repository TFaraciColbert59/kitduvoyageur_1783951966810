import { describe, expect, it } from 'vitest';

import {
  buildCommandIdempotencyKey,
  persistCommand,
  type CommandDb,
} from '@/server/admin/commands';
import {
  persistApprovalDecision,
  persistApprovalRequest,
  type ApprovalDb,
} from '@/server/admin/approvals';

/** Fake DB en mémoire : admin_commands + admin_approval_requests/decisions. */
function fakeDb() {
  const commands: Record<string, Record<string, unknown> & { id: string }> = {};
  const byKey: Record<string, string> = {};
  const requests: Record<string, Record<string, unknown> & { id: string; status: string }> = {};
  let n = 0;
  const nid = (p: string) => `${p}-${(n += 1)}`;
  const table = (t: string) => ({
    select: (_c: string) => ({
      eq: (col: string, val: string) => ({
        maybeSingle: () =>
          Promise.resolve({
            data:
              t === 'admin_commands'
                ? (Object.values(commands).find((c) => String(c[col]) === val) as {
                    id: string;
                    status: 'awaiting_approval';
                  } | undefined) ?? null
                : ((Object.values(requests).find((r) => String(r[col]) === val) as {
                    id: string;
                    command_id: string;
                    requested_by: string;
                    status: string;
                  } | undefined) ?? null),
            error: null,
          }),
      }),
    }),
    insert: (row: Record<string, unknown>) => ({
      select: () => ({
        single: () => {
          if (t === 'admin_commands') {
            const key = String(row.idempotency_key);
            if (byKey[key]) {
              return Promise.resolve({ data: null, error: { code: '23505' } });
            }
            const id = nid('cmd');
            commands[id] = { ...row, id };
            byKey[key] = id;
            return Promise.resolve({ data: { id, status: row.status }, error: null });
          }
          if (t === 'admin_approval_requests') {
            const id = nid('apr');
            requests[id] = { ...row, id, status: 'pending' };
            return Promise.resolve({ data: { id }, error: null });
          }
          return Promise.resolve({ data: { id: nid('dec') }, error: null });
        },
      }),
    }),
    update: (patch: Record<string, unknown>) => ({
      eq: (col: string, val: string) => {
        if (t === 'admin_approval_requests') {
          const r = Object.values(requests).find((x) => String(x[col]) === val);
          if (r) Object.assign(r, patch);
        }
        if (t === 'admin_commands') {
          const c =
            commands[val] ?? Object.values(commands).find((x) => String(x[col]) === val);
          if (c) Object.assign(c, patch);
        }
        return Promise.resolve({ error: null });
      },
    }),
  });
  return { db: { from: table } as unknown as CommandDb & ApprovalDb, commands, requests, byKey };
}

const ACTOR = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('cycle commande → approbation', () => {
  it('refund.request Tier3 ne demande pas d’approbation mais s’enregistre validé', async () => {
    const { db } = fakeDb();
    const fp = {
      command_key: 'commerce.refund.request',
      resource_type: 'order',
      resource_id: 'o1',
      reason: 'client débité deux fois, ticket #123',
    };
    const r1 = await persistCommand(db, ACTOR, {
      ...fp,
      risk_tier: 3,
      idempotency_key: buildCommandIdempotencyKey(fp),
    });
    expect(r1.status).toBe('validated');
    expect(r1.deduplicated).toBe(false);
    const r2 = await persistCommand(db, ACTOR, {
      ...fp,
      risk_tier: 3,
      idempotency_key: buildCommandIdempotencyKey(fp),
    });
    expect(r2.deduplicated).toBe(true);
    expect(r2.command_id).toBe(r1.command_id);
  });

  it('refund.approve Tier4 part en awaiting_approval + SoD bloque l’auto-approbation', async () => {
    const { db } = fakeDb();
    const fp = {
      command_key: 'commerce.refund.approve',
      resource_type: 'order',
      resource_id: 'o9',
      reason: 'remboursement 240€, ticket #456',
    };
    const cmd = await persistCommand(db, ACTOR, {
      ...fp,
      risk_tier: 4,
      idempotency_key: buildCommandIdempotencyKey(fp),
    });
    expect(cmd.status).toBe('awaiting_approval');

    const { approval_id } = await persistApprovalRequest(
      db,
      cmd.command_id,
      ACTOR,
      'second regard financier requis'
    );
    await expect(
      persistApprovalDecision(db, approval_id, ACTOR, 'approve', 'je valide moi-même')
    ).rejects.toThrow('sod_violation');

    const res = await persistApprovalDecision(
      db,
      approval_id,
      OTHER,
      'approve',
      'factures vérifiées, montant conforme'
    );
    expect(res.status).toBe('approved');
  });

  it('course check-then-insert (23505) rejouée sans 500', async () => {
    const { db } = fakeDb();
    const fp = {
      command_key: 'commerce.refund.request',
      resource_type: 'order',
      resource_id: 'race-1',
      reason: 'double-clic concurrent, ticket #789',
    };
    const key = buildCommandIdempotencyKey(fp);
    // Pré-insère la commande du concurrent, puis simule un INSERT qui
    // échoue en 23505 malgré le check (fake : on force via un doublon direct).
    await persistCommand(db, ACTOR, { ...fp, risk_tier: 3, idempotency_key: key });
    const racy = (() => {
      let lookups = 0;
      const inner = (db as unknown as { from(t: string): unknown }).from('admin_commands');
      const sel = inner as { select(c: string): { eq(c: string, v: string): { maybeSingle(): Promise<{ data: { id: string; status: 'validated' } | null; error: null }> } } };
      return {
      from: (t: string) => {
        if (t !== 'admin_commands') return (db as unknown as { from(tt: string): unknown }).from(t);
        return {
          select: (c: string) => ({
            eq: (col: string, val: string) => ({
              maybeSingle: async () => {
                lookups += 1;
                // Premier check : rien (concurrent pas encore visible)...
                if (lookups === 1) return { data: null, error: null };
                return sel.select(c).eq(col, val).maybeSingle();
              },
            }),
          }),
          insert: (_row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => ({ data: null, error: { code: '23505' } }),
            }),
          }),
          update: (inner as { update(p: Record<string, unknown>): unknown }).update.bind(inner),
        };
      },
    };
    })() as unknown as CommandDb;
    const r = await persistCommand(racy, ACTOR, { ...fp, risk_tier: 3, idempotency_key: key });
    expect(r.deduplicated).toBe(true);
  });

  it('refuse les commandes inconnues et les motifs courts', async () => {
    const { db } = fakeDb();
    await expect(
      persistCommand(db, ACTOR, {
        command_key: 'nope.unknown',
        resource_type: 'x',
        resource_id: 'y',
        reason: 'motif assez long ici',
        risk_tier: 1,
        idempotency_key: 'k-1234567890123456',
      })
    ).rejects.toThrow('unknown_command_key');
    await expect(
      persistCommand(db, ACTOR, {
        command_key: 'commerce.refund.request',
        resource_type: 'order',
        resource_id: 'o1',
        reason: 'court',
        risk_tier: 3,
        idempotency_key: 'k-1234567890123456',
      })
    ).rejects.toThrow('invalid_command');
  });
});

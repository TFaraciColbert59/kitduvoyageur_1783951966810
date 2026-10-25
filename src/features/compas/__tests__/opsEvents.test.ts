import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ rows: [] as unknown[], error: null as { code: string } | null, client: true }));
vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: () =>
    db.client
      ? {
          from: (table: string) => ({
            insert: async (row: unknown) => {
              db.rows.push({ table, row });
              return { error: db.error };
            },
          }),
        }
      : null,
}));

import { preparationEventKind, recordPreparationEvent } from '../server/opsEvents';

describe('journal des préparations (rapport quotidien)', () => {
  beforeEach(() => {
    db.rows = [];
    db.error = null;
    db.client = true;
  });

  it('chaque issue a son genre : seules « ok » et « failed » comptent au rapport', () => {
    expect(preparationEventKind({ success: true, summary: {} })).toBe('ok');
    expect(preparationEventKind({ success: true, pending: true })).toBe('pending');
    expect(preparationEventKind({ success: false, already: true })).toBe('already');
    expect(preparationEventKind({ success: false, retryInS: 30 })).toBe('limited');
    expect(preparationEventKind({ success: false })).toBe('failed');
  });

  it('une ligne par issue, sans rien de la personne ni du voyage', async () => {
    await recordPreparationEvent('ok');
    await recordPreparationEvent('ok');
    expect(db.rows).toEqual([
      { table: 'ops_preparation_events', row: { kind: 'ok' } },
      { table: 'ops_preparation_events', row: { kind: 'ok' } },
    ]);
  });

  it('base absente ou refus : la préparation continue', async () => {
    db.error = { code: '42501' };
    await expect(recordPreparationEvent('failed')).resolves.toBeUndefined();
    db.client = false;
    await expect(recordPreparationEvent('failed')).resolves.toBeUndefined();
  });
});

/**
 * A10 (10.8) — TTL d'auto-guérison des requêtes de génération.
 *
 * `hasActivePending` ne doit jamais rester bloqué sur un `pending` orphelin :
 * une ligne de plus de 10 minutes est ignorée et marquée `failed`
 * (best-effort), afin qu'une génération interrompue ne condamne pas les
 * tentatives suivantes (courses 409 en série).
 */
import { describe, it, expect, vi } from 'vitest';

import {
  createSupabaseGenerationRequestStore,
  STALE_PENDING_MS,
} from '@/features/adventure-intelligence/server/generationRequests';

const USER_ID = 'a1000000-0000-4000-8000-000000000001';
const TABLE = 'adventure_generation_requests';

interface Captures {
  selects: Array<{ table: string; columns: string; filters: Array<[string, unknown]> }>;
  updates: Array<{ table: string; values: Record<string, unknown>; id: string | null }>;
}

function createClient(
  rows: Record<string, unknown>[] | null,
  options: { selectError?: string; updateError?: string } = {}
): { client: Record<string, unknown>; captures: Captures } {
  const captures: Captures = { selects: [], updates: [] };
  const client = {
    from(table: string) {
      let op: 'select' | 'update' = 'select';
      let columns = '';
      let values: Record<string, unknown> = {};
      const filters: Array<[string, unknown]> = [];
      const builder: Record<string, unknown> = {};

      builder.select = (selected?: string) => {
        columns = selected ?? '';
        return builder;
      };
      builder.update = (next: Record<string, unknown>) => {
        op = 'update';
        values = next;
        return builder;
      };
      builder.eq = (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      };
      builder.then = (
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown
      ) => {
        if (op === 'update') {
          const id = filters.find(([column]) => column === 'id')?.[1] ?? null;
          captures.updates.push({ table, values, id: id == null ? null : String(id) });
          const result = options.updateError
            ? { error: { message: options.updateError } }
            : { error: null };
          return Promise.resolve(result).then(resolve, reject);
        }
        captures.selects.push({ table, columns, filters });
        const result = options.selectError
          ? { data: null, error: { message: options.selectError } }
          : { data: rows, error: null };
        return Promise.resolve(result).then(resolve, reject);
      };
      return builder;
    },
  };

  return { client, captures };
}

describe('generationRequests — TTL pending (auto-guérison)', () => {
  it('STALE_PENDING_MS vaut bien 10 minutes', () => {
    expect(STALE_PENDING_MS).toBe(600_000);
  });

  it('pending frais → actif (true), aucune écriture', async () => {
    const { client, captures } = createClient([
      { id: 'req-fresh', created_at: new Date().toISOString() },
    ]);
    const store = createSupabaseGenerationRequestStore(client as never);

    await expect(store.hasActivePending(USER_ID)).resolves.toBe(true);

    expect(captures.selects).toHaveLength(1);
    expect(captures.selects[0]).toMatchObject({
      table: TABLE,
      columns: 'id, created_at',
    });
    expect(captures.selects[0].filters).toEqual([
      ['user_id', USER_ID],
      ['status', 'pending'],
    ]);
    expect(captures.updates).toHaveLength(0);
  });

  it('pending périmé (> 10 min) → inactif (false) et marqué failed', async () => {
    const stale = new Date(Date.now() - STALE_PENDING_MS - 60_000).toISOString();
    const { client, captures } = createClient([{ id: 'req-stale', created_at: stale }]);
    const store = createSupabaseGenerationRequestStore(client as never);

    await expect(store.hasActivePending(USER_ID)).resolves.toBe(false);

    expect(captures.updates).toEqual([
      { table: TABLE, values: { status: 'failed' }, id: 'req-stale' },
    ]);
  });

  it('aucun pending → false, aucune écriture', async () => {
    const { client, captures } = createClient([]);
    const store = createSupabaseGenerationRequestStore(client as never);

    await expect(store.hasActivePending(USER_ID)).resolves.toBe(false);
    expect(captures.updates).toHaveLength(0);
  });

  it('mélange frais + périmé → true, seul le périmé est marqué failed', async () => {
    const stale = new Date(Date.now() - STALE_PENDING_MS - 1).toISOString();
    const fresh = new Date(Date.now() - 5_000).toISOString();
    const { client, captures } = createClient([
      { id: 'req-stale', created_at: stale },
      { id: 'req-fresh', created_at: fresh },
    ]);
    const store = createSupabaseGenerationRequestStore(client as never);

    await expect(store.hasActivePending(USER_ID)).resolves.toBe(true);
    expect(captures.updates).toEqual([
      { table: TABLE, values: { status: 'failed' }, id: 'req-stale' },
    ]);
  });

  it('échec du marquage → verdict rendu quand même (best-effort, jamais bloquant)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stale = new Date(Date.now() - STALE_PENDING_MS - 60_000).toISOString();
    const { client } = createClient([{ id: 'req-stale', created_at: stale }], {
      updateError: 'base indisponible',
    });
    const store = createSupabaseGenerationRequestStore(client as never);

    await expect(store.hasActivePending(USER_ID)).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('erreur de lecture → rejet (le store existant continue de remonter)', async () => {
    const { client } = createClient([], { selectError: 'base indisponible' });
    const store = createSupabaseGenerationRequestStore(client as never);

    await expect(store.hasActivePending(USER_ID)).rejects.toThrow('base indisponible');
  });
});

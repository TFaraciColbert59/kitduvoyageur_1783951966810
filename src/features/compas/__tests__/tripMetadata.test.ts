/**
 * Plan 2.7 : la préparation (jusqu'à 270 s en arrière-plan) et les gestes de
 * l'équipe écrivent tous `trips.metadata` en entier. Une écriture ne doit plus
 * effacer celle qui est passée entre sa lecture et la sienne.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { updateTripMetadata, type Supa } from '../server/compasServer';

interface Row {
  metadata: Record<string, unknown>;
  updated_at: string;
  user_id: string;
  [column: string]: unknown;
}

/** Une table `trips` d'une ligne : `updated_at` change à chaque écriture (trigger). */
function fakeTrips(row: Row, opts: { beforeWrite?: (n: number) => void; deny?: boolean } = {}) {
  const calls = { reads: 0, writes: 0 };
  let stamp = 0;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            calls.reads += 1;
            return { data: { metadata: structuredClone(row.metadata), updated_at: row.updated_at }, error: null };
          },
        }),
      }),
      update: (values: Record<string, unknown>) => {
        const filters: Record<string, unknown> = {};
        const query = {
          eq(column: string, value: unknown) {
            filters[column] = value;
            return query;
          },
          async select() {
            calls.writes += 1;
            opts.beforeWrite?.(calls.writes);
            const matches = Object.entries(filters).every(([k, v]) => k === 'id' || row[k] === v);
            if (opts.deny || !matches) return { data: [], error: null };
            Object.assign(row, values);
            stamp += 1;
            row.updated_at = `2026-10-09T00:00:0${stamp}.000000+00:00`;
            return { data: [{ id: 'trip' }], error: null };
          },
        };
        return query;
      },
    }),
  };
  return { client: client as unknown as Supa, calls };
}

const start = (): Row => ({
  metadata: { compas: { planned_days: 3 } },
  updated_at: '2026-10-09T00:00:00.000000+00:00',
  user_id: 'u1',
});

describe('métadonnées du voyage écrites sans écraser une écriture concurrente', () => {
  it('une écriture passée entre la lecture et la sienne est gardée : le patch est rejoué dessus', async () => {
    const row = start();
    const { client, calls } = fakeTrips(row, {
      // L'équipe change les préférences pendant que la préparation écrit son issue.
      beforeWrite: (n) => {
        if (n !== 1) return;
        row.metadata = { compas: { ...(row.metadata.compas as object), prefs: { pace: 'lent' } } };
        row.updated_at = '2026-10-09T00:00:00.500000+00:00';
      },
    });
    const res = await updateTripMetadata(client, 'trip', (m) => ({
      ...m,
      compas: { ...(m.compas as object), autofill_result: { success: true } },
    }));
    expect(res.error).toBeNull();
    expect(row.metadata).toEqual({
      compas: { planned_days: 3, prefs: { pace: 'lent' }, autofill_result: { success: true } },
    });
    expect(calls).toEqual({ reads: 2, writes: 2 });
  });

  it('les autres colonnes partent dans la même écriture', async () => {
    const row = start();
    const { client } = fakeTrips(row);
    const res = await updateTripMetadata(client, 'trip', (m) => ({ ...m, route_id: 42 }), {
      columns: { start_date: '2026-07-01', end_date: '2026-07-03' },
    });
    expect(res.metadata).toMatchObject({ route_id: 42 });
    expect(row).toMatchObject({ start_date: '2026-07-01', end_date: '2026-07-03', metadata: { route_id: 42 } });
  });

  it('rien à changer (même objet rendu) : aucune écriture', async () => {
    const row = start();
    const { client, calls } = fakeTrips(row);
    const res = await updateTripMetadata(client, 'trip', (m) => m);
    expect(res.error).toBeNull();
    expect(calls.writes).toBe(0);
  });

  it('écriture refusée sans que le voyage bouge (droits) : rendue aussitôt, sans boucler', async () => {
    const row = start();
    const { client, calls } = fakeTrips(row, { deny: true });
    const res = await updateTripMetadata(client, 'trip', (m) => ({ ...m, x: 1 }));
    expect(res).toMatchObject({ metadata: null, error: { code: 'not_written' } });
    expect(calls).toEqual({ reads: 2, writes: 1 });
  });

  it('course sans fin : abandon après le nombre d’essais, jamais une écriture aveugle', async () => {
    const row = start();
    const { client, calls } = fakeTrips(row, {
      beforeWrite: (n) => {
        row.updated_at = `2026-10-09T00:01:0${n}.000000+00:00`;
      },
    });
    const res = await updateTripMetadata(client, 'trip', (m) => ({ ...m, x: 1 }), { attempts: 3 });
    expect(res).toMatchObject({ metadata: null, error: { code: 'conflict' } });
    expect(calls.writes).toBe(3);
    expect(row.metadata).not.toHaveProperty('x');
  });

  it('un filtre en plus (propriétaire) qui ne correspond pas : rien n’est écrit', async () => {
    const row = start();
    const { client } = fakeTrips(row);
    const res = await updateTripMetadata(client, 'trip', (m) => ({ ...m, x: 1 }), { match: { user_id: 'u2' } });
    expect(res.error).not.toBeNull();
    expect(row.metadata).not.toHaveProperty('x');
  });
});

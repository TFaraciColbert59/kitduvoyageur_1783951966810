import { describe, it, expect, vi, beforeEach } from 'vitest';

const { captured } = vi.hoisted(() => ({
  captured: {
    updates: [] as Array<{ table: string; values: Record<string, unknown> }>,
    eqs: [] as Array<[string, unknown]>,
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { renameTrip } from '@/features/trips/actions/renameTrip';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TRIP_ID = '22222222-2222-4222-8222-222222222222';

interface SessionOptions {
  user: { id: string } | null;
  updateError?: { message: string } | null;
}

function createSession(options: SessionOptions) {
  return {
    auth: {
      getUser: async () => ({ data: { user: options.user } }),
    },
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          captured.updates.push({ table, values });
          const settled = Promise.resolve({ error: options.updateError ?? null });
          const builder = {
            eq(column: string, value: unknown) {
              captured.eqs.push([column, value]);
              return builder;
            },
            then: settled.then.bind(settled),
          };
          return builder;
        },
      };
    },
  };
}

const mockedCreateClient = vi.mocked(createClient);
const mockedRevalidate = vi.mocked(revalidatePath);

describe('renameTrip — action serveur', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.updates.length = 0;
    captured.eqs.length = 0;
  });

  it('refuse une session absente sans toucher aux données', async () => {
    mockedCreateClient.mockResolvedValue(createSession({ user: null }) as never);

    const result = await renameTrip(TRIP_ID, 'Nouveau titre');

    expect(result).toEqual({ ok: false, error: 'Session requise' });
    expect(captured.updates).toHaveLength(0);
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });

  it('refuse un titre de moins de 3 caractères sans requête', async () => {
    mockedCreateClient.mockResolvedValue(createSession({ user: { id: USER_ID } }) as never);

    const result = await renameTrip(TRIP_ID, 'ab');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('3');
    expect(captured.updates).toHaveLength(0);
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });

  it('refuse un titre de plus de 120 caractères sans requête', async () => {
    mockedCreateClient.mockResolvedValue(createSession({ user: { id: USER_ID } }) as never);

    const result = await renameTrip(TRIP_ID, 'x'.repeat(121));

    expect(result.ok).toBe(false);
    expect(result.error).toContain('120');
    expect(captured.updates).toHaveLength(0);
  });

  it('met à jour le titre normalisé, scopé id + user_id, puis revalide hub et itinéraire', async () => {
    mockedCreateClient.mockResolvedValue(createSession({ user: { id: USER_ID } }) as never);

    const result = await renameTrip(TRIP_ID, '  Tour du Mont-Blanc  ');

    expect(result).toEqual({ ok: true });
    expect(captured.updates).toHaveLength(1);
    expect(captured.updates[0].table).toBe('trips');
    expect(captured.updates[0].values).toEqual(
      expect.objectContaining({ title: 'Tour du Mont-Blanc' })
    );
    expect(captured.eqs).toEqual([
      ['id', TRIP_ID],
      ['user_id', USER_ID],
    ]);
    expect(mockedRevalidate).toHaveBeenCalledWith('/hub');
    expect(mockedRevalidate).toHaveBeenCalledWith('/hub/itineraire');
  });

  it('remonte l’erreur base sans revalider', async () => {
    mockedCreateClient.mockResolvedValue(
      createSession({ user: { id: USER_ID }, updateError: { message: 'permission denied' } }) as never
    );

    const result = await renameTrip(TRIP_ID, 'Nouveau titre');

    expect(result).toEqual({ ok: false, error: 'permission denied' });
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });

  it('refuse un identifiant de voyage vide ou démesuré', async () => {
    mockedCreateClient.mockResolvedValue(createSession({ user: { id: USER_ID } }) as never);

    expect((await renameTrip('', 'Nouveau titre')).ok).toBe(false);
    expect((await renameTrip('x'.repeat(129), 'Nouveau titre')).ok).toBe(false);
    expect(captured.updates).toHaveLength(0);
  });
});

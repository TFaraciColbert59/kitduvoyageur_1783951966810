/**
 * T11 — getProgressionHistory :
 *   (a) pagination par curseur (limit+1 → nextCursor sur la dernière ligne servie) ;
 *   (b) dernière page → nextCursor null ;
 *   (c) curseur transmis au filtre `or` (effective_at, id) ;
 *   (d) erreur événements → throw (la route répond 500) ;
 *   (e) libellés : action connue → nom français ; inconnue → humanisée ; points bornés ;
 *   (f) limit borné à 50 (+1 de lecture pour détecter la page suivante).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

import { createClient } from '@supabase/supabase-js';
import { getProgressionHistory } from '@/features/progression/server/progressionService';

const mockedCreateClient = vi.mocked(createClient);
const ORIGINAL_ENV = { ...process.env };

interface ServiceMockOptions {
  events?: unknown[];
  eventsError?: { message: string } | null;
  pending?: unknown[];
  pendingError?: { message: string } | null;
  limits?: Array<{ table: string; limit: number }>;
  ors?: string[];
}

function createServiceMock(options: ServiceMockOptions) {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.in = () => builder;
      builder.order = () => builder;
      builder.limit = (limit: number) => {
        options.limits?.push({ table, limit });
        return builder;
      };
      builder.or = (value: string) => {
        options.ors?.push(value);
        return builder;
      };
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(
          table === 'progression_events'
            ? { data: options.events ?? [], error: options.eventsError ?? null }
            : { data: options.pending ?? [], error: options.pendingError ?? null }
        ).then(resolve);
      return builder;
    },
  };
}

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    action_type: 'hike_session_processed',
    points_total: 70,
    effective_at: '2026-10-05T09:00:00.000Z',
    rules_version: 'v1',
    season_id: 'season_2026_s1',
    skill_allocations: [
      { skill: 'explorer', weight: 1, points: 70 },
      { skill: 'preparer', weight: 0, points: 0 },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('getProgressionHistory', () => {
  it('(a) pagine : limit+1 lu, deux servis, curseur = dernière ligne servie', async () => {
    const limits: Array<{ table: string; limit: number }> = [];
    mockedCreateClient.mockReturnValue(
      createServiceMock({
        events: [
          eventRow({ id: 'e1', effective_at: '2026-10-07T09:00:00.000Z' }),
          eventRow({ id: 'e2', effective_at: '2026-10-06T09:00:00.000Z' }),
          eventRow({ id: 'e3', effective_at: '2026-10-05T09:00:00.000Z' }),
        ],
        pending: [
          {
            id: 'i1',
            action_type: 'carnet_published',
            business_effective_at: '2026-10-07T10:00:00.000Z',
            state: 'pending',
          },
        ],
        limits,
      }) as never
    );

    const history = await getProgressionHistory('u1', { limit: 2 });

    expect(limits).toContainEqual({ table: 'progression_events', limit: 3 });
    expect(history.items).toHaveLength(2);
    expect(history.nextCursor).toEqual({ before: '2026-10-06T09:00:00.000Z', beforeId: 'e2' });
    expect(history.pending).toEqual([
      {
        id: 'i1',
        action: 'carnet_published',
        label: 'Carnet publié',
        effectiveAt: '2026-10-07T10:00:00.000Z',
        state: 'pending',
      },
    ]);
  });

  it('(b) dernière page → nextCursor null', async () => {
    mockedCreateClient.mockReturnValue(
      createServiceMock({ events: [eventRow()] }) as never
    );

    const history = await getProgressionHistory('u1', { limit: 2 });

    expect(history.items).toHaveLength(1);
    expect(history.nextCursor).toBeNull();
  });

  it('(c) curseur → filtre clés (effective_at, id)', async () => {
    const ors: string[] = [];
    mockedCreateClient.mockReturnValue(createServiceMock({ events: [], ors }) as never);

    await getProgressionHistory('u1', {
      limit: 5,
      before: '2026-10-06T09:00:00.000Z',
      beforeId: 'e2',
    });

    expect(ors).toEqual([
      'effective_at.lt.2026-10-06T09:00:00.000Z,and(effective_at.eq.2026-10-06T09:00:00.000Z,id.lt.e2)',
    ]);
  });

  it('(d) erreur de lecture → throw (la route décide du statut)', async () => {
    mockedCreateClient.mockReturnValue(
      createServiceMock({ eventsError: { message: 'boom' } }) as never
    );

    await expect(getProgressionHistory('u1')).rejects.toMatchObject({ message: 'boom' });
  });

  it('(e) libellés et bornes : action connue, action inconnue, points négatifs', async () => {
    mockedCreateClient.mockReturnValue(
      createServiceMock({
        events: [
          eventRow({ id: 'e1', action_type: 'hike_session_processed', points_total: 70 }),
          eventRow({ id: 'e2', action_type: 'fancy_new_action', points_total: -5 }),
        ],
      }) as never
    );

    const history = await getProgressionHistory('u1');

    expect(history.items[0].label).toBe('Randonnée accomplie');
    expect(history.items[0].skills).toEqual([
      { skill: 'explorer', points: 70, weight: 1 },
      { skill: 'preparer', points: 0, weight: 0 },
    ]);
    expect(history.items[1].label).toBe('Fancy New Action');
    expect(history.items[1].points).toBe(0);
  });

  it('(f) limit borné à 50 (lecture 51)', async () => {
    const limits: Array<{ table: string; limit: number }> = [];
    mockedCreateClient.mockReturnValue(createServiceMock({ events: [], limits }) as never);

    await getProgressionHistory('u1', { limit: 999 });

    expect(limits).toContainEqual({ table: 'progression_events', limit: 51 });
  });
});

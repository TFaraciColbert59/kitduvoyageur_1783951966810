/**
 * P3/stabilisation — verrou anti-manipulation du territoire déclaré :
 *   (a) re-soumettre l'identique est libre (aucune écriture de journal) ;
 *   (b) un changement réel dans les 24 h est refusé (`territory_locked_24h`) ;
 *   (c) un changement réel hors fenêtre est accepté et journalisé.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

import { createClient } from '@supabase/supabase-js';
import { updateDeclaredTerritory } from '@/features/progression/server/territoryService';

interface MockOptions {
  current?: unknown;
  lastChange?: unknown;
  calls?: Array<[string, ...unknown[]]>;
}

function createSupabaseMock(options: MockOptions) {
  const calls = options.calls ?? [];
  return {
    from: (table: string) => {
      calls.push(['from', table]);
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.order = () => builder;
      builder.limit = () => builder;
      builder.maybeSingle = () => {
        if (table === 'user_territory') {
          return Promise.resolve({ data: options.current ?? null, error: null });
        }
        return Promise.resolve({ data: options.lastChange ?? null, error: null });
      };
      builder.upsert = (payload: unknown) => {
        calls.push(['upsert', table, payload]);
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.maybeSingle = () =>
          Promise.resolve({
            data: {
              city_name: 'Grenoble',
              city_code: '38185',
              region_code: '84',
              country_code: 'FR',
              source: 'manual',
              updated_at: '2026-09-19T10:00:00.000Z',
            },
            error: null,
          });
        return chain;
      };
      builder.insert = (payload: unknown) => {
        calls.push(['insert', table, payload]);
        return Promise.resolve({ error: null });
      };
      return builder;
    },
  };
}

const mockedCreateClient = vi.mocked(createClient);
const ORIGINAL_ENV = { ...process.env };

const INPUT = { city_code: '38185', region_code: '84', country_code: 'FR', city_name: 'Grenoble' };

describe('updateDeclaredTerritory — verrou 24 h', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('(a) re-soumission identique : acceptée sans journal', async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    mockedCreateClient.mockReturnValue(
      createSupabaseMock({
        current: { city_code: '38185', region_code: '84', country_code: 'FR' },
        calls,
      }) as never
    );

    const result = await updateDeclaredTerritory('u1', INPUT);

    expect(result.ok).toBe(true);
    expect(calls.some(([op, table]) => op === 'insert' && table === 'territory_change_log')).toBe(false);
  });

  it('(b) changement réel dans les 24 h : refusé', async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    mockedCreateClient.mockReturnValue(
      createSupabaseMock({
        current: { city_code: '75056', region_code: '11', country_code: 'FR' },
        lastChange: { created_at: new Date().toISOString() },
        calls,
      }) as never
    );

    const result = await updateDeclaredTerritory('u1', INPUT);

    expect(result).toEqual({ ok: false, error: 'territory_locked_24h' });
    expect(calls.some(([op]) => op === 'upsert')).toBe(false);
  });

  it('(c) changement réel hors fenêtre : accepté et journalisé', async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    mockedCreateClient.mockReturnValue(
      createSupabaseMock({
        current: { city_code: '75056', region_code: '11', country_code: 'FR' },
        lastChange: { created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
        calls,
      }) as never
    );

    const result = await updateDeclaredTerritory('u1', INPUT);

    expect(result.ok).toBe(true);
    expect(
      calls.some(([op, table]) => op === 'insert' && table === 'territory_change_log')
    ).toBe(true);
  });
});

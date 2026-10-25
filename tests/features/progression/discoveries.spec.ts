/**
 * T18 — découvertes géographiques :
 *   (a) session non traitée ou sans sentier → aucune découverte ;
 *   (b) région + pays administratif quand connu (un événement, plusieurs
 *       territoires), via la fonction vérifiée uniquement ;
 *   (c) une découverte déclarée n'est jamais élevée en visite réelle sans
 *       preuve (insert-only, ignoreDuplicates) ;
 *   (d) liste : provenance et granularité normalisées, aucune coordonnée.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

import { createClient } from '@supabase/supabase-js';
import {
  deriveVerifiedDiscoveriesFromSession,
  listUserDiscoveries,
  recordUnverifiedDiscovery,
} from '@/features/progression/server/discoveries';

const ORIGINAL_ENV = { ...process.env };
const mockedCreateClient = vi.mocked(createClient);

interface MockOptions {
  session?: unknown;
  route?: unknown;
  countryRows?: unknown[];
  rpcResult?: unknown;
  rpcError?: { message: string } | null;
  listRows?: unknown[];
  upsertCalls?: Array<Record<string, unknown>>;
  rpcCalls?: Array<{ fn: string; args: Record<string, unknown> }>;
}

function createMock(options: MockOptions) {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        or: () => builder,
        limit: () => builder,
        order: () => builder,
        upsert: (row: Record<string, unknown>, opts: Record<string, unknown>) => {
          options.upsertCalls?.push({ row, opts });
          return Promise.resolve({ error: null });
        },
        maybeSingle: () =>
          Promise.resolve({
            data:
              table === 'hike_sessions'
                ? options.session ?? null
                : table === 'hiking_routes'
                  ? options.route ?? null
                  : null,
            error: null,
          }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(
            table === 'admin_regions_geo'
              ? { data: options.countryRows ?? [], error: null }
              : { data: options.listRows ?? [], error: null }
          ).then(resolve),
      };
      return builder;
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      options.rpcCalls?.push({ fn, args });
      return Promise.resolve({ data: options.rpcResult ?? true, error: options.rpcError ?? null });
    },
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

describe('découvertes géographiques', () => {
  it('(a1) session non traitée → zéro, aucun RPC', async () => {
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    mockedCreateClient.mockReturnValue(
      createMock({ session: { user_id: 'u1', processing_status: 'processing', route_id: 7 }, rpcCalls }) as never
    );

    expect(await deriveVerifiedDiscoveriesFromSession('s1')).toBe(0);
    expect(rpcCalls).toHaveLength(0);
  });

  it('(a2) session sans sentier → zéro (un GPX importé seul ne prouve rien)', async () => {
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    mockedCreateClient.mockReturnValue(
      createMock({ session: { user_id: 'u1', processing_status: 'processed', route_id: null }, rpcCalls }) as never
    );

    expect(await deriveVerifiedDiscoveriesFromSession('s1')).toBe(0);
    expect(rpcCalls).toHaveLength(0);
  });

  it('(b) région + pays : un événement, deux territoires, par le flux vérifié', async () => {
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    mockedCreateClient.mockReturnValue(
      createMock({
        session: { user_id: 'u1', processing_status: 'processed', route_id: 7 },
        route: { region: 'Occitanie' },
        countryRows: [{ country_iso_a2: 'FR' }],
        rpcResult: true,
        rpcCalls,
      }) as never
    );

    const recorded = await deriveVerifiedDiscoveriesFromSession('s1');

    expect(recorded).toBe(2);
    expect(rpcCalls.map((call) => call.fn)).toEqual([
      'record_verified_discovery',
      'record_verified_discovery',
    ]);
    expect(rpcCalls[0].args).toMatchObject({ p_entity_type: 'region', p_entity_code: 'occitanie' });
    expect(rpcCalls[1].args).toMatchObject({ p_entity_type: 'country', p_entity_code: 'fr' });
  });

  it('(b2) région seule quand le pays administratif est inconnu', async () => {
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    mockedCreateClient.mockReturnValue(
      createMock({
        session: { user_id: 'u1', processing_status: 'processed', route_id: 7 },
        route: { region: 'Massif Central' },
        countryRows: [],
        rpcResult: true,
        rpcCalls,
      }) as never
    );

    expect(await deriveVerifiedDiscoveriesFromSession('s1')).toBe(1);
    expect(rpcCalls[0].args).toMatchObject({ p_entity_type: 'region', p_entity_code: 'massif central' });
  });

  it('(c) déclaration ou virtuel : insert-only, jamais d’écrasement vérifié', async () => {
    const upsertCalls: Array<Record<string, unknown>> = [];
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    mockedCreateClient.mockReturnValue(createMock({ upsertCalls, rpcCalls }) as never);

    await recordUnverifiedDiscovery({
      userId: 'u1',
      entityType: 'country',
      entityCode: 'IT',
      provenance: 'declared',
      sourceType: 'manual',
      sourceId: 'd1',
    });

    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].opts).toMatchObject({
      onConflict: 'user_id,entity_type,entity_code',
      ignoreDuplicates: true,
    });
    expect((upsertCalls[0].row as Record<string, unknown>).provenance).toBe('declared');
    expect(rpcCalls).toHaveLength(0);
  });

  it('(d) liste : provenance bornée, aucune coordonnée retournée', async () => {
    mockedCreateClient.mockReturnValue(
      createMock({
        listRows: [
          { entity_type: 'region', entity_code: 'occitanie', provenance: 'verified', first_seen_at: '2026-10-05T00:00:00.000Z' },
          { entity_type: 'country', entity_code: 'it', provenance: 'declared', first_seen_at: '2026-10-01T00:00:00.000Z' },
          { entity_type: 'inconnu', entity_code: 'x', provenance: 'autre', first_seen_at: null },
        ],
      }) as never
    );

    const rows = await listUserDiscoveries('u1');

    expect(rows).toHaveLength(3);
    expect(rows[2].entityType).toBe('region');
    expect(rows[2].provenance).toBe('verified');
    expect(JSON.stringify(rows)).not.toMatch(/latitude|longitude|lat|lng/i);
  });
});

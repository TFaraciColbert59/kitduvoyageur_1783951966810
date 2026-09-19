/**
 * P2 — awardProducerGain : lecture du barème, calcul du gain, appel canonique.
 *   (a) règles absentes → refus sans appel RPC ;
 *   (b) action inconnue → refus ;
 *   (c) poids invalides → refus ;
 *   (d) nominal : base + bonus plafonné, poids transmis, clé stable côté RPC ;
 *   (e) erreur RPC → refus explicable, jamais de throw.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: vi.fn() }));

import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { awardProducerGain } from '@/features/progression/server/awardProducer';

interface MockOptions {
  rules?: unknown;
  rulesError?: { message: string } | null;
  rpcResult?: unknown;
  rpcError?: { message: string } | null;
  calls?: Array<[string, ...unknown[]]>;
}

function createSupabaseMock(options: MockOptions) {
  const calls = options.calls ?? [];
  const rulesBuilder: Record<string, unknown> = {};
  rulesBuilder.select = () => rulesBuilder;
  rulesBuilder.eq = () => rulesBuilder;
  rulesBuilder.maybeSingle = () =>
    Promise.resolve({ data: options.rules ?? null, error: options.rulesError ?? null });
  return {
    from: (table: string) => {
      calls.push(['from', table]);
      return rulesBuilder;
    },
    rpc: (name: string, params: unknown) => {
      calls.push(['rpc', name, params]);
      return Promise.resolve({ data: options.rpcResult ?? null, error: options.rpcError ?? null });
    },
  };
}

const mockedGetService = vi.mocked(getServiceSupabase);

const RULES = {
  payload: {
    actions: {
      hike_session_processed: {
        points: 40,
        max_points: 150,
        weights: { explorer: 1, preparer: 0, partager: 0, entraider: 0 },
      },
      bad_weights: { points: 10, weights: { explorer: 0.5, preparer: 0.2, partager: 0, entraider: 0 } },
    },
  },
};

const BASE_INPUT = {
  userId: '11111111-1111-1111-1111-111111111111',
  sourceType: 'hike_session',
  sourceId: 'session-1',
  effectiveAt: '2026-09-19T10:00:00.000Z',
};

describe('awardProducerGain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  it('(a) règles absentes → refus sans appel RPC', async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    mockedGetService.mockReturnValue(createSupabaseMock({ rules: null, calls }) as never);

    const result = await awardProducerGain({ ...BASE_INPUT, action: 'hike_session_processed' });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('regles_indisponibles');
    expect(calls.some(([op]) => op === 'rpc')).toBe(false);
  });

  it('(b) action inconnue → refus', async () => {
    mockedGetService.mockReturnValue(createSupabaseMock({ rules: RULES }) as never);

    const result = await awardProducerGain({ ...BASE_INPUT, action: 'inconnue' as never });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('action_non_autorisee');
  });

  it('(c) poids invalides → refus', async () => {
    mockedGetService.mockReturnValue(createSupabaseMock({ rules: RULES }) as never);

    const result = await awardProducerGain({ ...BASE_INPUT, action: 'bad_weights' as never });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('poids_invalides');
  });

  it('(d) nominal : base + bonus plafonné et poids transmis', async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    mockedGetService.mockReturnValue(
      createSupabaseMock({
        rules: RULES,
        rpcResult: { success: true, outcome: 'awarded', points: 55, rewardTransactionId: 'tx-1' },
        calls,
      }) as never
    );

    const result = await awardProducerGain({
      ...BASE_INPUT,
      action: 'hike_session_processed',
      bonus: 15,
      metadata: { segments: 3 },
    });

    expect(result.success).toBe(true);
    expect(result.points).toBe(55);
    const rpcCall = calls.find(([op]) => op === 'rpc');
    expect(rpcCall?.[1]).toBe('award_progression_gain');
    expect((rpcCall?.[2] as { p_points_total: number }).p_points_total).toBe(55);
    expect((rpcCall?.[2] as { p_source_id: string }).p_source_id).toBe('session-1');
  });

  it('(e) bonus au-delà du plafond → gain plafonné', async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    mockedGetService.mockReturnValue(
      createSupabaseMock({
        rules: RULES,
        rpcResult: { success: true, outcome: 'awarded', points: 150 },
        calls,
      }) as never
    );

    await awardProducerGain({ ...BASE_INPUT, action: 'hike_session_processed', bonus: 500 });

    const rpcCall = calls.find(([op]) => op === 'rpc');
    expect((rpcCall?.[2] as { p_points_total: number }).p_points_total).toBe(150);
  });

  it('(f) erreur RPC → refus explicable, sans throw', async () => {
    mockedGetService.mockReturnValue(
      createSupabaseMock({ rules: RULES, rpcError: { message: 'boom' } }) as never
    );

    const result = await awardProducerGain({ ...BASE_INPUT, action: 'hike_session_processed' });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('moteur_indisponible');
  });
});

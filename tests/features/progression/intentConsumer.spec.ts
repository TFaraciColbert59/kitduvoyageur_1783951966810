/**
 * T07 — consommateur d'intentions durables :
 *   (a) service indisponible → zéro, aucun appel ;
 *   (b) gain confirmé → intention `processed` avec la transaction du moteur ;
 *   (c) refus métier → `refused` terminal, aucune reprise ;
 *   (d) panne d'infrastructure → `failed` avec backoff, puis `dead` à 5 ;
 *   (e) réservation perdue (autre worker) → ligne ignorée sans effet ;
 *   (f) place_review → clé auteur:lieu rejouée ; trail_prepared → métadonnées ;
 *   (g) clé de source invalide → refus explicable, jamais de throw.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/features/progression/server/producerHooks', () => ({
  awardHikeSessionProcessed: vi.fn(),
  awardKitFieldReport: vi.fn(),
  awardCarnetPublished: vi.fn(),
  awardChecklistCompleted: vi.fn(),
  awardTripCompleted: vi.fn(),
  awardPlaceReview: vi.fn(),
  awardTrailPrepared: vi.fn(),
}));

import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  awardCarnetPublished,
  awardHikeSessionProcessed,
  awardPlaceReview,
  awardTrailPrepared,
} from '@/features/progression/server/producerHooks';
import { consumeProgressionAwardIntents } from '@/features/progression/server/intentConsumer';

interface FakeOptions {
  listRows?: unknown[];
  listError?: { message: string } | null;
  claimResultFor?: (intentId: string, payload: Record<string, unknown>) => Array<{ id: string }> | null;
  calls?: Array<Record<string, unknown>>;
}

function createSupabaseFake(options: FakeOptions) {
  const calls = options.calls ?? [];
  return {
    from(table: string) {
      const state: {
        table: string;
        op: 'select' | 'update' | null;
        payload: Record<string, unknown> | null;
        filters: Array<[string, unknown, unknown]>;
      } = { table, op: null, payload: null, filters: [] };

      const resolve = () => {
        if (state.op === 'select') {
          return { data: options.listRows ?? [], error: options.listError ?? null };
        }
        const idFilter = state.filters.find(([kind, col]) => kind === 'eq' && col === 'id');
        const intentId = String(idFilter?.[2] ?? '');
        if (state.payload?.state === 'processing') {
          const claim = options.claimResultFor
            ? options.claimResultFor(intentId, state.payload)
            : [{ id: intentId }];
          return { data: claim, error: null };
        }
        calls.push({ table: state.table, update: state.payload, filters: [...state.filters] });
        return { data: [{ id: intentId }], error: null };
      };

      const chain: Record<string, unknown> = {
        select: () => {
          if (state.op === null) state.op = 'select';
          return chain;
        },
        update: (payload: Record<string, unknown>) => {
          state.op = 'update';
          state.payload = payload;
          return chain;
        },
        in: (col: string, values: unknown) => {
          state.filters.push(['in', col, values]);
          return chain;
        },
        eq: (col: string, value: unknown) => {
          state.filters.push(['eq', col, value]);
          return chain;
        },
        lte: (col: string, value: unknown) => {
          state.filters.push(['lte', col, value]);
          return chain;
        },
        order: () => chain,
        limit: (value: number) => {
          calls.push({ table: state.table, limit: value });
          return chain;
        },
        then: (onFulfilled: (value: unknown) => unknown) =>
          Promise.resolve(resolve()).then(onFulfilled),
        catch: () => Promise.resolve(),
      };
      return chain;
    },
  };
}

const mockedGetService = vi.mocked(getServiceSupabase);
const mockHike = vi.mocked(awardHikeSessionProcessed);
const mockCarnet = vi.mocked(awardCarnetPublished);
const mockPlace = vi.mocked(awardPlaceReview);
const mockTrail = vi.mocked(awardTrailPrepared);

const INTENT_HIKE = {
  id: 'intent-1',
  user_id: 'user-1',
  action_type: 'hike_session_processed',
  source_type: 'hike_session',
  source_id: 'session-1',
  attempts: 0,
  metadata: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('consumeProgressionAwardIntents', () => {
  it('(a) sans service : zéro consommation, aucun accès table', async () => {
    mockedGetService.mockReturnValue(null as never);
    const summary = await consumeProgressionAwardIntents();
    expect(summary).toEqual({ claimed: 0, processed: 0, refused: 0, failed: 0 });
    expect(mockedGetService).toHaveBeenCalledTimes(1);
  });

  it('(b) gain confirmé → processed avec la transaction du moteur', async () => {
    const calls: Array<Record<string, unknown>> = [];
    mockedGetService.mockReturnValue(
      createSupabaseFake({ listRows: [INTENT_HIKE], calls }) as never
    );
    mockHike.mockResolvedValue({
      success: true,
      outcome: 'awarded',
      rewardTransactionId: 'tx-9',
    });

    const summary = await consumeProgressionAwardIntents({ limit: 10 });

    expect(summary).toEqual({ claimed: 1, processed: 1, refused: 0, failed: 0 });
    expect(mockHike).toHaveBeenCalledWith('session-1');
    const settle = calls.find((call) => (call.update as Record<string, unknown>)?.state === 'processed');
    expect(settle).toBeTruthy();
    expect((settle?.update as Record<string, unknown>).reward_transaction_id).toBe('tx-9');
  });

  it('(c) refus métier → terminal `refused`, aucun backoff', async () => {
    const calls: Array<Record<string, unknown>> = [];
    mockedGetService.mockReturnValue(
      createSupabaseFake({ listRows: [INTENT_HIKE], calls }) as never
    );
    mockHike.mockResolvedValue({ success: false, outcome: 'refused', reason: 'session_non_traitee' });

    const summary = await consumeProgressionAwardIntents();

    expect(summary.refused).toBe(1);
    const settle = calls.find((call) => (call.update as Record<string, unknown>)?.state === 'refused');
    expect((settle?.update as Record<string, unknown>).last_error).toBe('session_non_traitee');
    expect((settle?.update as Record<string, unknown>).available_at).toBeUndefined();
  });

  it('(d) panne d’infrastructure → failed avec backoff ; 5e échec → dead', async () => {
    const calls: Array<Record<string, unknown>> = [];
    mockedGetService.mockReturnValue(
      createSupabaseFake({ listRows: [{ ...INTENT_HIKE, attempts: 4 }], calls }) as never
    );
    mockHike.mockResolvedValue({ success: false, outcome: 'refused', reason: 'moteur_indisponible' });

    const summary = await consumeProgressionAwardIntents();

    expect(summary.failed).toBe(1);
    const settle = calls.find((call) =>
      ['failed', 'dead'].includes(String((call.update as Record<string, unknown>)?.state))
    );
    expect((settle?.update as Record<string, unknown>).state).toBe('dead');
    expect((settle?.update as Record<string, unknown>).available_at).toBeTruthy();
  });

  it('(e) réservation perdue (autre worker) → ligne ignorée sans hook', async () => {
    mockedGetService.mockReturnValue(
      createSupabaseFake({ listRows: [INTENT_HIKE], claimResultFor: () => [] }) as never
    );

    const summary = await consumeProgressionAwardIntents();

    expect(summary.claimed).toBe(0);
    expect(mockHike).not.toHaveBeenCalled();
  });

  it('(f1) place_review → clé auteur:lieu rejouée telle quelle', async () => {
    mockedGetService.mockReturnValue(
      createSupabaseFake({
        listRows: [
          { ...INTENT_HIKE, action_type: 'place_review', source_type: 'place_review', source_id: 'user-1:place-7' },
        ],
      }) as never
    );
    mockPlace.mockResolvedValue({ success: true, outcome: 'awarded' });

    await consumeProgressionAwardIntents();
    expect(mockPlace).toHaveBeenCalledWith('user-1', 'place-7');
  });

  it('(f2) trail_prepared → métadonnées route/trip transmises au hook', async () => {
    mockedGetService.mockReturnValue(
      createSupabaseFake({
        listRows: [
          {
            ...INTENT_HIKE,
            action_type: 'trail_prepared',
            source_type: 'trail_prep',
            source_id: 'user-1:42',
            metadata: { routeId: '42', tripId: 'trip-3' },
          },
        ],
      }) as never
    );
    mockTrail.mockResolvedValue({ success: true, outcome: 'awarded' });

    await consumeProgressionAwardIntents();
    expect(mockTrail).toHaveBeenCalledWith('user-1', '42', 'trip-3');
  });

  it('(f3) carnet_published → cible le carnet par identifiant', async () => {
    mockedGetService.mockReturnValue(
      createSupabaseFake({
        listRows: [{ ...INTENT_HIKE, action_type: 'carnet_published', source_type: 'carnet', source_id: 'carnet-5' }],
      }) as never
    );
    mockCarnet.mockResolvedValue({ success: true, outcome: 'awarded' });

    await consumeProgressionAwardIntents();
    expect(mockCarnet).toHaveBeenCalledWith('carnet-5');
  });

  it('(g) source invalide → refus explicable, jamais de throw', async () => {
    const calls: Array<Record<string, unknown>> = [];
    mockedGetService.mockReturnValue(
      createSupabaseFake({
        listRows: [
          { ...INTENT_HIKE, action_type: 'place_review', source_type: 'place_review', source_id: 'malformée' },
          { ...INTENT_HIKE, id: 'intent-2', action_type: 'trail_prepared', source_type: 'trail_prep', source_id: 'user-1:9', metadata: null },
          { ...INTENT_HIKE, id: 'intent-3', action_type: 'inconnue', source_type: 'x', source_id: 'y' },
        ],
        calls,
      }) as never
    );

    const summary = await consumeProgressionAwardIntents();

    expect(summary.refused).toBe(3);
    expect(mockPlace).not.toHaveBeenCalled();
    expect(mockTrail).not.toHaveBeenCalled();
    const refusals = calls.filter((call) => (call.update as Record<string, unknown>)?.state === 'refused');
    expect(refusals.some((call) => (call.update as Record<string, unknown>).last_error === 'source_invalide')).toBe(true);
    expect(refusals.some((call) => (call.update as Record<string, unknown>).last_error === 'action_non_geree')).toBe(true);
  });
});

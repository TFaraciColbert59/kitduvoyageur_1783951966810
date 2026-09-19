/**
 * P2 — Accroches producteurs : faits serveur exigés avant toute attribution.
 *   (a) session non traitée → aucun crédit, aucune décision ;
 *   (b) session traitée → gain Explorer avec bonus segments plafonné ;
 *   (c) débrief kit sans session traitée → refus ;
 *   (d) débrief kit sur session traitée → gain Se préparer/Partager ;
 *   (e) activité préparée → clé (user, route) ;
 *   (f) avis de lieu → clé (place).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/features/progression/server/awardProducer', () => ({ awardProducerGain: vi.fn() }));

import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { awardProducerGain } from '@/features/progression/server/awardProducer';
import {
  awardHikeSessionProcessed,
  awardKitFieldReport,
  awardTrailPrepared,
  awardPlaceReview,
} from '@/features/progression/server/producerHooks';

const mockedGetService = vi.mocked(getServiceSupabase);
const mockedAward = vi.mocked(awardProducerGain);

interface TableData {
  session?: unknown;
  report?: unknown;
  count?: number;
}

function createSupabaseMock(data: TableData) {
  return {
    from: (table: string) => {
      if (table === 'hike_sessions') {
        const builder: Record<string, unknown> = {};
        builder.select = () => builder;
        builder.eq = () => builder;
        builder.maybeSingle = () => Promise.resolve({ data: data.session ?? null, error: null });
        return builder;
      }
      if (table === 'session_segment_passages') {
        const builder: Record<string, unknown> = {};
        builder.select = () => builder;
        builder.eq = () => Promise.resolve({ count: data.count ?? 0, error: null });
        return builder;
      }
      if (table === 'kit_field_reports') {
        const builder: Record<string, unknown> = {};
        builder.select = (_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) {
            return {
              eq: () => Promise.resolve({ count: data.count ?? 0, error: null }),
            };
          }
          return builder;
        };
        builder.eq = () => builder;
        builder.limit = () => builder;
        builder.maybeSingle = () => Promise.resolve({ data: data.report ?? null, error: null });
        return builder;
      }
      throw new Error(`table inattendue: ${table}`);
    },
  };
}

describe('producerHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAward.mockResolvedValue({ success: true, outcome: 'awarded' });
  });

  it('(a) session non traitée → aucun crédit', async () => {
    mockedGetService.mockReturnValue(
      createSupabaseMock({ session: { user_id: 'u1', ended_at: null, processing_status: 'pending' } }) as never
    );

    const result = await awardHikeSessionProcessed('s1');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('session_non_traitee');
    expect(mockedAward).not.toHaveBeenCalled();
  });

  it('(b) session traitée → gain Explorer avec bonus segments plafonné', async () => {
    mockedGetService.mockReturnValue(
      createSupabaseMock({
        session: { user_id: 'u1', ended_at: '2026-09-19T08:00:00.000Z', processing_status: 'processed' },
        count: 100,
      }) as never
    );

    await awardHikeSessionProcessed('s1');

    expect(mockedAward).toHaveBeenCalledTimes(1);
    const input = mockedAward.mock.calls[0][0];
    expect(input.action).toBe('hike_session_processed');
    expect(input.sourceType).toBe('hike_session');
    expect(input.sourceId).toBe('s1');
    expect(input.bonus).toBe(110);
    expect(input.effectiveAt).toBe('2026-09-19T08:00:00.000Z');
  });

  it('(c) débrief kit sans session traitée → refus sans crédit', async () => {
    mockedGetService.mockReturnValue(
      createSupabaseMock({
        session: { user_id: 'u1', kit_id: 'k1', processing_status: 'processing' },
        report: { kit_id: 'k1' },
      }) as never
    );

    const result = await awardKitFieldReport('s1');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('session_non_traitee');
    expect(mockedAward).not.toHaveBeenCalled();
  });

  it('(d) débrief kit sur session traitée → gain kit', async () => {
    mockedGetService.mockReturnValue(
      createSupabaseMock({
        session: { user_id: 'u1', kit_id: 'k1', processing_status: 'processed' },
        report: { kit_id: 'k1' },
        count: 3,
      }) as never
    );

    await awardKitFieldReport('s1');

    const input = mockedAward.mock.calls[0][0];
    expect(input.action).toBe('kit_field_report');
    expect(input.sourceType).toBe('kit_report');
    expect(input.sourceId).toBe('s1');
    expect(input.bonus).toBe(6);
  });

  it('(e) activité préparée → clé stable (user, route)', async () => {
    await awardTrailPrepared('u1', 42, 'trip-1');

    const input = mockedAward.mock.calls[0][0];
    expect(input.action).toBe('trail_prepared');
    expect(input.sourceId).toBe('u1:42');
    expect(input.metadata).toEqual({ routeId: '42', tripId: 'trip-1' });
  });

  it('(f) avis de lieu → clé stable (place)', async () => {
    await awardPlaceReview('u1', 'place-9');

    const input = mockedAward.mock.calls[0][0];
    expect(input.action).toBe('place_review');
    expect(input.sourceId).toBe('place-9');
  });
});

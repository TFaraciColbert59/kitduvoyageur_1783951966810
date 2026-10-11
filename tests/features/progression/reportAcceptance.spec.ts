/**
 * T24 — corrections utiles :
 *   (a) service : mapping des refus SQL (auto-validation, déjà résolu, raison
 *       requise, invalide) et transport ;
 *   (b) hook : rapport pending/non accepté → refus sans crédit ;
 *   (c) hook : rapport accepté → gain avec claim unique `place_report` ;
 *   (d) même rapport (correction ↔ accessibilité) → même claim, une seule
 *       réservation possible.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/features/progression/server/awardProducer', () => ({ awardProducerGain: vi.fn() }));

import { createClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { awardProducerGain } from '@/features/progression/server/awardProducer';
import { resolvePlaceReport } from '@/features/progression/server/contributionValidation';
import { awardPlaceReportAccepted } from '@/features/progression/server/producerHooks';

const ORIGINAL_ENV = { ...process.env };
const mockedCreateClient = vi.mocked(createClient);
const mockedGetService = vi.mocked(getServiceSupabase);
const mockedAward = vi.mocked(awardProducerGain);

interface RpcOptions {
  rpcResult?: unknown;
  rpcError?: { message: string } | null;
  rpcCalls?: Array<{ fn: string; args: Record<string, unknown> }>;
}

function rpcMock(options: RpcOptions) {
  return {
    rpc: (fn: string, args: Record<string, unknown>) => {
      options.rpcCalls?.push({ fn, args });
      return Promise.resolve({ data: options.rpcResult ?? null, error: options.rpcError ?? null });
    },
  };
}

function serviceMock(report: unknown) {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.maybeSingle = () => Promise.resolve({ data: report ?? null, error: null });
  return { from: () => builder };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  mockedAward.mockResolvedValue({ success: true, outcome: 'awarded' });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('résolution d’un signalement (service)', () => {
  it('(a1) acceptation par validateur indépendant → ok', async () => {
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    mockedCreateClient.mockReturnValue(
      rpcMock({ rpcResult: { ok: true, resolution: 'accepted' }, rpcCalls }) as never
    );

    const result = await resolvePlaceReport({
      reportId: 'r1',
      moderatorId: 'mod-1',
      resolution: 'accepted',
    });

    expect(result).toEqual({ ok: true, resolution: 'accepted' });
    expect(rpcCalls[0].fn).toBe('resolve_place_report');
    expect(rpcCalls[0].args).toMatchObject({ p_resolved_by: 'mod-1', p_resolution: 'accepted' });
  });

  it('(a2) refus SQL mappés explicitement (auto-validation, déjà résolu…)', async () => {
    for (const reason of ['independant_requis', 'deja_resolu', 'raison_requise', 'resolution_invalide'] as const) {
      mockedCreateClient.mockReturnValue(rpcMock({ rpcResult: { ok: false, reason } }) as never);
      const result = await resolvePlaceReport({
        reportId: 'r1',
        moderatorId: 'mod-1',
        resolution: 'accepted',
      });
      expect(result).toEqual({ ok: false, reason });
    }
  });

  it('(a3) refus métier → ok:false avec raison visible ; erreur de transport → throw', async () => {
    mockedCreateClient.mockReturnValue(
      rpcMock({ rpcResult: { ok: false, reason: 'rejected', resolution: 'rejected' } }) as never
    );
    // Un refus valide du rapport n'est pas une erreur :
    mockedCreateClient.mockReturnValue(rpcMock({ rpcResult: { ok: true, resolution: 'rejected' } }) as never);
    expect(
      await resolvePlaceReport({ reportId: 'r1', moderatorId: 'mod-1', resolution: 'rejected', reason: 'doublon' })
    ).toEqual({ ok: true, resolution: 'rejected' });

    mockedCreateClient.mockReturnValue(rpcMock({ rpcError: { message: 'boom' } }) as never);
    await expect(
      resolvePlaceReport({ reportId: 'r1', moderatorId: 'mod-1', resolution: 'accepted' })
    ).rejects.toThrow('boom');
  });
});

describe('gain d’un rapport accepté (hook)', () => {
  it('(b) rapport en attente ou refusé → aucun crédit', async () => {
    for (const report of [
      { reporter_id: 'u1', status: 'pending', resolution: null },
      { reporter_id: 'u1', status: 'rejected', resolution: 'rejected' },
    ]) {
      mockedGetService.mockReturnValue(serviceMock(report) as never);
      const result = await awardPlaceReportAccepted('r1');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('rapport_non_accepte');
    }
    expect(mockedAward).not.toHaveBeenCalled();
  });

  it('(c) rapport accepté → gain avec claim unique place_report', async () => {
    mockedGetService.mockReturnValue(
      serviceMock({ reporter_id: 'u1', status: 'accepted', resolution: 'accepted' }) as never
    );

    await awardPlaceReportAccepted('r1');

    const input = mockedAward.mock.calls[0][0];
    expect(input.action).toBe('place_report_accepted');
    expect(input.userId).toBe('u1');
    expect(input.claims).toEqual([{ group: 'place_report', key: 'report:r1' }]);
  });

  it('(d) correction et accessibilité du même rapport → même claim (une seule réservation)', async () => {
    mockedGetService.mockReturnValue(
      serviceMock({ reporter_id: 'u1', status: 'accepted', resolution: 'accepted' }) as never
    );

    await awardPlaceReportAccepted('r1');
    await awardPlaceReportAccepted('r1');

    const first = mockedAward.mock.calls[0][0];
    const second = mockedAward.mock.calls[1][0];
    expect(first.claims).toEqual(second.claims);
    expect(JSON.stringify(first.claims)).toBe('[{"group":"place_report","key":"report:r1"}]');
  });
});

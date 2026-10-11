/**
 * P2/T09 — Accroches producteurs : faits serveur exigés avant toute attribution.
 *   (a) session non traitée → aucun crédit, aucune décision ;
 *   (b) session traitée 90 min → palier 70 + nouveauté +20, claim route_novelty ;
 *   (b2) parcours déjà parcouru cette saison → palier seul, aucun claim ;
 *   (b3) tracé non plausible (téléphone immobile) → refus ;
 *   (b4) durée < 20 min → refus ;
 *   (c) débrief kit sans session traitée → refus ;
 *   (d) débrief kit sur session traitée → équipements DISTINCTS (et non le
 *       nombre de lignes) et date du dernier enregistrement ;
 *   (e) activité préparée → clé (user, route) ;
 *   (f) avis de lieu → clé (place), sans collision inter-utilisateurs.
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
  reports?: Array<Record<string, unknown>>;
  claim?: unknown;
  season?: unknown;
}

function builder() {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.maybeSingle = (value: unknown) => Promise.resolve({ data: value ?? null, error: null });
  return b;
}

function createSupabaseMock(data: TableData) {
  return {
    from: (table: string) => {
      if (table === 'hike_sessions') {
        const b = builder();
        b.maybeSingle = () => Promise.resolve({ data: data.session ?? null, error: null });
        return b;
      }
      if (table === 'progression_claims') {
        const b = builder();
        b.maybeSingle = () => Promise.resolve({ data: data.claim ?? null, error: null });
        return b;
      }
      if (table === 'progression_seasons') {
        const b = builder();
        b.maybeSingle = () => Promise.resolve({ data: data.season ?? null, error: null });
        return b;
      }
      if (table === 'kit_field_reports') {
        const b = builder();
        b.eq = () => Promise.resolve({ data: data.reports ?? [], error: null });
        return b;
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

  it('(b) session 90 min plausible, nouveau parcours → palier 70 + nouveauté 20', async () => {
    mockedGetService.mockReturnValue(
      createSupabaseMock({
        session: {
          user_id: 'u1',
          ended_at: '2026-09-19T08:00:00.000Z',
          processing_status: 'processed',
          duration_seconds: 5400,
          track_quality: { plausibleMovement: 0.9 },
          route_id: 42,
        },
        season: null,
        claim: null,
      }) as never
    );

    await awardHikeSessionProcessed('s1');

    expect(mockedAward).toHaveBeenCalledTimes(1);
    const input = mockedAward.mock.calls[0][0];
    expect(input.action).toBe('hike_session_processed');
    expect(input.sourceType).toBe('hike_session');
    expect(input.sourceId).toBe('s1');
    expect(input.bonus).toBe(50); // (70 − 40) + 20
    expect(input.claims).toEqual([{ group: 'route_novelty', key: 'y2026:route:42' }]);
    expect(input.effectiveAt).toBe('2026-09-19T08:00:00.000Z');
    expect(input.metadata).toMatchObject({
      activeMinutes: 90,
      tierPoints: 70,
      novelty: true,
      plausibleMovement: 0.9,
      routeId: 42,
    });
  });

  it('(b2) parcours déjà parcouru dans la saison → palier seul, aucun claim', async () => {
    mockedGetService.mockReturnValue(
      createSupabaseMock({
        session: {
          user_id: 'u1',
          ended_at: '2026-10-02T08:00:00.000Z',
          processing_status: 'processed',
          duration_seconds: 7200,
          track_quality: { plausibleMovement: 0.8 },
          route_id: 42,
        },
        season: { id: 'season_2026_s1' },
        claim: { id: 'claim-1' },
      }) as never
    );

    await awardHikeSessionProcessed('s1');

    const input = mockedAward.mock.calls[0][0];
    expect(input.bonus).toBe(60); // (100 − 40) + 0
    expect(input.claims).toEqual([]);
    expect(input.metadata).toMatchObject({ tierPoints: 100, novelty: false });
  });

  it('(b3) tracé non plausible → refus sans attribution', async () => {
    mockedGetService.mockReturnValue(
      createSupabaseMock({
        session: {
          user_id: 'u1',
          ended_at: '2026-09-19T08:00:00.000Z',
          processing_status: 'processed',
          duration_seconds: 5400,
          track_quality: { plausibleMovement: 0.2 },
          route_id: 42,
        },
      }) as never
    );

    const result = await awardHikeSessionProcessed('s1');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('mouvement_non_plausible');
    expect(mockedAward).not.toHaveBeenCalled();
  });

  it('(b4) durée active < 20 min → refus', async () => {
    mockedGetService.mockReturnValue(
      createSupabaseMock({
        session: {
          user_id: 'u1',
          ended_at: '2026-09-19T08:00:00.000Z',
          processing_status: 'processed',
          duration_seconds: 600,
          track_quality: { plausibleMovement: 0.9 },
          route_id: null,
        },
      }) as never
    );

    const result = await awardHikeSessionProcessed('s1');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('duree_insuffisante');
    expect(mockedAward).not.toHaveBeenCalled();
  });

  it('(c) débrief kit sans session traitée → refus sans crédit', async () => {
    mockedGetService.mockReturnValue(
      createSupabaseMock({
        session: { user_id: 'u1', kit_id: 'k1', processing_status: 'processing' },
      }) as never
    );

    const result = await awardKitFieldReport('s1');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('session_non_traitee');
    expect(mockedAward).not.toHaveBeenCalled();
  });

  it('(d) débrief sur session traitée → équipements distincts et date du dernier item', async () => {
    mockedGetService.mockReturnValue(
      createSupabaseMock({
        session: { user_id: 'u1', kit_id: 'k1', processing_status: 'processed' },
        reports: [
          { item_key: 'tente', created_at: '2026-09-19T18:00:00.000Z' },
          { item_key: 'tente', created_at: '2026-09-19T18:05:00.000Z' },
          { item_key: 'rechaud', created_at: '2026-09-19T18:20:00.000Z' },
        ],
      }) as never
    );

    await awardKitFieldReport('s1');

    const input = mockedAward.mock.calls[0][0];
    expect(input.action).toBe('kit_field_report');
    expect(input.sourceType).toBe('kit_report');
    expect(input.sourceId).toBe('s1');
    expect(input.bonus).toBe(4); // 2 équipements distincts
    expect(input.effectiveAt).toBe('2026-09-19T18:20:00.000Z');
    expect(input.metadata).toMatchObject({ kitId: 'k1', items: 2 });
  });

  it('(e) activité préparée → clé stable (user, route)', async () => {
    await awardTrailPrepared('u1', 42, 'trip-1');

    const input = mockedAward.mock.calls[0][0];
    expect(input.action).toBe('trail_prepared');
    expect(input.sourceId).toBe('u1:42');
    expect(input.metadata).toEqual({ routeId: '42', tripId: 'trip-1' });
  });

  it('(f) avis de lieu → clé stable (auteur, place), sans collision inter-utilisateurs', async () => {
    await awardPlaceReview('u1', 'place-9');
    await awardPlaceReview('u2', 'place-9');

    const first = mockedAward.mock.calls[0][0];
    const second = mockedAward.mock.calls[1][0];
    expect(first.action).toBe('place_review');
    expect(first.sourceId).toBe('u1:place-9');
    expect(second.sourceId).toBe('u2:place-9');
    expect(first.sourceId).not.toBe(second.sourceId);
  });
});

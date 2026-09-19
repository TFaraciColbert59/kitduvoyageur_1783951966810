/**
 * P2 — Producteurs « à compléter » (spec §3.2) : preuve serveur exigée avant
 * toute attribution, clés d'idempotence stables, erreurs avalées.
 *   (a) carnet privé → refus ;
 *   (b) carnet publié sans lien voyage/session → refus ;
 *   (c) carnet publié lié mais contenu insuffisant → refus ;
 *   (d) carnet public lié avec ≥ 3 moments → gain Partager, clé `carnet:<id>` ;
 *   (e) carnet public avec média (image de moment) → gain ;
 *   (f) checklist sur voyage draft → refus ;
 *   (g) checklist incomplète → refus ;
 *   (h) checklist vide → refus ;
 *   (i) checklist 100 % sur voyage planned → gain Se préparer, clé `checklist:<trip>` ;
 *   (j) voyage actif → refus de « voyage terminé » ;
 *   (k) voyage completed sans preuve → refus ;
 *   (l) session traitée liée → gain Explorer/Se préparer, clé `trip:<trip>` ;
 *   (m) POI visité seul → gain.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/features/progression/server/awardProducer', () => ({ awardProducerGain: vi.fn() }));

import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { awardProducerGain } from '@/features/progression/server/awardProducer';
import {
  awardCarnetPublished,
  awardChecklistCompleted,
  awardTripCompleted,
} from '@/features/progression/server/producerHooks';

const mockedGetService = vi.mocked(getServiceSupabase);
const mockedAward = vi.mocked(awardProducerGain);

interface CompletionData {
  carnet?: Record<string, unknown> | null;
  moments?: Array<Record<string, unknown>>;
  mediaCount?: number;
  sessionCarnetCount?: number;
  trip?: Record<string, unknown> | null;
  items?: Array<Record<string, unknown>>;
  processedSessions?: number;
  visitedPois?: number;
}

function createSupabaseMock(data: CompletionData) {
  const singleBuilder = (row: unknown) => {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.maybeSingle = () => Promise.resolve({ data: row ?? null, error: null });
    return builder;
  };

  const rowsBuilder = (rows: unknown[]) => {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve);
    return builder;
  };

  const countBuilder = (count: number) => {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.then = (resolve: (value: { count: number; error: null }) => unknown) =>
      Promise.resolve({ count, error: null }).then(resolve);
    return builder;
  };

  const hikeSessionsBuilder = () => {
    const filters: Record<string, unknown> = {};
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = (column: string, value: unknown) => {
      filters[column] = value;
      return builder;
    };
    builder.then = (resolve: (value: { count: number; error: null }) => unknown) => {
      const count =
        'processing_status' in filters
          ? data.processedSessions ?? 0
          : data.sessionCarnetCount ?? 0;
      return Promise.resolve({ count, error: null }).then(resolve);
    };
    return builder;
  };

  return {
    from: (table: string) => {
      switch (table) {
        case 'carnets':
          return singleBuilder(data.carnet);
        case 'carnet_moments':
          return rowsBuilder(data.moments ?? []);
        case 'carnet_media':
          return countBuilder(data.mediaCount ?? 0);
        case 'hike_sessions':
          return hikeSessionsBuilder();
        case 'trips':
          return singleBuilder(data.trip);
        case 'trip_checklist_items':
          return rowsBuilder(data.items ?? []);
        case 'trip_pois':
          return countBuilder(data.visitedPois ?? 0);
        default:
          throw new Error(`table inattendue: ${table}`);
      }
    },
  };
}

function useService(data: CompletionData) {
  mockedGetService.mockReturnValue(createSupabaseMock(data) as never);
}

describe('producerHooksCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAward.mockResolvedValue({ success: true, outcome: 'awarded' });
  });

  describe('carnet publié', () => {
    it('(a) carnet privé → refus sans attribution', async () => {
      useService({
        carnet: { author_id: 'u1', visibility: 'private', trip_id: 't1', updated_at: '2026-09-19T10:00:00.000Z' },
      });

      const result = await awardCarnetPublished('c1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('carnet_non_publie');
      expect(mockedAward).not.toHaveBeenCalled();
    });

    it('(b) carnet publié sans lien voyage/session → refus', async () => {
      useService({
        carnet: { author_id: 'u1', visibility: 'public', trip_id: null, updated_at: '2026-09-19T10:00:00.000Z' },
        moments: [{ id: 'm1', hike_session_id: null }, { id: 'm2' }, { id: 'm3' }],
      });

      const result = await awardCarnetPublished('c1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('carnet_non_rattache');
      expect(mockedAward).not.toHaveBeenCalled();
    });

    it('(c) carnet publié lié mais contenu insuffisant → refus', async () => {
      useService({
        carnet: { author_id: 'u1', visibility: 'public', trip_id: 't1', updated_at: '2026-09-19T10:00:00.000Z' },
        moments: [{ id: 'm1', hike_session_id: null }, { id: 'm2' }],
      });

      const result = await awardCarnetPublished('c1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('contenu_insuffisant');
      expect(mockedAward).not.toHaveBeenCalled();
    });

    it('(d) carnet public lié avec ≥ 3 moments → gain Partager, clé carnet:<id>', async () => {
      useService({
        carnet: {
          author_id: 'u1',
          visibility: 'public',
          trip_id: 't1',
          created_at: '2026-09-18T08:00:00.000Z',
          updated_at: '2026-09-19T10:00:00.000Z',
        },
        moments: [
          { id: 'm1', hike_session_id: null },
          { id: 'm2', hike_session_id: null },
          { id: 'm3', hike_session_id: null },
        ],
      });

      await awardCarnetPublished('c1');

      expect(mockedAward).toHaveBeenCalledTimes(1);
      const input = mockedAward.mock.calls[0][0];
      expect(input.action).toBe('carnet_published');
      expect(`${input.sourceType}:${input.sourceId}`).toBe('carnet:c1');
      expect(input.userId).toBe('u1');
      expect(input.effectiveAt).toBe('2026-09-19T10:00:00.000Z');
      expect(input.metadata).toMatchObject({ moments: 3, tripId: 't1', visibility: 'public' });
    });

    it('(e) carnet public avec média (image de moment) → gain', async () => {
      useService({
        carnet: { author_id: 'u1', visibility: 'friends', trip_id: null, updated_at: '2026-09-19T10:00:00.000Z' },
        moments: [{ id: 'm1', hike_session_id: 's1', image_url: 'https://cdn.example/img.jpg' }],
        sessionCarnetCount: 1,
      });

      await awardCarnetPublished('c1');

      const input = mockedAward.mock.calls[0][0];
      expect(input.action).toBe('carnet_published');
      expect(`${input.sourceType}:${input.sourceId}`).toBe('carnet:c1');
      expect(input.metadata).toMatchObject({ moments: 1, momentsWithImage: 1 });
    });
  });

  describe('checklist complétée', () => {
    it('(f) voyage draft → refus sans attribution', async () => {
      useService({
        trip: { user_id: 'u1', status: 'draft' },
        items: [{ id: 'i1', done: true, done_at: '2026-09-19T09:00:00.000Z' }],
      });

      const result = await awardChecklistCompleted('t1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('voyage_hors_preparation');
      expect(mockedAward).not.toHaveBeenCalled();
    });

    it('(g) checklist incomplète → refus', async () => {
      useService({
        trip: { user_id: 'u1', status: 'planned' },
        items: [
          { id: 'i1', done: true, done_at: '2026-09-19T09:00:00.000Z' },
          { id: 'i2', done: false, done_at: null },
        ],
      });

      const result = await awardChecklistCompleted('t1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('checklist_incomplete');
      expect(mockedAward).not.toHaveBeenCalled();
    });

    it('(h) checklist vide → refus', async () => {
      useService({ trip: { user_id: 'u1', status: 'active' }, items: [] });

      const result = await awardChecklistCompleted('t1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('checklist_vide');
      expect(mockedAward).not.toHaveBeenCalled();
    });

    it('(i) 100 % des items sur voyage planned → gain Se préparer, clé checklist:<trip>', async () => {
      useService({
        trip: { user_id: 'u1', status: 'planned' },
        items: [
          { id: 'i1', done: true, done_at: '2026-09-17T09:00:00.000Z' },
          { id: 'i2', done: true, done_at: '2026-09-19T09:00:00.000Z' },
          { id: 'i3', done: true, done_at: '2026-09-18T09:00:00.000Z' },
        ],
      });

      await awardChecklistCompleted('t1');

      expect(mockedAward).toHaveBeenCalledTimes(1);
      const input = mockedAward.mock.calls[0][0];
      expect(input.action).toBe('checklist_completed');
      expect(`${input.sourceType}:${input.sourceId}`).toBe('checklist:t1');
      expect(input.userId).toBe('u1');
      expect(input.effectiveAt).toBe('2026-09-19T09:00:00.000Z');
      expect(input.metadata).toEqual({ items: 3 });
    });
  });

  describe('voyage terminé', () => {
    it('(j) voyage actif → refus sans attribution', async () => {
      useService({
        trip: { user_id: 'u1', status: 'active', updated_at: '2026-09-19T10:00:00.000Z' },
        processedSessions: 1,
      });

      const result = await awardTripCompleted('t1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('voyage_non_termine');
      expect(mockedAward).not.toHaveBeenCalled();
    });

    it('(k) voyage completed sans preuve de terrain → refus', async () => {
      useService({
        trip: { user_id: 'u1', status: 'completed', updated_at: '2026-09-19T10:00:00.000Z' },
        items: [],
        processedSessions: 0,
        visitedPois: 0,
      });

      const result = await awardTripCompleted('t1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('aucune_preuve');
      expect(mockedAward).not.toHaveBeenCalled();
    });

    it('(l) session traitée liée au voyage → gain Explorer+Se préparer, clé trip:<trip>', async () => {
      useService({
        trip: { user_id: 'u1', status: 'completed', updated_at: '2026-09-19T10:00:00.000Z' },
        processedSessions: 1,
      });

      await awardTripCompleted('t1');

      expect(mockedAward).toHaveBeenCalledTimes(1);
      const input = mockedAward.mock.calls[0][0];
      expect(input.action).toBe('trip_completed');
      expect(`${input.sourceType}:${input.sourceId}`).toBe('trip:t1');
      expect(input.userId).toBe('u1');
      expect(input.effectiveAt).toBe('2026-09-19T10:00:00.000Z');
      expect(input.metadata).toMatchObject({ processedSessions: 1, visitedPois: 0 });
    });

    it('(m) POI visité seul (checklist incomplète) → gain', async () => {
      useService({
        trip: { user_id: 'u1', status: 'completed', updated_at: '2026-09-19T10:00:00.000Z' },
        items: [{ id: 'i1', done: false }],
        processedSessions: 0,
        visitedPois: 2,
      });

      await awardTripCompleted('t1');

      const input = mockedAward.mock.calls[0][0];
      expect(input.action).toBe('trip_completed');
      expect(input.metadata).toMatchObject({ visitedPois: 2, checklistCompleted: false });
    });
  });
});

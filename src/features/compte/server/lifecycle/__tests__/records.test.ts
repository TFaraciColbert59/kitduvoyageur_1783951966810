import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyOverlay,
  loadActivityPoints,
  loadSourceHistory,
  loadSourceRecord,
  mergeHistoryWithOverlays,
  overlayToRecord,
} from '../records';
import { createMemoryLifecycleStore } from '../store';
import { makeRecord } from '@/components/compte/lifecycle/__tests__/fixtures';

type QueryResult = { data: unknown; error: null };

/**
 * Faux client Supabase : chaque table renvoie son résultat, la chaîne
 * PostgREST est thenable jusqu'au terminal (`maybeSingle`, `range`, `limit`).
 */
function fakeSupabase(
  results: Record<string, QueryResult | ((state: { offset: number }) => QueryResult)>
) {
  const state = { offset: 0 };
  function builderFor(table: string) {
    const builder: Record<string, unknown> = {};
    const resolve = () => {
      const value = results[table] ?? { data: null, error: null };
      return typeof value === 'function' ? value(state) : value;
    };
    for (const method of ['select', 'eq', 'not', 'order', 'limit', 'in', 'range']) {
      builder[method] = (...args: unknown[]) => {
        if (method === 'range') state.offset = Number(args[0] ?? 0);
        return builder;
      };
    }
    builder.maybeSingle = async () => resolve();
    builder.then = (onFulfilled: (value: QueryResult) => unknown) =>
      Promise.resolve(resolve()).then(onFulfilled);
    return builder;
  }
  return {
    from(table: string) {
      return builderFor(table);
    },
  } as unknown as SupabaseClient;
}

const HIKE_ROW = {
  id: 'hike-1',
  user_id: 'user-1',
  route_id: 42,
  title: 'Ancienne randonnée',
  started_at: '2026-08-10T07:00:00.000Z',
  ended_at: '2026-08-10T11:00:00.000Z',
  distance_km: 14.5,
  duration_seconds: 14_400,
  elevation_gain_m: 680,
  max_altitude_m: 1_950,
  positions_timed: null,
  positions_geojson: null,
  visibility: 'private',
  kit_id: null,
  notes: null,
  variant_id: null,
  activity_session_id: null,
};

const ACTIVITY_ROW = {
  id: 'act-1',
  user_id: 'user-1',
  sport: 'trail',
  variant_id: 'trail-10k',
  route_id: 42,
  status: 'finished',
  started_at: '2026-09-01T07:00:00.000Z',
  ended_at: '2026-09-01T08:00:00.000Z',
  distance_m: 9_800,
  elev_gain_m: 420,
  moving_s: 3_300,
  share_level: 'none',
  client_session_id: 'client-1',
  created_at: '2026-09-01T07:00:00.000Z',
  updated_at: '2026-09-01T08:00:00.000Z',
};

describe('A02 — adaptateur de lecture des tables sources', () => {
  it('normalise une randonnée historique et une séance Explorer avec leur route', async () => {
    const supabase = fakeSupabase({
      hike_sessions: { data: [HIKE_ROW], error: null },
      activity_sessions: { data: [ACTIVITY_ROW], error: null },
      hiking_routes: {
        data: [{ id: 42, name: 'Tour du Vercors', region: 'Vercors' }],
        error: null,
      },
    });

    const sources = await loadSourceHistory(supabase, 'user-1', {
      nowMs: Date.parse('2026-09-12T12:00:00.000Z'),
    });

    expect(sources.legacy).toHaveLength(1);
    expect(sources.legacy[0].id).toBe('hike-1');
    expect(sources.legacy[0].routeName).toBe('Tour du Vercors');
    expect(sources.legacy[0].massif).toBe('Vercors');
    expect(sources.explorer).toHaveLength(1);
    expect(sources.explorer[0].sport).toBe('trail');
    expect(sources.explorer[0].visibility).toBe('private');
    expect(sources.explorer[0].stats.distanceM).toBe(9_800);
    expect(sources.explorer[0].provenance.clientSessionId).toBe('client-1');
  });

  it('écarte le résumé hike_sessions lié à une séance Explorer présente (pas de doublon)', async () => {
    const linked = { ...HIKE_ROW, id: 'hike-linked', activity_session_id: 'act-1' };
    const supabase = fakeSupabase({
      hike_sessions: { data: [linked, HIKE_ROW], error: null },
      activity_sessions: { data: [ACTIVITY_ROW], error: null },
      hiking_routes: { data: [], error: null },
    });

    const sources = await loadSourceHistory(supabase, 'user-1');
    expect(sources.legacy.map((row) => row.id)).toEqual(['hike-1']);
    expect(sources.explorer.map((row) => row.id)).toEqual(['act-1']);
  });

  it('charge la trace paginée d’une séance Explorer sans inventer de valeur', async () => {
    const supabase = fakeSupabase({
      activity_points: {
        data: [
          { t: '2026-09-01T07:00:00.000Z', lat: 45.1, lng: 6.1, ele: 1200, acc: 5, speed: 2.5 },
          {
            t: '2026-09-01T07:00:30.000Z',
            lat: 45.101,
            lng: 6.1,
            ele: null,
            acc: null,
            speed: null,
          },
        ],
        error: null,
      },
    });

    const points = await loadActivityPoints(supabase, 'act-1');
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ lat: 45.1, lng: 6.1, elevationM: 1200, speedMs: 2.5 });
    expect(points[1].elevationM).toBeNull();
  });

  it('charge une séance précise avec sa trace complète', async () => {
    const supabase = fakeSupabase({
      hike_sessions: { data: null, error: null },
      activity_sessions: { data: ACTIVITY_ROW, error: null },
      hiking_routes: {
        data: [{ id: 42, name: 'Tour du Vercors', region: 'Vercors' }],
        error: null,
      },
      activity_points: {
        data: [
          { t: '2026-09-01T07:00:00.000Z', lat: 45.1, lng: 6.1, ele: 1200, acc: 5, speed: 2.5 },
        ],
        error: null,
      },
    });

    const record = await loadSourceRecord(
      supabase,
      'user-1',
      'act-1',
      Date.parse('2026-09-12T12:00:00.000Z')
    );
    expect(record?.id).toBe('act-1');
    expect(record?.points).toHaveLength(1);
    expect(record?.routeName).toBe('Tour du Vercors');
  });

  it('fusionne surcouche et sources sans doublon, la surcouche gagne', () => {
    const base = makeRecord();
    const overlayRecord = { ...base, title: 'Surcouche', revision: base.revision + 1 };
    const overlay = {
      userId: base.userId,
      activityId: base.id,
      parentActivityId: null,
      source: base.provenance.origin,
      revision: overlayRecord.revision,
      lifecycleStatus: 'active' as const,
      deletedAt: null,
      purgeAfter: null,
      record: overlayRecord,
      operationId: null,
      updatedAt: '2026-09-12T12:00:00.000Z',
    };
    const merged = mergeHistoryWithOverlays({ legacy: [], explorer: [base] }, [overlay]);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('Surcouche');
    expect(overlayToRecord(overlay).revision).toBe(overlayRecord.revision);
    expect(applyOverlay(base, overlay)?.title).toBe('Surcouche');
    expect(applyOverlay(base, null)?.id).toBe(base.id);
    expect(applyOverlay(null, overlay)?.title).toBe('Surcouche');
  });

  it('un store mémoire ne fuit jamais une surcouche d’un autre propriétaire', async () => {
    const base = makeRecord();
    const store = createMemoryLifecycleStore();
    await store.saveOverlay({
      userId: base.userId,
      activityId: base.id,
      parentActivityId: null,
      source: base.provenance.origin,
      revision: base.revision,
      lifecycleStatus: 'active',
      deletedAt: null,
      purgeAfter: null,
      record: base,
      operationId: null,
      updatedAt: new Date().toISOString(),
    });
    expect(await store.getOverlay('other-user', base.id)).toBeNull();
    expect(await store.listOverlays('other-user')).toHaveLength(0);
  });
});

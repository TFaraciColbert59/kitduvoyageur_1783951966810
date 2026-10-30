import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { buildGdprExport, createSupabaseGdprExportClient, GdprExportIncompleteError } from '@/server/gdprExport';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { GET as accountExport } from '@/app/api/account/export/route';
import { GET as legacyExport } from '@/app/api/user/export/route';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));

type Row = Record<string, unknown>;

/** Real supabase-js adapter over an isolated PostgREST HTTP fixture, never a server. */
function postgrest(rows: Record<string, Row[]>, cap = 1000,
  intercept?: (table: string, offset: number, filtered: Row[]) => Response | undefined) {
  const calls: URL[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    const table = url.pathname.split('/').at(-1)!;
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const requested = Number(url.searchParams.get('limit') ?? cap);
    let filtered = [...(rows[table] ?? [])];
    for (const [column, filter] of url.searchParams) {
      if (filter.startsWith('eq.')) filtered = filtered.filter((row) => String(row[column]) === filter.slice(3));
      if (filter.startsWith('in.(')) {
        const values = filter.slice(4, -1).split(',').map((value) => value.replaceAll('"', ''));
        filtered = filtered.filter((row) => values.includes(String(row[column])));
      }
    }
    for (const spec of (url.searchParams.get('order') ?? '').split(',').reverse()) {
      const column = spec.split('.')[0];
      if (column) filtered.sort((a, b) => String(a[column]).localeCompare(String(b[column])));
    }
    const intercepted = intercept?.(table, offset, filtered);
    if (intercepted) return intercepted;
    const page = filtered.slice(offset, offset + Math.min(cap, requested));
    // maybeSingle requests use the object media type.
    const body = table === 'user_profiles' ? (page[0] ?? null) : page;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-range': `${offset}-${offset + page.length - 1}/${filtered.length}`,
      },
    });
  });
  return {
    calls,
    client: createClient('https://gdpr-fixture.invalid', 'synthetic-public-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetcher },
    }),
  };
}

const subject = 'subject';
const row = (id: number, extra: Row = {}) => ({ id: String(id).padStart(6, '0'), user_id: subject, ...extra });

describe('VA-02 — bounded complete GDPR export through the real Supabase adapter', () => {
  it.each([1000, 37])('exports 1001 subject rows under API cap %i in deterministic order', async (cap) => {
    const fixture = postgrest({ hike_sessions: [
      ...Array.from({ length: 1001 }, (_, i) => row(1001 - i)),
      row(0, { user_id: 'unrelated' }),
    ] }, cap);
    const bundle = await buildGdprExport(createSupabaseGdprExportClient(fixture.client), subject);
    expect(bundle.tables.hike_sessions).toHaveLength(1001);
    expect(bundle.counts.hike_sessions).toBe(1001);
    expect(bundle.tables.hike_sessions.map((entry) => entry.id)).toEqual(
      Array.from({ length: 1001 }, (_, i) => row(i + 1).id)
    );
    expect(fixture.calls.filter((url) => url.pathname.endsWith('/hike_sessions')).length).toBeGreaterThan(1);
  });

  it('paginates plan children across owned plans and excludes unrelated plan data', async () => {
    const fixture = postgrest({
      adventure_plans: [row(1, { owner_id: subject }), row(2, { owner_id: subject }), row(3, { owner_id: 'unrelated' })],
      adventure_plan_versions: [
        ...Array.from({ length: 1203 }, (_, i) => row(i, { plan_id: row(i % 2 + 1).id })),
        row(9999, { plan_id: row(3).id }),
      ],
    });
    const bundle = await buildGdprExport(createSupabaseGdprExportClient(fixture.client), subject);
    expect(bundle.plans).toHaveLength(2);
    const versions = bundle.plans.flatMap((plan) => plan.versions);
    expect(versions).toHaveLength(1203);
    expect(versions.some((entry) => entry.plan_id === row(3).id)).toBe(false);
    expect(bundle.counts.adventure_plan_versions).toBe(1203);
    expect(bundle.counts.total).toBe(1205);
  });

  it('orders composite primary keys without assuming every table has an id', async () => {
    const fixture = postgrest({ offline_sync_operations: [
      { user_id: subject, idempotency_key: 'b' },
      { user_id: subject, idempotency_key: 'a' },
    ], progression_leaderboard_agg: [
      { user_id: subject, season_id: '2', scope_type: 'world', scope_id: '' },
      { user_id: subject, season_id: '1', scope_type: 'world', scope_id: '' },
    ] }, 1);
    const client = createSupabaseGdprExportClient(fixture.client);
    expect((await client.selectByUser('offline_sync_operations', 'user_id', subject)).map((entry) => entry.idempotency_key)).toEqual(['a', 'b']);
    expect((await client.selectByUser('progression_leaderboard_agg', 'user_id', subject)).map((entry) => entry.season_id)).toEqual(['1', '2']);
  });

  it('rejects a later page failure instead of returning a partial bundle', async () => {
    const fixture = postgrest({ hike_sessions: Array.from({ length: 1001 }, (_, i) => row(i)) }, 1000,
      (table, offset) => table === 'hike_sessions' && offset > 0
        ? new Response(JSON.stringify({ code: '42501', message: 'fixture access denied' }), { status: 403 }) : undefined);
    await expect(buildGdprExport(createSupabaseGdprExportClient(fixture.client), subject)).rejects.toThrow();
  });

  it.each([
    ['missing total', { body: [row(251)], total: '*' }],
    ['changed total', { body: [row(251)], total: '502' }],
    ['premature empty page', { body: [], total: '501' }],
    ['repeated page', { body: [row(0)], total: '501' }],
  ])('fails closed for %s', async (_, response) => {
    const fixture = postgrest({ hike_sessions: Array.from({ length: 501 }, (_, i) => row(i)) }, 250,
      (table, offset) => table === 'hike_sessions' && offset > 0
        ? new Response(JSON.stringify(response.body), {
          headers: { 'content-type': 'application/json', 'content-range': `${offset}-${offset}/${response.total}` },
        }) : undefined);
    await expect(createSupabaseGdprExportClient(fixture.client)
      .selectByUser('hike_sessions', 'user_id', subject)).rejects.toBeInstanceOf(GdprExportIncompleteError);
  });

  it.each([
    { maxRows: 2 },
    { maxBytes: 10 },
    { maxRequests: 1 },
  ])('bounds the whole export, not individual tables: %j', async (limits) => {
    const fixture = postgrest({
      hike_sessions: [row(1), row(2)], saved_trails: [row(3)],
    });
    await expect(buildGdprExport(createSupabaseGdprExportClient(fixture.client, limits), subject))
      .rejects.toBeInstanceOf(GdprExportIncompleteError);
  });

  it('times out an in-flight HTTP read without returning collected rows', async () => {
    const supabase = createClient('https://gdpr-fixture.invalid', 'synthetic-public-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (_input, init) => new Promise((_resolve, reject) => {
        const abort = () => reject(new DOMException('fixture aborted', 'AbortError'));
        if (init?.signal?.aborted) abort();
        else init?.signal?.addEventListener('abort', abort, { once: true });
      }) },
    });
    await expect(createSupabaseGdprExportClient(supabase, { timeoutMs: 10 })
      .selectByUser('hike_sessions', 'user_id', subject)).rejects.toBeInstanceOf(GdprExportIncompleteError);
  });

  it('batches large sets of owned plan ids while exporting every child', async () => {
    const fixture = postgrest({
      adventure_plans: Array.from({ length: 203 }, (_, i) => row(i, { owner_id: subject })),
      adventure_plan_versions: Array.from({ length: 203 }, (_, i) => row(i, { plan_id: row(i).id })),
    });
    const bundle = await buildGdprExport(createSupabaseGdprExportClient(fixture.client), subject);
    expect(bundle.plans.flatMap((plan) => plan.versions)).toHaveLength(203);
    const childQueries = fixture.calls.filter((url) => url.pathname.endsWith('/adventure_plan_versions'));
    expect(childQueries).toHaveLength(3);
    expect(childQueries.every((url) => url.searchParams.get('plan_id')!.split(',').length <= 100)).toBe(true);
  });

  it.each([['account', accountExport], ['legacy', legacyExport]])(
    '%s route returns an explicit noncacheable error after a later-page failure', async (_, handler) => {
      const fixture = postgrest({ hike_sessions: Array.from({ length: 501 }, (_, i) => row(i)) }, 250,
        (table, offset) => table === 'hike_sessions' && offset > 0
          ? new Response(JSON.stringify({ code: '42501', message: 'private fixture database detail' }), { status: 403 }) : undefined);
      vi.mocked(createSessionClient).mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: subject } }, error: null }) },
      } as never);
      vi.mocked(getServiceSupabase).mockReturnValue(fixture.client);
      const response = await handler();
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.has('content-disposition')).toBe(false);
      const body = await response.json();
      expect(body.code).toBe('EXPORT_INCOMPLETE');
      expect(JSON.stringify(body)).not.toContain('private fixture database detail');
      expect(body.tables).toBeUndefined();
    }
  );

  it.each([['account', accountExport], ['legacy', legacyExport]])(
    '%s route does not construct a service client without an authenticated user', async (_, handler) => {
      vi.mocked(getServiceSupabase).mockClear();
      vi.mocked(createSessionClient).mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      } as never);
      expect((await handler()).status).toBe(401);
      expect(getServiceSupabase).not.toHaveBeenCalled();
    }
  );
});

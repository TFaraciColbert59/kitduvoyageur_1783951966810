/**
 * Plan 100, 1.1 (crons) — le répartiteur appelle de VRAIS gestionnaires de
 * route, pas des doublures : l'en-tête `Authorization: Bearer` qu'il pose est
 * accepté par la route (GET et POST), un autre secret est refusé (401), et le
 * résumé ne garde que les compteurs. Seul le client Supabase est remplacé
 * (aucune base, aucun réseau).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const SECRET = 'secret-de-test-0123456789abcdef';

const queries: string[] = [];

/** Client Supabase factice : toute chaîne de requête se résout en « rien à faire ». */
function chain(table: string): unknown {
  const proxy: unknown = new Proxy(() => {}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: { data: unknown[]; error: null }) => void) => resolve({ data: [], error: null });
      }
      return () => proxy;
    },
    apply: () => proxy,
  });
  queries.push(table);
  return proxy;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (table: string) => chain(table) }),
}));

import { runDailyTasks } from '../dailyDispatcher';
import { DAILY_CRON_TASKS, buildDailyTasks } from '../dailyTasks';

const real = (...names: string[]) => DAILY_CRON_TASKS.filter((t) => names.includes(t.name));

function incoming(): NextRequest {
  return new NextRequest('http://localhost/api/cron/daily', { headers: { authorization: `Bearer ${SECRET}` } });
}

describe('répartiteur → vraies routes', () => {
  beforeEach(() => {
    queries.length = 0;
    vi.stubEnv('CRON_SECRET', SECRET);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://supabase.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'cle-de-test-sans-valeur');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('une route GET et une route GET de nettoyage acceptent le Bearer posé par le répartiteur', async () => {
    const tasks = buildDailyTasks(incoming(), SECRET, real('expire-live-positions', 'cleanup-ephemeral-groups'));
    const summary = await runDailyTasks(tasks, { log: () => {} });
    expect(summary.ok).toBe(true);
    expect(summary.tasks.map((t) => [t.name, t.status, t.httpStatus])).toEqual([
      ['expire-live-positions', 'ok', 200],
      ['cleanup-ephemeral-groups', 'ok', 200],
    ]);
    expect(summary.tasks[0].counters).toEqual({ positions: 0, sessions: 0 });
    expect(summary.tasks[1].counters).toEqual({ deleted: 0 });
    expect(queries).toContain('group_live_positions');
    expect(queries).toContain('travel_groups');
  });

  it('un autre secret que CRON_SECRET est refusé (401) par la vraie route : rien n’est lu ni supprimé', async () => {
    const tasks = buildDailyTasks(incoming(), 'un-autre-secret-0123456789', real('expire-live-positions', 'cleanup-ephemeral-groups'));
    const summary = await runDailyTasks(tasks, { log: () => {} });
    expect(summary.ok).toBe(false);
    expect(summary.tasks.map((t) => [t.status, t.httpStatus, t.reason])).toEqual([
      ['failed', 401, 'http_401'],
      ['failed', 401, 'http_401'],
    ]);
    expect(queries).toEqual([]);
  });

  it('la méthode déclarée est celle que la vraie route exporte : POST ici, 401 sans bon secret', async () => {
    const [post] = real('expire-terrain-reports');
    expect(post.method).toBe('POST');
    const loaded = await post.load();
    const res = await (loaded.POST as (r: Request) => Promise<Response>)(
      new NextRequest('http://localhost/api/cron/expire-terrain-reports', { method: 'POST' })
    );
    expect(res.status).toBe(401);
  });
});

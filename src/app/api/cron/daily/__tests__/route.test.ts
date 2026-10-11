/**
 * Plan 100, 1.1 (crons) — GET /api/cron/daily : l'unique cron planifié.
 *
 *   (a) refus sans secret configuré, sans en-tête ou avec un mauvais secret ;
 *   (b) les tâches s'enchaînent dans l'ordre, chacune avec le Bearer vérifié ;
 *   (c) une tâche en échec n'arrête pas les autres ;
 *   (d) la réponse ne contient aucune donnée personnelle ni le secret.
 *
 * Les routes réelles sont moquées à la frontière (`dailyTasks`) : aucune base,
 * aucun réseau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const SECRET = 'secret-de-test-0123456789abcdef';

const calls: Array<{ name: string; authorization: string | null; method: string }> = [];
const behaviours = vi.hoisted(
  () => new Map<string, (request: Request) => Promise<Response> | Response>()
);

vi.mock('@/lib/cron/dailyTasks', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cron/dailyTasks')>('@/lib/cron/dailyTasks');
  const make = (name: string, method: 'GET' | 'POST') => ({
    name,
    method,
    load: async () => ({
      [method]: async (request: Request) => {
        calls.push({ name, authorization: request.headers.get('authorization'), method: request.method });
        const behaviour = behaviours.get(name);
        return behaviour ? behaviour(request) : Response.json({ processed: 1 });
      },
    }),
  });
  const registry = [make('purge', 'GET'), make('file', 'POST'), make('vues', 'GET')];
  return {
    ...actual,
    DAILY_CRON_TASKS: registry,
    buildDailyTasks: (request: NextRequest, secret: string) => actual.buildDailyTasks(request, secret, registry),
  };
});

import { GET, maxDuration } from '../route';

function request(authorization?: string): NextRequest {
  return new NextRequest('http://localhost/api/cron/daily', {
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe('GET /api/cron/daily', () => {
  beforeEach(() => {
    calls.length = 0;
    behaviours.clear();
    vi.stubEnv('CRON_SECRET', SECRET);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('est dynamique et déclare une durée dans la limite Hobby (300 s)', () => {
    expect(maxDuration).toBeLessThanOrEqual(300);
  });

  it('refuse (401) sans en-tête, sans lancer aucune tâche', async () => {
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('refuse (401) avec un mauvais secret ou un autre schéma', async () => {
    expect((await GET(request('Bearer pas-le-bon'))).status).toBe(401);
    expect((await GET(request(SECRET))).status).toBe(401);
    expect((await GET(request(`Basic ${SECRET}`))).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('refuse (401) quand CRON_SECRET n’est pas configuré, même avec « Bearer undefined »', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await GET(request('Bearer undefined'))).status).toBe(401);
    expect((await GET(request('Bearer '))).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('enchaîne les tâches dans l’ordre, chacune avec le Bearer et sa méthode', async () => {
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(calls.map((c) => c.name)).toEqual(['purge', 'file', 'vues']);
    expect(calls.map((c) => c.method)).toEqual(['GET', 'POST', 'GET']);
    for (const call of calls) expect(call.authorization).toBe(`Bearer ${SECRET}`);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, total: 3, succeeded: 3, failed: 0, skipped: 0 });
    expect(body.tasks.map((t: { name: string; status: string }) => [t.name, t.status])).toEqual([
      ['purge', 'ok'],
      ['file', 'ok'],
      ['vues', 'ok'],
    ]);
  });

  it('une tâche qui échoue (500, puis exception) n’arrête pas les suivantes ; la réponse passe en 500', async () => {
    behaviours.set('purge', () => Response.json({ error: 'Erreur interne' }, { status: 500 }));
    behaviours.set('file', () => {
      throw new Error('relation "user_x" does not exist (user 5a1c-secret)');
    });
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(calls.map((c) => c.name)).toEqual(['purge', 'file', 'vues']);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, total: 3, succeeded: 1, failed: 2 });
    expect(body.tasks.map((t: { status: string }) => t.status)).toEqual(['failed', 'failed', 'ok']);
    expect(JSON.stringify(body)).not.toContain('5a1c-secret');
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it('ne renvoie ni le secret ni aucune donnée personnelle de la réponse d’une tâche', async () => {
    behaviours.set('purge', () =>
      Response.json({ deleted: 3, email: 'voyageur@example.org', user_id: '2b1f0c9e-0000-4000-8000-000000000001' })
    );
    const res = await GET(request(`Bearer ${SECRET}`));
    const text = JSON.stringify(await res.json());
    expect(text).toContain('"deleted":3');
    expect(text).not.toContain('voyageur@example.org');
    expect(text).not.toContain('2b1f0c9e');
    expect(text).not.toContain(SECRET);
    const logged = JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(logged).not.toContain(SECRET);
  });
});

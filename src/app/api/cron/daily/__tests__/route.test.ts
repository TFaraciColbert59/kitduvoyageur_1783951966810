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
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const SECRET = 'secret-de-test-0123456789abcdef';

const calls: Array<{ name: string; authorization: string | null; method: string }> = [];
const registries = vi.hoisted(() => ({
  active: 'default' as 'default' | 'rotating',
  default: [] as unknown[],
  rotating: [] as unknown[],
}));
const behaviours = vi.hoisted(
  () => new Map<string, (request: Request) => Promise<Response> | Response>()
);

vi.mock('@/lib/cron/dailyTasks', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cron/dailyTasks')>('@/lib/cron/dailyTasks');
  // Épinglées : l'ordre ne dépend pas du jour (la rotation quotidienne est testée à part).
  const make = (name: string, method: 'GET' | 'POST', pinned = true) => ({
    name,
    method,
    pinned,
    load: async () => ({
      [method]: async (request: Request) => {
        calls.push({ name, authorization: request.headers.get('authorization'), method: request.method });
        const behaviour = behaviours.get(name);
        return behaviour ? behaviour(request) : Response.json({ processed: 1 });
      },
    }),
  });
  const registry = [make('purge', 'GET'), make('file', 'POST'), make('vues', 'GET')];
  registries.default = registry;
  registries.rotating = [make('p', 'GET'), make('a', 'GET', false), make('b', 'GET', false), make('c', 'GET', false)];
  return {
    ...actual,
    DAILY_CRON_TASKS: registry,
    buildDailyTasks: (request: NextRequest, secret: string) =>
      actual.buildDailyTasks(request, secret, registries.active === 'rotating' ? registries.rotating : registries.default),
  };
});

import { GET, dynamic, maxDuration } from '../route';

function request(authorization?: string): NextRequest {
  return new NextRequest('http://localhost/api/cron/daily', {
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe('GET /api/cron/daily', () => {
  beforeEach(() => {
    calls.length = 0;
    behaviours.clear();
    registries.active = 'default';
    vi.stubEnv('CRON_SECRET', SECRET);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('est dynamique (jamais mise en cache) et déclare une durée dans la limite Hobby (300 s)', () => {
    expect(dynamic).toBe('force-dynamic');
    expect(maxDuration).toBeLessThanOrEqual(300);
  });

  it('contrôle le Bearer par isCronAuthorized (empreintes + timingSafeEqual), jamais par une comparaison de chaînes', () => {
    const source = readFileSync(path.resolve(__dirname, '../route.ts'), 'utf8');
    expect(source).toContain('isCronAuthorized(');
    expect(source).not.toMatch(/authorization[^\n]*(===|!==)/i);
    expect(source).not.toMatch(/(===|!==)[^\n]*Bearer/);
    const auth = readFileSync(path.resolve(__dirname, '../../../../../lib/cron/auth.ts'), 'utf8');
    expect(auth).toContain('timingSafeEqual');
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

  it('décale chaque jour les tâches non épinglées ; l’épinglée reste en tête', async () => {
    registries.active = 'rotating';
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const order: string[][] = [];
      for (const day of [20_000, 20_001, 20_002]) {
        vi.setSystemTime(new Date(day * 86_400_000 + 3 * 3_600_000));
        calls.length = 0;
        expect((await GET(request(`Bearer ${SECRET}`))).status).toBe(200);
        order.push(calls.map((c) => c.name));
      }
      // 20 000 mod 3 = 2 ; chaque jour la tête du reste avance d'un rang.
      expect(order).toEqual([
        ['p', 'c', 'a', 'b'],
        ['p', 'a', 'b', 'c'],
        ['p', 'b', 'c', 'a'],
      ]);
    } finally {
      vi.useRealTimers();
    }
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

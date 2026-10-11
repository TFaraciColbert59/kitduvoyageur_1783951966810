/**
 * Plan 100, 1.1 (crons) — répartiteur du cron quotidien (Hobby : un seul tir
 * par jour). Tâches enchaînées dans l'ordre, une tâche qui échoue (réponse
 * non 2xx, exception, dépassement) n'arrête pas les suivantes, le budget de
 * temps est borné, le résumé ne porte aucune donnée personnelle.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runDailyTasks, summarizeBody, type DailyTask } from '../dailyDispatcher';

function ok(body: unknown = { ok: true }): Response {
  return Response.json(body, { status: 200 });
}

function task(name: string, run: () => Promise<Response>): DailyTask {
  return { name, run };
}

describe('runDailyTasks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T03:10:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('enchaîne les tâches dans l’ordre donné, une à la fois', async () => {
    const order: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const make = (name: string) =>
      task(name, async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        order.push(name);
        await new Promise((r) => setTimeout(r, 5));
        inFlight -= 1;
        return ok({ processed: order.length });
      });
    const promise = runDailyTasks([make('a'), make('b'), make('c')], { log: () => {} });
    await vi.runAllTimersAsync();
    const summary = await promise;
    expect(order).toEqual(['a', 'b', 'c']);
    expect(maxInFlight).toBe(1);
    expect(summary.ok).toBe(true);
    expect(summary.succeeded).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.tasks.map((t) => [t.name, t.status])).toEqual([
      ['a', 'ok'],
      ['b', 'ok'],
      ['c', 'ok'],
    ]);
    expect(summary.tasks[2].counters).toEqual({ processed: 3 });
  });

  it('une réponse non 2xx est un échec journalisé, les tâches suivantes tournent quand même', async () => {
    const log = vi.fn();
    const after = vi.fn(async () => ok());
    const summary = await runDailyTasks(
      [
        task('purge', async () => Response.json({ error: 'Configuration serveur manquante' }, { status: 503 })),
        task('suite', after),
      ],
      { log }
    );
    expect(after).toHaveBeenCalledTimes(1);
    expect(summary.ok).toBe(false);
    expect(summary.failed).toBe(1);
    expect(summary.succeeded).toBe(1);
    expect(summary.tasks[0]).toMatchObject({ name: 'purge', status: 'failed', httpStatus: 503 });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({ task: 'purge', status: 'failed', reason: 'http_503' });
  });

  it('une exception n’arrête pas les suivantes et son message n’entre ni au résumé ni au journal', async () => {
    const log = vi.fn();
    const after = vi.fn(async () => ok({ deleted: 2 }));
    const summary = await runDailyTasks(
      [
        task('boom', async () => {
          throw new Error('duplicate key value violates unique constraint (user_id)=(2b1f-secret-uuid)');
        }),
        task('suite', after),
      ],
      { log }
    );
    expect(after).toHaveBeenCalledTimes(1);
    expect(summary.tasks[0]).toMatchObject({ name: 'boom', status: 'failed', reason: 'exception' });
    expect(summary.tasks[1]).toMatchObject({ name: 'suite', status: 'ok', counters: { deleted: 2 } });
    const dump = JSON.stringify([summary, log.mock.calls]);
    expect(dump).not.toContain('secret-uuid');
    expect(dump).not.toContain('duplicate key');
  });

  it('un import de route qui échoue (module cassé) est un échec comme un autre', async () => {
    const summary = await runDailyTasks(
      [
        task('cassée', () => Promise.reject(new TypeError('Cannot find module'))),
        task('saine', async () => ok()),
      ],
      { log: () => {} }
    );
    expect(summary.tasks.map((t) => t.status)).toEqual(['failed', 'ok']);
  });

  it('une tâche trop lente est coupée à son délai et la suivante démarre', async () => {
    const log = vi.fn();
    const next = vi.fn(async () => ok());
    const promise = runDailyTasks(
      [task('lente', () => new Promise<Response>(() => {})), task('suite', next)],
      { taskTimeoutMs: 1_000, log }
    );
    await vi.advanceTimersByTimeAsync(1_000);
    const summary = await promise;
    expect(summary.tasks[0]).toMatchObject({ name: 'lente', status: 'timeout' });
    expect(summary.tasks[0].durationMs).toBeGreaterThanOrEqual(1_000);
    expect(next).toHaveBeenCalledTimes(1);
    expect(summary.failed).toBe(1);
    expect(log).toHaveBeenCalledWith({ task: 'lente', status: 'timeout', reason: 'timeout' });
  });

  it('le budget total est borné : une tâche qui ne peut plus tenir est sautée, pas lancée', async () => {
    const third = vi.fn(async () => ok());
    const promise = runDailyTasks(
      [
        task('a', async () => {
          await new Promise((r) => setTimeout(r, 6_000));
          return ok();
        }),
        task('b', async () => {
          await new Promise((r) => setTimeout(r, 3_000));
          return ok();
        }),
        task('c', third),
      ],
      { budgetMs: 10_000, minStartMs: 2_000, taskTimeoutMs: 8_000, log: () => {} }
    );
    await vi.advanceTimersByTimeAsync(9_000);
    const summary = await promise;
    expect(third).not.toHaveBeenCalled();
    expect(summary.tasks.map((t) => t.status)).toEqual(['ok', 'ok', 'skipped']);
    expect(summary.tasks[2].reason).toBe('budget');
    expect(summary.skipped).toBe(1);
    // Une tâche sautée faute de temps n'est pas une panne : elle repart au prochain tir.
    expect(summary.ok).toBe(true);
  });

  it('le délai d’une tâche ne dépasse jamais le budget restant', async () => {
    const promise = runDailyTasks([task('lente', () => new Promise<Response>(() => {}))], {
      budgetMs: 5_000,
      taskTimeoutMs: 60_000,
      minStartMs: 1_000,
      log: () => {},
    });
    await vi.advanceTimersByTimeAsync(5_000);
    const summary = await promise;
    expect(summary.tasks[0].status).toBe('timeout');
    expect(summary.tasks[0].durationMs).toBeLessThanOrEqual(5_000);
    expect(summary.durationMs).toBeLessThanOrEqual(5_000);
  });

  it('aucune tâche : résumé vide et ok', async () => {
    const summary = await runDailyTasks([], { log: () => {} });
    expect(summary).toMatchObject({ ok: true, total: 0, succeeded: 0, failed: 0, skipped: 0, tasks: [] });
  });
});

describe('summarizeBody — aucun contenu libre dans le résumé', () => {
  it('ne garde que les nombres et les booléens du premier niveau', () => {
    expect(
      summarizeBody({
        processed: 4,
        failed: 0,
        ok: true,
        email: 'tony@example.org',
        user_id: '2b1f0c9e-0000-4000-8000-000000000001',
        error: 'message libre',
        ids: ['a', 'b'],
        nested: { count: 3 },
        ratio: Number.NaN,
        skipped: 'flag_disabled',
      })
    ).toEqual({ processed: 4, failed: 0, ok: true });
  });

  it('ignore tout ce qui n’est pas un objet simple', () => {
    expect(summarizeBody(null)).toBeUndefined();
    expect(summarizeBody('texte')).toBeUndefined();
    expect(summarizeBody([1, 2])).toBeUndefined();
    expect(summarizeBody({})).toBeUndefined();
  });
});

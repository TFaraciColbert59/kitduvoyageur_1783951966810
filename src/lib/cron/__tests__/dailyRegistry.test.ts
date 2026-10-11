/**
 * Plan 100, 1.1 (crons) — garde statique du cron quotidien.
 *
 *   - `vercel.json` ne planifie que `/api/cron/daily`, une fois par jour (la
 *     limite Hobby : https://vercel.com/docs/cron-jobs/usage-and-pricing), et ne
 *     contient aucun secret ;
 *   - chaque route de `src/app/api/cron/` est soit dans le tir quotidien, soit
 *     déclarée « à la main » avec sa raison : une route oubliée casse le test ;
 *   - chaque tâche du tir exporte bien la méthode que le répartiteur appelle ;
 *   - le budget du répartiteur tient sous la durée déclarée de la route.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { DAILY_BUDGET_MS, DAILY_MIN_START_MS, DAILY_TASK_TIMEOUT_MS } from '../dailyDispatcher';
import { DAILY_CRON_ROUTE, DAILY_CRON_TASKS, MANUAL_ONLY_CRON_ROUTES } from '../dailyTasks';

const ROOT = path.resolve(__dirname, '../../../..');
const CRON_DIR = path.join(ROOT, 'src/app/api/cron');

function cronRoutes(): string[] {
  return readdirSync(CRON_DIR)
    .filter((entry) => statSync(path.join(CRON_DIR, entry)).isDirectory())
    .filter((entry) => !entry.startsWith('_'))
    .sort();
}

function routeSource(name: string): string {
  return readFileSync(path.join(CRON_DIR, name, 'route.ts'), 'utf8');
}

function exportsMethod(source: string, method: 'GET' | 'POST'): boolean {
  return (
    new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`).test(source) ||
    new RegExp(`export\\s+const\\s+${method}\\b`).test(source)
  );
}

describe('vercel.json — un seul cron, une fois par jour', () => {
  const config = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')) as {
    crons?: Array<{ path: string; schedule: string }>;
    functions?: Record<string, { maxDuration?: number }>;
  };

  it('ne planifie que /api/cron/daily', () => {
    expect(config.crons).toEqual([{ path: `/api/cron/${DAILY_CRON_ROUTE}`, schedule: expect.any(String) }]);
  });

  it('la cadence est quotidienne (Hobby : toute expression plus fréquente fait échouer le déploiement)', () => {
    const [minute, hour, dayOfMonth, month, dayOfWeek, ...rest] = config.crons![0].schedule.trim().split(/\s+/);
    expect(rest).toEqual([]);
    expect(minute).toMatch(/^\d{1,2}$/);
    expect(hour).toMatch(/^\d{1,2}$/);
    expect([dayOfMonth, month, dayOfWeek]).toEqual(['*', '*', '*']);
  });

  it('ne contient aucun secret (Vercel envoie CRON_SECRET tout seul)', () => {
    const raw = readFileSync(path.join(ROOT, 'vercel.json'), 'utf8');
    expect(raw).not.toMatch(/bearer|secret|authorization|token|password/i);
  });

  it('ne force aucune durée au-delà de 300 s (maximum Hobby)', () => {
    for (const [file, setting] of Object.entries(config.functions ?? {})) {
      expect(setting.maxDuration ?? 0, file).toBeLessThanOrEqual(300);
    }
  });
});

describe('routes /api/cron/* — aucune route oubliée', () => {
  it('la route du répartiteur existe', () => {
    expect(cronRoutes()).toContain(DAILY_CRON_ROUTE);
  });

  it('chaque route est dans le tir quotidien ou déclarée « à la main » avec sa raison', () => {
    const scheduled = new Set(DAILY_CRON_TASKS.map((t) => t.name));
    const manual = new Set(Object.keys(MANUAL_ONLY_CRON_ROUTES));
    const unclassified = cronRoutes().filter((r) => r !== DAILY_CRON_ROUTE && !scheduled.has(r) && !manual.has(r));
    expect(unclassified).toEqual([]);
  });

  it('aucune route n’est à la fois planifiée et « à la main », ni inconnue', () => {
    const routes = new Set(cronRoutes());
    const scheduled = DAILY_CRON_TASKS.map((t) => t.name);
    expect(new Set(scheduled).size).toBe(scheduled.length);
    for (const name of scheduled) {
      expect(routes.has(name), `${name} n’existe pas`).toBe(true);
      expect(name in MANUAL_ONLY_CRON_ROUTES, `${name} est aussi « à la main »`).toBe(false);
    }
    for (const [name, reason] of Object.entries(MANUAL_ONLY_CRON_ROUTES)) {
      expect(routes.has(name), `${name} n’existe pas`).toBe(true);
      expect(reason.length, `${name} sans raison`).toBeGreaterThan(20);
    }
  });

  it('le répartiteur ne s’appelle pas lui-même', () => {
    expect(DAILY_CRON_TASKS.map((t) => t.name)).not.toContain(DAILY_CRON_ROUTE);
  });

  it('chaque tâche exporte la méthode que le répartiteur appelle et contrôle le secret', () => {
    for (const task of DAILY_CRON_TASKS) {
      const source = routeSource(task.name);
      expect(exportsMethod(source, task.method), `${task.name} : pas de ${task.method}`).toBe(true);
      expect(source, `${task.name} : pas de contrôle CRON_SECRET`).toContain('CRON_SECRET');
      expect(source, `${task.name} : pas force-dynamic`).toContain("export const dynamic = 'force-dynamic'");
    }
  });
});

describe('durée — le budget tient sous la limite Hobby', () => {
  const daily = routeSource(DAILY_CRON_ROUTE);
  const declared = Number(/export const maxDuration = (\d+)/.exec(daily)?.[1]);

  it('la route déclare une durée ≤ 300 s', () => {
    expect(Number.isFinite(declared)).toBe(true);
    expect(declared).toBeLessThanOrEqual(300);
  });

  it('le budget du répartiteur laisse une marge sous la durée déclarée', () => {
    expect(DAILY_BUDGET_MS).toBeLessThan(declared * 1000);
    expect(declared * 1000 - DAILY_BUDGET_MS).toBeGreaterThanOrEqual(20_000);
    expect(DAILY_TASK_TIMEOUT_MS).toBeLessThanOrEqual(DAILY_BUDGET_MS);
    expect(DAILY_MIN_START_MS).toBeLessThan(DAILY_TASK_TIMEOUT_MS);
  });
});

describe('chargement réel des routes du tir quotidien', () => {
  it('chaque route se charge (import dynamique) et expose la méthode appelée', async () => {
    for (const task of DAILY_CRON_TASKS) {
      const loaded = await task.load();
      expect(typeof loaded[task.method], `${task.name} : ${task.method} absent`).toBe('function');
    }
  }, 60_000);
});

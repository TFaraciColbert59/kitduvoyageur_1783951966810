import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateDailyReport } from '../../scripts/ops/check-daily-report.mjs';

const now = new Date('2026-10-20T05:07:00Z');
const MIB = 1024 * 1024;

describe('alerte gratuite sur le rapport quotidien (plan 1.1)', () => {
  it('rapport d’hier sans alerte et base sous la cible : ok', () => {
    const r = evaluateDailyReport({ day: '2026-10-19', db_bytes: 350 * MIB, alerts: [] }, now);
    expect(r.ok).toBe(true);
    expect(r.problems).toEqual([]);
  });

  it('alertes (colonne vide ou null = aucune)', () => {
    expect(evaluateDailyReport({ day: '2026-10-19', db_bytes: 1, alerts: null }, now).ok).toBe(true);
    const r = evaluateDailyReport(
      { day: '2026-10-19', db_bytes: 1, alerts: ['plus de 10 % de préparations échouées'] },
      now,
    );
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain('plus de 10 % de préparations échouées');
  });

  it('aucun rapport, ou rapport trop ancien (pg_cron arrêté, projet en pause) : échec', () => {
    expect(evaluateDailyReport(null, now).ok).toBe(false);
    expect(evaluateDailyReport({}, now).ok).toBe(false);
    const old = evaluateDailyReport({ day: '2026-10-16', db_bytes: 1, alerts: [] }, now);
    expect(old.ok).toBe(false);
    expect(old.problems[0]).toContain('pg_cron');
    // Un jour de retard reste toléré (écrit à 4 h 07 UTC, lu à 5 h 17).
    expect(evaluateDailyReport({ day: '2026-10-18', db_bytes: 1, alerts: [] }, now).ok).toBe(true);
  });

  it('base au-dessus de 400 Mio : échec avec la taille dite', () => {
    const r = evaluateDailyReport({ day: '2026-10-19', db_bytes: 431 * MIB, alerts: [] }, now);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain('431.0 Mio');
  });

  it('db_bytes arrivant en chaîne (bigint JSON) est compris', () => {
    const r = evaluateDailyReport(
      { day: '2026-10-19', db_bytes: String(450 * MIB), alerts: [] },
      now,
    );
    expect(r.ok).toBe(false);
  });

  it('en ligne de commande : code 1 sur alerte, 0 sinon, 1 sur entrée illisible', () => {
    const script = path.resolve(__dirname, '../../scripts/ops/check-daily-report.mjs');
    const run = (input: string) =>
      spawnSync(process.execPath, [script], { input, encoding: 'utf8', timeout: 20_000 });
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    expect(run(JSON.stringify({ day: yesterday, db_bytes: 10 * MIB, alerts: [] })).status).toBe(0);
    expect(run(JSON.stringify({ day: yesterday, db_bytes: 10 * MIB, alerts: ['x'] })).status).toBe(1);
    expect(run('pas du json').status).toBe(1);
    expect(run('').status).toBe(1);
  });
});

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_THRESHOLDS,
  evaluateHealth,
  isLocalDsn,
} from '../../scripts/ops/a14_healthcheck.mjs';
import okFixture from './fixtures/a14-health-ok.json';
import degradedFixture from './fixtures/a14-health-degraded.json';

const here = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(here, '../../scripts/ops/a14_healthcheck.mjs');
const okPath = path.resolve(here, 'fixtures/a14-health-ok.json');
const degradedPath = path.resolve(here, 'fixtures/a14-health-degraded.json');

function runScript(args: string[]) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf8',
    timeout: 30_000,
  });
}

describe('A14 — healthcheck observabilité (TEST-A14-OPS-HEALTH)', () => {
  it('TEST-A14-OPS-HEALTH-01: instantané sain ⇒ exit 0', () => {
    const result = runScript(['--snapshot', okPath]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('RÉSULTAT : SAIN');
  });

  it('TEST-A14-OPS-HEALTH-02: seuils dépassés ⇒ exit 1 (jamais un faux sain)', () => {
    const result = runScript(['--snapshot', degradedPath]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('RÉSULTAT : DÉGRADÉ');
    expect(result.stdout).toContain('file événements domaine');
    expect(result.stdout).toContain('latence RPC');
  });

  it('TEST-A14-OPS-HEALTH-03: base injoignable ⇒ exit 2 (erreur explicite)', () => {
    const result = runScript([
      '--dsn',
      'postgresql://postgres:postgres@127.0.0.1:59999/postgres',
    ]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain('ERREUR CONNEXION/CONFIG');
  });

  it('TEST-A14-OPS-HEALTH-04: DSN distant refusé sans opt-in (garde-fou production)', () => {
    const result = runScript(['--dsn', 'postgresql://user:pass@db.production.example:5432/postgres']);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain('production est interdite');
  });

  it('TEST-A14-OPS-HEALTH-05: évaluation pure — checqués/ratio/seuils', () => {
    const okEvaluation = evaluateHealth(okFixture);
    expect(okEvaluation.ok).toBe(true);
    expect(okEvaluation.failures).toEqual([]);

    const degraded = evaluateHealth(degradedFixture);
    expect(degraded.ok).toBe(false);
    expect(degraded.checks.find((check) => check.id === 'pending_domain_events')?.ok).toBe(false);
    expect(degraded.checks.find((check) => check.id === 'rpc_latency_avg_ms')?.ok).toBe(false);
    expect(degraded.failures.length).toBeGreaterThanOrEqual(5);
  });

  it('TEST-A14-OPS-HEALTH-06: petit échantillon d’échecs ⇒ avertissement non bloquant', () => {
    const evaluation = evaluateHealth({
      db: {
        runs: { total: 3, last24h: 3, failed24h: 1 },
      },
    });

    expect(evaluation.ok).toBe(true);
    expect(evaluation.warnings.some((warning) => warning.includes('échantillon'))).toBe(true);
    expect(DEFAULT_THRESHOLDS.minRunsForFailureRatio).toBeGreaterThan(3);
  });

  it('TEST-A14-OPS-HEALTH-07: garde-fou local — hôtes locaux autorisés uniquement', () => {
    expect(isLocalDsn('postgresql://postgres:postgres@127.0.0.1:54322/postgres')).toBe(true);
    expect(isLocalDsn('postgresql://postgres:postgres@localhost:54322/postgres')).toBe(true);
    expect(isLocalDsn('postgresql://user:pass@db.example.com:5432/postgres')).toBe(false);
    expect(isLocalDsn('pas-un-dsn')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { measurementsFromLoad } from '../../scripts/ops/phase10_slo_check';
import { evaluatePhase10Slos, PHASE10_SLOS } from '@/lib/observability/slo';

const healthy = {
  count: 100,
  total: 100,
  p95Ms: 100,
  status5xx: 0,
  status4xx: 0,
  errors: 0,
  evaluation: { verdict: 'pass' },
};
const metrics = {
  api_availability_ratio: 1,
  api_read_p95_ms: 100,
  api_write_p95_ms: 200,
  http_5xx_ratio: 0,
  destructive_syncs: 0,
  rls_violations: 0,
  carnet_entry_loss: 0,
  jobs_pending_events: 0,
  jobs_oldest_pending_min: 0,
};
const evaluate = (conditions: object) =>
  evaluatePhase10Slos(
    measurementsFromLoad({ scenarios: { conditions } }),
    PHASE10_SLOS.filter((s) => s.id === 'api_read_p95_ms' || s.id === 'http_5xx_ratio')
  );

describe('A15 SLO validity gate', () => {
  it.each([
    { count: 1 },
    { count: 99 },
    { count: undefined },
    { status4xx: 100 },
    { errors: 1 },
    { status5xx: undefined },
    { status4xx: undefined },
    { errors: undefined },
    { evaluation: { verdict: 'inconclusive' } },
    { evaluation: undefined },
  ])('retains insufficient_data for invalid samples %j', (patch) => {
    expect(evaluate({ ...healthy, ...patch }).evaluations.map((x) => x.status)).toEqual([
      'insufficient_data',
      'insufficient_data',
    ]);
  });

  it('accepts 100 complete observations and fails measured threshold violations', () => {
    expect(evaluate(healthy).complete).toBe(true);
    const red = evaluate({ ...healthy, p95Ms: 400, status5xx: 2, evaluation: { verdict: 'fail' } });
    expect(red.failures.map((x) => x.id)).toEqual(['api_read_p95_ms', 'http_5xx_ratio']);
  });

  it('never converts an unexplained failed source verdict to a pass', () => {
    expect(
      evaluate({ ...healthy, evaluation: { verdict: 'fail' } }).evaluations.map((x) => x.status)
    ).toEqual(['insufficient_data', 'insufficient_data']);
  });

  it.each([
    ['low count', { ...healthy, count: 1 }, 2],
    ['healthy but incomplete SLO coverage', healthy, 2],
    ['measured failure', { ...healthy, p95Ms: 400, evaluation: { verdict: 'fail' } }, 1],
  ])('actual CLI exits honestly: %s', (_, conditions, expected) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'slo-gate-'));
    try {
      const fixture = path.join(directory, 'load.json');
      writeFileSync(fixture, JSON.stringify({ scenarios: { conditions } }));
      const child = spawnSync(
        process.execPath,
        ['--import', 'tsx', 'scripts/ops/phase10_slo_check.ts', '--load', fixture, '--json'],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          timeout: 15000,
        }
      );
      expect(child.error).toBeUndefined();
      expect(child.status, child.stderr).toBe(expected);
      expect(JSON.parse(child.stdout).exitCode).toBe(expected);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each([
    [0, 0],
    [1, 1],
  ])('actual CLI full metrics: rls_violations=%i exits %i', (violations, expected) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'slo-metrics-'));
    try {
      const fixture = path.join(directory, 'metrics.json');
      writeFileSync(fixture, JSON.stringify({ ...metrics, rls_violations: violations }));
      const child = spawnSync(
        process.execPath,
        ['--import', 'tsx', 'scripts/ops/phase10_slo_check.ts', '--metrics', fixture, '--json'],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          timeout: 15000,
        }
      );
      expect(child.error).toBeUndefined();
      expect(child.status, child.stderr).toBe(expected);
      expect(JSON.parse(child.stdout).exitCode).toBe(expected);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

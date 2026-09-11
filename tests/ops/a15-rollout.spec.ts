/**
 * A15 — Tests du rollout progressif par cohortes (script `scripts/ops/a15_rollout.mjs`).
 *
 * Partie pure : toujours exécutée (aucune base).
 * Partie intégration : LOCAL uniquement, gatée `A15_LOCAL_INTEGRATION=1` et
 * DSN local obligatoire (toute cible non locale est refusée). Elle prouve les
 * paliers 1/5/20/50/100 sur la vraie RPC `current_feature_flags_for`, la parité
 * bucket SQL ↔ TS, allowlist/exclusions, puis restaure l'état initial.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  A9_STOP_THRESHOLDS,
  DEFAULT_FLAG_ID,
  DEFAULT_LOCAL_DSN,
  ROLLOUT_TIERS,
  applyTier,
  assertLocalDsn,
  cohortBucket,
  collectLocalMetrics,
  evaluateStopCriteria,
  evaluateTierOutcome,
  isLocalDsn,
  main,
  restoreFlag,
  sampleUserIds,
  sha256Hex,
  snapshotFlag,
  verifyAllTiers,
  verifyTier,
} from '../../scripts/ops/a15_rollout.mjs';

describe('A15 — rollout critères & pure logic (TEST-A15-ROLL)', () => {
  it('TEST-A15-ROLL-01: paliers A9 exacts et seuils cohérents', () => {
    expect(ROLLOUT_TIERS).toEqual([1, 5, 20, 50, 100]);
    expect(DEFAULT_FLAG_ID).toBe('performance_profile_v2');
    expect(A9_STOP_THRESHOLDS.errorRateMultiplier).toBe(2);
    expect(A9_STOP_THRESHOLDS.minEtaCoverageP90).toBe(0.75);
    expect(A9_STOP_THRESHOLDS.maxBatteryPctPerHour).toBe(5);
  });

  it('TEST-A15-ROLL-02: bucket SHA-256 stable (vecteurs) et échantillon déterministe', () => {
    expect(sha256Hex('00000000-0000-0000-0000-000000000001').slice(0, 8)).toBe('7ac1b8d7');
    expect(cohortBucket('00000000-0000-0000-0000-000000000001')).toBe(19);
    expect(cohortBucket('11111111-1111-4111-a111-111111111111')).toBe(51);

    const first = sampleUserIds(20, 'seed-a');
    const second = sampleUserIds(20, 'seed-a');
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(20);
    for (const id of first) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it('TEST-A15-ROLL-03: taux de palier — tolérance respectée, dérive détectée, échantillon faible non concluant', () => {
    expect(evaluateTierOutcome({ percentage: 20, total: 1000, enabledCount: 202 }).verdict).toBe('pass');
    expect(evaluateTierOutcome({ percentage: 20, total: 1000, enabledCount: 260 }).verdict).toBe('fail');
    expect(evaluateTierOutcome({ percentage: 20, total: 50, enabledCount: 10 }).verdict).toBe('inconclusive');
    expect(evaluateTierOutcome({ percentage: 100, total: 1000, enabledCount: 1000 }).verdict).toBe('pass');
  });

  it('TEST-A15-ROLL-04: critères 1-2 — fuite/RLS et erreurs > 2× baseline', () => {
    const clean = {
      requests24h: 5000,
      errorRate24h: 0.01,
      baselineErrorRate24h: 0.01,
      etaCoverageP90: 0.9,
      etaSampleSize: 100,
      batteryPctPerHour: 2,
      debounceOk: true,
    };
    expect(evaluateStopCriteria(clean).decision).toBe('continue');

    expect(evaluateStopCriteria({ ...clean, dataLeakOrRlsCritical: true }).decision).toBe('stop');
    expect(
      evaluateStopCriteria({ ...clean, dataLeakOrRlsCritical: true }).stops[0]
    ).toContain('critère 1');

    const degraded = evaluateStopCriteria({ ...clean, errorRate24h: 0.03 });
    expect(degraded.decision).toBe('stop');
    expect(degraded.stops[0]).toContain('critère 2');

    const smallSample = evaluateStopCriteria({
      ...clean,
      requests24h: 100,
      errorRate24h: 0.5,
    });
    expect(smallSample.decision).toBe('insufficient_data');
    expect(smallSample.insufficient.join(' ')).toContain('critère 2');
  });

  it('TEST-A15-ROLL-05: critères 3-5 — ETA P90, faux signalements, batterie/anti-rebond', () => {
    const clean = {
      requests24h: 5000,
      errorRate24h: 0.01,
      baselineErrorRate24h: 0.01,
      etaCoverageP90: 0.9,
      etaSampleSize: 100,
      batteryPctPerHour: 2,
      debounceOk: true,
    };
    expect(evaluateStopCriteria({ ...clean, etaCoverageP90: 0.5 }).decision).toBe('stop');
    expect(
      evaluateStopCriteria({ ...clean, etaCoverageP90: 0.5, etaSampleSize: 10 }).decision
    ).toBe('insufficient_data');
    expect(evaluateStopCriteria({ ...clean, terrainCriticalFalseReports: 3 }).decision).toBe('stop');
    expect(evaluateStopCriteria({ ...clean, moderationFailure: true }).decision).toBe('stop');
    expect(evaluateStopCriteria({ ...clean, batteryPctPerHour: 6 }).decision).toBe('stop');
    expect(evaluateStopCriteria({ ...clean, debounceOk: false }).decision).toBe('stop');
    expect(
      evaluateStopCriteria({ ...clean, batteryPctPerHour: null }).decision
    ).toBe('insufficient_data');
  });

  it('TEST-A15-ROLL-06: critères 6-7, métriques vides honnêtes et garde-fou local', () => {
    const clean = {
      requests24h: 5000,
      errorRate24h: 0.01,
      baselineErrorRate24h: 0.01,
      etaCoverageP90: 0.9,
      etaSampleSize: 100,
      batteryPctPerHour: 2,
      debounceOk: true,
    };
    expect(evaluateStopCriteria({ ...clean, monthlyCostOverBudget: true }).decision).toBe('stop');
    expect(evaluateStopCriteria({ ...clean, sessionCorruption: true }).decision).toBe('stop');
    expect(evaluateStopCriteria({ ...clean, offlineSyncDestructive: true }).decision).toBe('stop');

    const empty = evaluateStopCriteria({});
    expect(empty.decision).toBe('insufficient_data');
    expect(empty.decision).not.toBe('continue');

    expect(isLocalDsn('postgresql://postgres:postgres@127.0.0.1:54322/postgres')).toBe(true);
    expect(isLocalDsn('postgresql://user:pass@db.production.example:5432/postgres')).toBe(false);
    expect(() =>
      assertLocalDsn('postgresql://user:pass@db.production.example:5432/postgres', {})
    ).toThrow(/non local/i);
    expect(() =>
      assertLocalDsn('postgresql://user:pass@db.production.example:5432/postgres', {
        A15_ROLLOUT_ALLOW_REMOTE: '1',
      })
    ).not.toThrow();
  });

  it('TEST-A15-ROLL-07: CLI --check-stop — sain ⇒ 0, dégradé ⇒ 3 (arrêt immédiat)', async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const healthy = path.resolve(here, 'fixtures/a15-rollout-metrics-healthy.json');
    const degraded = path.resolve(here, 'fixtures/a15-rollout-metrics-degraded.json');
    const logs: string[] = [];

    const healthyCode = await main(['--check-stop', '--metrics', healthy], {}, (message) =>
      logs.push(String(message))
    );
    expect(healthyCode).toBe(0);
    expect(logs.join('\n')).toContain('CONTINUE');

    const degradedCode = await main(['--check-stop', '--metrics', degraded], {}, (message) =>
      logs.push(String(message))
    );
    expect(degradedCode).toBe(3);
    expect(logs.join('\n')).toContain('ARRÊT');
  });
});

const RUN = process.env.A15_LOCAL_INTEGRATION === '1';

const integration = RUN ? describe : describe.skip;

integration(
  'A15 — rollout intégration base locale (TEST-A15-ROLL-INT)',
  { timeout: 120_000 },
  () => {
    let client: import('pg').Client;
    let initial: Awaited<ReturnType<typeof snapshotFlag>>;

    beforeAll(async () => {
      assertLocalDsn(DEFAULT_LOCAL_DSN);
      const { default: pg } = await import('pg');
      client = new pg.Client({ connectionString: DEFAULT_LOCAL_DSN });
      await client.connect();
      initial = await snapshotFlag(client, DEFAULT_FLAG_ID);
    });

    afterAll(async () => {
      if (client) {
        await restoreFlag(client, DEFAULT_FLAG_ID, initial);
        const after = await snapshotFlag(client, DEFAULT_FLAG_ID);
        expect(after.flag.enabled).toBe(initial.flag.enabled);
        expect(after.cohort?.percentage ?? null).toBe(initial.cohort?.percentage ?? null);
        await client.end();
      }
    });

    it('TEST-A15-ROLL-INT-01: paliers 1/5/20/50/100 respectés sur la vraie RPC', async () => {
      const verification = await verifyAllTiers({
        dsn: DEFAULT_LOCAL_DSN,
        sampleSize: 1000,
      });

      expect(verification.restored).toBe(true);
      const tiers = verification.results.filter((result) => result.boundary === undefined);
      expect(tiers.map((tier) => tier.percentage)).toEqual([...ROLLOUT_TIERS]);
      for (const tier of tiers) {
        expect(tier.verdict, `palier ${tier.percentage} % : ${tier.reason ?? ''}`).toBe('pass');
        expect(tier.bucketMismatches).toBe(0);
        expect(tier.ok).toBe(true);
      }

      const boundary = verification.results.find((result) => result.boundary);
      expect(boundary).toBeDefined();
      for (const check of boundary?.allowChecks ?? []) {
        expect(check.actual, `allowlist/exclusion ${check.userId}`).toBe(check.expected);
      }
    });

    it('TEST-A15-ROLL-INT-02: parité bucket SQL ↔ TypeScript sur 300 UUID', async () => {
      const userIds = sampleUserIds(300, 'a15-rollout-parity');
      const { rows } = await client.query(
        'SELECT u::text AS user_id, public.a11_cohort_bucket(u) AS bucket FROM unnest($1::uuid[]) AS u',
        [userIds]
      );
      expect(rows).toHaveLength(300);
      for (const row of rows) {
        expect(Number(row.bucket)).toBe(cohortBucket(String(row.user_id)));
      }
    });

    it('TEST-A15-ROLL-INT-03: allowlist prioritaire et exclusion effective à 0 %', async () => {
      const allowUser = sampleUserIds(1, 'a15-int-allow')[0];
      const excludedUser = sampleUserIds(1, 'a15-int-exclude')[0];
      await applyTier(client, DEFAULT_FLAG_ID, 0, {
        allowlist: [allowUser],
        exclusions: [excludedUser],
      });
      const outcome = await verifyTier(client, {
        flagId: DEFAULT_FLAG_ID,
        percentage: 0,
        sampleSize: 20,
        allowlist: [allowUser],
        exclusions: [excludedUser],
      });
      expect(outcome.allowChecks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: allowUser, expected: true, actual: true }),
          expect.objectContaining({ userId: excludedUser, expected: false, actual: false }),
        ])
      );
      await restoreFlag(client, DEFAULT_FLAG_ID, initial);
    });

    it('TEST-A15-ROLL-INT-04: métriques locales collectées sans invention (ETA/batterie absentes)', async () => {
      const metrics = await collectLocalMetrics(client);
      expect(metrics.source).toContain('local-db');
      expect(metrics.requests24h).toBeGreaterThanOrEqual(0);
      expect(metrics.etaCoverageP90).toBeNull();
      expect(metrics.etaSampleSize).toBe(0);
      expect(metrics.batteryPctPerHour).toBeNull();

      const evaluation = evaluateStopCriteria(metrics);
      expect(evaluation.decision).not.toBe('continue');
      expect(evaluation.insufficient.length).toBeGreaterThan(0);
    });
  }
);

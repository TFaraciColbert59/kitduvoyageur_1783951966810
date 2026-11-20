import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildEffortSegmentsForSession,
  computeEffortScoreV1Shadow,
  DIRECT_SEGMENT_FALLBACK_SURFACE,
  DIRECT_SEGMENT_FALLBACK_TERRAIN_ETA,
  EFFORT_SCORE_VERSION,
  EFFORT_SHADOW_FLAG_ID,
  evaluateHikeSessionEffortShadow,
  hasPersonalScoringConsent,
  processHikeSession,
  type EffortScoreShadowPersistRow,
  type GpsPoint,
  type HikeProcessingClient,
  type HikeSessionRow,
  type PersistTranscriptInput,
} from '../processHikeSession';
import { EffortScoreOutputSchema } from '../../schemas/effort.schema';
import { DAILY_BUDGET_MS, DAILY_MIN_START_MS } from '@/lib/cron/dailyDispatcher';
import {
  DAILY_AVAILABLE_EFFORT_SHADOW_BUDGET_MS,
  EFFORT_SHADOW_BATCH_SIZE,
  planEffortShadowDailyBatches,
  runIdempotentEffortShadowBatches,
} from '@/lib/cron/dailyTasks';

const ROOT = path.resolve(__dirname, '../../../../..');
const USER_A = 'f3000000-0000-4000-8000-000000000001';
const USER_B = 'f3000000-0000-4000-8000-000000000002';
const SESSION_1 = '73100000-0000-4000-8000-000000000001';

function isoAt(offsetSeconds: number): string {
  return new Date(Date.UTC(2026, 10, 20, 8, 0, 0) + offsetSeconds * 1000).toISOString();
}

function buildTimedPositions(count = 20, withElevation = false) {
  return Array.from({ length: count }, (_, idx) => ({
    lat: 45.92 + idx * 0.0005,
    lng: 6.87 + idx * 0.0003,
    timestamp: isoAt(idx * 60),
    elevationM: withElevation ? 1100 + idx * 12 : null,
  }));
}

function makeSession(overrides: Partial<HikeSessionRow> = {}): HikeSessionRow {
  return {
    id: SESSION_1,
    user_id: USER_A,
    positions_geojson: null,
    positions_timed: buildTimedPositions(25, false),
    processing_status: 'pending',
    processor_version: null,
    ended_at: isoAt(25 * 60),
    distance_km: 4.5,
    dplus_m: 380,
    elevation_gain_m: 380,
    duration_min: 25,
    duration_seconds: 1500,
    max_altitude_m: 1480,
    ...overrides,
  };
}

function createShadowTestClient(options: {
  session: HikeSessionRow | null;
  shadowEnabled?: boolean;
  consents?: Partial<Record<string, boolean>>;
  consentThrows?: boolean;
  mntElevations?: number[];
  physiology?: {
    weight_kg?: number;
    sex?: 'female' | 'male' | 'unspecified';
    birth_year?: number;
    hr_rest?: number;
    hr_max?: number;
  } | null;
}) {
  const persistedScores = new Map<string, EffortScoreShadowPersistRow>();
  const transcripts: PersistTranscriptInput[] = [];

  const client: HikeProcessingClient = {
    getSession: vi.fn().mockResolvedValue(options.session),
    hasActiveConsent: vi.fn().mockImplementation(async (_userId: string, purpose: string) => {
      if (options.consentThrows) throw new Error('consent_rpc_unavailable');
      const map = options.consents;
      if (!map) return false;
      // Reproduit la sémantique exacte de public.has_active_consent(p_user_id, p_purpose) :
      // priorité à la ligne explicite de la finalité demandée (permettant la révocation RGPD
      // immédiate de 'personal_scoring' même si 'personal_performance' = true), sinon fallback
      // rétrocompatible vers l'autre finalité si aucune ligne explicite n'existe.
      if (purpose === 'personal_scoring' || purpose === 'personal_performance') {
        if (map[purpose] !== undefined) {
          return map[purpose] === true;
        }
        const fallback = purpose === 'personal_scoring' ? 'personal_performance' : 'personal_scoring';
        return map[fallback] === true;
      }
      return map[purpose] === true;
    }),
    // En production, trail_segments contient 0 ligne => candidats vides
    getCandidatesBatch: vi.fn().mockImplementation(async (points: GpsPoint[]) =>
      points.map(() => [])
    ),
    persistTranscript: vi.fn().mockImplementation(async (input: PersistTranscriptInput) => {
      transcripts.push(input);
    }),
    markSession: vi.fn().mockResolvedValue(undefined),
    isEffortShadowEnabled: vi.fn().mockResolvedValue(options.shadowEnabled === true),
    getUserPhysiology: vi.fn().mockResolvedValue(
      options.physiology
        ? { user_id: options.session?.user_id ?? USER_A, ...options.physiology }
        : null
    ),
    resolveMntElevations: options.mntElevations
      ? vi.fn().mockResolvedValue(options.mntElevations)
      : undefined,
    persistEffortScoreShadow: vi.fn().mockImplementation(async (row: EffortScoreShadowPersistRow) => {
      // Contrat C : ON CONFLICT (snapshot_hash) DO NOTHING
      if (persistedScores.has(row.snapshot_hash)) {
        return false;
      }
      persistedScores.set(row.snapshot_hash, row);
      return true;
    }),
  };

  return { client, persistedScores, transcripts };
}

describe('Lot P3 — Rétrocompatibilité stricte & révocation RGPD des consentements (personal_scoring / personal_performance)', () => {
  it('accepte le consentement historique personal_performance déjà présent en base si aucune ligne personal_scoring n’existe', async () => {
    const { client, persistedScores } = createShadowTestClient({
      session: makeSession(),
      shadowEnabled: true,
      consents: {
        personal_performance: true,
      },
    });

    await expect(hasPersonalScoringConsent(client, USER_A)).resolves.toBe(true);
    expect(client.hasActiveConsent).toHaveBeenCalledTimes(1);
    expect(client.hasActiveConsent).toHaveBeenCalledWith(USER_A, 'personal_scoring');

    const result = await processHikeSession(SESSION_1, client);
    expect(result.status).toBe('processed');
    expect(result.passages).toBe(0); // trail_segments = 0
    expect(result.effortShadow?.status).toBe('persisted');
    expect(persistedScores.size).toBe(1);
  });

  it('RGPD : un user avec personal_performance = true qui révoque personal_scoring reçoit false et un seul appel personal_scoring', async () => {
    const { client, persistedScores } = createShadowTestClient({
      session: makeSession(),
      shadowEnabled: true,
      consents: {
        personal_performance: true,
        personal_scoring: false,
      },
    });

    await expect(hasPersonalScoringConsent(client, USER_A)).resolves.toBe(false);
    expect(client.hasActiveConsent).toHaveBeenCalledTimes(1);
    expect(client.hasActiveConsent).toHaveBeenCalledWith(USER_A, 'personal_scoring');
    expect(client.hasActiveConsent).not.toHaveBeenCalledWith(USER_A, 'personal_performance');

    const result = await processHikeSession(SESSION_1, client);
    expect(result.status).toBe('processed');
    expect(result.effortShadow?.status).toBe('skipped_no_consent');
    expect(persistedScores.size).toBe(0);
  });

  it('accepte la nouvelle finalité granulaire personal_scoring même sans personal_performance', async () => {
    const { client, persistedScores } = createShadowTestClient({
      session: makeSession(),
      shadowEnabled: true,
      consents: {
        personal_performance: false,
        personal_scoring: true,
      },
    });

    await expect(hasPersonalScoringConsent(client, USER_A)).resolves.toBe(true);
    expect(client.hasActiveConsent).toHaveBeenCalledTimes(1);
    expect(client.hasActiveConsent).toHaveBeenCalledWith(USER_A, 'personal_scoring');

    const result = await processHikeSession(SESSION_1, client);
    expect(result.status).toBe('processed');
    expect(result.effortShadow?.status).toBe('persisted');
    expect(persistedScores.size).toBe(1);
  });

  it('refuse le calcul shadow si ni personal_scoring ni personal_performance ne sont accordés (ou en cas d’erreur RPC)', async () => {
    const { client: noConsentClient, persistedScores: scores1 } = createShadowTestClient({
      session: makeSession(),
      shadowEnabled: true,
      consents: {
        personal_performance: false,
        personal_scoring: false,
      },
    });

    await expect(hasPersonalScoringConsent(noConsentClient, USER_A)).resolves.toBe(false);
    const res1 = await processHikeSession(SESSION_1, noConsentClient);
    expect(res1.effortShadow?.status).toBe('skipped_no_consent');
    expect(scores1.size).toBe(0);

    const { client: errorClient, persistedScores: scores2 } = createShadowTestClient({
      session: makeSession(),
      shadowEnabled: true,
      consentThrows: true,
    });
    await expect(hasPersonalScoringConsent(errorClient, USER_A)).resolves.toBe(false);
    const res2 = await processHikeSession(SESSION_1, errorClient);
    expect(res2.effortShadow?.status).toBe('skipped_no_consent');
    expect(scores2.size).toBe(0);
  });
});

describe('Lot P3 — Mode shadow effort_score_v1_shadow & fallback trail_segments = 0', () => {
  it('court-circuite immédiatement quand effort_score_v1_shadow = false', async () => {
    const { client, persistedScores } = createShadowTestClient({
      session: makeSession(),
      shadowEnabled: false,
      consents: { personal_performance: true },
    });

    expect(EFFORT_SHADOW_FLAG_ID).toBe('effort_score_v1_shadow');
    const result = await processHikeSession(SESSION_1, client);
    expect(result.status).toBe('processed');
    expect(result.effortShadow).toEqual({ status: 'skipped_flag_disabled' });
    expect(persistedScores.size).toBe(0);
  });

  it('bascule sur la segmentation directe depuis positions_timed avec MNT et fallback surface dirt / eta = 1.10 quand trail_segments = 0', async () => {
    const timedPoints = buildTimedPositions(30, false);
    const mntElevations = timedPoints.map((_, idx) => 1200 + idx * 15);
    const session = makeSession({ positions_timed: timedPoints });

    const { client, persistedScores } = createShadowTestClient({
      session,
      shadowEnabled: true,
      consents: { personal_performance: true },
      mntElevations,
      physiology: {
        weight_kg: 74,
        sex: 'male',
        birth_year: 1989,
        hr_rest: 52,
        hr_max: 188,
      },
    });

    const result = await processHikeSession(SESSION_1, client);

    expect(result.status).toBe('processed');
    expect(result.passages).toBe(0);
    expect(result.effortShadow).toBeDefined();
    expect(result.effortShadow?.status).toBe('persisted');
    expect(result.effortShadow?.segmentationMode).toBe('direct_positions_timed');
    expect(result.effortShadow?.surfaceFallback).toBe(DIRECT_SEGMENT_FALLBACK_SURFACE);
    expect(result.effortShadow?.terrainFactorEta).toBe(DIRECT_SEGMENT_FALLBACK_TERRAIN_ETA);
    expect(result.effortShadow?.usedMntElevation).toBe(true);
    expect(result.effortShadow?.dataLevel).toBe('cardio');
    expect((result.effortShadow?.segmentCount ?? 0)).toBeGreaterThanOrEqual(2);

    const [persisted] = [...persistedScores.values()];
    expect(persisted.is_shadow).toBe(true);
    expect(persisted.score_version).toBe(EFFORT_SCORE_VERSION);
    expect(persisted.snapshot_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(persisted.multipliers.terrainEta).toBeCloseTo(1.10, 4);
    expect(persisted.iea).toBeGreaterThan(0);
    expect(persisted.iea).toBeLessThanOrEqual(100);
    expect(persisted.interval_p10).toBeLessThanOrEqual(persisted.interval_p50);
    expect(persisted.interval_p50).toBeLessThanOrEqual(persisted.interval_p90);

    // Somme Shapley additive exacte === IEA
    const s = persisted.shapley;
    const sumParts =
      s.baseDistance +
      s.ascent +
      s.descent +
      s.packLoad +
      s.surfaceAndSnow +
      s.thermalAndWind +
      s.altitude +
      s.fatigue;
    expect(Math.abs(sumParts - persisted.iea)).toBeLessThanOrEqual(1e-5);
    expect(s.total).toBeCloseTo(persisted.iea, 5);

    // Validation complète contre le contrat Zod EffortScoreOutputSchema
    const validatedOutput = EffortScoreOutputSchema.safeParse({
      scoreVersion: persisted.score_version,
      snapshotHash: persisted.snapshot_hash,
      iea: persisted.iea,
      erp: persisted.erp,
      eFlatKm: persisted.e_flat_km,
      rawDose: persisted.raw_dose,
      technicite: persisted.technicite,
      risque: persisted.risque,
      multipliers: persisted.multipliers,
      shapley: persisted.shapley,
      dataLevel: persisted.data_level,
      interval: {
        p10: persisted.interval_p10,
        p50: persisted.interval_p50,
        p90: persisted.interval_p90,
      },
      confidence: persisted.confidence,
      evidence: persisted.evidence,
      warnings: persisted.warnings,
    });
    expect(validatedOutput.success).toBe(true);
  });

  it('respecte le Contrat C d’immutabilité : ON CONFLICT (snapshot_hash) DO NOTHING ignore les doublons', async () => {
    const session = makeSession();
    const { client, persistedScores } = createShadowTestClient({
      session,
      shadowEnabled: true,
      consents: { personal_scoring: true },
    });

    const first = await evaluateHikeSessionEffortShadow(session, client, {
      nowIso: '2026-11-20T10:00:00Z',
    });
    expect(first.status).toBe('persisted');
    expect(persistedScores.size).toBe(1);

    const second = await evaluateHikeSessionEffortShadow(session, client, {
      nowIso: '2026-11-20T11:00:00Z',
    });
    expect(second.status).toBe('skipped_duplicate_snapshot');
    expect(second.snapshotHash).toBe(first.snapshotHash);
    expect(persistedScores.size).toBe(1);
    expect(persistedScores.get(first.snapshotHash!)?.computed_at).toBe('2026-11-20T10:00:00Z');
  });

  it('gère aussi le repli scalaire pour les sessions sans positions_timed mais avec distance_km / dplus_m / duration_min', async () => {
    const scalarOnlySession = makeSession({
      id: '73100000-0000-4000-8000-000000000099',
      positions_timed: null,
      positions_geojson: null,
      distance_km: 12.4,
      dplus_m: 850,
      duration_min: 240,
    });

    const segmentation = await buildEffortSegmentsForSession(scalarOnlySession);
    expect(segmentation.mode).toBe('direct_scalar_fallback');
    expect(segmentation.surfaceFallback).toBe('dirt');
    expect(segmentation.terrainFactorEta).toBe(1.10);
    expect(segmentation.segments.length).toBeGreaterThan(0);

    const { client, persistedScores } = createShadowTestClient({
      session: scalarOnlySession,
      shadowEnabled: true,
      consents: { personal_performance: true },
    });

    const shadow = await evaluateHikeSessionEffortShadow(scalarOnlySession, client);
    expect(shadow.status).toBe('persisted');
    expect(shadow.segmentationMode).toBe('direct_scalar_fallback');
    expect(persistedScores.size).toBe(1);
  });
});

describe('Lot P3 — Lotissement idempotent des 141 hike_sessions dans le budget /api/cron/daily (270 s / ~155 s)', () => {
  // Reproduit la distribution exacte des 141 hike_sessions auditées en production :
  // 120 avec positions_timed, 9 avec LineString legacy, 12 scalaires sans géométrie.
  const prodLike141Sessions: HikeSessionRow[] = Array.from({ length: 141 }, (_, idx) => {
    const id = `73100000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`;
    if (idx < 120) {
      return makeSession({
        id,
        positions_timed: buildTimedPositions(12, idx % 2 === 0),
        distance_km: 8 + (idx % 10),
        dplus_m: 300 + (idx % 8) * 100,
        duration_min: 150 + (idx % 6) * 20,
      });
    }
    if (idx < 129) {
      return makeSession({
        id,
        positions_timed: null,
        positions_geojson: {
          type: 'LineString',
          coordinates: [
            [6.85, 45.9, 1000],
            [6.855, 45.905, 1080],
            [6.86, 45.91, 1160],
            [6.865, 45.915, 1240],
          ],
        },
        distance_km: 6.5,
        dplus_m: 240,
        duration_min: 110,
      });
    }
    return makeSession({
      id,
      positions_timed: null,
      positions_geojson: null,
      distance_km: 10.0,
      dplus_m: 500,
      duration_min: 200,
    });
  });

  it('découpe les 141 hike_sessions en 6 lots de 25 dans le budget disponible (~155 s sur 270 s)', () => {
    expect(DAILY_BUDGET_MS).toBe(270_000);
    expect(DAILY_AVAILABLE_EFFORT_SHADOW_BUDGET_MS).toBe(155_000);
    expect(EFFORT_SHADOW_BATCH_SIZE).toBe(25);

    const plan = planEffortShadowDailyBatches(prodLike141Sessions);
    expect(plan.totalCandidateCount).toBe(141);
    expect(plan.plannedSessionCount).toBe(141);
    expect(plan.deferredCount).toBe(0);
    expect(plan.batches).toHaveLength(6);
    expect(plan.batches[0]).toHaveLength(25);
    expect(plan.batches[5]).toHaveLength(16);
    expect(plan.effectiveBudgetMs).toBeLessThanOrEqual(DAILY_AVAILABLE_EFFORT_SHADOW_BUDGET_MS);
    expect(plan.minRemainingMs).toBe(DAILY_MIN_START_MS);
  });

  it('évalue les 141 hike_sessions en mode shadow quand trail_segments = 0 et garantit l’idempotence au rejeu', async () => {
    const persistedScores = new Map<string, EffortScoreShadowPersistRow>();

    const evaluateOne = async (session: HikeSessionRow) => {
      const { client } = createShadowTestClient({
        session,
        shadowEnabled: true,
        consents: { personal_performance: true },
      });
      client.persistEffortScoreShadow = async (row) => {
        if (persistedScores.has(row.snapshot_hash)) return false;
        persistedScores.set(row.snapshot_hash, row);
        return true;
      };
      return evaluateHikeSessionEffortShadow(session, client);
    };

    const firstRun = await runIdempotentEffortShadowBatches({
      sessions: prodLike141Sessions,
      evaluateSession: evaluateOne,
    });

    expect(firstRun.totalCandidates).toBe(141);
    expect(firstRun.batchesPlanned).toBe(6);
    expect(firstRun.batchesCompleted).toBe(6);
    expect(firstRun.persisted).toBe(141);
    expect(firstRun.skippedDuplicate).toBe(0);
    expect(firstRun.failed).toBe(0);
    expect(firstRun.deferredByBudget).toBe(0);
    expect(firstRun.withinAvailableBudget).toBe(true);
    expect(firstRun.elapsedMs).toBeLessThan(DAILY_AVAILABLE_EFFORT_SHADOW_BUDGET_MS);
    expect(persistedScores.size).toBe(141);

    // Rejeu idempotent (Contrat C : ON CONFLICT (snapshot_hash) DO NOTHING)
    const secondRun = await runIdempotentEffortShadowBatches({
      sessions: prodLike141Sessions,
      evaluateSession: evaluateOne,
    });

    expect(secondRun.persisted).toBe(0);
    expect(secondRun.skippedDuplicate).toBe(141);
    expect(secondRun.failed).toBe(0);
    expect(persistedScores.size).toBe(141);
  });

  it('s’arrête proprement avant épuisement du budget (~155 s) et reporte le reliquat au tir suivant', async () => {
    let fakeNowMs = 0;
    const summary = await runIdempotentEffortShadowBatches({
      sessions: prodLike141Sessions,
      options: {
        batchSize: 25,
        availableBudgetMs: 50_000,
        taskTimeoutMs: 50_000,
        minRemainingMs: 10_000,
      },
      nowMs: () => fakeNowMs,
      evaluateSession: async (session) => {
        // Chaque session consomme 1 000 ms simulées : après 40 sessions (40 s),
        // il reste 10 s == minRemainingMs, la 41e session (remaining < 10 s) est différée.
        fakeNowMs += 1_000;
        return {
          status: 'persisted',
          snapshotHash: session.id.replace(/-/g, '').padEnd(64, 'a'),
        };
      },
    });

    expect(summary.persisted).toBe(41);
    expect(summary.deferredByBudget).toBe(100);
    expect(summary.batchesCompleted).toBe(1);
    expect(summary.withinAvailableBudget).toBe(true);
  });
});

describe('Lot P3 — Vérification structurelle de la migration SQL, du rollback down et de la suite pgTAP RLS', () => {
  const upSql = readFileSync(
    path.join(ROOT, 'supabase/migrations/20261120143000_effort_engine_v1.sql'),
    'utf8'
  );
  const downSql = readFileSync(
    path.join(ROOT, 'supabase/migrations_down/20261120143000_effort_engine_v1.down.sql'),
    'utf8'
  );
  const pgtapSql = readFileSync(
    path.join(ROOT, 'supabase/tests/effort_engine_rls.pgtap.sql'),
    'utf8'
  );

  it('la migration up déclare user_physiology, effort_scores, posterior, group_prediction_members, consentements rétrocompatibles et flags shadow à false', () => {
    // 1. user_physiology + ENABLE & FORCE RLS + policies (SELECT auth.uid()) = user_id
    expect(upSql).toMatch(/CREATE TABLE IF NOT EXISTS public\.user_physiology/i);
    expect(upSql).toMatch(/ALTER TABLE public\.user_physiology ENABLE ROW LEVEL SECURITY/i);
    expect(upSql).toMatch(/ALTER TABLE public\.user_physiology FORCE ROW LEVEL SECURITY/i);
    for (const pol of ['select_own', 'insert_own', 'update_own', 'delete_own']) {
      expect(upSql).toContain(`CREATE POLICY "${pol}"`);
    }
    expect(upSql).toContain('USING ((SELECT auth.uid()) = user_id)');

    // 2. effort_scores + Contrat C ON CONFLICT (snapshot_hash) DO NOTHING
    expect(upSql).toMatch(/CREATE TABLE IF NOT EXISTS public\.effort_scores/i);
    expect(upSql).toMatch(/snapshot_hash text NOT NULL UNIQUE/i);
    expect(upSql).toMatch(/data_level text NOT NULL CHECK \(data_level IN \('socle', 'cardio', 'complet'\)\)/i);
    expect(upSql).toMatch(/ON CONFLICT \(snapshot_hash\) DO NOTHING/i);

    // 3. posterior jsonb sur user_performance_profiles
    expect(upSql).toMatch(/ALTER TABLE public\.user_performance_profiles[\s\S]*ADD COLUMN IF NOT EXISTS posterior jsonb/i);

    // 4. scope + member_user_id sur route_predictions + table group_prediction_members
    expect(upSql).toMatch(/ALTER TABLE public\.route_predictions[\s\S]*ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'solo'/i);
    expect(upSql).toMatch(/CREATE TABLE IF NOT EXISTS public\.group_prediction_members/i);
    expect(upSql).toMatch(/ALTER TABLE public\.group_prediction_members FORCE ROW LEVEL SECURITY/i);
    expect(upSql).toMatch(/USING \(member_user_id = \(SELECT auth\.uid\(\)\)\)/i);

    // 5. Rétrocompatibilité adventure_data_consents.purpose
    for (const purpose of [
      'personal_performance',
      'collective_terrain',
      'collective_aggregation',
      'terrain_contribution',
      'personal_scoring',
      'wearable_sync',
      'group_simulation',
      'anonymized_calibration',
    ]) {
      expect(upSql).toContain(`'${purpose}'`);
    }

    // 6. Feature flags shadow à false par défaut
    expect(upSql).toMatch(/\('effort_score_v1_shadow',\s*false\)/i);
    expect(upSql).toMatch(/\('group_prediction_v2_shadow',\s*false\)/i);
  });

  it('la migration down annule proprement les tables, colonnes et flags sans supprimer les consentements personal_performance existants', () => {
    expect(downSql).toMatch(/DELETE FROM public\.feature_flags[\s\S]*'effort_score_v1_shadow'/i);
    expect(downSql).toMatch(/DROP TABLE IF EXISTS public\.group_prediction_members CASCADE/i);
    expect(downSql).toMatch(/DROP TABLE IF EXISTS public\.effort_scores CASCADE/i);
    expect(downSql).toMatch(/DROP TABLE IF EXISTS public\.user_physiology CASCADE/i);
    expect(downSql).toMatch(/DROP COLUMN IF EXISTS posterior/i);
    expect(downSql).toMatch(/DROP COLUMN IF EXISTS member_user_id/i);
    expect(downSql).toMatch(/DROP COLUMN IF EXISTS scope/i);
    expect(downSql).toContain("'personal_performance'");
  });

  it('la suite pgTAP couvre l’isolation A vs B et les upserts ON CONFLICT sous RLS', () => {
    expect(pgtapSql).toMatch(/SELECT plan\(30\);/i);
    expect(pgtapSql).toMatch(/ON CONFLICT \(user_id\) DO UPDATE/i);
    expect(pgtapSql).toMatch(/ON CONFLICT \(user_id, purpose, policy_version\) DO UPDATE/i);
    expect(pgtapSql).toMatch(/ON CONFLICT \(snapshot_hash\) DO NOTHING/i);
    expect(pgtapSql).toMatch(/public\.group_prediction_members/i);
    expect(pgtapSql).toMatch(/scope = 'member'/i);
    expect(pgtapSql).toMatch(/SELECT \* FROM finish\(\);/i);
  });

  it('computeEffortScoreV1Shadow produit un score déterministe conforme à EffortScoreOutputSchema', async () => {
    const session = makeSession();
    const segs = await buildEffortSegmentsForSession(session);
    const out = await computeEffortScoreV1Shadow({
      segments: segs.segments,
      weather: { tempC: 12, windMs: 3, precipMmPerH: 0 },
      ground: { surface: 'dirt', snowSinkCm: 0, terrainFactorEta: 1.10, wetness: 0 },
      pack: { packWeightKg: 7 },
      physiology: { weightKg: 70 },
      dataLevel: 'socle',
      snapshot: {
        modelVersion: 'effort-score-v1',
        profileVersion: 'socle-v1',
        routeFeatureVersion: 'direct-v1',
        equipmentSnapshot: 'pack-7kg',
        contextSnapshot: 'dirt-12c',
        scenario: 'unit-test',
      },
      evidence: [
        {
          value: 70,
          unit: 'kg',
          source: 'socle_default',
          kind: 'imputed',
          quality: 0.5,
          capturedAt: '2026-11-20T12:00:00Z',
        },
      ],
    });

    expect(out.scoreVersion).toBe('effort-score-v1');
    expect(out.dataLevel).toBe('socle');
    expect(out.iea).toBeGreaterThan(0);
    expect(out.warnings.some((w) => w.code === 'imputed_physiology')).toBe(true);
  });
});

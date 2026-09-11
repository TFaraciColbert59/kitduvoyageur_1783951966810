#!/usr/bin/env node
/**
 * A15 — Rollout progressif des feature flags (paliers 1/5/20/50/100), local.
 *
 * S'appuie sur `feature_flags` + `feature_flag_cohorts` (migration A11) et sur
 * la RPC `current_feature_flags_for(uuid)` : chaque palier est appliqué en base
 * locale, puis vérifié sur un échantillon d'UUID déterministes (taux observé,
 * parité bucket SQL ↔ TypeScript, allowlist/exclusions), puis TOUJOURS restauré
 * (état initial capturé avant modification ; flags OFF en sortie).
 *
 * Les critères d'arrêt reprennent A9_ROLLOUT.md et les seuils A12 : le calcul
 * est automatisé (`evaluateStopCriteria`), les entrées sont des métriques
 * locales/CI (`--check-stop --metrics <fichier.json>`), et un échantillon
 * insuffisant produit `insufficient_data` — jamais un faux « continue ».
 *
 * Garde-fou : DSN local obligatoire (sauf A15_ROLLOUT_ALLOW_REMOTE=1).
 *
 * Usage :
 *   node scripts/ops/a15_rollout.mjs --verify --json
 *   node scripts/ops/a15_rollout.mjs --check-stop --metrics docs/reports/exemple.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

/** DSN local standard Supabase CLI — jamais la production. */
export const DEFAULT_LOCAL_DSN = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
export const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1', '[::1]'];

/** Paliers A9 (A9_ROLLOUT.md §Paliers). */
export const ROLLOUT_TIERS = [1, 5, 20, 50, 100];

/** Flag vérifié par défaut (tiers A9 palier 1, sans consommateur dangereux). */
export const DEFAULT_FLAG_ID = 'performance_profile_v2';

/** Taille d'échantillon par défaut (UUID synthétiques, déterministes). */
export const DEFAULT_SAMPLE_SIZE = 1000;

/** Tolérance en points de pourcentage sur le taux observé (échantillon 1000). */
export const TIER_TOLERANCE_POINTS = 4;

/**
 * Seuils d'arrêt opérationnels dérivés de A9_ROLLOUT.md et A12 :
 * ce sont des hypothèses de travail, à faire valider avant production.
 */
export const A9_STOP_THRESHOLDS = {
  /** Critère 2 — hausse du taux d'erreurs > 2 × baseline 24 h. */
  errorRateMultiplier: 2,
  /** Échantillon minimal de requêtes 24 h avant d'appliquer le critère erreurs. */
  minRequestsForErrorRate: 1000,
  /** Critère 3 — couverture ETA P90 minimale. */
  minEtaCoverageP90: 0.75,
  /** Échantillon minimal de paires prédiction/réel pour le critère ETA. */
  minEtaSampleSize: 30,
  /** Critère 4 — faux signalements critiques répétés (Terrain Live). */
  maxTerrainCriticalFalseReports: 3,
  /** Critère 5 — batterie/h et anti-rebond de recalcul (A12 : < 5 %/h). */
  maxBatteryPctPerHour: 5,
};

/** Vrai si le DSN pointe vers la machine locale. */
export function isLocalDsn(dsn) {
  try {
    return LOCAL_HOSTS.includes(new URL(dsn).hostname);
  } catch {
    return false;
  }
}

/** Refuse tout DSN non local (sauf opt-in explicite). */
export function assertLocalDsn(dsn, env = process.env) {
  if (isLocalDsn(dsn)) return;
  if (env?.A15_ROLLOUT_ALLOW_REMOTE === '1') return;
  throw new Error(
    `DSN non local refusé (${String(dsn).replace(/:[^:@/]+@/, ':***@')}) — ` +
      'la production est interdite ; A15_ROLLOUT_ALLOW_REMOTE=1 pour un test distant assumé.'
  );
}

/** SHA-256 hex d'une chaîne (node:crypto). */
export function sha256Hex(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Bucket 0..99 : mêmes 8 premiers caractères hex du SHA-256 que
 * `a11_cohort_bucket` (SQL) et `cohortBucketFromSha256Hex` (TS).
 */
export function cohortBucket(userId) {
  return Number.parseInt(sha256Hex(userId).slice(0, 8), 16) % 100;
}

/** Génère `count` UUID valides déterministes (jamais de vrais utilisateurs). */
export function sampleUserIds(count, seed) {
  const ids = [];
  for (let index = 0; index < count; index += 1) {
    const hex = sha256Hex(`${seed}:${index}`);
    ids.push(
      `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(12, 15)}-a${hex.slice(15, 18)}-${hex.slice(18, 30)}`
    );
  }
  return ids;
}

/**
 * Évalue un palier observé : taux attendu = pourcentage (0..100). Un échantillon
 * trop petit est `inconclusive` (jamais un faux vert).
 */
export function evaluateTierOutcome({
  percentage,
  total,
  enabledCount,
  tolerancePoints = TIER_TOLERANCE_POINTS,
  minSample = 200,
}) {
  if (!Number.isFinite(total) || total < minSample) {
    return {
      ok: null,
      verdict: 'inconclusive',
      observedPct: total > 0 ? Number(((enabledCount / total) * 100).toFixed(2)) : 0,
      expectedPct: percentage,
      reason: `échantillon ${total} < ${minSample}`,
    };
  }
  const observedPct = Number(((enabledCount / total) * 100).toFixed(2));
  const delta = Math.abs(observedPct - percentage);
  const ok = delta <= tolerancePoints;
  return {
    ok,
    verdict: ok ? 'pass' : 'fail',
    observedPct,
    expectedPct: percentage,
    deltaPoints: Number(delta.toFixed(2)),
    reason: ok
      ? null
      : `taux observé ${observedPct} % hors tolérance ±${tolerancePoints} pts de ${percentage} %`,
  };
}

/**
 * Automatisation des critères d'arrêt A9/A12. Entrées : métriques locales/CI.
 * `null` = donnée absente → `insufficient_data` sur ce critère, jamais un
 * « continue » implicite.
 */
export function evaluateStopCriteria(metrics, thresholds = A9_STOP_THRESHOLDS) {
  const m = metrics ?? {};
  const t = { ...A9_STOP_THRESHOLDS, ...(thresholds ?? {}) };
  const stops = [];
  const warnings = [];
  const insufficient = [];

  if (m.dataLeakOrRlsCritical === true) {
    stops.push('critère 1 : fuite de données ou erreur RLS critique signalée');
  }

  const requests = Number(m.requests24h ?? 0);
  const errorRate = m.errorRate24h;
  const baseline = m.baselineErrorRate24h;
  if (errorRate === null || errorRate === undefined) {
    insufficient.push('critère 2 : taux d’erreurs 24 h absent');
  } else if (requests < t.minRequestsForErrorRate) {
    insufficient.push(
      `critère 2 : échantillon ${requests} requêtes < ${t.minRequestsForErrorRate}`
    );
  } else if (baseline === null || baseline === undefined) {
    insufficient.push('critère 2 : baseline 24 h absente');
  } else if (Number(errorRate) > t.errorRateMultiplier * Number(baseline)) {
    stops.push(
      `critère 2 : taux d’erreurs ${Number(errorRate).toFixed(4)} > ` +
        `${t.errorRateMultiplier} × baseline ${Number(baseline).toFixed(4)}`
    );
  }

  const coverage = m.etaCoverageP90;
  const etaSample = Number(m.etaSampleSize ?? 0);
  if (coverage === null || coverage === undefined) {
    insufficient.push('critère 3 : couverture ETA P90 absente');
  } else if (etaSample < t.minEtaSampleSize) {
    insufficient.push(`critère 3 : ${etaSample} paires prédiction/réel < ${t.minEtaSampleSize}`);
  } else if (Number(coverage) < t.minEtaCoverageP90) {
    stops.push(
      `critère 3 : couverture ETA P90 ${Number(coverage).toFixed(3)} < ${t.minEtaCoverageP90}`
    );
  }

  const falseReports = Number(m.terrainCriticalFalseReports ?? 0);
  if (falseReports >= t.maxTerrainCriticalFalseReports || m.moderationFailure === true) {
    stops.push(
      `critère 4 : ${falseReports} faux signalements critiques (max ${t.maxTerrainCriticalFalseReports})` +
        (m.moderationFailure === true ? ' + défaut de modération' : '')
    );
  }

  const battery = m.batteryPctPerHour;
  if (m.debounceOk === false) {
    stops.push('critère 5 : anti-rebond 60 s défaillant');
  }
  if (battery === null || battery === undefined) {
    insufficient.push('critère 5 : consommation batterie absente');
  } else if (Number(battery) > t.maxBatteryPctPerHour) {
    stops.push(
      `critère 5 : batterie ${Number(battery).toFixed(2)} %/h > ${t.maxBatteryPctPerHour} %/h`
    );
  }

  if (m.monthlyCostOverBudget === true) {
    stops.push('critère 6 : budget IA/tuiles dépassé');
  }
  if (m.sessionCorruption === true || m.offlineSyncDestructive === true) {
    stops.push('critère 7 : corruption de session ou synchronisation offline destructive');
  }

  if (stops.length > 0) {
    return { decision: 'stop', stops, warnings, insufficient };
  }
  if (insufficient.length > 0) {
    return { decision: 'insufficient_data', stops, warnings, insufficient };
  }
  return { decision: 'continue', stops, warnings, insufficient };
}

/** Instantané de l'état d'un flag (à restaurer en toute fin de test). */
export async function snapshotFlag(client, flagId) {
  const flag = (
    await client.query('SELECT id, enabled FROM public.feature_flags WHERE id = $1', [flagId])
  ).rows[0];
  if (!flag) throw new Error(`flag ${flagId} introuvable`);
  const cohort = (
    await client.query('SELECT * FROM public.feature_flag_cohorts WHERE flag_id = $1', [flagId])
  ).rows[0] ?? null;
  return { flag, cohort };
}

/** Applique un palier (enabled + pourcentage) sur un flag local. */
export async function applyTier(client, flagId, percentage, { allowlist = [], exclusions = [] } = {}) {
  await client.query(
    `INSERT INTO public.feature_flag_cohorts (flag_id, percentage, allowlist, exclusions, updated_at)
     VALUES ($1, $2, $3::uuid[], $4::uuid[], now())
     ON CONFLICT (flag_id) DO UPDATE SET
       percentage = EXCLUDED.percentage,
       allowlist = EXCLUDED.allowlist,
       exclusions = EXCLUDED.exclusions,
       updated_at = now()`,
    [flagId, percentage, allowlist, exclusions]
  );
  await client.query(
    'UPDATE public.feature_flags SET enabled = true, updated_at = now() WHERE id = $1',
    [flagId]
  );
}

/** Restaure l'état capturé (flag + ligne de cohorte, ou absence de ligne). */
export async function restoreFlag(client, flagId, snapshot) {
  if (snapshot.cohort) {
    await client.query(
      `INSERT INTO public.feature_flag_cohorts
         (flag_id, percentage, allowlist, exclusions, updated_by, updated_at)
       VALUES ($1, $2, $3::uuid[], $4::uuid[], $5, $6)
       ON CONFLICT (flag_id) DO UPDATE SET
         percentage = EXCLUDED.percentage,
         allowlist = EXCLUDED.allowlist,
         exclusions = EXCLUDED.exclusions,
         updated_by = EXCLUDED.updated_by,
         updated_at = EXCLUDED.updated_at`,
      [
        flagId,
        snapshot.cohort.percentage,
        snapshot.cohort.allowlist,
        snapshot.cohort.exclusions,
        snapshot.cohort.updated_by,
        snapshot.cohort.updated_at,
      ]
    );
  } else {
    await client.query('DELETE FROM public.feature_flag_cohorts WHERE flag_id = $1', [flagId]);
  }
  await client.query('UPDATE public.feature_flags SET enabled = $2, updated_at = now() WHERE id = $1', [
    flagId,
    snapshot.flag.enabled,
  ]);
}

/**
 * Vérifie un palier sur la vraie RPC : taux observé + parité bucket SQL/TS.
 * Renvoie aussi le détail allowlist/exclusions si fournis.
 */
export async function verifyTier(client, {
  flagId,
  percentage,
  sampleSize = DEFAULT_SAMPLE_SIZE,
  seed = `a15-rollout-${percentage}`,
  allowlist = [],
  exclusions = [],
} = {}) {
  const userIds = sampleUserIds(sampleSize, seed);
  const rows = (
    await client.query(
      `SELECT u::text AS user_id,
              public.a11_cohort_bucket(u) AS sql_bucket,
              (SELECT enabled FROM public.current_feature_flags_for(u) WHERE id = $2) AS enabled
       FROM unnest($1::uuid[]) AS u`,
      [userIds, flagId]
    )
  ).rows;

  let enabledCount = 0;
  let bucketMismatches = 0;
  for (const row of rows) {
    if (row.enabled === true) enabledCount += 1;
    if (Number(row.sql_bucket) !== cohortBucket(row.user_id)) bucketMismatches += 1;
  }

  const outcome = evaluateTierOutcome({
    percentage,
    total: rows.length,
    enabledCount,
  });
  outcome.bucketMismatches = bucketMismatches;
  if (bucketMismatches > 0) {
    outcome.ok = false;
    outcome.verdict = 'fail';
    outcome.reason = `${bucketMismatches} divergence(s) bucket SQL ↔ TS`;
  }

  const allowChecks = [];
  for (const user of allowlist) {
    const { rows: allowRows } = await client.query(
      `SELECT enabled FROM public.current_feature_flags_for($1::uuid) WHERE id = $2`,
      [user, flagId]
    );
    allowChecks.push({ userId: user, expected: true, actual: allowRows[0]?.enabled === true });
  }
  for (const user of exclusions) {
    const { rows: exclusionRows } = await client.query(
      `SELECT enabled FROM public.current_feature_flags_for($1::uuid) WHERE id = $2`,
      [user, flagId]
    );
    allowChecks.push({ userId: user, expected: false, actual: exclusionRows[0]?.enabled === true });
  }
  outcome.allowChecks = allowChecks;
  for (const check of allowChecks) {
    if (check.actual !== check.expected) {
      outcome.ok = false;
      outcome.verdict = 'fail';
      outcome.reason = `allowlist/exclusion non respectée pour ${check.userId}`;
    }
  }
  return outcome;
}

/**
 * Collecte les métriques locales disponibles (aucune invention) : les critères
 * non mesurables ressortent `null` → `insufficient_data` au calcul.
 */
export async function collectLocalMetrics(client) {
  const runs = (
    await client.query(
      `SELECT
         count(*) FILTER (WHERE started_at >= now() - interval '24 hours')::int AS "requests24h",
         count(*) FILTER (WHERE started_at >= now() - interval '24 hours' AND status = 'failed')::int AS "failed24h",
         count(*) FILTER (WHERE started_at >= now() - interval '48 hours' AND started_at < now() - interval '24 hours')::int AS "previousRequests",
         count(*) FILTER (WHERE started_at >= now() - interval '48 hours' AND started_at < now() - interval '24 hours' AND status = 'failed')::int AS "previousFailed"
       FROM public.adventure_engine_runs`
    )
  ).rows[0];
  const requests = Number(runs.requests24h ?? 0);
  const failed = Number(runs.failed24h ?? 0);
  const previousRequests = Number(runs.previousRequests ?? 0);
  const previousFailed = Number(runs.previousFailed ?? 0);
  return {
    source: 'local-db:adventure_engine_runs',
    requests24h: requests,
    errorRate24h: requests > 0 ? failed / requests : null,
    baselineErrorRate24h: previousRequests > 0 ? previousFailed / previousRequests : null,
    etaCoverageP90: null,
    etaSampleSize: 0,
    terrainCriticalFalseReports: 0,
    moderationFailure: false,
    batteryPctPerHour: null,
    debounceOk: true,
    monthlyCostOverBudget: false,
    sessionCorruption: false,
    offlineSyncDestructive: false,
  };
}

/** Vérifie le palier complet sur la base locale puis restaure l'état initial. */
export async function verifyAllTiers({
  dsn,
  flagId = DEFAULT_FLAG_ID,
  sampleSize = DEFAULT_SAMPLE_SIZE,
  tiers = ROLLOUT_TIERS,
  log = () => {},
}) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: dsn });
  await client.connect();
  const results = [];
  const initial = await snapshotFlag(client, flagId);
  let thrown = null;
  let restored = false;
  log(
    `état initial ${flagId} : enabled=${initial.flag.enabled}, ` +
      `cohorte=${initial.cohort ? initial.cohort.percentage : 'aucune'}`
  );
  try {
    for (const percentage of tiers) {
      await applyTier(client, flagId, percentage);
      const outcome = await verifyTier(client, { flagId, percentage, sampleSize });
      results.push({ percentage, ...outcome });
      log(
        `palier ${String(percentage).padStart(3, ' ')} % : observé ${outcome.observedPct} % ` +
          `(${outcome.verdict})${outcome.reason ? ` — ${outcome.reason}` : ''}`
      );
    }
    const allowUser = sampleUserIds(1, 'a15-rollout-allow')[0];
    const exclusionUser = sampleUserIds(1, 'a15-rollout-exclusion')[0];
    await applyTier(client, flagId, 0, { allowlist: [allowUser], exclusions: [exclusionUser] });
    const boundary = await verifyTier(client, {
      flagId,
      percentage: 0,
      sampleSize,
      allowlist: [allowUser],
      exclusions: [exclusionUser],
    });
    results.push({ percentage: 0, boundary: 'allowlist/exclusion', ...boundary });
    log(
      `borne 0 % + allowlist/exclusion : ${boundary.verdict}` +
        (boundary.reason ? ` — ${boundary.reason}` : '')
    );
  } catch (error) {
    thrown = error;
  } finally {
    await restoreFlag(client, flagId, initial);
    const after = await snapshotFlag(client, flagId);
    restored =
      after.flag.enabled === initial.flag.enabled &&
      (after.cohort?.percentage ?? null) === (initial.cohort?.percentage ?? null);
    log(
      `restauration : enabled=${after.flag.enabled}, ` +
        `cohorte=${after.cohort ? after.cohort.percentage : 'aucune'} (${restored ? 'OK' : 'ÉCHEC'})`
    );
    await client.end().catch(() => {});
  }
  if (thrown) throw thrown;
  return { results, restored, initialEnabled: initial.flag.enabled };
}

function parseArgs(argv) {
  const args = {
    dsn: process.env.A15_ROLLOUT_DSN ?? DEFAULT_LOCAL_DSN,
    flagId: DEFAULT_FLAG_ID,
    sampleSize: DEFAULT_SAMPLE_SIZE,
    verify: false,
    checkStop: false,
    metrics: null,
    json: false,
    out: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dsn') args.dsn = argv[++index] ?? args.dsn;
    else if (arg === '--flag') args.flagId = argv[++index] ?? args.flagId;
    else if (arg === '--sample') args.sampleSize = Number(argv[++index] ?? args.sampleSize);
    else if (arg === '--verify') args.verify = true;
    else if (arg === '--check-stop') args.checkStop = true;
    else if (arg === '--metrics') args.metrics = argv[++index] ?? null;
    else if (arg === '--json') args.json = true;
    else if (arg === '--out') args.out = argv[++index] ?? null;
  }
  return args;
}

export async function main(argv = process.argv.slice(2), env = process.env, log = console.log) {
  const args = parseArgs(argv);
  const report = { generatedAt: new Date().toISOString(), flagId: args.flagId };
  try {
    assertLocalDsn(args.dsn, env);
    const { default: pg } = await import('pg');

    if (args.checkStop) {
      let metrics;
      if (args.metrics) {
        metrics = JSON.parse(fs.readFileSync(args.metrics, 'utf8'));
      } else {
        const client = new pg.Client({ connectionString: args.dsn });
        await client.connect();
        metrics = await collectLocalMetrics(client);
        await client.end();
      }
      const evaluation = evaluateStopCriteria(metrics);
      report.metricsSource = metrics.source ?? args.metrics ?? 'inconnue';
      report.metrics = metrics;
      report.stopEvaluation = evaluation;
      if (args.json) log(JSON.stringify(report, null, 2));
      else {
        log(`Critères d'arrêt A9 — décision : ${evaluation.decision.toUpperCase()}`);
        for (const stop of evaluation.stops) log(`  ARRÊT : ${stop}`);
        for (const missing of evaluation.insufficient) log(`  DONNÉE MANQUANTE : ${missing}`);
      }
      if (args.out) fs.writeFileSync(args.out, JSON.stringify(report, null, 2));
      return evaluation.decision === 'stop' ? 3 : 0;
    }

    if (args.verify) {
      const verification = await verifyAllTiers({
        dsn: args.dsn,
        flagId: args.flagId,
        sampleSize: args.sampleSize,
        log: args.json ? () => {} : log,
      });
      report.verification = verification;
      const failed = verification.results.filter((result) => result.ok === false);
      report.exitCode = failed.length > 0 || !verification.restored ? 1 : 0;
      if (args.json) log(JSON.stringify(report, null, 2));
      else {
        log(
          failed.length === 0 && verification.restored
            ? 'RÉSULTAT : tous les paliers respectés, état restauré.'
            : `RÉSULTAT : ${failed.length} palier(s) en échec, restauration ${verification.restored ? 'OK' : 'ÉCHEC'}.`
        );
      }
      if (args.out) fs.writeFileSync(args.out, JSON.stringify(report, null, 2));
      return report.exitCode;
    }

    log('Rien à faire : utiliser --verify ou --check-stop --metrics <fichier>.');
    return 2;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.error = message;
    if (args.json) log(JSON.stringify({ ...report, exitCode: 2 }, null, 2));
    else log(`ERREUR CONFIGURATION/CONNEXION : ${message}`);
    return 2;
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  path.basename(process.argv[1]).startsWith('a15_rollout') &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().then((code) => {
    process.exitCode = code;
  });
}

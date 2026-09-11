#!/usr/bin/env node
/**
 * A14 — Healthcheck Ops (observabilité Adventure Intelligence).
 *
 * Usage :
 *   node scripts/ops/a14_healthcheck.mjs                     # base locale par défaut
 *   node scripts/ops/a14_healthcheck.mjs --snapshot <file>   # évalue un instantané JSON (tests)
 *   node scripts/ops/a14_healthcheck.mjs --json              # sortie JSON machine
 *   node scripts/ops/a14_healthcheck.mjs --dsn <url>         # DSN explicite (local uniquement)
 *
 * Variables d'environnement :
 *   A14_HEALTHCHECK_DSN              — DSN PostgreSQL (défaut local 127.0.0.1:54322).
 *   A14_HEALTHCHECK_SNAPSHOT         — chemin d'un instantané JSON (mode hors-ligne).
 *   A14_HEALTHCHECK_ALLOW_REMOTE=1   — autorise un DSN non local (INTERDIT en prod ;
 *                                      garde-fou anti-production explicite).
 *
 * Codes de sortie :
 *   0 — sain (tous les seuils respectés)
 *   1 — dégradé (au moins un seuil dépassé)
 *   2 — connexion/configuration impossible (jamais un faux « sain »)
 *
 * La couverture 5xx HTTP n'est pas mesurable sur la base locale : les seuils
 * HTTP sont documentés dans docs/reports/A14_OBSERVABILITY.md et vérifiés en
 * production uniquement (plateforme d'hébergement).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** DSN local standard Supabase CLI — jamais la production. */
export const DEFAULT_LOCAL_DSN = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/** Hôtes autorisés sans opt-in explicite (garde-fou anti-production). */
export const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1', '[::1]'];

export const DEFAULT_THRESHOLDS = {
  /** File domaine : événements en attente. */
  maxPendingEvents: 50,
  /** Âge maximal du plus vieil événement en attente (minutes). */
  maxOldestPendingMinutes: 60,
  /** File générations : requêtes en attente. */
  maxPendingGenerationRequests: 20,
  /** Âge maximal d'une génération en attente (minutes). */
  maxOldestGenerationMinutes: 30,
  /** Ratio d'échecs des runs moteurs sur 24 h (à partir de minRunsForFailureRatio). */
  maxFailedRunRatio: 0.2,
  /** Nombre minimal de runs 24 h avant d'appliquer le ratio d'échecs. */
  minRunsForFailureRatio: 10,
  /** Latence RPC moyenne maximale (ms) — `current_feature_flags()`. */
  maxRpcLatencyMs: 250,
  /** Nombre d'appels RPC chronométrés. */
  rpcSamples: 5,
};

/** Vrai si le DSN pointe vers une base locale (jamais la prod sans opt-in). */
export function isLocalDsn(dsn) {
  try {
    const url = new URL(dsn);
    return LOCAL_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Évalue un instantané de santé contre les seuils. Fonction pure :
 * aucune dépendance base, entièrement testable.
 */
export function evaluateHealth(snapshot, thresholds = DEFAULT_THRESHOLDS) {
  const t = { ...DEFAULT_THRESHOLDS, ...(thresholds ?? {}) };
  const checks = [];
  const failures = [];
  const warnings = [];

  const runs = snapshot?.db?.runs ?? {};
  const queues = snapshot?.db?.queues ?? {};
  const rpc = snapshot?.db?.rpc ?? {};

  const last24h = Number(runs.last24h ?? 0);
  const failed24h = Number(runs.failed24h ?? 0);
  const failedRatio = last24h > 0 ? failed24h / last24h : 0;

  checks.push({ id: 'engine_runs_total', value: Number(runs.total ?? 0), ok: true });

  let failedRatioOk = true;
  if (last24h >= t.minRunsForFailureRatio) {
    failedRatioOk = failedRatio <= t.maxFailedRunRatio;
  }
  checks.push({
    id: 'failed_run_ratio_24h',
    value: Number(failedRatio.toFixed(4)),
    threshold: t.maxFailedRunRatio,
    sample: last24h,
    ok: failedRatioOk,
  });
  if (!failedRatioOk) {
    failures.push(
      `runs moteurs : ${failed24h}/${last24h} échecs sur 24 h (ratio ${failedRatio.toFixed(2)} > ${t.maxFailedRunRatio})`
    );
  } else if (last24h > 0 && last24h < t.minRunsForFailureRatio && failed24h > 0) {
    warnings.push(
      `runs moteurs : ${failed24h} échec(s) sur ${last24h} run(s) — échantillon < ${t.minRunsForFailureRatio}, ratio non bloquant`
    );
  }

  const pendingEvents = Number(queues.pendingEvents ?? 0);
  const eventsOk = pendingEvents <= t.maxPendingEvents;
  checks.push({
    id: 'pending_domain_events',
    value: pendingEvents,
    threshold: t.maxPendingEvents,
    ok: eventsOk,
  });
  if (!eventsOk) {
    failures.push(
      `file événements domaine : ${pendingEvents} en attente > ${t.maxPendingEvents}`
    );
  }

  const oldestEventMinutes = Number(queues.oldestPendingEventMinutes ?? 0);
  const oldestEventOk = oldestEventMinutes <= t.maxOldestPendingMinutes;
  checks.push({
    id: 'oldest_pending_event_minutes',
    value: Number(oldestEventMinutes.toFixed(1)),
    threshold: t.maxOldestPendingMinutes,
    ok: oldestEventOk,
  });
  if (!oldestEventOk) {
    failures.push(
      `file événements domaine : plus vieil élément en attente depuis ${oldestEventMinutes.toFixed(1)} min > ${t.maxOldestPendingMinutes}`
    );
  }

  const pendingGeneration = Number(queues.pendingGenerationRequests ?? 0);
  const generationOk = pendingGeneration <= t.maxPendingGenerationRequests;
  checks.push({
    id: 'pending_generation_requests',
    value: pendingGeneration,
    threshold: t.maxPendingGenerationRequests,
    ok: generationOk,
  });
  if (!generationOk) {
    failures.push(
      `file générations : ${pendingGeneration} en attente > ${t.maxPendingGenerationRequests}`
    );
  }

  const oldestGenerationMinutes = Number(queues.oldestGenerationRequestMinutes ?? 0);
  const oldestGenerationOk = oldestGenerationMinutes <= t.maxOldestGenerationMinutes;
  checks.push({
    id: 'oldest_generation_request_minutes',
    value: Number(oldestGenerationMinutes.toFixed(1)),
    threshold: t.maxOldestGenerationMinutes,
    ok: oldestGenerationOk,
  });
  if (!oldestGenerationOk) {
    failures.push(
      `file générations : plus ancienne en attente depuis ${oldestGenerationMinutes.toFixed(1)} min > ${t.maxOldestGenerationMinutes}`
    );
  }

  const rpcAvgMs = Number(rpc.avgMs ?? 0);
  const rpcOk = rpcAvgMs <= t.maxRpcLatencyMs;
  checks.push({
    id: 'rpc_latency_avg_ms',
    value: Number(rpcAvgMs.toFixed(2)),
    threshold: t.maxRpcLatencyMs,
    samples: Number(rpc.samples ?? 0),
    ok: rpcOk,
  });
  if (!rpcOk) {
    failures.push(
      `latence RPC ${rpc.name ?? 'inconnue'} : ${rpcAvgMs.toFixed(1)} ms en moyenne > ${t.maxRpcLatencyMs} ms`
    );
  }

  return { ok: failures.length === 0, failures, warnings, checks };
}

/** Résumé français imprimable (aucune donnée personnelle). */
export function formatHealthFr(snapshot, evaluation) {
  const runs = snapshot?.db?.runs ?? {};
  const queues = snapshot?.db?.queues ?? {};
  const rpc = snapshot?.db?.rpc ?? {};
  const lines = [
    '=== A14 healthcheck Adventure Intelligence (base locale) ===',
    `Généré : ${snapshot?.generatedAt ?? 'inconnu'}`,
    `Runs moteurs : total=${runs.total ?? 'n/a'}, 24h=${runs.last24h ?? 'n/a'} ` +
      `(succès=${runs.succeeded24h ?? 'n/a'}, échecs=${runs.failed24h ?? 'n/a'}, ` +
      `skipped=${runs.skipped24h ?? 'n/a'}, durée moy=${runs.avgDurationMs ?? 'n/a'} ms, ` +
      `p95=${runs.p95DurationMs ?? 'n/a'} ms)`,
    `File événements domaine : attente=${queues.pendingEvents ?? 'n/a'}, ` +
      `échec=${queues.failedEvents ?? 'n/a'}, plus vieil en attente=${queues.oldestPendingEventMinutes ?? 0} min`,
    `File générations : attente=${queues.pendingGenerationRequests ?? 'n/a'}, ` +
      `plus ancienne=${queues.oldestGenerationRequestMinutes ?? 0} min`,
    `Latence RPC ${rpc.name ?? '?'} : moy=${rpc.avgMs ?? 'n/a'} ms (n=${rpc.samples ?? 0})`,
  ];
  for (const warning of evaluation.warnings) lines.push(`AVERTISSEMENT : ${warning}`);
  if (evaluation.ok) {
    lines.push('RÉSULTAT : SAIN (tous les seuils respectés).');
  } else {
    for (const failure of evaluation.failures) lines.push(`ÉCHEC : ${failure}`);
    lines.push(`RÉSULTAT : DÉGRADÉ (${evaluation.failures.length} seuil(s) dépassé(s)).`);
  }
  lines.push(
    '5xx HTTP : non mesurable localement — seuils documentés (prod) : alerte > 1 % sur 15 min, page > 5 %.'
  );
  return lines.join('\n');
}

/** Vérifie le DSN : local obligatoire sauf opt-in explicite. */
export function assertLocalDsn(dsn, env = process.env) {
  if (isLocalDsn(dsn)) return;
  if (env?.A14_HEALTHCHECK_ALLOW_REMOTE === '1') return;
  throw new Error(
    `DSN non local refusé (${dsn.replace(/:[^:@/]+@/, ':***@')}) — ` +
      'la production est interdite ; A14_HEALTHCHECK_ALLOW_REMOTE=1 pour un test distant assumé.'
  );
}

const RUNS_QUERY = `
SELECT
  count(*)::int AS total,
  count(*) FILTER (WHERE started_at >= now() - interval '24 hours')::int AS "last24h",
  count(*) FILTER (WHERE started_at >= now() - interval '24 hours' AND status = 'succeeded')::int AS "succeeded24h",
  count(*) FILTER (WHERE started_at >= now() - interval '24 hours' AND status = 'failed')::int AS "failed24h",
  count(*) FILTER (WHERE started_at >= now() - interval '24 hours' AND status = 'skipped')::int AS "skipped24h",
  round(avg(duration_ms) FILTER (WHERE started_at >= now() - interval '24 hours'))::int AS "avgDurationMs",
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)
    FILTER (WHERE started_at >= now() - interval '24 hours' AND duration_ms IS NOT NULL))::int AS "p95DurationMs",
  max(started_at)::text AS "latestStartedAt"
FROM public.adventure_engine_runs`;

const EVENTS_QUERY = `
SELECT
  count(*) FILTER (WHERE status = 'pending')::int AS "pendingEvents",
  count(*) FILTER (WHERE status = 'failed')::int AS "failedEvents",
  round(coalesce(extract(epoch FROM (now() - min(created_at) FILTER (WHERE status = 'pending'))) / 60, 0)::numeric, 1)::float AS "oldestPendingEventMinutes"
FROM public.adventure_domain_events`;

const GENERATION_QUERY = `
SELECT
  count(*) FILTER (WHERE status = 'pending')::int AS "pendingGenerationRequests",
  round(coalesce(extract(epoch FROM (now() - min(created_at) FILTER (WHERE status = 'pending'))) / 60, 0)::numeric, 1)::float AS "oldestGenerationRequestMinutes"
FROM public.adventure_generation_requests`;

/** Mesure la latence réelle de la RPC exportée `current_feature_flags()`. */
export async function measureRpcLatency(client, samples = DEFAULT_THRESHOLDS.rpcSamples) {
  const durations = [];
  for (let i = 0; i < samples; i += 1) {
    const start = performance.now();
    await client.query('SELECT public.current_feature_flags()');
    durations.push(performance.now() - start);
  }
  const sorted = [...durations].sort((a, b) => a - b);
  const avg = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)];
  return {
    name: 'current_feature_flags',
    samples: durations.length,
    avgMs: Number(avg.toFixed(2)),
    p95Ms: Number(p95.toFixed(2)),
  };
}

/** Collecte l'instantané complet sur une base réelle (lecture seule). */
export async function collectSnapshot({ databaseUrl, log = console.log } = {}) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const runs = (await client.query(RUNS_QUERY)).rows[0] ?? {};
    const events = (await client.query(EVENTS_QUERY)).rows[0] ?? {};
    const generation = (await client.query(GENERATION_QUERY)).rows[0] ?? {};
    const rpc = await measureRpcLatency(client);
    return {
      generatedAt: new Date().toISOString(),
      source: 'local-db',
      db: {
        runs,
        queues: { ...events, ...generation },
        rpc,
      },
    };
  } finally {
    await client.end().catch(() => {});
  }
}

function readSnapshotFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

function parseArgs(argv) {
  const args = { snapshot: null, dsn: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--snapshot') args.snapshot = argv[++i] ?? null;
    else if (arg === '--dsn') args.dsn = argv[++i] ?? null;
    else if (arg === '--json') args.json = true;
  }
  return args;
}

export async function main(argv = process.argv.slice(2), env = process.env, log = console.log) {
  const args = parseArgs(argv);
  const snapshotPath = args.snapshot ?? env.A14_HEALTHCHECK_SNAPSHOT ?? null;

  let snapshot;
  try {
    if (snapshotPath) {
      snapshot = readSnapshotFile(snapshotPath);
    } else {
      const dsn = args.dsn ?? env.A14_HEALTHCHECK_DSN ?? DEFAULT_LOCAL_DSN;
      assertLocalDsn(dsn, env);
      snapshot = await collectSnapshot({ databaseUrl: dsn });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (args.json) {
      log(JSON.stringify({ ok: false, exitCode: 2, error: message }));
    } else {
      log(`ERREUR CONNEXION/CONFIG : ${message}`);
    }
    return 2;
  }

  const evaluation = evaluateHealth(snapshot);
  if (args.json) {
    log(JSON.stringify({ snapshot, evaluation, exitCode: evaluation.ok ? 0 : 1 }, null, 2));
  } else {
    log(formatHealthFr(snapshot, evaluation));
  }
  return evaluation.ok ? 0 : 1;
}

const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  path.basename(process.argv[1]).startsWith('a14_healthcheck') &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().then((code) => {
    process.exitCode = code;
  });
}

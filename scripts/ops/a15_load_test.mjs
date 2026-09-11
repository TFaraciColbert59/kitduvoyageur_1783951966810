#!/usr/bin/env node
/**
 * A15 — Test de charge LOCAL (preuves exécutées, jamais la production).
 *
 * Trois scénarios, sur la base/route Supabase locale exclusivement :
 *   1. `proximity`   — RPC `a5_terrain_reports_near` via PostgREST (autocannon
 *                      si disponible via `npx`, sinon benchmark SQL `pg` direct).
 *   2. `conditions`  — `GET /api/terrain/conditions` sur un serveur Next local
 *                      (`--next-url`), générateur HTTP natif avec X-Forwarded-For
 *                      tournant (le limiteur A11 est par IP : 30 jetons / 0,5/s).
 *   3. `plan_read`   — lecture d'un plan (plan + version courante + décisions,
 *                      mêmes 3 requêtes que `getAdventurePlan`) en benchmark SQL
 *                      direct : c'est la couche passe-bas, pas la route HTTP.
 *
 * Données de test : utilisateur + signalements synthétiques + plan synthétique
 * créés dans la base locale, puis supprimés (aucune PII, aucun accès distant).
 *
 * Garde-fou : tout DSN/URL non local est refusé (sauf A15_LOAD_ALLOW_REMOTE=1).
 *
 * Usage :
 *   node scripts/ops/a15_load_test.mjs --json --out docs/reports/A15_LOAD_TEST.json
 *   node scripts/ops/a15_load_test.mjs --next-url http://127.0.0.1:4028 --duration 10
 *
 * Sortie : résumé stdin ; exit 0 si tous les scénarios exécutés passent les
 * seuils A12, 1 si un seuil échoue, 2 si configuration/connexion impossible.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

/** DSN local standard Supabase CLI — jamais la production. */
export const DEFAULT_LOCAL_DSN = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
/** API locale Supabase CLI (PostgREST). */
export const DEFAULT_LOCAL_REST_URL = 'http://127.0.0.1:54321';
/**
 * Clé anon de DÉMONSTRATION locale (valeur publique constante de `supabase
 * start` — aucun secret de projet ; la clé de production n'est jamais lue).
 */
export const DEFAULT_LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
/**
 * Clé service_role de DÉMONSTRATION locale (valeur publique constante de
 * `supabase start`) — utilisée uniquement pour créer/supprimer l'utilisateur
 * jetable en local ; toute cible non locale est refusée en amont.
 */
export const DEFAULT_LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1', '[::1]'];

/** Seuils repris du plan A12 (p95 < 300 ms, aucun 5xx) — hypothèse locale. */
export const LOAD_THRESHOLDS = {
  proximity: { p95Ms: 300, max5xx: 0 },
  conditions: { p95Ms: 300, max5xx: 0 },
  plan_read: { p95Ms: 300, max5xx: 0 },
};

/** Échantillon minimal pour qu'un résultat soit concluant. */
export const MIN_SAMPLES = 100;

/** Rayon de recherche des scénarios terrain (mètres). */
export const SEARCH_RADIUS_M = 5000;

/** Vrai si l'URL pointe vers la machine locale. */
export function isLocalUrl(url) {
  try {
    return LOCAL_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Refuse toute cible non locale (sauf opt-in explicite). */
export function assertLocalTarget(label, value, env = process.env) {
  if (isLocalUrl(value)) return;
  if (env?.A15_LOAD_ALLOW_REMOTE === '1') return;
  throw new Error(
    `${label} non local refusé (${value}) — la production est interdite ; ` +
      'A15_LOAD_ALLOW_REMOTE=1 pour un test distant assumé.'
  );
}

/** Quantile par interpolation linéaire sur un tableau trié croissant. */
export function quantile(sorted, q) {
  if (!Array.isArray(sorted) || sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/** Statistiques de latence (ms) d'un échantillon. */
export function summarizeLatencies(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  return {
    count: sorted.length,
    avgMs: sorted.length > 0 ? Number((sum / sorted.length).toFixed(2)) : 0,
    p50Ms: Number(quantile(sorted, 0.5).toFixed(2)),
    p95Ms: Number(quantile(sorted, 0.95).toFixed(2)),
    p99Ms: Number(quantile(sorted, 0.99).toFixed(2)),
    maxMs: sorted.length > 0 ? Number(sorted[sorted.length - 1].toFixed(2)) : 0,
  };
}

/** Agrège latences + statuts HTTP + erreurs réseau. */
export function summarizeRun({ samples, statuses, errors, durationMs }) {
  const latency = summarizeLatencies(samples);
  const total = latency.count + errors;
  const status5xx = countStatus(statuses, (code) => code >= 500);
  const status4xx = countStatus(statuses, (code) => code >= 400 && code < 500);
  return {
    ...latency,
    durationMs: Number(durationMs.toFixed(0)),
    total,
    errors,
    statuses,
    status4xx,
    status5xx,
    requestsPerSecond:
      durationMs > 0 ? Number(((total / durationMs) * 1000).toFixed(2)) : 0,
  };
}

/** Compte les statuts HTTP vérifiant un prédicat (0 si aucun statut). */
export function countStatus(statuses, predicate) {
  return Object.entries(statuses ?? {})
    .filter(([code]) => predicate(Number(code)))
    .reduce((acc, [, count]) => acc + count, 0);
}

/**
 * p95 : autocannon v8 n'expose pas p95 nativement (p90 et p97,5 bornent la
 * valeur). Interpolation linéaire entre p90 et p97,5 — la source est tracée.
 */
export function p95FromAutocannon(latency) {
  const p90 = latency?.p90 ?? 0;
  const p97_5 = latency?.p97_5 ?? p90;
  return Number((p90 + (p97_5 - p90) * (5 / 7.5)).toFixed(2));
}

/** Normalise un résultat autocannon (API programmatique, v8). */
export function normalizeAutocannonResult(result) {
  const statuses = {};
  for (const [code, stat] of Object.entries(result.statusCodeStats ?? {})) {
    statuses[code] = stat.count ?? 0;
  }
  const total = result.requests?.total ?? 0;
  return {
    count: total,
    avgMs: result.latency?.average ?? 0,
    p50Ms: result.latency?.p50 ?? 0,
    p95Ms: p95FromAutocannon(result.latency),
    p99Ms: result.latency?.p99 ?? 0,
    maxMs: result.latency?.max ?? 0,
    total,
    errors: (result.errors ?? 0) + (result.timeouts ?? 0),
    statuses,
    status4xx: countStatus(statuses, (code) => code >= 400 && code < 500),
    status5xx: countStatus(statuses, (code) => code >= 500),
    requestsPerSecond: Number((result.requests?.average ?? 0).toFixed(2)),
    throughputBytes: result.throughput?.average ?? 0,
  };
}

/**
 * Lance autocannon via l'API programmatique (devDependency). Retourne `null`
 * si la dépendance est absente — l'appelant retombe alors sur le SQL direct.
 */
export async function runAutocannon(options, { log = () => {} } = {}) {
  let autocannon;
  try {
    ({ default: autocannon } = await import('autocannon'));
  } catch {
    log('autocannon absent (devDependency) — repli SQL pg');
    return null;
  }
  log(
    `autocannon : ${options.method ?? 'GET'} ${options.url} ` +
      `(c=${options.connections}, d=${options.duration}s)`
  );
  const instance = autocannon({
    url: options.url,
    method: options.method ?? 'GET',
    headers: options.headers,
    body: options.body ?? undefined,
    connections: options.connections ?? 20,
    duration: options.duration ?? 10,
  });
  const result = await instance;
  return normalizeAutocannonResult(result);
}

/** Évalue un scénario exécuté contre les seuils A12 (jamais un faux vert). */
export function evaluateScenario(name, result, thresholds = LOAD_THRESHOLDS) {
  const target = thresholds[name] ?? { p95Ms: 300, max5xx: 0 };
  const failures = [];
  if (result.skipped) {
    return { ok: null, verdict: 'skipped', failures, reason: result.reason };
  }
  if (result.count < MIN_SAMPLES) {
    failures.push(
      `échantillon insuffisant : ${result.count} requêtes < ${MIN_SAMPLES} (résultat non concluant)`
    );
    return { ok: null, verdict: 'inconclusive', failures };
  }
  if (result.status5xx > target.max5xx) {
    failures.push(`${result.status5xx} réponse(s) 5xx > ${target.max5xx}`);
  }
  if ((result.status4xx ?? 0) > 0) {
    failures.push(
      `${result.status4xx} réponse(s) 4xx inattendue(s) — statuts : ${JSON.stringify(result.statuses)}`
    );
  }
  if (result.errors > 0) {
    failures.push(`${result.errors} erreur(s) réseau/requête`);
  }
  if (result.p95Ms > target.p95Ms) {
    failures.push(`p95 ${result.p95Ms} ms > ${target.p95Ms} ms`);
  }
  return {
    ok: failures.length === 0,
    verdict: failures.length === 0 ? 'pass' : 'fail',
    failures,
  };
}

/** Requête HTTP native unique (résolution { status, bytes, error }). */
function httpRequest({ url, method = 'GET', headers = {}, body = null, timeoutMs = 15000 }) {
  return new Promise((resolve) => {
    const target = new URL(url);
    const transport = target.protocol === 'https:' ? https : http;
    const request = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method,
        headers,
      },
      (response) => {
        let bytes = 0;
        response.on('data', (chunk) => {
          bytes += chunk.length;
        });
        response.on('end', () => resolve({ status: response.statusCode ?? 0, bytes, error: null }));
      }
    );
    request.on('error', (error) => resolve({ status: 0, bytes: 0, error: error.message }));
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`timeout ${timeoutMs} ms`));
    });
    if (body) request.write(body);
    request.end();
  });
}

/**
 * Générateur HTTP natif en concurrence fixe pendant une durée bornée.
 * `rotateIp` ajoute un X-Forwarded-For distinct par requête (le limiteur A11
 * est par IP : sans rotation, le scénario `conditions` mesurerait des 429).
 */
export async function runHttpBenchmark({
  url,
  method = 'GET',
  headers = {},
  body = null,
  concurrency = 20,
  durationMs = 10000,
  rotateIp = false,
  log = () => {},
}) {
  const samples = [];
  const statuses = {};
  let errors = 0;
  let counter = 0;
  let stop = false;
  const startedAt = performance.now();

  async function worker(workerId) {
    while (!stop) {
      if (performance.now() - startedAt >= durationMs) {
        stop = true;
        return;
      }
      const requestHeaders = { ...headers };
      if (rotateIp) {
        counter += 1;
        const third = workerId % 250;
        const fourth = (counter * 7 + workerId) % 250;
        requestHeaders['x-forwarded-for'] = `10.${third}.${fourth}.${((counter + workerId) % 250) + 1}`;
      }
      const started = performance.now();
      const result = await httpRequest({ url, method, headers: requestHeaders, body });
      const elapsed = performance.now() - started;
      if (result.error) {
        errors += 1;
      } else {
        samples.push(elapsed);
        statuses[result.status] = (statuses[result.status] ?? 0) + 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index)));
  const durationMsActual = performance.now() - startedAt;
  log(`http natif : ${samples.length} ok, ${errors} erreur(s) en ${durationMsActual.toFixed(0)} ms`);
  return summarizeRun({
    samples,
    statuses,
    errors,
    durationMs: durationMsActual,
  });
}

/**
 * Benchmark SQL direct : chaque worker possède son client `pg` et exécute
 * `queryFn(client)` en boucle pendant la durée. La latence mesurée couvre
 * l'ensemble des requêtes du `queryFn` (ex. les 3 requêtes de `getAdventurePlan`).
 */
export async function runPgBenchmark({
  dsn,
  queryFn,
  concurrency = 20,
  durationMs = 10000,
  log = () => {},
}) {
  const { default: pg } = await import('pg');
  const samples = [];
  let errors = 0;
  let stop = false;
  const startedAt = performance.now();

  async function worker() {
    const client = new pg.Client({ connectionString: dsn });
    await client.connect();
    try {
      while (!stop) {
        if (performance.now() - startedAt >= durationMs) {
          stop = true;
          return;
        }
        const started = performance.now();
        try {
          await queryFn(client);
          samples.push(performance.now() - started);
        } catch {
          errors += 1;
        }
      }
    } finally {
      await client.end().catch(() => {});
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const durationMsActual = performance.now() - startedAt;
  log(`pg direct : ${samples.length} ok, ${errors} erreur(s) en ${durationMsActual.toFixed(0)} ms`);
  return summarizeRun({
    samples,
    statuses: {},
    errors,
    durationMs: durationMsActual,
  });
}

/** Nettoie tout résidu synthétique A15 (idempotent, local uniquement). */
export async function cleanupFixtures(client) {
  await client.query(
    `DELETE FROM public.terrain_reports WHERE reporter_id IN (SELECT id FROM auth.users WHERE email LIKE 'a15-load-%@example.invalid')`
  );
  await client.query(
    `DELETE FROM public.adventure_plans WHERE owner_id IN (SELECT id FROM auth.users WHERE email LIKE 'a15-load-%@example.invalid')`
  );
  await client.query(`DELETE FROM auth.users WHERE email LIKE 'a15-load-%@example.invalid'`);
}

/**
 * Crée un utilisateur jetable via l'API admin LOCALE, avec un mot de passe
 * connu, puis ouvre une session (nécessaire au scénario `conditions` : la RPC
 * `current_feature_flags` n'est exécutable que par `authenticated`).
 */
async function createLocalSession({ restUrl, serviceKey, email, password, log }) {
  const createResponse = await fetch(`${restUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!createResponse.ok) {
    throw new Error(`création utilisateur local : HTTP ${createResponse.status}`);
  }
  const created = await createResponse.json();

  const tokenResponse = await fetch(`${restUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: serviceKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!tokenResponse.ok) {
    throw new Error(`session utilisateur local : HTTP ${tokenResponse.status}`);
  }
  const session = await tokenResponse.json();
  log(`session locale ouverte pour ${created.id}`);
  return { userId: created.id, session };
}

/** Cookie d'auth @supabase/ssr (`sb-<ref>-auth-token`, encodage base64url). */
export function buildAuthCookie(restUrl, session) {
  const host = new URL(restUrl).hostname.split('.')[0];
  const name = `sb-${host}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  return `${name}=${value}`;
}

/**
 * Crée un utilisateur jetable + signalements synthétiques + un plan synthétique.
 * Aucune donnée réelle : e-mails `@example.invalid`, coordonnées fictives.
 * L'utilisateur est créé via l'API admin locale (mot de passe jetable) pour que
 * le scénario HTTP `conditions` dispose d'une session `authenticated` réelle.
 */
export async function seedFixtures({
  dsn,
  restUrl = DEFAULT_LOCAL_REST_URL,
  serviceKey = DEFAULT_LOCAL_SERVICE_ROLE_KEY,
  reportCount = 2000,
  lat = 45.1,
  lng = 2.8,
  log = () => {},
}) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: dsn });
  await client.connect();
  try {
    await cleanupFixtures(client);

    const email = `a15-load-${Date.now()}@example.invalid`;
    const password = `A15-load-${Math.random().toString(36).slice(2)}-local!`;
    const { userId, session } = await createLocalSession({
      restUrl,
      serviceKey,
      email,
      password,
      log,
    });
    const planId = randomUUID();

    await client.query('SELECT setseed(0.4242)');
    await client.query(
      `INSERT INTO public.terrain_reports
         (reporter_id, category, severity, passability, lat, lng, status, source_type, expires_at)
       SELECT
         $1, 'obstacle', 'info', 'passable',
         $2 + (random() - 0.5) * 0.03,
         $3 + (random() - 0.5) * 0.04,
         'confirmed', 'user', now() + interval '7 days'
       FROM generate_series(1, $4)`,
      [userId, lat, lng, reportCount]
    );

    await client.query(
      `INSERT INTO public.adventure_plans (id, owner_id, title, current_version, intent)
       VALUES ($1, $2, 'A15 load fixture', 1,
         '{"rawInput":"a15-load","activities":[],"constraints":[]}'::jsonb)`,
      [planId, userId]
    );
    await client.query(
      `INSERT INTO public.adventure_plan_versions
         (plan_id, version, snapshot, reason, generated_by)
       VALUES ($1, 1, '{"fixture":true}'::jsonb, 'a15-load', 'engine')`,
      [planId]
    );
    for (let index = 0; index < 3; index += 1) {
      await client.query(
        `INSERT INTO public.adventure_plan_decisions
           (plan_id, decision_type, proposal, status)
         VALUES ($1, 'other', $2, 'proposed')`,
        [planId, `a15-load decision ${index + 1}`]
      );
    }

    log(
      `fixtures locales : utilisateur ${userId}, ${reportCount} signalements, plan ${planId}`
    );
    return { userId, planId, email, reportCount, session };
  } finally {
    await client.end().catch(() => {});
  }
}

/** Lit/écrit un flag local (service de test uniquement). */
export async function setFlagLocal(dsn, flagId, enabled, log = () => {}) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: dsn });
  await client.connect();
  try {
    const { rows } = await client.query(
      `UPDATE public.feature_flags SET enabled = $2, updated_at = now() WHERE id = $1 RETURNING id, enabled`,
      [flagId, enabled]
    );
    if (rows.length !== 1) throw new Error(`flag ${flagId} introuvable`);
    log(`flag ${flagId} = ${rows[0].enabled}`);
    return rows[0].enabled;
  } finally {
    await client.end().catch(() => {});
  }
}

/** Vérifie qu'aucun flag domaine n'est resté actif (fin de test). */
export async function assertAllFlagsOff(dsn) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: dsn });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT id FROM public.feature_flags WHERE enabled = true ORDER BY id`
    );
    return rows.map((row) => row.id);
  } finally {
    await client.end().catch(() => {});
  }
}

function parseArgs(argv) {
  const args = {
    dsn: process.env.A15_LOAD_DSN ?? DEFAULT_LOCAL_DSN,
    restUrl: process.env.A15_LOAD_REST_URL ?? DEFAULT_LOCAL_REST_URL,
    nextUrl: process.env.A15_LOAD_NEXT_URL ?? null,
    anonKey: process.env.A15_LOAD_ANON_KEY ?? DEFAULT_LOCAL_ANON_KEY,
    serviceKey: process.env.A15_LOAD_SERVICE_KEY ?? DEFAULT_LOCAL_SERVICE_ROLE_KEY,
    connections: 20,
    duration: 10,
    reports: 2000,
    scenarios: ['proximity', 'conditions', 'plan_read'],
    json: false,
    out: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dsn') args.dsn = argv[++index] ?? args.dsn;
    else if (arg === '--rest-url') args.restUrl = argv[++index] ?? args.restUrl;
    else if (arg === '--next-url') args.nextUrl = argv[++index] ?? args.nextUrl;
    else if (arg === '--anon-key') args.anonKey = argv[++index] ?? args.anonKey;
    else if (arg === '--service-key') args.serviceKey = argv[++index] ?? args.serviceKey;
    else if (arg === '--connections') args.connections = Number(argv[++index] ?? args.connections);
    else if (arg === '--duration') args.duration = Number(argv[++index] ?? args.duration);
    else if (arg === '--reports') args.reports = Number(argv[++index] ?? args.reports);
    else if (arg === '--scenarios') args.scenarios = String(argv[++index] ?? '').split(',').filter(Boolean);
    else if (arg === '--json') args.json = true;
    else if (arg === '--out') args.out = argv[++index] ?? args.out;
  }
  return args;
}

function machineInfo() {
  const cpu = os.cpus()?.[0];
  return {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    cpu: cpu?.model ?? 'inconnu',
    cpuCount: os.cpus()?.length ?? 0,
    totalMemoryGb: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
  };
}

async function pgProximityQuery(client, lat, lng) {
  await client.query('SELECT * FROM public.a5_terrain_reports_near($1, $2, $3)', [
    lat,
    lng,
    SEARCH_RADIUS_M,
  ]);
}

async function pgPlanReadQuery(client, planId) {
  await client.query('SELECT * FROM public.adventure_plans WHERE id = $1', [planId]);
  await client.query(
    `SELECT version, snapshot, reason, generated_by, confidence, created_at
     FROM public.adventure_plan_versions WHERE plan_id = $1
     ORDER BY version DESC LIMIT 1`,
    [planId]
  );
  await client.query(
    `SELECT * FROM public.adventure_plan_decisions WHERE plan_id = $1 ORDER BY created_at ASC`,
    [planId]
  );
}

export async function main(argv = process.argv.slice(2), env = process.env, log = console.log) {
  const args = parseArgs(argv);
  const durationMs = Math.max(1, args.duration) * 1000;
  const report = {
    generatedAt: new Date().toISOString(),
    environment: { ...machineInfo(), target: 'local-only', caveat: 'local ≠ production' },
    config: {
      dsn: 'postgresql://postgres:***@127.0.0.1:54322/postgres',
      restUrl: args.restUrl,
      nextUrl: args.nextUrl,
      connections: args.connections,
      durationSeconds: args.duration,
      reportCount: args.reports,
      scenarios: args.scenarios,
    },
    scenarios: {},
  };
  let flagWasRestored = true;

  try {
    assertLocalTarget('DSN', args.dsn.replace(/^postgresql:\/\/[^@]+@/, 'postgresql://'), env);
    assertLocalTarget('REST URL', args.restUrl, env);
    if (args.nextUrl) assertLocalTarget('Next URL', args.nextUrl, env);

    const { default: pg } = await import('pg');
    const health = new pg.Client({ connectionString: args.dsn });
    await health.connect();
    const version = (await health.query('SELECT version() AS v')).rows[0].v;
    await health.end();
    report.environment.database = version;

    const fixtures = await seedFixtures({
      dsn: args.dsn,
      restUrl: args.restUrl,
      serviceKey: args.serviceKey,
      reportCount: args.reports,
      log,
    });
    report.fixtures = { reportCount: fixtures.reportCount, planId: fixtures.planId };

    if (args.scenarios.includes('proximity')) {
      const rpcUrl = `${args.restUrl}/rest/v1/rpc/a5_terrain_reports_near`;
      const body = JSON.stringify({
        p_lat: 45.1,
        p_lng: 2.8,
        p_radius_m: SEARCH_RADIUS_M,
      });
      let result = null;
      let engine = 'autocannon-programmatic';
      const autocannonResult = await runAutocannon(
        {
          url: rpcUrl,
          method: 'POST',
          headers: {
            apikey: args.anonKey,
            authorization: `Bearer ${args.anonKey}`,
            'content-type': 'application/json',
          },
          body,
          connections: args.connections,
          duration: args.duration,
        },
        { log }
      );
      if (autocannonResult) {
        result = {
          ...autocannonResult,
          durationMs,
          mode: 'http-postgrest-rpc',
        };
      } else {
        engine = 'pg-direct';
        const run = await runPgBenchmark({
          dsn: args.dsn,
          queryFn: (client) => pgProximityQuery(client, 45.1, 2.8),
          concurrency: args.connections,
          durationMs,
          log,
        });
        result = { ...run, mode: 'sql-direct' };
      }
      report.scenarios.proximity = { engine, ...result };
      report.scenarios.proximity.evaluation = evaluateScenario('proximity', result);
    }

    if (args.scenarios.includes('conditions')) {
      if (!args.nextUrl) {
        report.scenarios.conditions = {
          skipped: true,
          reason:
            '--next-url absent : serveur Next local requis (npm run start avec env Supabase locale)',
        };
      } else {
        let previous = null;
        try {
          previous = await setFlagLocal(args.dsn, 'terrain_live', true, log);
          const url = `${args.nextUrl.replace(/\/$/, '')}/api/terrain/conditions?lat=45.1&lng=2.8&radius=${SEARCH_RADIUS_M}`;
          const result = await runHttpBenchmark({
            url,
            headers: {
              cookie: buildAuthCookie(args.restUrl, fixtures.session),
              origin: args.nextUrl.replace(/\/$/, ''),
            },
            concurrency: args.connections,
            durationMs,
            rotateIp: true,
            log,
          });
          report.scenarios.conditions = {
            engine: 'node-http-native',
            mode: 'next-route',
            ipRotation: true,
            ...result,
          };
          report.scenarios.conditions.evaluation = evaluateScenario('conditions', result);
        } finally {
          if (previous !== null) {
            const restored = await setFlagLocal(args.dsn, 'terrain_live', false, log);
            flagWasRestored = restored === false;
          }
        }
      }
    }

    if (args.scenarios.includes('plan_read')) {
      const run = await runPgBenchmark({
        dsn: args.dsn,
        queryFn: (client) => pgPlanReadQuery(client, fixtures.planId),
        concurrency: args.connections,
        durationMs,
        log,
      });
      report.scenarios.plan_read = { engine: 'pg-direct', mode: 'sql-plan-read-3-queries', ...run };
      report.scenarios.plan_read.evaluation = evaluateScenario('plan_read', run);
    }

    const cleanup = new pg.Client({ connectionString: args.dsn });
    await cleanup.connect();
    await cleanupFixtures(cleanup);
    const leftovers = (
      await cleanup.query(
        `SELECT count(*)::int AS n FROM auth.users WHERE email LIKE 'a15-load-%@example.invalid'`
      )
    ).rows[0].n;
    await cleanup.end();
    report.cleanup = { leftoverFixtures: leftovers };

    const activeFlags = await assertAllFlagsOff(args.dsn);
    report.flagsEnabledAtEnd = activeFlags;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.error = message;
    if (args.json) {
      log(JSON.stringify({ ...report, exitCode: 2 }, null, 2));
    } else {
      log(`ERREUR CONFIGURATION/CONNEXION : ${message}`);
    }
    return 2;
  }

  const evaluations = Object.values(report.scenarios)
    .map((scenario) => scenario.evaluation)
    .filter(Boolean);
  const anyFail = evaluations.some((evaluation) => evaluation.ok === false);
  const executed = evaluations.filter((evaluation) => evaluation.verdict !== 'skipped').length;
  report.exitCode = anyFail ? 1 : 0;

  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(report, null, 2));
    log(`résultat JSON écrit : ${args.out}`);
  }

  if (args.json) {
    log(JSON.stringify(report, null, 2));
  } else {
    log('=== A15 — Test de charge LOCAL (jamais la production) ===');
    log(`Machine : ${report.environment.cpu} (${report.environment.cpuCount} cœurs), Node ${report.environment.node}`);
    log(`Base : ${report.environment.database}`);
    for (const [name, scenario] of Object.entries(report.scenarios)) {
      if (scenario.skipped) {
        log(`- ${name} : SAUTÉ — ${scenario.reason}`);
        continue;
      }
      log(
        `- ${name} (${scenario.engine}/${scenario.mode}) : ${scenario.total} req, ` +
          `${scenario.requestsPerSecond} req/s, p50 ${scenario.p50Ms} ms, p95 ${scenario.p95Ms} ms, ` +
          `5xx=${scenario.status5xx}, erreurs=${scenario.errors} → ${scenario.evaluation.verdict.toUpperCase()}`
      );
      for (const failure of scenario.evaluation.failures) log(`    ÉCHEC : ${failure}`);
    }
    log(
      `Scénarios exécutés : ${executed} · fixtures restantes : ${report.cleanup.leftoverFixtures} · ` +
        `flags actifs en fin de test : ${report.flagsEnabledAtEnd.length === 0 ? 'aucun' : report.flagsEnabledAtEnd.join(', ')}`
    );
    log(
      anyFail
        ? 'RÉSULTAT : au moins un seuil A12 dépassé (voir JSON pour le détail).'
        : 'RÉSULTAT : tous les seuils locaux A12 respectés sur les scénarios exécutés.'
    );
  }

  if (report.cleanup.leftoverFixtures !== 0 || !flagWasRestored) {
    return 2;
  }
  return anyFail ? 1 : 0;
}

const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  path.basename(process.argv[1]).startsWith('a15_load_test') &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().then((code) => {
    process.exitCode = code;
  });
}

/**
 * Phase 10 — Capacité : test de charge LOCAL réutilisable (100 / 1 000 / 10 000).
 *
 * Réutilise les briques A15 (`scripts/ops/a15_load_test.mjs`) : garde-fou
 * anti-production, fixtures jetables, benchmark `pg` direct, agrégation des
 * latences. Charge mixte représentative des lectures principales :
 *   - 5/10 lecture de plan (plan + version courante + décisions) ;
 *   - 3/10 proximité PostGIS (`a5_terrain_reports_near`) ;
 *   - 2/10 drapeaux de fonctionnalités (`current_feature_flags`).
 *
 * Honnêteté stricte :
 *   - les profils 100 et 1 000 sont exécutables et évalués localement ;
 *   - le profil 10 000 exige `--allow-10k` et rend TOUJOURS un verdict
 *     `inconclusive` : 10 000 utilisateurs concurrents ne sont pas
 *     représentables sur un poste unique. La charge réelle à 10k et la charge
 *     distante sont un item humain/Phase 1 (INSUFFICIENT_DATA, jamais un PASS).
 *   - local ≠ production (pas de TLS, CDN, pooler, multi-instance).
 *
 * Usage :
 *   node scripts/ops/phase10_capacity.mjs --users 100
 *   node scripts/ops/phase10_capacity.mjs --users 1000 --duration 15 --json
 *   node scripts/ops/phase10_capacity.mjs --users 10000 --allow-10k
 *   node scripts/ops/phase10_capacity.mjs --list
 *
 * Codes de sortie : 0 pass · 1 fail · 2 configuration/connexion ·
 * 4 non concluant (10k non représentable, jamais un faux vert).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_LOCAL_DSN,
  DEFAULT_LOCAL_REST_URL,
  DEFAULT_LOCAL_SERVICE_ROLE_KEY,
  MIN_SAMPLES,
  SEARCH_RADIUS_M,
  assertLocalTarget,
  cleanupFixtures,
  runPgBenchmark,
  seedFixtures,
} from './a15_load_test.mjs';

/** Profils de capacité (le champ `users` est une population simulée). */
export const CAPACITY_PROFILES = {
  100: {
    users: 100,
    concurrency: 10,
    durationSeconds: 10,
    representative: true,
    note: 'palier de mise en route — exécutable sur un poste unique',
  },
  1000: {
    users: 1000,
    concurrency: 50,
    durationSeconds: 15,
    representative: true,
    note: 'palier de croissance — résultats locaux, non contractuels',
  },
  10000: {
    users: 10000,
    concurrency: 200,
    durationSeconds: 20,
    representative: false,
    note:
      'population mensuelle cible ; 10 000 simultanés non représentables localement ' +
      '— item humain/Phase 1 (charge distante), jamais un PASS',
  },
};

/** Répartition de la charge mixte (poids cumulés). */
export const MIX_WEIGHTS = [
  { kind: 'plan_read', weight: 5 },
  { kind: 'proximity', weight: 3 },
  { kind: 'feature_flags', weight: 2 },
];

/** Seuils locaux : p95 < 300 ms, 0 erreur, 0 5xx (repris d'A12/A15). */
export const CAPACITY_THRESHOLDS = { p95Ms: 300, maxErrors: 0, max5xx: 0 };

/**
 * Plafond de connexions locales : `max_connections` du Postgres Supabase local
 * vaut 100, mais les services Supabase (PostgREST, auth, realtime…) en
 * consomment une partie. 50 connexions simultanées ont été validées localement
 * (profil 1 000) ; au-delà le risque « too many clients » est réel et le profil
 * 10k n'est de toute façon pas représentatif.
 */
export const LOCAL_CONNECTION_CAP = 50;

/** Vrai si le profil est exécutable sans opt-in explicite. */
export function isRepresentative(users) {
  return users <= 1000;
}

/**
 * Planifie une exécution : profil canonique + overrides bornés.
 * Le profil 10 000 exige `allow10k` (sinon erreur explicite : item humain).
 */
export function planCapacityRun(users, overrides = {}) {
  const profile = CAPACITY_PROFILES[users];
  if (!profile) {
    throw new Error(
      `profil inconnu (${users}) — profils : ${Object.keys(CAPACITY_PROFILES).join(', ')}`
    );
  }
  if (!profile.representative && overrides.allow10k !== true) {
    throw new Error(
      'profil 10 000 refusé : 10k simultanés ne sont pas représentables sur un poste ' +
        'unique (item humain/Phase 1). --allow-10k pour une exécution exploratoire ' +
        'explicitement non concluante.'
    );
  }
  const requestedConcurrency = Math.max(1, Number(overrides.concurrency ?? profile.concurrency));
  const concurrency = Math.min(requestedConcurrency, LOCAL_CONNECTION_CAP);
  const durationSeconds = Math.max(1, Number(overrides.durationSeconds ?? profile.durationSeconds));
  return {
    ...profile,
    requestedConcurrency,
    concurrency,
    concurrencyCapped: requestedConcurrency > concurrency,
    durationSeconds,
    representative: profile.representative,
  };
}

/** Travail à exécuter pour l'itération `index` (déterministe). */
export function pickWorkload(index, weights = MIX_WEIGHTS) {
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  const position = ((index % total) + total) % total;
  let cursor = 0;
  for (const item of weights) {
    cursor += item.weight;
    if (position < cursor) return item.kind;
  }
  return weights[weights.length - 1].kind;
}

/**
 * Évalue un run : `pass`/`fail` pour les profils représentatifs, TOUJOURS
 * `inconclusive` au-delà (10k ou profil marqué non représentatif).
 */
export function evaluateCapacityRun(profile, summary, thresholds = CAPACITY_THRESHOLDS) {
  const reasons = [];
  if (profile.concurrencyCapped) {
    reasons.push(
      `concurrence plafonnée à ${profile.concurrency} (demandé ${profile.requestedConcurrency}, ` +
        'max_connections locale = 100)'
    );
  }
  if (!profile.representative || profile.users > 1000) {
    reasons.push(
      `${profile.users} utilisateurs simulés : échantillon local non représentatif ` +
        '(charge réelle = item humain/Phase 1) — verdict jamais concluant'
    );
    return { verdict: 'inconclusive', reasons, failures: [] };
  }
  if ((summary?.count ?? 0) < MIN_SAMPLES) {
    return {
      verdict: 'inconclusive',
      reasons: [`échantillon insuffisant : ${summary?.count ?? 0} < ${MIN_SAMPLES}`],
      failures: [],
    };
  }
  const failures = [];
  if ((summary.p95Ms ?? 0) > thresholds.p95Ms) {
    failures.push(`p95 ${summary.p95Ms} ms > ${thresholds.p95Ms} ms`);
  }
  if ((summary.errors ?? 0) > thresholds.maxErrors) {
    failures.push(`${summary.errors} erreur(s) réseau/requête`);
  }
  if ((summary.status5xx ?? 0) > thresholds.max5xx) {
    failures.push(`${summary.status5xx} réponse(s) 5xx`);
  }
  return {
    verdict: failures.length === 0 ? 'pass' : 'fail',
    reasons,
    failures,
  };
}

/** Requête SQL correspondant au type de charge (3 requêtes max par itération). */
export function buildMixedQueryFn({ planId, lat, lng, radiusM = SEARCH_RADIUS_M }) {
  let index = 0;
  return async function mixedQuery(client) {
    index += 1;
    const kind = pickWorkload(index);
    if (kind === 'proximity') {
      await client.query('SELECT * FROM public.a5_terrain_reports_near($1, $2, $3)', [
        lat,
        lng,
        radiusM,
      ]);
      return;
    }
    if (kind === 'feature_flags') {
      await client.query('SELECT public.current_feature_flags()');
      return;
    }
    await client.query('SELECT id, current_version FROM public.adventure_plans WHERE id = $1', [
      planId,
    ]);
    await client.query(
      `SELECT version, snapshot, reason, generated_by, confidence, created_at
       FROM public.adventure_plan_versions WHERE plan_id = $1
       ORDER BY version DESC LIMIT 1`,
      [planId]
    );
    await client.query(
      `SELECT id, decision_type, status FROM public.adventure_plan_decisions
       WHERE plan_id = $1 ORDER BY created_at ASC`,
      [planId]
    );
  };
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

function parseArgs(argv) {
  const args = {
    users: null,
    dsn: process.env.PHASE10_CAPACITY_DSN ?? DEFAULT_LOCAL_DSN,
    restUrl: process.env.PHASE10_CAPACITY_REST_URL ?? DEFAULT_LOCAL_REST_URL,
    serviceKey: process.env.PHASE10_CAPACITY_SERVICE_KEY ?? DEFAULT_LOCAL_SERVICE_ROLE_KEY,
    reports: 2000,
    concurrency: undefined,
    duration: undefined,
    allow10k: false,
    list: false,
    json: false,
    out: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--users') args.users = Number(argv[++index]);
    else if (arg === '--dsn') args.dsn = argv[++index] ?? args.dsn;
    else if (arg === '--rest-url') args.restUrl = argv[++index] ?? args.restUrl;
    else if (arg === '--service-key') args.serviceKey = argv[++index] ?? args.serviceKey;
    else if (arg === '--reports') args.reports = Number(argv[++index] ?? args.reports);
    else if (arg === '--concurrency') args.concurrency = Number(argv[++index]);
    else if (arg === '--duration') args.duration = Number(argv[++index]);
    else if (arg === '--allow-10k') args.allow10k = true;
    else if (arg === '--list') args.list = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--out') args.out = argv[++index] ?? args.out;
  }
  return args;
}

export async function main(argv = process.argv.slice(2), env = process.env, log = console.log) {
  const args = parseArgs(argv);

  if (args.list) {
    for (const profile of Object.values(CAPACITY_PROFILES)) {
      log(
        `- ${profile.users} utilisateurs simulés : ${profile.concurrency} connexions, ` +
          `${profile.durationSeconds} s, représentatif=${profile.representative} — ${profile.note}`
      );
    }
    return 0;
  }

  if (!args.users) {
    log('ERREUR CONFIGURATION : --users 100|1000|10000 requis (ou --list).');
    return 2;
  }

  let profile;
  try {
    profile = planCapacityRun(args.users, {
      allow10k: args.allow10k,
      concurrency: args.concurrency,
      durationSeconds: args.duration,
    });
  } catch (error) {
    log(`ERREUR CONFIGURATION : ${error instanceof Error ? error.message : error}`);
    return 2;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    phase: 10,
    environment: { ...machineInfo(), target: 'local-only', caveat: 'local ≠ production' },
    profile,
    remoteCharge: 'INSUFFICIENT_DATA — charge distante et 10k réels = item humain/Phase 1',
    claim: 'local-only — aucune conclusion de capacité de production',
    scenario: { engine: 'pg-direct', mix: MIX_WEIGHTS },
    result: null,
    cleanup: null,
    exitCode: null,
  };

  let fixtures;
  try {
    assertLocalTarget('DSN', args.dsn.replace(/^postgresql:\/\/[^@]+@/, 'postgresql://'), env);
    assertLocalTarget('REST URL', args.restUrl, env);

    fixtures = await seedFixtures({
      dsn: args.dsn,
      restUrl: args.restUrl,
      serviceKey: args.serviceKey,
      reportCount: args.reports,
      lat: 45.1,
      lng: 2.8,
      log: () => {},
    });
    report.fixtures = { reportCount: fixtures.reportCount, planId: fixtures.planId };

    try {
      const run = await runPgBenchmark({
        dsn: args.dsn,
        queryFn: buildMixedQueryFn({ planId: fixtures.planId, lat: 45.1, lng: 2.8 }),
        concurrency: profile.concurrency,
        durationMs: profile.durationSeconds * 1000,
        log: () => {},
      });
      // `runPgBenchmark` agrège déjà latences/erreurs : on conserve son résumé.
      report.result = run;
      report.result.evaluation = evaluateCapacityRun(profile, run, CAPACITY_THRESHOLDS);
    } finally {
      // Nettoyage garanti même si la charge échoue (ex. connexions épuisées).
      const { default: pg } = await import('pg');
      const client = new pg.Client({ connectionString: args.dsn });
      await client.connect();
      await cleanupFixtures(client);
      const leftovers = (
        await client.query(
          `SELECT count(*)::int AS n FROM auth.users WHERE email LIKE 'a15-load-%@example.invalid'`
        )
      ).rows[0].n;
      await client.end();
      report.cleanup = { leftoverFixtures: leftovers };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.error = message;
    report.exitCode = 2;
    if (args.json) log(JSON.stringify(report, null, 2));
    else log(`ERREUR CONFIGURATION/CONNEXION : ${message}`);
    return 2;
  }

  const evaluation = report.result.evaluation;
  report.exitCode = evaluation.verdict === 'pass' ? 0 : evaluation.verdict === 'fail' ? 1 : 4;

  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(report, null, 2));
    log(`résultat JSON écrit : ${args.out}`);
  }

  if (args.json) {
    log(JSON.stringify(report, null, 2));
  } else {
    log('=== Phase 10 — Capacité LOCALE (jamais la production) ===');
    log(
      `Profil : ${profile.users} utilisateurs simulés · ${profile.concurrency} connexions` +
        (profile.concurrencyCapped
          ? ` (plafonnées depuis ${profile.requestedConcurrency})`
          : '') +
        ` · ${profile.durationSeconds} s · représentatif=${profile.representative}`
    );
    log(
      `Charge mixte : ${report.result.count} itérations, ${report.result.requestsPerSecond} req/s, ` +
        `p50 ${report.result.p50Ms} ms, p95 ${report.result.p95Ms} ms, ` +
        `erreurs=${report.result.errors} → ${evaluation.verdict.toUpperCase()}`
    );
    for (const reason of evaluation.reasons) log(`NOTE : ${reason}`);
    for (const failure of evaluation.failures) log(`ÉCHEC : ${failure}`);
    log(`Fixtures restantes : ${report.cleanup.leftoverFixtures}`);
    log('RÉSULTAT : ' + (
      evaluation.verdict === 'pass'
        ? 'seuils locaux respectés (aucune revendication de capacité de production).'
        : evaluation.verdict === 'fail'
          ? 'seuil local dépassé.'
          : 'NON CONCLUANT (jamais un PASS) — charge réelle = item humain/Phase 1.'
    ));
  }

  if (report.cleanup.leftoverFixtures !== 0) return 2;
  return report.exitCode;
}

const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  path.basename(process.argv[1]).startsWith('phase10_capacity') &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().then((code) => {
    process.exitCode = code;
  });
}

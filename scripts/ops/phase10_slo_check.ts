#!/usr/bin/env -S npx tsx
/**
 * Phase 10 — Vérification SLO & budget IA à partir de preuves locales.
 *
 * Consomme les sorties réelles déjà produites par les outils existants :
 *   - `a14_healthcheck.mjs --json`  → file domaine (`jobs_pending_events`,
 *     `jobs_oldest_pending_min`) ;
 *   - `a15_load_test.mjs --json`    → proxy local lecture API (`conditions`)
 *     et ratio 5xx local ;
 *   - un export `ai_usage_daily`    → budget IA (JSON `[{ user_id, day, ... }]`).
 *
 * Les SLO non mesurables localement (disponibilité, écriture p95, sync
 * destructive, violations RLS, perte d'entrée carnet) restent explicitement
 * `insufficient_data` : jamais un faux « pass ».
 *
 * Exécution : `npx tsx scripts/ops/phase10_slo_check.ts --health h.json --load l.json`
 * Codes de sortie : 0 aucun SLO en échec (des mesures peuvent manquer) ·
 *                   1 au moins un SLO en échec · 2 configuration illisible.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  PHASE10_SLOS,
  alertDecision,
  evaluatePhase10Slos,
  type Phase10Measurements,
} from '../../src/lib/observability/slo';
import {
  AI_BUDGET_CONFIG,
  evaluateAiBudget,
  type AiUsageDailyRow,
} from '../../src/lib/observability/aiBudget';

export interface HealthLike {
  db?: {
    queues?: {
      pendingEvents?: number | null;
      oldestPendingEventMinutes?: number | null;
    };
  };
}

export interface LoadLike {
  scenarios?: Record<
    string,
    | {
        skipped?: boolean;
        p95Ms?: number | null;
        total?: number | null;
        status5xx?: number | null;
      }
    | undefined
  >;
}

/** Extrait les mesures SLO d'un instantané A14 (sortie `--json` ou snapshot brut). */
export function measurementsFromHealth(input: unknown): Phase10Measurements {
  const snapshot = (
    input && typeof input === 'object' && 'snapshot' in (input as Record<string, unknown>)
      ? (input as { snapshot: HealthLike }).snapshot
      : (input as HealthLike)
  ) as HealthLike;
  const queues = snapshot?.db?.queues ?? {};
  return {
    jobs_pending_events: numberOrNull(queues.pendingEvents),
    jobs_oldest_pending_min: numberOrNull(queues.oldestPendingEventMinutes),
  };
}

/**
 * Extrait les mesures SLO d'un rapport A15. Seul le scénario HTTP `conditions`
 * est un proxy de lecture API ; les scénarios SQL ne sont pas des routes.
 */
export function measurementsFromLoad(input: unknown): Phase10Measurements {
  const report = (input ?? {}) as LoadLike;
  const conditions = report?.scenarios?.conditions;
  if (!conditions || conditions.skipped) return {};
  const p95 = numberOrNull(conditions.p95Ms);
  const total = numberOrNull(conditions.total);
  const status5xx = numberOrNull(conditions.status5xx) ?? 0;
  return {
    api_read_p95_ms: p95,
    http_5xx_ratio: total && total > 0 ? status5xx / total : null,
  };
}

function numberOrNull(value: unknown): number | null {
  if (value == null || typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function readJson(file: string): unknown {
  // Tolère un BOM (redirections PowerShell) : sinon JSON.parse échoue.
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function parseArgs(argv: string[]) {
  const args: {
    health: string | null;
    load: string | null;
    aiUsage: string | null;
    json: boolean;
    out: string | null;
  } = { health: null, load: null, aiUsage: null, json: false, out: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--health') args.health = argv[++index] ?? null;
    else if (arg === '--load') args.load = argv[++index] ?? null;
    else if (arg === '--ai-usage') args.aiUsage = argv[++index] ?? null;
    else if (arg === '--json') args.json = true;
    else if (arg === '--out') args.out = argv[++index] ?? null;
  }
  return args;
}

export async function main(argv = process.argv.slice(2), log = console.log): Promise<number> {
  const args = parseArgs(argv);
  const measurements: Phase10Measurements = {};
  const sources: string[] = [];

  try {
    if (args.health) {
      Object.assign(measurements, measurementsFromHealth(readJson(args.health)));
      sources.push(`health=${args.health}`);
    }
    if (args.load) {
      Object.assign(measurements, measurementsFromLoad(readJson(args.load)));
      sources.push(`load=${args.load}`);
    }
  } catch (error) {
    log(`ERREUR CONFIGURATION : ${error instanceof Error ? error.message : error}`);
    return 2;
  }

  const report = evaluatePhase10Slos(measurements);
  const decision = alertDecision(report);

  let aiBudget: ReturnType<typeof evaluateAiBudget> | null = null;
  if (args.aiUsage) {
    try {
      const rows = readJson(args.aiUsage) as AiUsageDailyRow[];
      aiBudget = evaluateAiBudget(rows, AI_BUDGET_CONFIG);
      sources.push(`ai_usage=${args.aiUsage}`);
    } catch (error) {
      log(`ERREUR CONFIGURATION (ai-usage) : ${error instanceof Error ? error.message : error}`);
      return 2;
    }
  }

  const output = {
    generatedAt: report.generatedAt,
    sources,
    scope:
      'local/proxy — les valeurs issues d’A15 sont des proxys locaux, ' +
      'jamais des mesures de production ; les SLO absents restent insufficient_data',
    slos: report.evaluations,
    sloTotal: PHASE10_SLOS.length,
    failures: report.failures.map((item) => item.id),
    insufficient: report.insufficient.map((item) => item.id),
    decision,
    aiBudget,
    exitCode: report.ok ? 0 : 1,
  };

  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(output, null, 2));
    log(`résultat JSON écrit : ${args.out}`);
  }

  if (args.json) {
    log(JSON.stringify(output, null, 2));
  } else {
    log('=== Phase 10 — SLO & budget (preuves locales, jamais la production) ===');
    for (const evaluation of report.evaluations) {
      const observed = evaluation.observed == null ? 'n/a' : String(evaluation.observed);
      log(
        `- ${evaluation.status.toUpperCase().padEnd(18)} ${evaluation.id} ` +
          `(observé=${observed}, cible=${evaluation.target}, ${evaluation.reason})`
      );
    }
    if (decision.messages.length > 0) {
      log('--- Alertes / instrumentation ---');
      for (const message of decision.messages) log(message);
    }
    if (aiBudget) {
      log(`--- Budget IA : ${aiBudget.status} (${aiBudget.reason}) ---`);
      for (const check of aiBudget.checks) {
        log(`- ${check.ok === null ? 'INSUFFICIENT' : check.ok ? 'ok' : 'DÉPASSÉ'} : ${check.detail}`);
      }
    }
    log(
      report.ok
        ? `RÉSULTAT : aucun SLO en échec · ${report.insufficient.length} SLO non mesuré(s) (INSUFFICIENT_DATA)`
        : `RÉSULTAT : ${report.failures.length} SLO en échec`
    );
    log(
      'Rappel : les destinataires réels d’alerte et la charge distante sont des ' +
        'items humain/ops (INSUFFICIENT_DATA).'
    );
  }

  return report.ok ? 0 : 1;
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && process.argv[1].replace(/\\/g, '/').endsWith('phase10_slo_check.ts');

if (invokedDirectly) {
  main().then((code) => {
    process.exitCode = code;
  });
}

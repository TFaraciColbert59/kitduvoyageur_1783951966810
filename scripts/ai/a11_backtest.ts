/**
 * A11 #35 — Harnais de backtesting réel (CLI).
 *
 * Usage :
 *   npx tsx scripts/ai/a11_backtest.ts <samples.json> [--min-coverage=0.85]
 *
 * Lit un tableau JSON de `BacktestSample`, exécute le moteur pur
 * `runBacktest` puis imprime un rapport chiffré en français. Code de sortie :
 *  - 0 : échantillon non vide et couverture P90 ≥ seuil ;
 *  - 1 : entrée vide/invalide, fichier illisible ou couverture sous le seuil.
 * Aucune écriture, aucune donnée inventée : le harnais ne fait que mesurer.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_ANOMALY_THRESHOLD_PCT,
  P90_COVERAGE_TARGET,
  residualAnomalies,
  runBacktest,
  type BacktestMetrics,
  type BacktestSample,
  type ResidualAnomaly,
} from '../../src/features/adventure-intelligence/domain/backtesting';

export interface BacktestReport {
  sampleCount: number;
  minCoverage: number;
  coverageMet: boolean;
  metrics: BacktestMetrics;
  anomalies: ResidualAnomaly[];
}

export interface BacktestCliArgs {
  samplesPath: string | null;
  minCoverage: number;
}

/** Bornage du seuil de couverture (0..1, défaut 0.85). */
function normalizeCoverage(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    return P90_COVERAGE_TARGET;
  }
  return value;
}

/** Analyse un tableau d'échantillons ; jamais de métrique inventée. */
export function buildBacktestReport(
  samples: BacktestSample[],
  minCoverage: number = P90_COVERAGE_TARGET
): BacktestReport {
  const metrics = runBacktest(samples);
  const threshold = normalizeCoverage(minCoverage);
  return {
    sampleCount: metrics.sampleCount,
    minCoverage: threshold,
    coverageMet: metrics.sampleCount > 0 && metrics.p90Coverage >= threshold,
    metrics,
    anomalies: residualAnomalies(samples),
  };
}

/** 0 si le rapport passe le seuil, 1 sinon (entrée vide comprise). */
export function evaluateBacktestExitCode(report: BacktestReport): number {
  return report.coverageMet ? 0 : 1;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)} %`;
}

/** Rapport texte français, déterministe (même entrée ⇒ même sortie). */
export function formatBacktestReportFr(report: BacktestReport): string {
  const { metrics } = report;
  const lines: string[] = [
    '=== Rapport de backtesting A11 ===',
    `Échantillons analysés : ${report.sampleCount}`,
    `MAE médiane : ${formatPercent(metrics.medianAbsErrorPct)}`,
    `MAE moyenne : ${formatPercent(metrics.meanAbsErrorPct)}`,
    `P90 des erreurs absolues : ${formatPercent(metrics.p90ErrorPct)}`,
    `Couverture P90 : ${(metrics.p90Coverage * 100).toFixed(1)} % (cible ≥ ${(report.minCoverage * 100).toFixed(1)} %) — ${report.coverageMet ? 'OK' : 'SOUS LE SEUIL'}`,
    `MAE difficulté : ${metrics.difficultyMae === null ? 'indisponible (paires incomplètes)' : metrics.difficultyMae.toFixed(2)}`,
    'Dérive par bucket (signée, % vs P50) :',
  ];

  const buckets = Object.entries(metrics.driftByBucket);
  if (buckets.length === 0) {
    lines.push('  (aucun bucket renseigné)');
  } else {
    for (const [bucket, drift] of buckets) {
      const direction = drift > 0 ? 'sous-estimation' : drift < 0 ? 'surestimation' : 'neutre';
      lines.push(`  - ${bucket} : ${drift > 0 ? '+' : ''}${drift.toFixed(2)} % (${direction})`);
    }
  }

  lines.push(
    `Anomalies (seuil ${DEFAULT_ANOMALY_THRESHOLD_PCT} %) : ${report.anomalies.length}`
  );
  for (const anomaly of report.anomalies) {
    lines.push(`  #${anomaly.index} : ${anomaly.errorPct > 0 ? '+' : ''}${anomaly.errorPct} % — ${anomaly.reason}`);
  }
  if (report.anomalies.length === 0) {
    lines.push('  (aucun résidu au-delà du seuil)');
  }

  return lines.join('\n');
}

function parseCoverageFlag(value: string): number | undefined {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Analyse les arguments CLI : premier argument positionnel = chemin du JSON,
 * `--min-coverage=0.85` ou `--min-coverage 0.85` pour le seuil.
 */
export function parseBacktestArgs(argv: string[]): BacktestCliArgs {
  let samplesPath: string | null = null;
  let minCoverage = P90_COVERAGE_TARGET;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--min-coverage=')) {
      minCoverage = normalizeCoverage(parseCoverageFlag(arg.slice('--min-coverage='.length)));
    } else if (arg === '--min-coverage') {
      minCoverage = normalizeCoverage(parseCoverageFlag(argv[index + 1] ?? ''));
      index += 1;
    } else if (!arg.startsWith('--') && samplesPath === null) {
      samplesPath = arg;
    }
  }

  return { samplesPath, minCoverage };
}

function isBacktestSample(value: unknown): value is BacktestSample {
  if (value === null || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (['predictedP50Seconds', 'predictedP90Seconds', 'actualSeconds'] as const).every(
    (key) => typeof record[key] === 'number' && Number.isFinite(record[key])
  );
}

function validateSampleList(candidates: unknown[]): { samples: BacktestSample[] } | { error: string } {
  const invalidIndex = candidates.findIndex((entry) => !isBacktestSample(entry));
  if (invalidIndex >= 0) {
    return {
      error: `Échantillon invalide à l’index ${invalidIndex} — champs prédits/réels numériques requis.`,
    };
  }
  return { samples: candidates as BacktestSample[] };
}

/**
 * Lit un fichier d'échantillons : tableau JSON (héritage A11) **ou** JSONL
 * (une ligne = un `BacktestSample`, format de l'export anonymisé A13). Un JSONL
 * dont une ligne est illisible ou invalide est refusé avec le numéro de ligne —
 * aucune donnée n'est inventée ni ignorée silencieusement.
 */
export function parseSamplesFile(raw: string): { samples: BacktestSample[] } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {
      error: 'Fichier vide — un tableau JSON ou un JSONL d’échantillons BacktestSample est attendu.',
    };
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return validateSampleList(parsed);
    if (parsed !== null && typeof parsed === 'object') return validateSampleList([parsed]);
    return { error: 'Format invalide — le fichier doit contenir un tableau JSON ou un objet par ligne.' };
  } catch {
    // Repli JSONL : une ligne = un objet JSON.
    const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
    const candidates: unknown[] = [];
    for (const [index, line] of lines.entries()) {
      try {
        candidates.push(JSON.parse(line) as unknown);
      } catch {
        return { error: `Ligne ${index + 1} illisible — JSON attendu (une ligne = un échantillon).` };
      }
    }
    if (candidates.length === 0) {
      return { error: 'Fichier vide — un tableau JSON ou un JSONL d’échantillons est attendu.' };
    }
    const validated = validateSampleList(candidates);
    if ('error' in validated) {
      return { error: validated.error.replace('à l’index', 'à la ligne') };
    }
    return validated;
  }
}

async function main(argv: string[]): Promise<number> {
  const args = parseBacktestArgs(argv);
  if (!args.samplesPath) {
    console.error(
      'Usage : npx tsx scripts/ai/a11_backtest.ts <samples.json> [--min-coverage=0.85]'
    );
    return 1;
  }

  const resolved = path.resolve(process.cwd(), args.samplesPath);
  let raw: string;
  try {
    raw = readFileSync(resolved, 'utf8');
  } catch {
    console.error(`Fichier illisible : ${resolved}`);
    return 1;
  }

  const result = parseSamplesFile(raw);
  if ('error' in result) {
    console.error(result.error);
    return 1;
  }

  const report = buildBacktestReport(result.samples, args.minCoverage);
  console.log(formatBacktestReportFr(report));
  if (!report.coverageMet) {
    console.error(
      `Couverture P90 ${(report.metrics.p90Coverage * 100).toFixed(1)} % < seuil ${(report.minCoverage * 100).toFixed(1)} %.`
    );
  }
  return evaluateBacktestExitCode(report);
}

const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  path.basename(process.argv[1]).startsWith('a11_backtest') &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(
        'Erreur inattendue du harnais de backtesting :',
        error instanceof Error ? error.message : error
      );
      process.exitCode = 1;
    });
}

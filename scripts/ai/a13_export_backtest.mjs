#!/usr/bin/env node
/**
 * A13 (S8) — Export de backtesting sur données réelles anonymisées.
 *
 * Usage :
 *   node scripts/ai/a13_export_backtest.mjs
 *
 * Variables d'environnement (jamais en dur, jamais commitées) :
 *   SUPABASE_TEST_DB_URL | DATABASE_URL  — chaîne de connexion PostgreSQL de la
 *                                          base de TEST uniquement (jamais la
 *                                          production). Aucun défaut implicite.
 *   A13_BACKTEST_HASH_SALT               — sel optionnel de pseudonymisation.
 *
 * Le script extrait les paires prédiction/réel :
 *   • route_predictions (A10/S1) × hike_sessions ;
 *   • segment_predictions × session_segment_passages.
 * puis écrit un JSONL strictement anonymisé (SHA-256 des identifiants, aucune
 * position GPS, aucun nom/email) dans un répertoire temporaire HORS dépôt.
 *
 * Honnêteté des données : les compteurs réels sont toujours imprimés ; si moins
 * de MIN_BACKTEST_SAMPLES paires exploitables existent, l'insuffisance est
 * affichée explicitement et l'échantillon partiel est produit tel quel —
 * aucune donnée n'est inventée. Le script ne modifie jamais la base (SELECT
 * uniquement) et n'affiche jamais la chaîne de connexion.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Seuil minimal d'échantillons pour un backtesting exploitable. */
export const MIN_BACKTEST_SAMPLES = 40;
/** Plafond d'échantillons extraits par source (garde-fou mémoire). */
export const MAX_BACKTEST_SAMPLES = 5000;
/** Colonnes whitelistées de la sortie — tout le reste est ignoré. */
export const SAMPLE_KEYS = [
  'predictedP50Seconds',
  'predictedP90Seconds',
  'actualSeconds',
  'predictedDifficulty',
  'feltDifficulty',
  'terrainBucket',
  'source',
  'userHash',
  'sessionHash',
  'modelVersion',
];
/** Sacs à dos techniques reconnus pour le bucket `technical`. */
export const TECHNICAL_SAC_SCALES = [
  'mountain_hiking',
  'demanding_mountain_hiking',
  'alpine_hiking',
  'demanding_alpine_hiking',
  'difficult_alpine_hiking',
];
/** Surfaces reconnues comme techniques (rocheux). */
export const TECHNICAL_SURFACES = ['rock', 'scree', 'cliff'];
/** Écart minimal (m) de dénivelé pour classer montée/descente. */
const BUCKET_ELEVATION_THRESHOLD_M = 20;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Nombre fini ou `null` (jamais de conversion implicite de chaîne). */
function finiteOrNull(value) {
  if (isFiniteNumber(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Pseudonymise un identifiant (user/session) par SHA-256 hex 64.
 * `salt` optionnel : `sha256(salt:value)`. Valeur vide/absente ⇒ `null`.
 */
export function hashAnonymousId(value, salt = '') {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const input = typeof salt === 'string' && salt.length > 0 ? `${salt}:${value}` : value;
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Bucket de terrain dérivé des valeurs réelles du passage (`gain_m`, `loss_m`)
 * et des tags OSM (`sac_scale`, `surface`). Aucun signal ⇒ `null`.
 */
export function deriveTerrainBucket({ gainM = null, lossM = null, sacScale = null, surface = null } = {}) {
  if (typeof sacScale === 'string' && TECHNICAL_SAC_SCALES.includes(sacScale)) return 'technical';
  if (typeof surface === 'string' && TECHNICAL_SURFACES.includes(surface)) return 'technical';
  const gain = finiteOrNull(gainM);
  const loss = finiteOrNull(lossM);
  if (gain === null && loss === null) return null;
  const diff = (gain ?? 0) - (loss ?? 0);
  if (diff > BUCKET_ELEVATION_THRESHOLD_M) return 'ascent';
  if (diff < -BUCKET_ELEVATION_THRESHOLD_M) return 'descent';
  return 'flat';
}

/** Projection stricte (whitelist) d'une paire prédit/réel en `BacktestSample`. */
function projectSample({ predictedP50, predictedP90, actual, predictedDifficulty, terrainBucket, source, userId, sessionId, modelVersion, salt }) {
  const sample = {
    predictedP50Seconds: predictedP50,
    predictedP90Seconds: predictedP90,
    actualSeconds: actual,
    predictedDifficulty: finiteOrNull(predictedDifficulty),
    feltDifficulty: null,
    terrainBucket: terrainBucket ?? null,
    source,
    userHash: hashAnonymousId(userId, salt),
    sessionHash: hashAnonymousId(sessionId, salt),
    modelVersion: typeof modelVersion === 'string' && modelVersion.length > 0 ? modelVersion : null,
  };
  return sample;
}

function isValidPair(p50, p90, actual) {
  return isFiniteNumber(p50) && p50 > 0 && isFiniteNumber(p90) && p90 > 0 && isFiniteNumber(actual) && actual > 0;
}

/**
 * Construit les échantillons anonymisés depuis les lignes brutes (colonnes DB).
 * Les lignes inexploitables sont comptées, jamais réparées ni inventées.
 */
export function buildSamplesFromRows({
  routeRows = [],
  segmentRows = [],
  salt = '',
  minSamples = MIN_BACKTEST_SAMPLES,
} = {}) {
  const samples = [];
  let skippedRouteRows = 0;
  let skippedSegmentRows = 0;
  let routeSamples = 0;
  let segmentSamples = 0;

  for (const row of Array.isArray(routeRows) ? routeRows : []) {
    const p50 = finiteOrNull(row?.total_duration_p50_s ?? row?.predictedP50Seconds);
    const p90 = finiteOrNull(row?.total_duration_p90_s ?? row?.predictedP90Seconds);
    const actual = finiteOrNull(row?.actual_seconds ?? row?.actualSeconds);
    if (!isValidPair(p50, p90, actual)) {
      skippedRouteRows += 1;
      continue;
    }
    samples.push(
      projectSample({
        predictedP50: p50,
        predictedP90: p90,
        actual,
        predictedDifficulty: row?.personal_difficulty ?? null,
        terrainBucket: null,
        source: 'route',
        userId: row?.user_id,
        sessionId: row?.session_id,
        modelVersion: row?.model_version,
        salt,
      })
    );
    routeSamples += 1;
  }

  for (const row of Array.isArray(segmentRows) ? segmentRows : []) {
    const p50 = finiteOrNull(row?.predicted_duration_p50 ?? row?.predictedP50Seconds);
    const p90 = finiteOrNull(row?.predicted_duration_p90 ?? row?.predictedP90Seconds);
    const actual = finiteOrNull(row?.actual_seconds ?? row?.actualSeconds);
    if (!isValidPair(p50, p90, actual)) {
      skippedSegmentRows += 1;
      continue;
    }
    samples.push(
      projectSample({
        predictedP50: p50,
        predictedP90: p90,
        actual,
        predictedDifficulty: row?.personal_difficulty ?? null,
        terrainBucket: deriveTerrainBucket({
          gainM: row?.gain_m,
          lossM: row?.loss_m,
          sacScale: row?.sac_scale,
          surface: row?.surface,
        }),
        source: 'segment',
        userId: row?.user_id,
        sessionId: row?.session_id,
        modelVersion: row?.model_version,
        salt,
      })
    );
    segmentSamples += 1;
  }

  const users = new Set(samples.map((sample) => sample.userHash).filter(Boolean));
  const threshold = isFiniteNumber(minSamples) && minSamples > 0 ? Math.trunc(minSamples) : MIN_BACKTEST_SAMPLES;
  const counts = {
    routeRows: Array.isArray(routeRows) ? routeRows.length : 0,
    segmentRows: Array.isArray(segmentRows) ? segmentRows.length : 0,
    routeSamples,
    segmentSamples,
    skippedRouteRows,
    skippedSegmentRows,
    samples: samples.length,
    usersHashed: users.size,
    minSamples: threshold,
    sufficient: samples.length >= threshold,
  };

  return { samples, counts };
}

/** Sérialisation JSONL déterministe (une ligne = un échantillon). */
export function serializeSamplesJsonl(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return '';
  return `${samples.map((sample) => JSON.stringify(sample)).join('\n')}\n`;
}

/** Rapport français, compteurs réels et insuffisance explicite. */
export function formatExportSummaryFr({ counts, outputPath = null, database = null, errors = [] } = {}) {
  const lines = ['=== Export backtesting A13 (anonymisé) ==='];
  if (database) {
    lines.push(
      `Base de test : route_predictions=${database.routePredictions ?? 'indisponible'}, ` +
        `segment_predictions=${database.segmentPredictions ?? 'indisponible'}, ` +
        `hike_sessions=${database.hikeSessions ?? 'indisponible'}, ` +
        `session_segment_passages=${database.sessionSegmentPassages ?? 'indisponible'}`
    );
  }
  lines.push(
    `Lignes lues : route=${counts?.routeRows ?? 0}, segment=${counts?.segmentRows ?? 0}`,
    `Échantillons retenus : route=${counts?.routeSamples ?? 0}, segment=${counts?.segmentSamples ?? 0}, ` +
      `total=${counts?.samples ?? 0}`,
    `Lignes ignorées (valeurs inexploitables) : route=${counts?.skippedRouteRows ?? 0}, ` +
      `segment=${counts?.skippedSegmentRows ?? 0}`,
    `Identifiants pseudonymisés (SHA-256) : ${counts?.usersHashed ?? 0} utilisateurs distincts`
  );

  const threshold = counts?.minSamples ?? MIN_BACKTEST_SAMPLES;
  if (counts?.sufficient) {
    lines.push(`Seuil minimal : ${threshold} échantillons — SUFFISANT.`);
  } else {
    lines.push(
      `DONNÉES INSUFFISANTES : ${counts?.samples ?? 0} échantillon(s) exploitable(s) < ${threshold} — ` +
        'échantillon partiel, aucune donnée inventée.'
    );
  }

  for (const error of Array.isArray(errors) ? errors : []) {
    lines.push(`AVERTISSEMENT lecture ${error?.scope ?? 'inconnue'} : ${error?.message ?? 'erreur inconnue'}`);
  }

  if (outputPath) {
    lines.push(
      `Fichier JSONL temporaire (hors dépôt) : ${outputPath}`,
      `Suppression après usage : Remove-Item -LiteralPath "${outputPath}"`
    );
  }
  return lines.join('\n');
}

/** Lit la chaîne de connexion de TEST depuis l'environnement, jamais en dur. */
export function loadDatabaseUrl(env = process.env) {
  const candidates = [env?.SUPABASE_TEST_DB_URL, env?.DATABASE_URL];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate.trim();
  }
  return null;
}

/** Ligne JSON synthétique pour l'outillage (`A13_EXPORT_COUNTS {...}`). */
export function formatCountsLine({ counts, database, errors, outputPath }) {
  return `A13_EXPORT_COUNTS ${JSON.stringify({ counts, database, errors, outputPath })}`;
}

const COUNTED_TABLES = [
  'route_predictions',
  'segment_predictions',
  'hike_sessions',
  'session_segment_passages',
];

const ROUTE_QUERY = `SELECT
  rp.user_id::text AS user_id,
  hs.id::text AS session_id,
  rp.strategy,
  rp.total_duration_p50_s,
  rp.total_duration_p90_s,
  rp.personal_difficulty,
  rp.model_version,
  hs.duration_seconds AS actual_seconds
FROM public.route_predictions rp
JOIN public.hike_sessions hs
  ON hs.user_id = rp.user_id
 AND hs.ended_at >= rp.computed_at
 AND hs.duration_seconds IS NOT NULL
 AND hs.duration_seconds BETWEEN (rp.total_duration_p50_s * 0.5) AND (rp.total_duration_p50_s * 2.0)
WHERE rp.strategy = 'recommended'
ORDER BY rp.computed_at DESC
LIMIT ${MAX_BACKTEST_SAMPLES}`;

const SEGMENT_QUERY = `SELECT
  sp.user_id::text AS user_id,
  pass.session_id::text AS session_id,
  sp.segment_id,
  sp.predicted_duration_p50,
  sp.predicted_duration_p90,
  sp.personal_difficulty,
  sp.model_version,
  pass.duration_s AS actual_seconds,
  pass.gain_m,
  pass.loss_m,
  ts.sac_scale,
  ts.surface
FROM public.segment_predictions sp
JOIN public.session_segment_passages pass
  ON pass.user_id = sp.user_id
 AND pass.segment_id = sp.segment_id
 AND pass.entered_at >= sp.computed_at
LEFT JOIN public.trail_segments ts ON ts.id = sp.segment_id
WHERE pass.duration_s > 0
ORDER BY pass.entered_at DESC
LIMIT ${MAX_BACKTEST_SAMPLES}`;

/**
 * Exécute l'export complet : compteurs, extraction, anonymisation, écriture
 * JSONL hors dépôt. `pg` est importé dynamiquement pour garder la logique pure
 * testable sans dépendance base.
 */
export async function exportBacktestSamples({ databaseUrl, salt = '', log = console.log } = {}) {
  if (typeof databaseUrl !== 'string' || databaseUrl.trim().length === 0) {
    throw new Error(
      'Chaîne de connexion de test requise via SUPABASE_TEST_DB_URL ou DATABASE_URL (jamais en dur).'
    );
  }

  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const database = {};
  const errors = [];
  try {
    for (const table of COUNTED_TABLES) {
      try {
        const result = await client.query(`SELECT count(*)::int AS n FROM public.${table}`);
        database[table] = Number(result.rows[0]?.n ?? 0);
      } catch (caught) {
        database[table] = null;
        errors.push({ scope: table, message: caught instanceof Error ? caught.message : String(caught) });
      }
    }

    const readRows = async (scope, query) => {
      try {
        const result = await client.query(query);
        return result.rows ?? [];
      } catch (caught) {
        errors.push({ scope, message: caught instanceof Error ? caught.message : String(caught) });
        return [];
      }
    };

    const [routeRows, segmentRows] = await Promise.all([
      readRows('route_predictions×hike_sessions', ROUTE_QUERY),
      readRows('segment_predictions×session_segment_passages', SEGMENT_QUERY),
    ]);

    const { samples, counts } = buildSamplesFromRows({ routeRows, segmentRows, salt });
    const directory = mkdtempSync(path.join(os.tmpdir(), 'lkdv-a13-backtest-'));
    const outputPath = path.join(directory, 'samples.jsonl');
    writeFileSync(outputPath, serializeSamplesJsonl(samples), 'utf8');

    const databaseCounts = {
      routePredictions: database.route_predictions,
      segmentPredictions: database.segment_predictions,
      hikeSessions: database.hike_sessions,
      sessionSegmentPassages: database.session_segment_passages,
    };

    log(
      formatExportSummaryFr({ counts, outputPath, database: databaseCounts, errors })
    );
    log(formatCountsLine({ counts, database: databaseCounts, errors, outputPath }));

    return { samples, counts, outputPath, database: databaseCounts, errors };
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  const databaseUrl = loadDatabaseUrl(process.env);
  if (!databaseUrl) {
    console.error(
      'Chaîne de connexion de TEST manquante. Définissez SUPABASE_TEST_DB_URL ou ' +
        'DATABASE_URL dans l’environnement local (base de test uniquement, jamais la production).'
    );
    return 1;
  }
  const salt = process.env.A13_BACKTEST_HASH_SALT ?? '';
  try {
    await exportBacktestSamples({ databaseUrl, salt });
    return 0;
  } catch (caught) {
    console.error(
      'Export impossible :',
      caught instanceof Error ? caught.message : String(caught)
    );
    return 1;
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  path.basename(process.argv[1]).startsWith('a13_export_backtest') &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().then((code) => {
    process.exitCode = code;
  });
}

#!/usr/bin/env node
/**
 * Alerte gratuite sur le rapport quotidien de la base (plan 1.1).
 *
 * `ops_daily_report()` (pg_cron, 4 h 07 UTC) écrit une ligne par jour dans
 * `ops_daily_reports`, avec une colonne `alerts`. Personne ne lit la table : cette
 * vérification, lancée chaque matin par `.github/workflows/ops-alerts.yml`, sort en
 * erreur (exécution rouge = e-mail GitHub gratuit) quand :
 *   - la dernière ligne a des alertes ;
 *   - aucune ligne récente n'existe (pg_cron arrêté, projet en pause) ;
 *   - la base dépasse la cible de 400 Mo du budget de place.
 * Sans donnée personnelle : seuls des compteurs et des libellés d'alerte sont lus.
 *
 * Usage : `psql … -At -c "select row_to_json(r) from (…) r" | node scripts/ops/check-daily-report.mjs`
 */
import { pathToFileURL } from 'node:url';

export const DB_TARGET_BYTES = 400 * 1024 * 1024;
/** Le rapport du jour J est écrit le jour J+1 à 4 h 07 UTC : tolérer un jour de retard. */
export const MAX_REPORT_AGE_DAYS = 2;

const DAY_MS = 86_400_000;

/**
 * @param {{ day?: string, db_bytes?: number | string | null, alerts?: string[] | null } | null | undefined} row
 * @param {Date} now
 * @returns {{ ok: boolean, problems: string[], notes: string[] }}
 */
export function evaluateDailyReport(row, now = new Date()) {
  const problems = [];
  const notes = [];
  if (!row || typeof row.day !== 'string') {
    return {
      ok: false,
      problems: ['aucun rapport quotidien lu (ops_daily_reports vide ou illisible)'],
      notes,
    };
  }
  const dayMs = Date.parse(`${row.day}T00:00:00Z`);
  if (!Number.isFinite(dayMs)) {
    return {
      ok: false,
      problems: [`date de rapport illisible : ${String(row.day).slice(0, 20)}`],
      notes,
    };
  }
  const todayMs = Math.floor(now.getTime() / DAY_MS) * DAY_MS;
  const ageDays = Math.round((todayMs - dayMs) / DAY_MS);
  if (ageDays > MAX_REPORT_AGE_DAYS) {
    problems.push(
      `dernier rapport du ${row.day} (${ageDays} jours) : pg_cron « ops-daily-report » ne tourne plus ou le projet est en pause`,
    );
  }
  const alerts = Array.isArray(row.alerts)
    ? row.alerts.filter((a) => typeof a === 'string' && a)
    : [];
  for (const a of alerts) problems.push(`alerte du ${row.day} : ${a}`);
  const bytes = Number(row.db_bytes);
  if (Number.isFinite(bytes)) {
    const mib = bytes / 1024 / 1024;
    notes.push(`base : ${mib.toFixed(1)} Mio`);
    if (bytes > DB_TARGET_BYTES) {
      problems.push(
        `base à ${mib.toFixed(1)} Mio, au-dessus de la cible de 400 Mio (offre gratuite : 500 Mio)`,
      );
    }
  }
  return { ok: problems.length === 0, problems, notes };
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function main() {
  const raw = await readStdin();
  let row = null;
  try {
    row = raw ? JSON.parse(raw.split('\n')[0]) : null;
  } catch {
    row = null;
  }
  const result = evaluateDailyReport(row);
  for (const n of result.notes) console.log(n);
  if (result.ok) {
    console.log('Rapport quotidien sans alerte.');
    return;
  }
  for (const p of result.problems) console.log(`::error::${p}`);
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}

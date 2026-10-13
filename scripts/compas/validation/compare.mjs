// Compas — verdict d'un passage de validation en ligne (PLAN-100, phase 7).
//
// Croise trois sources :
//   1. results.jsonl  : ce que le passage a vu à l'écran (scripts/compas/validate-online.mjs) ;
//   2. le contrôle en base : les lignes de check.sql, exportées en CSV (psql --csv) ou en JSON ;
//   3. le jeu          : { id, phrase, expect } (scripts/compas/validation/*.json).
// et rend, par demande, un verdict :
//   prête      la préparation a réussi en moins de 60 s et tout `expect` est tenu ;
//   partielle  préparée, mais une attente, un invariant ou la durée est manqué (liste dite) ;
//   échec      pas de voyage, préparation en échec ou jamais finie.
// puis le taux de réussite (prêtes / jouées). Les demandes jamais jouées sont comptées à part.
//
// Usage :
//   node scripts/compas/validation/compare.mjs --run proof/compas/<dossier> \
//        --check check.csv --set scripts/compas/validation/reels-20.json \
//        [--max-seconds 60] [--skew-seconds 20] [--min-rate 95] [--json rapport.json]
//
// Module : les fonctions sont pures et exportées (tests/compas-validation/) ; la ligne de commande
// ne démarre que si le fichier est lancé directement.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSet, plain } from './sets.mjs';

export const DEFAULT_MAX_SECONDS = 60;
export const DEFAULT_SKEW_SECONDS = 20;

/* ---------- Lecture ---------- */

const NUMERIC_COLUMNS = new Set([
  'days',
  'party_size',
  'estimated_budget',
  'anchor_lat',
  'anchor_lon',
  'anchor_radius_km',
  'step_count',
  'steps_no_place',
  'steps_no_coords',
  'steps_dup_consecutive',
  'steps_beyond_radius',
  'steps_ai_proposed',
  'steps_lat_min',
  'steps_lat_max',
  'steps_lon_min',
  'steps_lon_max',
  'kit_items',
  'budget_lines',
  'budget_planned_total',
  'prep_seconds',
  'ops_event_gap_s',
  'app_errors_during',
]);
const BOOLEAN_COLUMNS = new Set(['car_free', 'prep_ok', 'prep_used_ai']);

/** Horodatage de PostgreSQL (« 2026-10-14 10:02:05+00 ») ou ISO 8601 → millisecondes, sinon null. */
export function parseTimestamp(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const m =
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(
      String(value).trim()
    );
  if (!m) return null;
  let zone = m[4] ?? 'Z';
  if (zone !== 'Z') {
    const digits = zone.slice(1).replace(':', '');
    zone = `${zone[0]}${digits.slice(0, 2)}:${digits.slice(2) || '00'}`;
  }
  const ms = Date.parse(`${m[1]}T${m[2]}${(m[3] ?? '').slice(0, 4)}${zone}`);
  return Number.isFinite(ms) ? ms : null;
}

/** CSV (RFC 4180, comme `psql --csv`) → lignes de champs. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = String(text).replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

/**
 * Une ligne de check.sql, de CSV (tout en texte) ou de JSON (types variables) → types sûrs.
 * @param {Record<string, any>} raw
 * @returns {Record<string, any>}
 */
export function normaliseRow(raw) {
  /** @type {Record<string, any>} */
  const row = {};
  for (const [key, value] of Object.entries(raw)) {
    let v = value === '' || value === undefined ? null : value;
    if (v != null && NUMERIC_COLUMNS.has(key)) {
      const n = Number(v);
      v = Number.isFinite(n) ? n : null;
    } else if (v != null && BOOLEAN_COLUMNS.has(key)) {
      v =
        v === true || v === 't' || v === 'true'
          ? true
          : v === false || v === 'f' || v === 'false'
            ? false
            : null;
    }
    row[key] = v;
  }
  row.created_ms = parseTimestamp(row.created_at);
  return row;
}

/**
 * Le contrôle en base : un tableau JSON, ou le CSV de `psql --csv`.
 * @param {string} text
 * @returns {Record<string, any>[]}
 */
export function readCheckRows(text) {
  const body = String(text).trim();
  if (!body) return [];
  if (body.startsWith('[') || body.startsWith('{')) {
    const parsed = JSON.parse(body);
    return (Array.isArray(parsed) ? parsed : [parsed]).map(normaliseRow);
  }
  const table = parseCsv(body);
  if (!table.length) return [];
  const [header, ...lines] = table;
  return lines.map((cells) =>
    normaliseRow(Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ''])))
  );
}

/**
 * results.jsonl : un objet JSON par ligne.
 * @param {string} text
 * @returns {Record<string, any>[]}
 */
export function readResults(text) {
  /** @type {Record<string, any>[]} */
  const out = [];
  String(text)
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (!line.trim()) return;
      try {
        out.push(JSON.parse(line));
      } catch {
        throw new Error(`results.jsonl, ligne ${i + 1} : JSON invalide`);
      }
    });
  return out;
}

/* ---------- Appariement demande ↔ voyage ---------- */

function resolveItemId(result, items, byId) {
  if (typeof result.id === 'string' && byId.has(result.id)) return result.id;
  const said = result.say ?? result.phrase;
  if (Number.isInteger(result.i) && items[result.i - 1]) {
    const item = items[result.i - 1];
    if (!said || plain(said) === plain(item.phrase)) return item.id;
  }
  if (said) {
    const hit = items.find((it) => plain(it.phrase) === plain(said));
    if (hit) return hit.id;
  }
  return null;
}

/**
 * Chaque voyage de la base est rangé sous la demande qui l'a fait naître :
 *   1. par sa phrase de départ, tant que le Compas ne l'a pas effacée (`start_say_pending`) ;
 *   2. sinon par l'heure : la demande la plus récente démarrée au plus `skewMs` après la création
 *      du voyage, à condition que le voyage soit né avant la fin de cette demande (+ `skewMs`).
 * Les demandes se jouent l'une après l'autre : leurs fenêtres ne se recouvrent pas.
 */
export function matchTrips(items, results, rows, { skewMs = DEFAULT_SKEW_SECONDS * 1000 } = {}) {
  const byId = new Map(items.map((it) => [it.id, it]));
  const entries = results.map((r, idx) => {
    const start = parseTimestamp(r.startedAt);
    const endRaw = parseTimestamp(r.endedAt);
    return {
      r,
      idx,
      itemId: resolveItemId(r, items, byId),
      start,
      end: endRaw ?? (start != null ? start + (Number(r.seconds) || 0) * 1000 : null),
    };
  });
  const timed = entries.filter((e) => e.start != null).sort((a, b) => a.start - b.start);
  const buckets = new Map(entries.map((e) => [e.idx, []]));
  const orphans = [];
  for (const row of rows) {
    let target = null;
    if (row.start_say_pending) {
      const said = plain(row.start_say_pending);
      const item = items.find((it) => said.startsWith(plain(it.phrase)));
      if (item) {
        const mine = entries.filter((e) => e.itemId === item.id);
        target = mine.length ? mine[mine.length - 1] : null;
      }
    }
    if (!target && row.created_ms != null) {
      const before = timed.filter((e) => e.start - skewMs <= row.created_ms);
      const last = before[before.length - 1];
      if (last && (last.end == null || row.created_ms <= last.end + skewMs)) target = last;
    }
    if (target) buckets.get(target.idx).push(row);
    else orphans.push(row);
  }
  // Par demande : la dernière tentative (un passage relancé dans le même dossier s'ajoute au journal).
  const perItem = new Map();
  for (const item of items) {
    const mine = entries.filter((e) => e.itemId === item.id);
    if (!mine.length) continue;
    const withRows = mine.filter((e) => buckets.get(e.idx).length);
    const chosen = (withRows.length ? withRows : mine).reduce((a, b) =>
      (b.start ?? 0) >= (a.start ?? 0) ? b : a
    );
    const own = [...buckets.get(chosen.idx)].sort(
      (a, b) => (a.created_ms ?? 0) - (b.created_ms ?? 0)
    );
    perItem.set(item.id, { result: chosen.r, row: own[0] ?? null, extraRows: own.slice(1) });
  }
  // Un voyage sans demande connue (start_say seule, journal perdu) : il garde sa demande.
  for (const row of orphans.slice()) {
    if (!row.start_say_pending) continue;
    const said = plain(row.start_say_pending);
    const item = items.find((it) => said.startsWith(plain(it.phrase)));
    if (item && !perItem.has(item.id)) {
      perItem.set(item.id, { result: null, row, extraRows: [] });
      orphans.splice(orphans.indexOf(row), 1);
    }
  }
  // Un voyage né pendant une ligne du journal que le jeu ne connaît pas n'appartient à aucune demande.
  for (const e of entries) if (e.itemId == null) orphans.push(...buckets.get(e.idx));
  const unknownResults = entries.filter((e) => e.itemId == null).map((e) => e.r);
  return { perItem, orphans, unknownResults };
}

/* ---------- Attentes ---------- */

const asList = (v) => (Array.isArray(v) ? v : [v]);
const show = (v) => (v == null ? 'non renseigné' : String(v));

/** Écart entre deux dates ISO (jours entiers, UTC). */
function daysBetween(fromMs, toIso) {
  const to = Date.parse(`${String(toIso).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(to) || fromMs == null) return null;
  const from = Date.parse(`${new Date(fromMs).toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/**
 * Les attentes du jeu contre la ligne de base. Rend la liste des manques, en français ; vide :
 * tout est tenu. Chaque clé de `expect` est facultative (voir README.md).
 */
export function evaluateExpect(expect, row) {
  const misses = [];
  if (expect.country !== undefined) {
    const got = row.country ? String(row.country).toUpperCase() : null;
    if (!got || !asList(expect.country).includes(got))
      misses.push(`pays : attendu ${asList(expect.country).join('|')}, obtenu ${show(got)}`);
  }
  if (expect.activity !== undefined && !asList(expect.activity).includes(row.activity))
    misses.push(
      `activité : attendu ${asList(expect.activity).join('|')}, obtenu ${show(row.activity)}`
    );
  if (expect.days !== undefined) {
    const [min, max] = Array.isArray(expect.days) ? expect.days : [expect.days, expect.days];
    const label = min === max ? String(min) : `${min} à ${max}`;
    if (row.days == null || row.days < min || row.days > max)
      misses.push(`durée : attendu ${label} jours, obtenu ${show(row.days)}`);
  }
  if (expect.party !== undefined && row.party_size !== expect.party)
    misses.push(`groupe : attendu ${expect.party} personnes, obtenu ${show(row.party_size)}`);
  if (expect.origin === null && row.origin_name)
    misses.push(`départ : aucun dit, mais « ${row.origin_name} » est rangé`);
  else if (
    typeof expect.origin === 'string' &&
    !plain(row.origin_name).includes(plain(expect.origin))
  )
    misses.push(
      `départ : attendu « ${expect.origin} », obtenu ${row.origin_name ? `« ${row.origin_name} »` : 'aucun'}`
    );
  if (expect.carFree === true && row.car_free !== true)
    misses.push('sans voiture : non rangé sur le voyage');
  if (expect.nights !== undefined && row.nights !== expect.nights)
    misses.push(`nuits : attendu ${expect.nights}, obtenu ${show(row.nights)}`);
  if (expect.budget !== undefined) {
    const { amount, currency } = expect.budget;
    const people = expect.perPersonBudget ? (expect.party ?? 1) : 1;
    const nominal = amount * people;
    const got = row.estimated_budget;
    const where = expect.perPersonBudget ? ` (${amount} par personne × ${people})` : '';
    if (got == null || got <= 0)
      misses.push(`budget : attendu ${nominal} ${currency}${where}, obtenu ${show(got)}`);
    else if (currency === row.budget_currency) {
      if (Math.abs(got - nominal) > 1)
        misses.push(
          `budget : attendu ${nominal} ${currency}${where}, obtenu ${got} ${row.budget_currency}`
        );
    } else if (got < nominal * 0.2 || got > nominal * 5) {
      // Autre devise : le taux du jour n'est pas connu ici, seul l'ordre de grandeur se vérifie.
      misses.push(
        `budget : attendu environ ${nominal} ${currency}${where} converti, obtenu ${got} ${show(row.budget_currency)}`
      );
    }
  }
  if (
    expect.startMonth !== undefined ||
    expect.startMonthDay !== undefined ||
    expect.startOffsetDays
  ) {
    const start = row.start_date ? String(row.start_date).slice(0, 10) : null;
    if (!start) misses.push('départ : aucune date de départ rangée');
    else {
      if (expect.startMonth !== undefined && Number(start.slice(5, 7)) !== expect.startMonth)
        misses.push(`départ : attendu en mois ${expect.startMonth}, obtenu ${start}`);
      if (expect.startMonthDay !== undefined && start.slice(5) !== expect.startMonthDay)
        misses.push(`départ : attendu le ${expect.startMonthDay} (MM-JJ), obtenu ${start}`);
      if (expect.startOffsetDays) {
        const gap = daysBetween(row.created_ms, start);
        const [min, max] = expect.startOffsetDays;
        if (gap == null || gap < min || gap > max)
          misses.push(
            `départ : attendu dans ${min} à ${max} jours, obtenu ${gap == null ? 'inconnu' : `${gap} jours`} (${start})`
          );
      }
    }
  }
  if (expect.hemisphere === 'S') {
    const north =
      row.step_count > 0 && row.steps_lat_max != null
        ? row.steps_lat_max >= 0
        : row.anchor_lat != null
          ? row.anchor_lat >= 0
          : null;
    if (north === null) misses.push('hémisphère sud : aucune coordonnée à vérifier');
    else if (north)
      misses.push(
        `hémisphère sud : une étape est au nord de l’équateur (latitude max ${show(row.steps_lat_max ?? row.anchor_lat)})`
      );
  }
  if (expect.linearRoute === true && row.steps_dup_consecutive > 0)
    misses.push(
      `parcours linéaire : ${row.steps_dup_consecutive} étape(s) au même lieu que la précédente`
    );
  return misses;
}

/**
 * Invariants d'une préparation réussie (les défauts de l'audit du 7 octobre : voyage sans étapes,
 * sans budget, lieu introuvable) et mises en garde qui ne changent pas le verdict.
 */
export function checkInvariants(row) {
  const misses = [];
  const warnings = [];
  if (!(row.step_count > 0)) misses.push('[invariant] aucune étape');
  if (row.steps_no_coords > 0)
    misses.push(`[invariant] ${row.steps_no_coords} étape(s) sans coordonnées`);
  if (row.steps_no_place > 0)
    misses.push(`[invariant] ${row.steps_no_place} étape(s) sans nom de lieu`);
  if (!(row.kit_items > 0)) misses.push('[invariant] aucun objet de kit');
  if (!(row.budget_lines > 0)) misses.push('[invariant] aucune ligne de budget');
  if (row.app_errors_during > 0)
    misses.push(
      `[invariant] ${row.app_errors_during} erreur(s) serveur pendant la préparation${row.app_error_scopes ? ` (${row.app_error_scopes})` : ''}`
    );
  if (row.steps_beyond_radius > 0)
    warnings.push(
      `${row.steps_beyond_radius} étape(s) hors du rayon de la destination (${show(row.anchor_radius_km)} km)`
    );
  if (row.anchor_lat == null)
    warnings.push('aucune ancre (lieu de la destination) rangée sur le voyage');
  if (row.steps_ai_proposed > 0)
    warnings.push(`${row.steps_ai_proposed} étape(s) proposée(s) par l’IA`);
  if (row.start_say_pending)
    warnings.push('la phrase de départ n’a pas été appliquée (encore rangée)');
  return { misses, warnings };
}

/* ---------- Verdict ---------- */

export const VERDICTS = ['prête', 'partielle', 'échec', 'non joué'];

/**
 * Le verdict d'une demande. `row` : la ligne de check.sql, ou null ; `result` : la ligne de
 * results.jsonl, ou null.
 * @param {{ id: string, phrase: string, expect: Record<string, any> }} item
 * @param {Record<string, any> | null} result
 * @param {Record<string, any> | null} row
 * @param {{ maxSeconds?: number, extraRows?: any[] }} [options]
 * @returns {{ id: string, phrase: string, verdict: string, seconds: number | null, reasons: string[], warnings: string[], tripId?: string | null }}
 */
export function judgeItem(item, result, row, options = {}) {
  const { maxSeconds = DEFAULT_MAX_SECONDS, extraRows = [] } = options;
  /** @type {{ id: string, phrase: string, seconds: number | null, reasons: string[], warnings: string[] }} */
  const base = { id: item.id, phrase: item.phrase, seconds: null, reasons: [], warnings: [] };
  if (!result && !row) return { ...base, verdict: 'non joué' };
  if (extraRows.length)
    base.warnings.push(`${extraRows.length} autre(s) voyage(s) créé(s) pour la même demande`);
  const runnerSeconds =
    result && Number.isFinite(Number(result.seconds)) ? Number(result.seconds) : null;
  if (!row) {
    return {
      ...base,
      seconds: runnerSeconds,
      verdict: 'échec',
      reasons: [
        result?.error
          ? `le passage a échoué avant la fin : ${result.error}`
          : 'aucun voyage en base pour cette demande',
      ],
    };
  }
  const seconds = row.prep_seconds ?? runnerSeconds;
  const out = { ...base, seconds, tripId: /** @type {string | null} */ (row.trip_id ?? null) };
  if (row.prep_ok === false) {
    return {
      ...out,
      verdict: 'échec',
      reasons: [`préparation en échec : ${row.prep_error ?? 'sans message'}`],
    };
  }
  if (row.prep_ok == null) {
    return {
      ...out,
      verdict: 'échec',
      reasons: ['préparation non terminée : aucune issue écrite sur le voyage'],
    };
  }
  if (result?.error)
    out.warnings.push(
      `le passage a signalé « ${result.error} » alors que la base dit la préparation réussie`
    );
  const reasons = [];
  if (seconds != null && seconds >= maxSeconds)
    reasons.push(`durée : ${Math.round(seconds)} s, au-delà de ${maxSeconds} s`);
  if (seconds == null) out.warnings.push('durée inconnue');
  reasons.push(...evaluateExpect(item.expect, row));
  const inv = checkInvariants(row);
  reasons.push(...inv.misses);
  out.warnings.push(...inv.warnings);
  // Une base fixe (ville, ski, escalade, plage) peut dormir deux nuits au même lieu : seul un
  // parcours dit linéaire (`linearRoute`) en fait un manque ; sinon, une mise en garde.
  if (row.steps_dup_consecutive > 0 && item.expect.linearRoute !== true)
    out.warnings.push(`${row.steps_dup_consecutive} étape(s) au même lieu que la précédente`);
  return { ...out, verdict: reasons.length ? 'partielle' : 'prête', reasons };
}

/** Rang le plus proche (« nearest rank ») sur une liste triée. */
const percentile = (sorted, p) =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]
    : null;

/** Médiane d'une liste triée (moyenne des deux valeurs du milieu si le nombre est pair). */
const median = (sorted) => {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Totaux d'un passage. Le taux de réussite = prêtes / jouées (les non jouées sont à part). */
export function summarise(judged) {
  const count = (v) => judged.filter((j) => j.verdict === v).length;
  const ready = count('prête');
  const partial = count('partielle');
  const failed = count('échec');
  const notPlayed = count('non joué');
  const played = ready + partial + failed;
  const times = judged
    .filter((j) => (j.verdict === 'prête' || j.verdict === 'partielle') && j.seconds != null)
    .map((j) => j.seconds)
    .sort((a, b) => a - b);
  const pct = (n) => (played ? Math.round((n / played) * 1000) / 10 : null);
  return {
    total: judged.length,
    played,
    ready,
    partial,
    failed,
    notPlayed,
    successRate: pct(ready),
    preparedRate: pct(ready + partial),
    medianSeconds: median(times),
    p90Seconds: percentile(times, 0.9),
  };
}

/** Tout le passage : appariement, verdicts, totaux. */
export function compareRun({
  items,
  results,
  rows,
  maxSeconds = DEFAULT_MAX_SECONDS,
  skewSeconds = DEFAULT_SKEW_SECONDS,
}) {
  const matched = matchTrips(items, results, rows, { skewMs: skewSeconds * 1000 });
  const judged = items.map((item) => {
    const m = matched.perItem.get(item.id);
    return judgeItem(item, m?.result ?? null, m?.row ?? null, {
      maxSeconds,
      extraRows: m?.extraRows ?? [],
    });
  });
  return {
    items: judged,
    summary: summarise(judged),
    orphanTrips: matched.orphans.map((r) => ({
      tripId: r.trip_id ?? null,
      createdAt: r.created_at ?? null,
      title: r.title ?? null,
    })),
    unknownResults: matched.unknownResults.length,
  };
}

/* ---------- Rapport ---------- */

const pad = (s, n) => String(s).padEnd(n, ' ');

export function formatReport(report, { setName = '' } = {}) {
  const lines = [];
  for (const j of report.items) {
    const secs = j.seconds == null ? '—' : `${Math.round(j.seconds)} s`;
    lines.push(`${pad(j.id, 5)} ${pad(j.verdict, 10)} ${pad(secs, 6)} ${j.phrase}`);
    for (const r of j.reasons) lines.push(`        - ${r}`);
    for (const w of j.warnings) lines.push(`        ! ${w}`);
  }
  const s = report.summary;
  lines.push('');
  lines.push(
    `${setName ? `${setName} : ` : ''}prêtes ${s.ready}/${s.played} · partielles ${s.partial} · échecs ${s.failed} · non jouées ${s.notPlayed}`
  );
  const pct = (n) => (n == null ? 'n/a' : `${String(n).replace('.', ',')} %`);
  lines.push(
    `Taux de réussite (prêtes / jouées) : ${pct(s.successRate)} · taux de préparation (prêtes + partielles) : ${pct(s.preparedRate)}`
  );
  if (s.medianSeconds != null)
    lines.push(
      `Durée de préparation : médiane ${Math.round(s.medianSeconds)} s, 90e centile ${Math.round(s.p90Seconds)} s`
    );
  if (report.orphanTrips.length)
    lines.push(`Voyages en base sans demande du jeu : ${report.orphanTrips.length}`);
  if (report.unknownResults)
    lines.push(`Lignes du journal sans demande du jeu : ${report.unknownResults}`);
  return lines.join('\n');
}

/* ---------- Ligne de commande ---------- */

const USAGE = `Usage : node scripts/compas/validation/compare.mjs --run <dossier> --check <check.csv|json> --set <jeu.json>
        [--max-seconds ${DEFAULT_MAX_SECONDS}] [--skew-seconds ${DEFAULT_SKEW_SECONDS}] [--min-rate <pourcentage>] [--json <rapport.json>]`;

/**
 * @param {string[]} argv
 * @returns {{ run?: string, check?: string, set?: string, json?: string, maxSeconds: number, skewSeconds: number, minRate?: number, help?: boolean }}
 */
export function parseArgs(argv) {
  /** @type {{ run?: string, check?: string, set?: string, json?: string, maxSeconds: number, skewSeconds: number, minRate?: number, help?: boolean }} */
  const opts = { maxSeconds: DEFAULT_MAX_SECONDS, skewSeconds: DEFAULT_SKEW_SECONDS };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    const need = () => {
      if (value === undefined || value.startsWith('--'))
        throw new Error(`${flag} demande une valeur`);
      i += 1;
      return value;
    };
    switch (flag) {
      case '--run':
        opts.run = need();
        break;
      case '--check':
        opts.check = need();
        break;
      case '--set':
        opts.set = need();
        break;
      case '--json':
        opts.json = need();
        break;
      case '--max-seconds':
        opts.maxSeconds = Number(need());
        break;
      case '--skew-seconds':
        opts.skewSeconds = Number(need());
        break;
      case '--min-rate':
        opts.minRate = Number(need());
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default:
        throw new Error(`option inconnue : ${flag}`);
    }
  }
  for (const key of ['maxSeconds', 'skewSeconds', 'minRate'])
    if (opts[key] !== undefined && !Number.isFinite(opts[key]))
      throw new Error(`valeur numérique attendue pour ${key}`);
  return opts;
}

export function main(argv = process.argv.slice(2), log = console.info) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    console.error(`${e.message}\n${USAGE}`);
    return 2;
  }
  if (opts.help || !opts.run || !opts.check || !opts.set) {
    log(USAGE);
    return opts.help ? 0 : 2;
  }
  const resultsFile =
    fs.existsSync(opts.run) && fs.statSync(opts.run).isDirectory()
      ? path.join(opts.run, 'results.jsonl')
      : opts.run;
  const items = loadSet(opts.set);
  const results = readResults(fs.readFileSync(resultsFile, 'utf8'));
  const rows = readCheckRows(fs.readFileSync(opts.check, 'utf8'));
  const report = compareRun({
    items,
    results,
    rows,
    maxSeconds: opts.maxSeconds,
    skewSeconds: opts.skewSeconds,
  });
  log(formatReport(report, { setName: path.basename(opts.set) }));
  if (opts.json) fs.writeFileSync(opts.json, `${JSON.stringify(report, null, 2)}\n`);
  if (opts.minRate !== undefined && (report.summary.successRate ?? 0) < opts.minRate) {
    log(`Taux de réussite inférieur au seuil de ${opts.minRate} %.`);
    return 1;
  }
  return 0;
}

const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exitCode = main();

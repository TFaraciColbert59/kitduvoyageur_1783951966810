#!/usr/bin/env node
/**
 * Vérifie un ou plusieurs rapports Lighthouse JSON contre les seuils de `.lighthouserc.json`.
 *
 * Usage :
 *   node scripts/perf/assert-lighthouse.mjs .lighthouseci/report.json [--config .lighthouserc.json] [--summary /path/to/step-summary.md]
 *
 * Code de sortie :
 *   0 — toutes les assertions `error` passent
 *   1 — au moins une assertion `error` échoue (ou rapport manquant/invalide)
 */
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
let configPath = '.lighthouserc.json';
let summaryPath = null;
const reportPaths = [];

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--config') {
    configPath = argv[++i];
  } else if (arg === '--summary') {
    summaryPath = argv[++i];
  } else if (!arg.startsWith('-')) {
    reportPaths.push(arg);
  }
}

if (reportPaths.length === 0) {
  console.error('Usage: node scripts/perf/assert-lighthouse.mjs <report.json...> [--config .lighthouserc.json]');
  process.exit(2);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const assertions = config?.ci?.assert?.assertions ?? {};
const entries = Object.entries(assertions);

if (entries.length === 0) {
  console.error(`Aucune assertion trouvée dans ${configPath}.`);
  process.exit(1);
}

let errors = 0;
let warnings = 0;
const mdLines = ['## Lighthouse CI — Vérification des seuils (`.lighthouserc.json`)\n'];

function evaluateAssertion(report, key, rule) {
  const [level, opts = {}] = Array.isArray(rule) ? rule : [rule, {}];
  if (level === 'off') {
    return { level: 'error', passed: false, actual: 'off', expected: 'seuil actif requis (jamais "off")' };
  }

  if (key.startsWith('categories:')) {
    const catId = key.slice('categories:'.length);
    const score = report?.categories?.[catId]?.score;
    const minScore = typeof opts.minScore === 'number' ? opts.minScore : 0;
    const passed = typeof score === 'number' && score >= minScore;
    return {
      level,
      passed,
      actual: typeof score === 'number' ? `${Math.round(score * 100)}/100` : 'n/a',
      expected: `>= ${Math.round(minScore * 100)}/100`,
    };
  }

  const audit = report?.audits?.[key];
  if (!audit) {
    return { level, passed: false, actual: 'absent', expected: JSON.stringify(opts) };
  }

  if (typeof opts.maxNumericValue === 'number') {
    const val = audit.numericValue;
    const passed = typeof val === 'number' && Number.isFinite(val) && val <= opts.maxNumericValue;
    const unit = audit.numericUnit === 'millisecond' ? ' ms' : '';
    const fmt = (n) => (audit.numericUnit === 'unitless' ? n.toFixed(3) : `${Math.round(n)}${unit}`);
    return {
      level,
      passed,
      actual: typeof val === 'number' ? fmt(val) : 'n/a',
      expected: `<= ${fmt(opts.maxNumericValue)}`,
    };
  }

  if (typeof opts.minScore === 'number') {
    const score = audit.score;
    const passed = typeof score === 'number' && score >= opts.minScore;
    return {
      level,
      passed,
      actual: typeof score === 'number' ? `${Math.round(score * 100)}/100` : 'n/a',
      expected: `>= ${Math.round(opts.minScore * 100)}/100`,
    };
  }

  return { level, passed: audit.score === 1, actual: String(audit.score), expected: '1' };
}

for (const reportFile of reportPaths) {
  if (!fs.existsSync(reportFile)) {
    console.error(`✗ Rapport Lighthouse introuvable : ${reportFile}`);
    errors += 1;
    continue;
  }
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const url = report.finalDisplayedUrl || report.finalUrl || report.requestedUrl || path.basename(reportFile);
  console.info(`\n=== Lighthouse : ${url} ===`);
  mdLines.push(`### ${url}\n`);
  mdLines.push('| Contrôle | Mesuré | Seuil | Niveau | État |');
  mdLines.push('| --- | ---: | ---: | --- | --- |');

  for (const [key, rule] of entries) {
    const res = evaluateAssertion(report, key, rule);
    const badge = res.passed ? 'OK' : res.level === 'error' ? 'ÉCHEC' : 'AVERTISSEMENT';
    if (!res.passed) {
      if (res.level === 'error') errors += 1;
      else warnings += 1;
    }
    const line = `  ${res.passed ? '✓' : res.level === 'error' ? '✗' : '⚠'} ${key.padEnd(28)} ${res.actual.padStart(10)}  (seuil ${res.expected}) [${res.level}]`;
    if (!res.passed && res.level === 'error') console.error(line);
    else console.info(line);
    mdLines.push(`| \`${key}\` | ${res.actual} | ${res.expected} | ${res.level} | ${badge} |`);
  }
  mdLines.push('');
}

if (summaryPath) {
  fs.appendFileSync(summaryPath, `${mdLines.join('\n')}\n`, 'utf8');
}

if (errors > 0) {
  console.error(`\n✗ Lighthouse CI : ${errors} échec(s) bloquant(s), ${warnings} avertissement(s).`);
  process.exit(1);
}
console.info(`\n✓ Lighthouse CI : 0 échec bloquant (${warnings} avertissement(s)).`);

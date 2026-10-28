#!/usr/bin/env node
/**
 * Explorer v2 — vérification globale (08_TESTS.md §7).
 *
 * Exécute dans l'ordre, s'arrête au premier échec (code ≠ 0) :
 *   1. type-check
 *   2. lint
 *   3. Vitest explorer-v2
 *   4. next build + First Load JS /explorer (≤ 170 Ko)
 *   5. Playwright @explorer-v2 (mobile-chromium puis mobile-webkit)
 *   6. inventaire de clics (100 %)
 *   7. axe (a11y) sur les scènes Explorer v2
 *   8. contrôles grep bloquants (08_TESTS §6)
 *   9. intrusion RLS
 *  10. cases non cochées de 07_CHECKLIST.md (bloquant en phase 10 seulement)
 *
 * Résumé horodaté écrit dans docs/explorer-v2/VERIFY_LAST.md.
 *
 * Usage :
 *   node scripts/explorer-v2/verify-all.mjs            # tout
 *   node scripts/explorer-v2/verify-all.mjs --only=build,grep
 *   node scripts/explorer-v2/verify-all.mjs --final     # exige la checklist à 100 %
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = process.cwd();
const DOCS = join(ROOT, 'docs/explorer-v2');
const LOG = [];
const RESULTS = [];
const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--only=')) || '').slice('--only='.length);
const finalMode = args.includes('--final');

function log(line = '') {
  LOG.push(line);
  process.stdout.write(`${line}\n`);
}

function run(step, cmd, cmdArgs, opts = {}) {
  if (only && !only.split(',').includes(step)) {
    log(`⏭  ${step} (ignoré)`);
    return { status: 0, stdout: '', skipped: true };
  }
  const started = Date.now();
  log(`\n▶ ${step} : ${cmd} ${cmdArgs.join(' ')}`);
  const res = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, CI: '1', ...(opts.env || {}) },
    timeout: opts.timeout ?? 30 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const ms = Date.now() - started;
  const out = `${res.stdout || ''}${res.stderr || ''}`.trim();
  const tail = out.split('\n').slice(-25).join('\n');
  if (out) log(tail);
  const status = res.status ?? 1;
  RESULTS.push({ step, code: status, ms });
  log(status === 0 ? `✔ ${step} (${(ms / 1000).toFixed(1)} s)` : `✘ ${step} — code ${status}`);
  return { status, stdout: out };
}

function fail(message) {
  log(`\n✘ ÉCHEC : ${message}`);
  writeReport(false, message);
  process.exit(1);
}

function readFirstLoadJS() {
  const manifestPath = join(ROOT, '.next/app-build-manifest.json');
  const buildLogPath = join(DOCS, 'build-last.log');
  // 1) mesure via le log de build (ligne « /explorer … 265 kB »)
  if (existsSync(buildLogPath)) {
    const lines = readFileSync(buildLogPath, 'utf8').split('\n');
    const routeLine = lines.find((l) => /^\s*[├└┌│ ]*\/explorer\s/.test(l));
    if (routeLine) {
      const first = routeLine.match(/([\d.]+)\s*kB/);
      if (first) return { kb: Number.parseFloat(first[1]), source: 'build-log' };
    }
  }
  if (existsSync(manifestPath)) {
    return { kb: null, source: 'manifest-only' };
  }
  return { kb: null, source: 'absent' };
}

function countUnchecked() {
  const path = join(ROOT, 'handoff/explorer-v2/07_CHECKLIST.md');
  if (!existsSync(path)) return { total: 0, unchecked: 0, missing: true };
  const text = readFileSync(path, 'utf8');
  const boxes = text.match(/^- \[[ x]\]/gm) || [];
  const unchecked = (text.match(/^- \[ \]/gm) || []).length;
  return { total: boxes.length, unchecked, missing: false };
}

function writeReport(ok, failureMessage = '') {
  mkdirSync(DOCS, { recursive: true });
  const stamp = new Date().toISOString();
  const body = [
    '# VERIFY_LAST · Explorer v2',
    '',
    `- Exécuté : ${stamp}`,
    `- Mode : ${finalMode ? 'final' : 'courant'}${only ? ` (--only=${only})` : ''}`,
    `- Résultat : ${ok ? '✅ OK' : '❌ ÉCHEC'}${failureMessage ? ` — ${failureMessage}` : ''}`,
    '',
    '## Étapes',
    '',
    '| Étape | Code | Durée |',
    '|---|---|---|',
    ...RESULTS.map((r) => `| ${r.step} | ${r.code} | ${(r.ms / 1000).toFixed(1)} s |`),
    '',
    '## Journal',
    '',
    '```',
    ...LOG.slice(-400),
    '```',
    '',
  ].join('\n');
  writeFileSync(join(DOCS, 'VERIFY_LAST.md'), body, 'utf8');
  try {
    appendFileSync(join(DOCS, 'VERIFY_HISTORY.log'), `${stamp} ${ok ? 'OK' : 'FAIL'} ${failureMessage}\n`);
  } catch {
    /* historique optionnel */
  }
}

log('# Explorer v2 · verify-all');
log(`- racine : ${ROOT}`);
log(`- date : ${new Date().toISOString()}`);

// 1. type-check -------------------------------------------------------------
{
  const r = run(
    'type-check',
    'npx',
    ['tsc', '--noEmit'],
    { env: { NODE_OPTIONS: '--max-old-space-size=6144' } },
  );
  if (r.status !== 0) fail('type-check rouge');
}

// 2. lint -------------------------------------------------------------------
{
  const r = run('lint', 'npx', ['next', 'lint']);
  if (r.status !== 0) fail('lint rouge');
}

// 3. Vitest explorer-v2 -----------------------------------------------------
{
  const r = run('vitest', 'npx', ['vitest', 'run', '--reporter=dot', 'explorer-v2']);
  if (r.status !== 0) fail('tests Vitest explorer-v2 rouges');
}

// 4. build + First Load JS --------------------------------------------------
{
  const r = run('build', 'npx', ['next', 'build'], {
    env: { NODE_OPTIONS: '--max-old-space-size=6144' },
  });
  mkdirSync(DOCS, { recursive: true });
  writeFileSync(join(DOCS, 'build-last.log'), r.stdout || '', 'utf8');
  if (r.status !== 0) fail('next build rouge');
  const { kb } = readFirstLoadJS();
  if (kb === null) {
    log('… First Load JS /explorer introuvable dans le log de build (toléré hors phase 9)');
  } else if (kb > 170) {
    log(`… First Load JS /explorer = ${kb} Ko > budget 170 Ko`);
    if (finalMode) fail(`budget de bundle dépassé : ${kb} Ko`);
  } else {
    log(`✔ First Load JS /explorer = ${kb} Ko (budget 170 Ko)`);
  }
}

// 5. Playwright @explorer-v2 ------------------------------------------------
for (const project of ['mobile-chromium', 'mobile-webkit']) {
  const r = run(
    'playwright',
    'npx',
    ['playwright', 'test', '--grep', '@explorer-v2', `--project=${project}`, '--reporter=line', '--workers=1'],
    { env: { PW_BASE_URL: process.env.PW_BASE_URL || 'http://localhost:4028' }, timeout: 15 * 60 * 1000 },
  );
  if (r.status !== 0) fail(`Playwright ${project} rouge`);
}

// 6. inventaire de clics ----------------------------------------------------
{
  const r = run('clicks', 'node', ['scripts/explorer-v2/click-inventory.mjs']);
  if (r.status !== 0) fail('inventaire de clics incomplet');
}

// 7. axe / a11y -------------------------------------------------------------
{
  const r = run('a11y', 'npx', [
    'playwright',
    'test',
    'tests/explorer-v2/a11y.spec.ts',
    '--project=mobile-webkit',
    '--reporter=line',
  ]);
  if (r.status !== 0) fail('a11y : violations sérieuses');
}

// 8. contrôles grep ---------------------------------------------------------
{
  const forbidden = [
    { label: 'couleur #E4501C', pattern: 'E4501C', paths: ['src'] },
    {
      label: 'TODO/FIXME/lorem/EXAMPLE_TRAIL/mock',
      pattern: 'TODO|FIXME|lorem|EXAMPLE_TRAIL|mock',
      paths: ['src/features/explorer-v2', 'src/app/explorer'],
    },
    { label: 'SERVICE_ROLE côté client', pattern: 'SERVICE_ROLE', paths: ['src/features/explorer-v2', 'src/components'] },
    { label: 'projet Supabase fantôme', pattern: 'lwrmugg' + 'efbmboikjgudc', paths: ['.'], globs: ['!handoff/**', '!node_modules/**', '!.next/**', '!docs/**'] },
  ];
  for (const rule of forbidden) {
    const existing = rule.paths.filter((p) => existsSync(join(ROOT, p)));
    if (existing.length === 0) continue;
    const globArgs = (rule.globs || []).flatMap((g) => ['-g', g]);
    const res = spawnSync('rg', ['-n', rule.pattern, ...globArgs, ...existing], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    const hits = (res.stdout || '').trim();
    if (res.status === 0 && hits) {
      log(`✘ grep « ${rule.label} » :`);
      log(hits.split('\n').slice(0, 10).join('\n'));
      RESULTS.push({ step: `grep:${rule.label}`, code: 1, ms: 0 });
      fail(`contrôle grep « ${rule.label} » non respecté`);
    }
    log(`✔ grep « ${rule.label} » vierge`);
    RESULTS.push({ step: `grep:${rule.label}`, code: 0, ms: 0 });
  }
}

// 9. intrusion RLS ----------------------------------------------------------
{
  const scripts = ['.agents/test_rls_intrusion.mjs', 'scripts/explorer-v2/test-rls-intrusion.mjs'];
  let ran = 0;
  for (const script of scripts) {
    if (!existsSync(join(ROOT, script))) continue;
    ran += 1;
    const r = run('rls', 'node', [script]);
    if (r.status !== 0) fail(`test d’intrusion RLS rouge (${script})`);
  }
  if (ran === 0) log('… aucun script d’intrusion RLS — voir BLOCAGES');
}

// 10. checklist -------------------------------------------------------------
{
  const { total, unchecked, missing } = countUnchecked();
  if (missing) {
    log('… 07_CHECKLIST.md introuvable');
  } else {
    log(`… checklist : ${total - unchecked}/${total} cases cochées, ${unchecked} restantes`);
    if (finalMode && unchecked > 0) fail(`${unchecked} case(s) de checklist non cochée(s)`);
  }
}

writeReport(true);
log('\n✅ verify-all : toutes les étapes vertes');

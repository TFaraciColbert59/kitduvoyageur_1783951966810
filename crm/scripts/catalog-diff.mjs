#!/usr/bin/env node
/**
 * catalog-diff.mjs — compare les quatre sources de vérité des 144 actions :
 *
 *   1. crm/bundle/04_CATALOGUE_ACTIONS.md          (la source écrite)
 *   2. supabase/migrations/20261109090300_crm_commands_registry.sql
 *                                                  (l'amorçage de admin.commands)
 *   3. les fonctions admin.cmd_* en base           (via SUPABASE_DB_URL, si fourni)
 *   4. les tests (crm/tests/**)                    (couverture, avertissement)
 *
 * Sortie : un JSON sur stdout. Code de sortie 1 au moindre écart entre 1, 2 et 3
 * (07_VERIFICATION.md § 3 : « toute absence ou différence de drapeaux = écart »).
 * La couverture par les tests est rapportée et ne fait échouer le script
 * qu'avec `--strict-tests` (les tests sont écrits par un autre rôle, en parallèle).
 *
 * Usage :
 *   node crm/scripts/catalog-diff.mjs                  # JSON + code 0/1
 *   node crm/scripts/catalog-diff.mjs --pretty         # JSON indenté
 *   node crm/scripts/catalog-diff.mjs --strict-tests   # échec si un test manque
 *
 * Variables : SUPABASE_DB_URL (facultatif) pour vérifier les fonctions réelles.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const crmRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(crmRoot, '..');

const MD_PATH = path.join(crmRoot, 'bundle/04_CATALOGUE_ACTIONS.md');
const REGISTRY_PATH = path.join(repoRoot, 'supabase/migrations/20261109090300_crm_commands_registry.sql');
const TESTS_DIR = path.join(crmRoot, 'tests');

const POLES = {
  D1: 'MEMB', D2: 'CONF', D3: 'CONF', D4: 'CONF', D5: 'CONF', D6: 'CONF', D7: 'CONT',
  D8: 'CONF', D9: 'COMM', D10: 'COMM', D11: 'COMM', D12: 'CROI', D13: 'COMM', D14: 'CONF',
  D15: 'CONT', D16: 'CROI', D17: 'PRIA', D18: 'MEMB', D19: 'TECH'
};
const OVERRIDES = { 'ACT-112': 'TECH', 'ACT-113': 'TECH', 'ACT-134': 'CROI', 'ACT-136': 'TECH' };
const ROW_RE = /^\| (ACT-\d{3}) \| ([a-z0-9_]+) \| (.+?) \| (membre|resp\.|SA) \| (oui|—) \| (oui|—) \| (oui|—) \| (propose|lit|—) \| (P\d) \|$/;

/** 1. Catalogue (même parsing que gen-catalog.mjs / gen-commands.mjs). */
export function parseCatalog(md) {
  const rows = [];
  let domain = null;
  for (const line of md.split('\n')) {
    const dm = line.match(/^## (D\d+) — (.+)$/);
    if (dm) { domain = dm[1]; continue; }
    const m = line.match(ROW_RE);
    if (!m || !domain) continue;
    const [, id, command, label, role, two, reason, undo, agent, rt] = m;
    rows.push({
      id, command,
      pole: OVERRIDES[id] ?? POLES[domain],
      domain,
      roleMin: role === 'resp.' ? 'responsable' : role === 'SA' ? 'super_admin' : 'membre',
      needsValidation: two === 'oui',
      reasonRequired: reason === 'oui',
      undoable: undo === 'oui',
      agent: agent === 'propose' ? 'propose' : agent === 'lit' ? 'read' : 'never',
      realtime: rt
    });
  }
  return rows;
}

/** 2. Registre SQL généré (lignes de values). */
export function parseRegistry(sql) {
  const rows = [];
  const re = /^\s*\(('ACT-\d{3}'), '([a-z0-9_]+)', '(?:[^']|'')*', '(D\d+)', '([A-Z]{4})', '([a-z_]+)', (true|false), (true|false), (true|false), '([a-z]+)', '(P\d)', \d+\)/;
  for (const line of sql.split('\n')) {
    const m = line.match(re);
    if (!m) continue;
    rows.push({
      id: m[1].replace(/'/g, ''),
      command: m[2],
      domain: m[3],
      pole: m[4],
      roleMin: m[5],
      needsValidation: m[6] === 'true',
      reasonRequired: m[7] === 'true',
      undoable: m[8] === 'true',
      agent: m[9],
      realtime: m[10]
    });
  }
  return rows;
}

/** 3. Fonctions réellement en base (si SUPABASE_DB_URL est fourni). */
async function fetchDbFunctions() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) return null;
  let pg;
  try { pg = await import('pg'); } catch { return { error: 'module pg absent' }; }
  const client = new pg.default.Client({ connectionString: url });
  try {
    await client.connect();
    const { rows } = await client.query(`
      select p.proname as name
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'admin' and p.proname like 'cmd\\_%'
       order by 1`);
    const { rows: counts } = await client.query('select count(*)::int as n from admin.commands');
    return { functions: rows.map((r) => r.name.replace(/^cmd_/, '')), registryCount: counts[0].n };
  } catch (e) {
    return { error: e.message };
  } finally {
    await client.end().catch(() => {});
  }
}

/** 4. Couverture par les tests (recherche du nom de commande). */
function parseTestCoverage(commands) {
  if (!existsSync(TESTS_DIR)) return { files: 0, covered: [], missing: commands };
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = path.join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|mjs|js)$/.test(entry)) files.push(p);
    }
  };
  walk(TESTS_DIR);
  const blob = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  const covered = commands.filter((c) => new RegExp(`\\b${c}\\b`).test(blob));
  return {
    files: files.length,
    covered,
    missing: commands.filter((c) => !covered.includes(c))
  };
}

const FLAGS = ['pole', 'roleMin', 'needsValidation', 'reasonRequired', 'undoable', 'agent', 'realtime'];

function diffFlags(a, b) {
  const out = [];
  for (const k of FLAGS) {
    if (a[k] !== b[k]) out.push({ field: k, catalogue: a[k], registre: b[k] });
  }
  return out;
}

const pretty = process.argv.includes('--pretty');
const strictTests = process.argv.includes('--strict-tests');

const catalog = parseCatalog(readFileSync(MD_PATH, 'utf8'));
const registrySql = existsSync(REGISTRY_PATH) ? readFileSync(REGISTRY_PATH, 'utf8') : '';
const registry = parseRegistry(registrySql);
const db = await fetchDbFunctions();

const byId = (rows) => new Map(rows.map((r) => [r.id, r]));
const catById = byId(catalog);
const regById = byId(registry);

const onlyCatalogue = catalog.filter((r) => !regById.has(r.id)).map((r) => ({ id: r.id, command: r.command }));
const onlyRegistry = registry.filter((r) => !catById.has(r.id)).map((r) => ({ id: r.id, command: r.command }));
const flagMismatches = catalog
  .filter((r) => regById.has(r.id))
  .map((r) => ({ id: r.id, command: r.command, diffs: diffFlags(r, regById.get(r.id)) }))
  .filter((x) => x.diffs.length > 0);

const registryCommands = new Set(registry.map((r) => r.command));
let functionsMissing = [];
let functionsExtra = [];
let dbError = null;
let dbMode = 'fichiers';

if (db && db.functions) {
  dbMode = 'base';
  const fnSet = new Set(db.functions);
  functionsMissing = [...registryCommands].filter((c) => !fnSet.has(c));
  functionsExtra = [...fnSet].filter((c) => !registryCommands.has(c));
  if (typeof db.registryCount === 'number' && db.registryCount !== 144) {
    dbError = `admin.commands contient ${db.registryCount} lignes (144 attendues)`;
  }
} else if (db && db.error) {
  dbMode = `base indisponible (${db.error})`;
}

const tests = parseTestCoverage([...registryCommands]);

const problems = [];
if (catalog.length !== 144) problems.push(`catalogue : ${catalog.length} actions (144 attendues)`);
if (registry.length !== 144) problems.push(`registre SQL : ${registry.length} lignes (144 attendues)`);
if (onlyCatalogue.length) problems.push(`${onlyCatalogue.length} action(s) du catalogue absentes du registre`);
if (onlyRegistry.length) problems.push(`${onlyRegistry.length} ligne(s) du registre absentes du catalogue`);
if (flagMismatches.length) problems.push(`${flagMismatches.length} commande(s) avec un drapeau différent`);
if (functionsMissing.length) problems.push(`${functionsMissing.length} fonction(s) admin.cmd_* manquante(s)`);
if (functionsExtra.length) problems.push(`${functionsExtra.length} fonction(s) admin.cmd_* hors registre`);
if (dbError) problems.push(dbError);
if (strictTests && tests.missing.length) problems.push(`${tests.missing.length} commande(s) sans test`);

const report = {
  ok: problems.length === 0,
  generatedAt: new Date().toISOString(),
  mode: dbMode,
  counts: {
    catalogue: catalog.length,
    registre: registry.length,
    fonctionsEnBase: db && db.functions ? db.functions.length : null,
    testsCouverts: tests.covered.length,
    testsFichiers: tests.files
  },
  byPole: catalog.reduce((acc, r) => ((acc[r.pole] = (acc[r.pole] ?? 0) + 1), acc), {}),
  ecarts: {
    absentesDuRegistre: onlyCatalogue,
    horsCatalogue: onlyRegistry,
    drapeaux: flagMismatches,
    fonctionsManquantes: functionsMissing,
    fonctionsHorsRegistre: functionsExtra,
    base: dbError
  },
  tests: {
    covered: tests.covered.length,
    missing: tests.missing,
    strict: strictTests
  },
  problemes: problems
};

console.log(JSON.stringify(report, null, pretty ? 2 : 0));
process.exit(report.ok ? 0 : 1);

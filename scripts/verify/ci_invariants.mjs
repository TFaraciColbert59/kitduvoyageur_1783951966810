#!/usr/bin/env node
/**
 * CI INVARIANTS — Garde-fous anti-dérive stricts
 * ============================================
 * Vérifie automatiquement les invariants obligatoires :
 * 1. Aucun token couleur hors palette ou --role-*
 * 2. Aucun terme monétaire dans kit_trust_scores
 * 3. Aucun compteur de partage (share_count, partages) dans l'UI
 * 4. Migration 20260903050000_kit_attributions.sql gelée (absente de toute liste active)
 * 5. Aucun fichier .env* stagé ni secret en dur (sk_live_, whsec_, service_role)
 * 6. Tous les noms d’icônes résolus via le registre canonique
 * 7. Aucune constante de démonstration dans le préparateur (src/features/adventure-prep)
 * 8. Aucune écriture cliente de colonnes de solde sur user_profiles
 *    (hors src/app/api/ et modules server-only src/features/<feature>/server*)
 * 9. Aucune écriture cliente directe des journaux/commandes
 *    (loyalty_history, loyalty_redemptions, orders — hors src/app/api/)
 *
 * Usage : node scripts/verify/ci_invariants.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const src = path.join(root, 'src');
const supabaseDir = path.join(root, 'supabase');
let failures = 0;

function fail(msg) {
  console.error(`✗ ${msg}`);
  failures++;
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

function grep(pattern, searchDir) {
  try {
    const out = execSync(`rg -l ${JSON.stringify(pattern)} ${JSON.stringify(searchDir)}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

console.log('=== VÉRIFICATION DES INVARIANTS CI LKDV ===\n');

// 1. AUCUN TOKEN PARALLÈLE --role-* ET CONFORMITÉ COULEURS
const roleMatches = grep('--[a-z-]*role', src);
if (roleMatches.length > 0) {
  roleMatches.forEach((f) => fail(`Token --role-* détecté dans : ${path.relative(root, f)}`));
} else {
  ok('Invariant 1a : Aucun token parallèle --role-* dans src/');
}

try {
  execSync('node scripts/verify/identity_compliance.mjs', { stdio: 'inherit' });
  ok('Invariant 1b : Conformité palette identity vérifiée');
} catch {
  fail('Invariant 1b : scripts/verify/identity_compliance.mjs a échoué');
}

// 2. AUCUN TERME MONÉTAIRE DANS LE CALCUL DE SCORE
const conservationSqlPath = path.join(supabaseDir, 'migrations', '20260903040000_kit_conservation.sql');
if (fs.existsSync(conservationSqlPath)) {
  const content = fs.readFileSync(conservationSqlPath, 'utf8');
  // Isoler la définition de kit_trust_scores
  const trustScoresMatch = content.match(/create\s+materialized\s+view\s+(?:if\s+not\s+exists\s+)?(?:public\.)?kit_trust_scores[\s\S]*?;/i);
  if (trustScoresMatch) {
    const trustSql = trustScoresMatch[0].toLowerCase();
    const forbidden = ['price', 'revenue', 'commission', 'amount_cents', 'chiffre_affaires', 'euro', 'vente'];
    const found = forbidden.filter((w) => new RegExp(`\\b${w}\\b`).test(trustSql));
    if (found.length > 0) {
      fail(`Terme monétaire interdit détecté dans kit_trust_scores : ${found.join(', ')}`);
    } else {
      ok('Invariant 2 : Aucun terme monétaire dans le calcul de score kit_trust_scores');
    }
  } else {
    fail('Vue matérialisée kit_trust_scores introuvable dans 20260903040000_kit_conservation.sql');
  }
} else {
  fail('Fichier 20260903040000_kit_conservation.sql introuvable');
}

// 3. AUCUN COMPTEUR DE PARTAGE DANS L'UI DES KITS
const kitUiDirs = [
  path.join(src, 'components', 'kits'),
  path.join(src, 'components', 'materiel'),
  path.join(src, 'app', 'k'),
];

let shareCountLeaks = [];
for (const dir of kitUiDirs) {
  if (fs.existsSync(dir)) {
    const leaks = grep('share_count|shares_count|nb_partages|partages_count', dir);
    shareCountLeaks.push(...leaks);
  }
}
if (shareCountLeaks.length > 0) {
  shareCountLeaks.forEach((f) => fail(`Compteur de partage UI détecté dans : ${path.relative(root, f)}`));
} else {
  ok('Invariant 3 : Aucun compteur de partage dans les composants UI de kits');
}

// 4. MIGRATION D'ATTRIBUTION LOT 6 GELÉE (PHYSIQUEMENT ISOLÉE)
const migrationsDir = path.join(supabaseDir, 'migrations');
const migrationsFrozenDir = path.join(supabaseDir, 'migrations_frozen');

if (fs.existsSync(migrationsDir)) {
  const activeFiles = fs.readdirSync(migrationsDir);
  // Seule la réintroduction de la migration HISTORIQUE gelée est interdite.
  // Une réimplémentation additive post-baseline (ex. 20260911400000_a11_kit_attributions.sql)
  // est légitime (ruling Étape 0 — attributions reprises proprement).
  const leakedAttributions = activeFiles.filter((f) =>
    /^20260903050000_kit_attributions\.sql$/i.test(f)
  );
  if (leakedAttributions.length > 0) {
    fail(`Migration Lot 6 gelée réintroduite dans supabase/migrations/ : ${leakedAttributions.join(', ')} (doit rester dans supabase/migrations_frozen/)`);
  } else {
    ok('Invariant 4a : La migration gelée 20260903050000_kit_attributions.sql n\'est pas réintroduite');
  }
}

if (!fs.existsSync(path.join(migrationsFrozenDir, '20260903050000_kit_attributions.sql'))) {
  fail('La migration gelée 20260903050000_kit_attributions.sql est introuvable dans supabase/migrations_frozen/');
} else {
  ok('Invariant 4b : Migration 20260903050000_kit_attributions.sql correctement isolée dans supabase/migrations_frozen/');
}

// Vérifier que la route royalties renvoie bien 404 tant que gelée
const royaltiesRoutePath = path.join(src, 'app', 'api', 'kits', 'my-royalties', 'route.ts');
if (fs.existsSync(royaltiesRoutePath)) {
  const royaltiesCode = fs.readFileSync(royaltiesRoutePath, 'utf8');
  if (!royaltiesCode.includes('status: 404')) {
    fail('La route /api/kits/my-royalties ne renvoie pas un statut 404 alors que le Lot 6 est gelé');
  } else {
    ok('Invariant 4c : Route /api/kits/my-royalties verrouillée à 404');
  }
} else {
  ok('Invariant 4c : Route /api/kits/my-royalties absente');
}

// 5. AUCUN SECRET EN DUR NI FICHIER .ENV STAGÉ
try {
  const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
  const stagedEnvs = stagedFiles.filter((f) => /(^|\/)\.env(\..+)?$/.test(f));
  if (stagedEnvs.length > 0) {
    fail(`Fichier(s) .env stagé(s) pour commit : ${stagedEnvs.join(', ')}`);
  } else {
    ok('Invariant 5a : Aucun fichier .env stagé');
  }
} catch {
  // Hors repo git, skip
}

const secretPatterns = [
  'sk_live_[0-9a-zA-Z]{20,}',
  'whsec_[0-9a-zA-Z]{20,}',
];
for (const pat of secretPatterns) {
  const matches = grep(pat, src);
  if (matches.length > 0) {
    matches.forEach((f) => fail(`Secret potentiel (${pat}) détecté dans : ${path.relative(root, f)}`));
  }
}
ok('Invariant 5b : Aucun secret en dur détecté dans src/');

// 6. NOMS D'ICÔNES RÉSOLUS VIA LE REGISTRE CANONIQUE
try {
  execSync('node scripts/verify/icon-names.mjs', { stdio: 'inherit' });
  ok('Invariant 6 : Tous les noms d\'icônes canoniques sont résolus');
} catch {
  fail('Invariant 6 : scripts/verify/icon-names.mjs a échoué');
}

// 7. AUCUNE CONSTANTE DE DÉMONSTRATION DANS LE PRÉPARATEUR
//
// Le préparateur est le seul écran dont les chiffres partent sur un réseau
// public et une base Supabase. Une constante de démo qui y subsiste ne se voit pas
// à la revue : elle se voit à l’écran, comme une distance vraie qui ne l’est pas.
// D’où l’invariant 6, on ne retient pas `placeholder` : c’est un attribut HTML
// légitime (et un sélecteur CSS), pas une donnée. On retient la forme
// *constante* : un préfixe ou un suffixe de démo, là où le nom d’une variable dit
// dès sa déclaration qu’elle ne sort pas d’un réseau.
const DEMO_TOKEN = new RegExp(
  [
    '\\b(DEMO|MOCK|FAKE|SAMPLE|DUMMY|STUB|PLACEHOLDER)_(?=[A-Z0-9_])',
    '\\b__[A-Z_]*(DEMO|MOCK|FAKE|SAMPLE|DUMMY)[A-Z_]*__\\b',
    '\\b(is|has|use|should)(Demo|Mock|Fake|Sample|Dummy|Stub)\\b',
    '\\b(demo|mock|fake|sample|dummy|stub)(Data|Fixture|Content|Value|Values|List|Lookup|Catalog)\\b',
    '\\bDEFAULT_(DEMO|MOCK|FAKE|SAMPLE|DUMMY|STUB)_',
  ].join('|'),
  'i',
);

// Les tests ont le droit d’utiliser des doubles : c’est leur metier. On les exclut,
// sinon on interdâit à la suite de prouver quoi que ce soit.
function walkSource(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...walkSource(full));
    } else if (/\.(ts|tsx|js|mjs|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const prepDir = path.join(src, 'features', 'adventure-prep');
const demoLeaks = [];
for (const file of walkSource(prepDir)) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, i) => {
    // Une ligne de commentaire qui *signale* l’interdiction n’est pas une fuite.
    const code = line.replace(/\/\/.*$/, '').replace(/\*.*$/, '');
    if (DEMO_TOKEN.test(code)) {
      demoLeaks.push(`${path.relative(root, file)}:${i + 1}`);
    }
  });
}
if (demoLeaks.length > 0) {
  demoLeaks.forEach((f) => fail(`Constante de démonstration dans le préparateur : ${f}`));
} else {
  ok('Invariant 7 : Aucune constante de démonstration dans src/features/adventure-prep (hors __tests__)');
}

// 8. AUCUNE ÉCRITURE CLIENTE DE COLONNES DE SOLDE SUR user_profiles
//
// Depuis la phase 1 « balance lockdown », la base refuse elle-même toute
// écriture cliente de loyalty_points / loyalty_level / xp / level (trigger +
// policies). Cet invariant fait échouer la CI AVANT l'exécution : hors routes
// API (src/app/api/) et hors modules server-only (src/features/*/server*),
// aucun fichier de src/ ne doit contenir un .from('user_profiles') suivi à
// moins de ~300 caractères d'un .update()/.upsert()/.insert() écrivant l'une
// de ces colonnes.
function relativePath(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function lineOf(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

/**
 * Fenêtre de recherche bornée à la fin de l'instruction : tronque au premier
 * `;` suivant le point de départ. Évite les faux positifs inter-instructions
 * (un `.update()` d'une AUTRE requête située plus loin dans le fichier) sans
 * casser les chaînages PostgREST, qui ne contiennent jamais de `;`.
 */
function statementWindow(content, start, maxLen) {
  const slice = content.slice(start, start + maxLen);
  const end = slice.indexOf(';');
  return end === -1 ? slice : slice.slice(0, end);
}

const BALANCE_EXCLUDES = [
  /^src\/app\/api\//,
  /^src\/features\/[^/]+\/server/,
];
const BALANCE_FROM = /\.from\(\s*['"]user_profiles['"]\s*\)/g;
const CLIENT_WRITE = /\.(?:update|upsert|insert)\s*\(/;
const BALANCE_FIELDS = /\b(?:loyalty_points|loyalty_level|xp\s*:|level\s*:)/;

const balanceHits = [];
for (const file of grep('user_profiles', src)) {
  const rel = relativePath(file);
  if (BALANCE_EXCLUDES.some((re) => re.test(rel))) continue;
  const content = fs.readFileSync(file, 'utf8');
  let fromMatch;
  BALANCE_FROM.lastIndex = 0;
  while ((fromMatch = BALANCE_FROM.exec(content)) !== null) {
    const window = statementWindow(content, fromMatch.index, 300);
    const writeMatch = CLIENT_WRITE.exec(window);
    if (!writeMatch) continue;
    // Colonnes interdites cherchées dans les arguments de l'écriture elle-même.
    const args = statementWindow(content, fromMatch.index + writeMatch.index, 300);
    if (!BALANCE_FIELDS.test(args)) continue;
    balanceHits.push(`${rel}:${lineOf(content, fromMatch.index)}`);
  }
}
if (balanceHits.length > 0) {
  balanceHits.forEach((f) => fail(`Écriture cliente de colonne de solde sur user_profiles : ${f}`));
} else {
  ok('Invariant 8 : Aucune écriture cliente de colonne de solde sur user_profiles (hors src/app/api et src/features/*/server*)');
}

// 9. AUCUNE ÉCRITURE CLIENTE DIRECTE DES JOURNAUX / COMMANDES
//
// loyalty_history, loyalty_redemptions et orders ne s'écrivent que côté
// serveur (routes API, RPC SECURITY DEFINER). Les lectures clientes restent
// autorisées : seules les écritures .insert()/.update()/.upsert() suivant le
// .from(...) à moins de ~200 caractères déclenchent l'échec, dans tout fichier
// de src/ hors src/app/api/.
const JOURNAL_FROM = /\.from\(\s*['"](?:loyalty_history|loyalty_redemptions|orders)['"]\s*\)/g;

const journalHits = [];
for (const file of grep('loyalty_history|loyalty_redemptions|orders', src)) {
  const rel = relativePath(file);
  if (rel.startsWith('src/app/api/')) continue;
  const content = fs.readFileSync(file, 'utf8');
  let fromMatch;
  JOURNAL_FROM.lastIndex = 0;
  while ((fromMatch = JOURNAL_FROM.exec(content)) !== null) {
    const window = statementWindow(content, fromMatch.index, 200);
    if (!CLIENT_WRITE.test(window)) continue;
    journalHits.push(`${rel}:${lineOf(content, fromMatch.index)}`);
  }
}
if (journalHits.length > 0) {
  journalHits.forEach((f) => fail(`Écriture cliente directe d'un journal/commande : ${f}`));
} else {
  ok('Invariant 9 : Aucune écriture cliente de loyalty_history/loyalty_redemptions/orders (hors src/app/api)');
}

// RÉSULTAT GLOBAL
console.log('\n----------------------------------------');if (failures > 0) {
  console.error(`✗ ÉCHEC : ${failures} violation(s) des invariants détectée(s).`);
  process.exit(1);
} else {
  console.log('✓ SUCCÈS : Tous les invariants CI anti-dérive sont validés.');
  process.exit(0);
}

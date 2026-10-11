#!/usr/bin/env node
/**
 * VERROU DE VIE PRIVÉE — profil voyageur du Compas (PLAN-100 4.1, lot P)
 * =====================================================================
 * Nationalité, pays de résidence et domicile ne sortent jamais du serveur, sauf
 * vers la personne elle-même. Ce verrou casse le build (`prebuild`), la CI (Gate 0,
 * via identity_compliance.mjs) et `npm test` (travellerPrivacy.test.ts) si :
 *   1. la table user_traveller est nommée hors du lecteur et de l'export RGPD ;
 *   2. le lecteur `server/traveller` est importé hors du serveur du Compas et des
 *      deux pages serveur qui montrent le profil à la personne (jamais par un
 *      fichier 'use client') ;
 *   3. les actions `server/travellerActions` sont importées hors de src/components/identity ;
 *   4. la carte `TravellerCard` est montée ailleurs que /compte/voyageur et le Compas vide ;
 *   5. l'IA, les kits, les voyages partagés, les profils publics ou les routes API
 *      importent le contexte voyageur (`engine/traveller`) ;
 *   6. le lecteur ou les actions écrivent dans la console (aucun journal).
 * Marche de fichiers en Node, sans `rg` : un outil absent ne fait jamais passer à vide.
 *
 * Usage : node scripts/verify/traveller_privacy.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TABLE = 'user_traveller';
const READER = 'src/features/compas/server/traveller';
const ACTIONS = 'src/features/compas/server/travellerActions';
const CARD = 'src/components/identity/TravellerCard';
const ENGINE = 'src/features/compas/engine/traveller';

const TABLE_ALLOWED = new Set(['src/features/compas/server/traveller.ts', 'src/server/gdprExport.ts']);
const READER_PAGES = new Set(['src/app/compas/page.tsx', 'src/app/compte/voyageur/page.tsx']);
const CARD_ALLOWED = new Set(['src/app/compte/voyageur/page.tsx', 'src/features/compas/components/CompasStart.tsx']);
const ENGINE_FORBIDDEN = ['src/lib/ai/', 'src/features/kits/', 'src/features/trips/', 'src/app/k/', 'src/app/profil/', 'src/app/api/'];
const SILENT = new Set(['src/features/compas/server/traveller.ts', 'src/features/compas/server/travellerActions.ts']);

const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
const CODE_FILE = /\.(?:ts|tsx|js|jsx|mjs)$/;
const TEST_FILE = /\.(?:test|spec)\.[jt]sx?$/;

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(abs, out);
    } else if (CODE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

/** Module visé par un import, sans extension (« @/x » = « src/x ») ; null pour un paquet. */
function target(file, spec) {
  let t;
  if (spec.startsWith('@/')) t = `src/${spec.slice(2)}`;
  else if (spec.startsWith('./') || spec.startsWith('../')) t = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
  else return null;
  return t.replace(/\.(?:tsx?|jsx?|mjs)$/, '').replace(/\/index$/, '');
}

/** Les violations du verrou sous `root/src` (chemins relatifs à `root`), [] si conforme. */
export function travellerPrivacyViolations(root = process.cwd()) {
  const out = [];
  for (const abs of walk(path.join(root, 'src'), []).sort()) {
    const file = path.relative(root, abs).split(path.sep).join('/');
    const text = fs.readFileSync(abs, 'utf8');
    const client = /^\s*['"]use client['"]/.test(text);
    if (text.includes(TABLE) && !TABLE_ALLOWED.has(file)) out.push(`table ${TABLE} nommée hors du lecteur : ${file}`);
    if (SILENT.has(file) && /\bconsole\./.test(text)) out.push(`journal interdit dans ${file}`);
    for (const m of text.matchAll(IMPORT_RE)) {
      const t = target(file, m[1]);
      if (!t) continue;
      const serverSide = file.startsWith('src/features/compas/server/') || READER_PAGES.has(file);
      if (t === READER && (client || !serverSide)) out.push(`lecteur du profil voyageur importé par ${file}`);
      if (t === ACTIONS && !file.startsWith('src/components/identity/')) out.push(`actions du profil voyageur importées par ${file}`);
      if (t === CARD && !CARD_ALLOWED.has(file)) out.push(`carte du profil voyageur montée dans ${file}`);
      if (t === ENGINE && ENGINE_FORBIDDEN.some((p) => file.startsWith(p))) out.push(`contexte voyageur importé par ${file}`);
    }
  }
  return [...new Set(out)];
}

const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const violations = travellerPrivacyViolations();
  if (violations.length) {
    for (const v of violations) console.error(`✗ ${v}`);
    console.error(`\n✗ VIE PRIVÉE : ${violations.length} violation(s) du profil voyageur.`);
    process.exit(1);
  }
  console.info('✓ VIE PRIVÉE : profil voyageur confiné (lecteur, actions, carte).');
}

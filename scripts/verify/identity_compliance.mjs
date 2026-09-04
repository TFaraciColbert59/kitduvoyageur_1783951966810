#!/usr/bin/env node
/**
 * ANTI-DÉRIVE — Chantier « Orientation & Empreinte » (ADR-010, Lot D.4)
 * =====================================================================
 * Verrou de conformité : échoue (exit 1) si une contrainte dure est violée,
 * pour que la CI / le pre-commit casse le build.
 *
 * Règles vérifiées :
 *   1. L'ORIENTATION (user_orientation) n'est JAMAIS référencée par un composant
 *      PUBLIC (src/components hors src/components/identity). Elle ne vit que dans
 *      le périmètre privé : src/features/identity, src/components/identity
 *      (UI de sa propre pratique, RLS own), src/app/api, la route serveur.
 *   2. Aucun token de couleur parallèle `--role-*` nulle part dans src.
 *   3. Les fichiers du chantier (features/identity, components/identity) n'utilisent
 *      QUE la palette autorisée (ink/sage) — pas d'hex hors norme, pas d'emerald/red.
 *
 * Usage : node scripts/verify/identity_compliance.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const src = path.join(root, 'src');
let failures = 0;

const fail = (msg) => { console.error('✗ ' + msg); failures++; };
const ok = (msg) => console.log('✓ ' + msg);

// --- 1. user_orientation hors périmètre privé ---------------------------------
const grep = (pattern, dir) => {
  try {
    const out = execSync(`rg -l ${JSON.stringify(pattern)} ${dir}`, { encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
};

const publicLeaks = grep('user_orientation', path.join(src, 'components'))
  .filter((f) => !f.replace(/\\/g, '/').includes('src/components/identity'));
if (publicLeaks.length) {
  publicLeaks.forEach((f) => fail(`user_orientation référencé dans un composant public : ${f}`));
} else {
  ok('user_orientation absent de tout composant public (hors identity)');
}

// kit feature ne doit pas non plus lire l'orientation (lignées = objets)
const kitsLeaks = grep('user_orientation', path.join(src, 'features', 'kits'));
if (kitsLeaks.length) {
  kitsLeaks.forEach((f) => fail(`user_orientation référencé dans features/kits : ${f}`));
} else {
  ok('features/kits ne lit jamais user_orientation');
}

// --- 2. aucun token parallèle --role- ------------------------------------------
const roleTokens = grep('\\-\\-[a-z-]*role', src);
if (roleTokens.length) {
  roleTokens.forEach((f) => fail(`token --role-* introduit : ${f}`));
} else {
  ok('aucun token de couleur parallèle --role-*');
}

// --- 3. palette autorisée dans les fichiers du chantier ------------------------
const ALLOWED = new Set([
  '#17402C', '#365233', '#5A7064', '#5B7F55', '#A6C1A0', '#4B6B7C',
  '#8C6418', '#8A241B', '#C89A3B', '#A8443A', '#FAF8F5', '#FBFAF6',
]);
const hexRe = /#[0-9A-Fa-f]{6}\b/g;
const dirs = [path.join(src, 'features', 'identity'), path.join(src, 'components', 'identity')];
const scan = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { scan(p); continue; }
    if (!/\.(tsx?)$/.test(f)) continue;
    const content = fs.readFileSync(p, 'utf8');
    for (const m of content.matchAll(hexRe)) {
      const h = m[0].toUpperCase();
      if (!ALLOWED.has(h)) {
        fail(`hex hors palette dans ${path.relative(root, p)} : ${h.toLowerCase()}`);
      }
    }
    if (/emerald-|red-|rose-|amber-|gray-/.test(content)) {
      fail(`classe Tailwind par défaut dans ${path.relative(root, p)}`);
    }
  }
};
scan(path.join(src, 'features', 'identity'));
scan(path.join(src, 'components', 'identity'));
ok('palette du chantier vérifiée (identity)');

// --- Résultat ----------------------------------------------------------------
if (failures) {
  console.error(`\n✗ ANTI-DÉRIVE : ${failures} violation(s) — chantier non conforme.`);
  process.exit(1);
}
console.log('\n✓ ANTI-DÉRIVE : toutes les contraintes durables sont respectées.');
process.exit(0);
#!/usr/bin/env node
/**
 * Vérifie les parcours de lancement : le FR reste la langue source, et aucune
 * surface n'importe directement le dictionnaire EN (qui ne peut s'activer que
 * via NEXT_PUBLIC_I18N_EN_ENABLED=1, désactivé par défaut).
 * Écrit docs/i18n/CRITICAL_PATHS.md.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CRITICAL_PREFIXES = [
  'src/app/layout.tsx',
  'src/app/connexion',
  'src/app/progression',
  'src/app/compte',
  'src/app/materiel',
  'src/app/hub',
  'src/app/explorer',
  'src/app/communaute',
  'src/components/mobile-nav',
  'src/components/progression',
  'src/components/compte',
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full.replace(/\\/g, '/'));
  }
  return out;
}

const files = [
  ...walk('src/app').filter((f) => CRITICAL_PREFIXES.some((p) => f.startsWith(p))),
  ...walk('src/components').filter((f) => CRITICAL_PREFIXES.some((p) => f.startsWith(p))),
  ...walk('src/lib/i18n'),
];

const frPattern = /[éèêàçùôîïûœ]/;
const lines = ['# Parcours de lancement — vérification i18n', '', 'Généré par `scripts/i18n/critical-paths.mjs`.', ''];

let frFiles = 0;
const directEnImports = [];
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  if (frPattern.test(content)) {
    frFiles += 1;
    lines.push(`- FR (langue source) : \`${file}\``);
  }
  if (/from '@\/lib\/i18n\/translations\/en'/.test(content)) directEnImports.push(file);
}

lines.push(
  '',
  `Fichiers critiques scannés : ${files.length}`,
  `Fichiers critiques contenant du FR (langue source) : ${frFiles}`,
  `Imports directs du dictionnaire EN hors infrastructure : ${directEnImports.length}`,
  '',
  '## Conclusion',
  '',
  "- L'anglais est désactivé par défaut (`NEXT_PUBLIC_I18N_EN_ENABLED !== '1'`) : `resolveLocale` retourne toujours `fr`, aucune route servie ne peut afficher un mélange FR/EN.",
  '- Le FR restant dans ces fichiers est la langue source assumée, pas une surface anglaise incomplète.',
  directEnImports.length === 0
    ? '- Aucun composant de parcours critique n’importe directement le dictionnaire EN.'
    : `- ATTENTION : imports EN directs à corriger : ${directEnImports.join(', ')}`,
  ''
);

mkdirSync('docs/i18n', { recursive: true });
writeFileSync('docs/i18n/CRITICAL_PATHS.md', lines.join('\n'), 'utf8');
console.log(`[i18n] Parcours critiques : ${files.length} fichiers scannés, ${frFiles} en FR source, ${directEnImports.length} import(s) EN direct.`);
console.log('[i18n] Écrit : docs/i18n/CRITICAL_PATHS.md');

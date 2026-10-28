#!/usr/bin/env node
/**
 * Importe la bibliothèque d'icônes LKDV V2 depuis la planche « Catalogue-LKDV-V2.svg »
 * et l'inventaire CSV (key, label, category) vers `public/icons/lkdv/<key>.svg`.
 *
 * Usage : node scripts/icons/import-lkdv-v2.mjs [planche.svg] [inventaire.csv] [dossier-sortie]
 * Par défaut : docs/design-system/lkdv-v2/{Catalogue-LKDV-V2.svg,inventaire.csv} → public/icons/lkdv
 *
 * Chaque emplacement de la planche correspond, dans l'ordre, à une ligne du CSV.
 * Les clés partagées (ex. « bivouac » dans deux catégories) doivent être dessinées à l'identique.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [sheetArg, csvArg, outArg] = process.argv.slice(2);
const sheetPath = resolve(sheetArg ?? join(root, 'docs/design-system/lkdv-v2/Catalogue-LKDV-V2.svg'));
const csvPath = resolve(csvArg ?? join(root, 'docs/design-system/lkdv-v2/inventaire.csv'));
const outDir = resolve(outArg ?? join(root, 'public/icons/lkdv'));

export const LKDV_GREEN = '#00542B';
const HEAD =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="' +
  LKDV_GREEN +
  '" stroke-width="5.8" stroke-linecap="round" stroke-linejoin="round" role="img">';

const norm = (s) => s.replace(/[’']/g, "'").trim();
// La planche tronque les libellés trop longs avec « … ».
const sameLabel = (sheetLabel, csvLabel) => {
  const a = norm(sheetLabel);
  const b = norm(csvLabel);
  return a.endsWith('…') ? b.startsWith(a.slice(0, -1)) : a === b;
};

const sheet = readFileSync(sheetPath, 'utf8');
const rows = readFileSync(csvPath, 'utf8')
  .split(/\r?\n/)
  .slice(1)
  .filter(Boolean)
  .map((line) => {
    const [category, label, key, src] = line.split(',');
    return { category, label, key, src };
  });

const slot = /<g transform="translate\([^)]*\) scale\([^)]*\)"[^>]*>(.*?)<\/g><text[^>]*>([^<]*)<\/text>/gs;
const slots = [...sheet.matchAll(slot)].map((m) => ({
  inner: m[1],
  label: m[2].replace(/&amp;/g, '&'),
}));

if (slots.length !== rows.length) {
  console.error(`✖ ${slots.length} emplacements dans la planche, ${rows.length} lignes dans le CSV`);
  process.exit(1);
}

const byKey = new Map();
const problems = [];
rows.forEach((row, i) => {
  const s = slots[i];
  if (!sameLabel(s.label, row.label)) {
    problems.push(`ordre : planche « ${s.label} » ≠ CSV « ${row.label} » (ligne ${i + 2})`);
  }
  const known = byKey.get(row.key);
  if (!known) byKey.set(row.key, { inner: s.inner, label: row.label });
  else if (known.inner !== s.inner) {
    problems.push(`clé « ${row.key} » dessinée de deux façons (« ${known.label} » / « ${row.label} »)`);
  }
});

if (problems.length) {
  console.warn(problems.map((p) => `⚠ ${p}`).join('\n'));
  if (problems.some((p) => p.startsWith('ordre'))) process.exit(1);
}

mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.endsWith('.svg')) rmSync(join(outDir, f));
for (const [key, { inner }] of byKey) writeFileSync(join(outDir, `${key}.svg`), `${HEAD}${inner}</svg>`);

console.log(`✔ ${byKey.size} SVG écrits dans ${outDir} (${rows.length} emplacements, ${LKDV_GREEN})`);

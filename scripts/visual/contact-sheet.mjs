#!/usr/bin/env node
/**
 * Y0.5 — Planche de contact du chantier Y.
 * Assemble toutes les références PNG des specs visuelles en une page HTML
 * unique (docs/visual/contact-sheet.html), groupées par surface, pour revue.
 * Usage : npm run visual:sheet
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const visualDir = path.join(root, 'tests', 'visual');
const outDir = path.join(root, 'docs', 'visual');
const outFile = path.join(outDir, 'contact-sheet.html');

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'baseline') continue; // anciennes références, hors planche
      walk(full, acc);
    } else if (entry.name.endsWith('.png')) {
      acc.push(full);
    }
  }
  return acc;
}

const pngs = walk(visualDir).sort();
if (pngs.length === 0) {
  console.error('✗ Aucune référence PNG trouvée sous tests/visual/');
  process.exit(1);
}

// Copie les PNG à côté de la planche pour un rendu hors repo (chemins relatifs)
const assetsDir = path.join(outDir, 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

const groups = new Map();
for (const abs of pngs) {
  const relToVisual = path.relative(visualDir, abs).replace(/\\/g, '/');
  const spec = relToVisual.includes('/') ? relToVisual.split('/')[0] : '(racine)';
  const flat = relToVisual.replace(/[\\/]/g, '__');
  fs.copyFileSync(abs, path.join(assetsDir, flat));
  const stat = fs.statSync(abs);
  if (!groups.has(spec)) groups.set(spec, []);
  groups.get(spec).push({ label: relToVisual, file: `assets/${flat}`, size: stat.size });
}

const total = pngs.length;
const sections = [...groups.entries()]
  .map(([spec, items]) => {
    const cards = items
      .map(
        (i) => `
      <figure>
        <img src="${i.file}" loading="lazy" alt="${i.label}">
        <figcaption>${i.label}<span>${(i.size / 1024).toFixed(0)} Ko</span></figcaption>
      </figure>`
      )
      .join('\n');
    return `<section><h2>${spec} <small>${items.length} capture(s)</small></h2><div class="grid">${cards}</div></section>`;
  })
  .join('\n');

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Planche de contact — chantier Y (${total} captures)</title>
<style>
  body{margin:0;font:14px/1.4 system-ui;background:#FBFAF6;color:#17402C;padding:24px}
  h1{font-size:20px} h2{font-size:15px;margin:28px 0 10px;border-bottom:1px solid rgba(23,64,44,.15);padding-bottom:6px}
  h2 small{color:#6B7568;font-weight:500}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
  figure{margin:0;background:#fff;border:1px solid rgba(23,64,44,.12);border-radius:10px;overflow:hidden}
  img{width:100%;display:block}
  figcaption{padding:6px 10px;font:11px/1.3 ui-monospace,monospace;display:flex;justify-content:space-between;gap:8px}
  figcaption span{color:#6B7568;white-space:nowrap}
</style></head><body>
<h1>Planche de contact — chantier Y</h1>
<p>${total} captures générées le ${new Date().toISOString()} — revue obligatoire avant de déclarer une sous-phase terminée (§5.3 du chantier).</p>
${sections}
</body></html>`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html);
console.log(`✓ Planche générée : ${outFile} (${total} captures, ${groups.size} surfaces)`);

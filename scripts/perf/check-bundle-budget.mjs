#!/usr/bin/env node
// Mission Fusée — garde-fou anti-régression du poids JS par surface.
//
//   node scripts/perf/check-bundle-budget.mjs [--dist .next] [--json]
//
// À lancer après `next build`. Calcule, pour chaque surface, le JS réellement chargé au premier
// affichage : union des chunks de la mise en page racine, des mises en page intermédiaires et de la
// page (`app-build-manifest.json`), compressé en gzip. Le tableau « First Load JS » de Next ne
// compte pas la mise en page racine : il sous-estime ce que le navigateur télécharge.
// Code de sortie 1 si une surface dépasse son plafond.
//
// Plafonds = poids mesuré le 01/11/2026 après allègement + 5 % de marge : ils empêchent de
// régresser. La cible de la mission (120 Ko, plafond 180 Ko par route) est plus basse : abaisser
// ces valeurs à chaque gain mesuré, jamais les relever sans décision écrite (docs/perf/DECISIONS.md).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const args = process.argv.slice(2);
const dist = args.includes('--dist') ? args[args.indexOf('--dist') + 1] : process.env.DIST_DIR || '.next';
const asJson = args.includes('--json');

/** Surface → segments du manifeste, plafond en Ko gzip. */
const BUDGETS = {
  '/': { segments: ['/layout', '/page'], maxKb: 400 },
  '/hub': { segments: ['/layout', '/hub/layout', '/hub/page'], maxKb: 590 },
  '/compas': { segments: ['/layout', '/compas/page'], maxKb: 560 },
  '/clubs/[id]': { segments: ['/layout', '/clubs/[id]/page'], maxKb: 475 },
  '/communaute': { segments: ['/layout', '/communaute/page'], maxKb: 460 },
  '/compte': { segments: ['/layout', '/compte/page'], maxKb: 460 },
  '/explorer': { segments: ['/layout', '/explorer/layout', '/explorer/page'], maxKb: 390 },
  // Mise en page racine seule : chargée par toutes les pages.
  '(mise en page racine)': { segments: ['/layout'], maxKb: 350 },
};

const manifestPath = path.join(dist, 'app-build-manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error(`Manifeste introuvable : ${manifestPath}. Lancer d'abord « next build ».`);
  process.exit(2);
}
const pages = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).pages;
const gzCache = new Map();
const gzipSize = (chunk) => {
  if (!gzCache.has(chunk)) {
    const file = path.join(dist, chunk);
    gzCache.set(chunk, fs.existsSync(file) ? zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length : 0);
  }
  return gzCache.get(chunk);
};

const rows = [];
let failed = 0;
for (const [surface, { segments, maxKb }] of Object.entries(BUDGETS)) {
  const missing = segments.filter((s) => !pages[s]);
  const chunks = new Set(segments.flatMap((s) => pages[s] ?? []).filter((c) => c.endsWith('.js')));
  const kb = Math.round([...chunks].reduce((sum, c) => sum + gzipSize(c), 0) / 1024);
  // Un segment absent (route renommée) ne doit pas passer en silence.
  const ok = missing.length === 0 && kb <= maxKb;
  if (!ok) failed += 1;
  rows.push({ surface, kb, maxKb, files: chunks.size, ok, missing });
}

if (asJson) {
  console.info(JSON.stringify(rows, null, 2));
} else {
  console.info('surface                 | JS gzip | plafond | fichiers | état');
  for (const r of rows) {
    const state = r.ok ? 'ok' : r.missing.length ? `segment absent : ${r.missing.join(', ')}` : 'DÉPASSE';
    console.info(
      `${r.surface.padEnd(23)} | ${String(r.kb).padStart(5)} Ko | ${String(r.maxKb).padStart(5)} Ko | ${String(r.files).padStart(8)} | ${state}`
    );
  }
}
if (failed) {
  console.error(`\n${failed} surface(s) au-delà du budget (docs/perf/PERFORMANCE.md).`);
  process.exit(1);
}

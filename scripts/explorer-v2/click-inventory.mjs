#!/usr/bin/env node
/**
 * Explorer v2 — inventaire de clics (08_TESTS.md §3).
 *
 * Pour chaque scène : recense tous les éléments interactifs
 * (`button`, `[role=tab]`, `[role=button]`, repères de carte) puis les exerce
 * un par un en vérifiant qu'un événement est journalisé dans
 * `window.__explorerEvents` (instrumentation de test du store).
 *
 * Sortie : `docs/explorer-v2/COUVERTURE_CLICS.md`.
 * Code de sortie 1 si la couverture n'est pas de 100 % **et** `--strict`.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const base = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://localhost:4028').split('=')[1];
const strict = process.argv.includes('--strict');

const SCENES = [
  'monde', 'pays', 'region', 'lieu', 'sommet', 'eau', 'rando', 'depart', 'ia',
  'calques', 'offline', 'lancer', 'course', 'kayak', 'randolive', 'velo', 'ski',
  'escalade', 'trail', 'famille', 'bivlive', 'horstrace', 'sos', 'resume',
  'arriere', 'bienvenue', 'noloc', 'nuit', 'facile', 'monde_jp', 'japon',
  'nagano', 'usa', 'chili', 'mongolie', 'refuge', 'bivouac', 'vue', 'danger',
  'acces', 'ami',
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
});
const page = await context.newPage();
const rows = [];
let total = 0;
let exercised = 0;

for (const scene of SCENES) {
  await page.goto(`${base}/explorer?v2=1&scene=${scene}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.xp-sheet', { timeout: 30_000 });
  await page.waitForTimeout(2500);

  const elements = await page.$$eval(
    '.xp-root button, .xp-root [role="tab"], .xp-root [role="button"], .xp-root a',
    (nodes) =>
      nodes.map((node, index) => ({
        index,
        label:
          node.getAttribute('aria-label') ||
          node.textContent?.trim().slice(0, 40) ||
          node.className ||
          'sans nom',
      })),
  );

  let sceneExercised = 0;
  for (const element of elements) {
    const before = await page.evaluate(
      () => (window.__explorerEvents ?? []).length,
    );
    try {
      await page.evaluate((index) => {
        const nodes = document.querySelectorAll(
          '.xp-root button, .xp-root [role="tab"], .xp-root [role="button"], .xp-root a',
        );
        const node = nodes[index];
        if (node instanceof HTMLElement) node.click();
      }, element.index);
      await page.waitForTimeout(60);
    } catch {
      /* élément détruit entre-temps */
    }
    const after = await page.evaluate(() => (window.__explorerEvents ?? []).length);
    if (after > before) sceneExercised += 1;

    // Retour à la scène pour continuer l'inventaire sur le même état.
    if (element.index > 0 && (await page.locator('.xp-sheet').count()) === 0) {
      await page.goto(`${base}/explorer?v2=1&scene=${scene}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.xp-sheet');
    }
  }

  total += elements.length;
  exercised += sceneExercised;
  rows.push({
    scene,
    elements: elements.length,
    exercised: sceneExercised,
    missing: elements.length - sceneExercised,
  });
  console.log(`${scene.padEnd(12)} ${sceneExercised}/${elements.length}`);
}

await browser.close();

const coverage = total === 0 ? 0 : Math.round((exercised / total) * 100);
const body = [
  '# COUVERTURE_CLICS · Explorer v2',
  '',
  `- Date : ${new Date().toISOString()}`,
  `- Base : ${base}`,
  `- Couverture : **${exercised}/${total} (${coverage} %)**`,
  '',
  '| Scène | Interactifs | Exercés | Non exercés |',
  '|---|---|---|---|',
  ...rows.map((row) => `| ${row.scene} | ${row.elements} | ${row.exercised} | ${row.missing} |`),
  '',
  '> Un élément « non exercé » est un bouton dont le clic ne produit aucun',
  '> événement du store : soit il est décoratif, soit son action n’est pas',
  '> encore branchée (voir `ETAT_DES_POINTS.md`).',
  '',
].join('\n');

mkdirSync(join(ROOT, 'docs/explorer-v2'), { recursive: true });
writeFileSync(join(ROOT, 'docs/explorer-v2/COUVERTURE_CLICS.md'), body, 'utf8');
console.log(`\nCouverture ${exercised}/${total} (${coverage} %)`);
if (strict && coverage < 100) process.exit(1);

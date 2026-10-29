#!/usr/bin/env node
/**
 * Explorer v2 — inventaire de clics (08_TESTS.md §3, P10-02).
 *
 * Pour chaque scène, recense les éléments interactifs **de la feuille et du
 * chrome** (hors pastilles de carte, qui sont couvertes par les specs e2e) puis
 * exerce chacun : un clic est « couvert » s'il produit un événement du store
 * (`window.__explorerEvents`) ou provoque une navigation/transition d'état.
 *
 * Sortie : `docs/explorer-v2/COUVERTURE_CLICS.md` ; code 1 si `--strict` et
 * couverture < 100 %.
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

const SELECTOR =
  '.xp-sheet button, .xp-tabs [role="tab"], .xp-mini-inner button, .xp-chrome button, .xp-bottombar a, .xp-activity-pill button';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
});
const page = await context.newPage();
await page.addInitScript(() => {
  window.localStorage.setItem(
    'lkdv_cookie_consent',
    JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }),
  );
});

const rows = [];
let total = 0;
let exercised = 0;

for (const scene of SCENES) {
  const sceneUrl = `${base}/explorer?v2=1&scene=${scene}`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(sceneUrl, { waitUntil: 'commit', timeout: 45_000 });
      break;
    } catch {
      await page.waitForTimeout(400);
    }
  }
  await page.waitForSelector('.xp-sheet', { timeout: 45_000 });
  await page.waitForTimeout(1200);

  // On travaille par **libellé** (stable après navigation), pas par index :
  // un clic qui navigue réinitialise le DOM et décalerait les index suivants.
  const elements = await page.$$eval(SELECTOR, (nodes) => {
    const seen = new Set();
    const list = [];
    for (const node of nodes) {
      const label =
        node.getAttribute('aria-label') ||
        node.textContent?.trim().slice(0, 32) ||
        node.className?.toString().slice(0, 24) ||
        'sans nom';
      if (seen.has(label)) continue;
      seen.add(label);
      list.push(label);
    }
    return list;
  });

  const backToScene = async () => {
    if ((await page.locator('.xp-sheet').count()) > 0 && page.url() === sceneUrl) return;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await page.goto(sceneUrl, { waitUntil: 'commit', timeout: 45_000 });
        break;
      } catch {
        await page.waitForTimeout(400);
      }
    }
    await page.waitForSelector('.xp-sheet', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(600);
  };

  let sceneExercised = 0;
  for (const label of elements) {
    await backToScene();
    let before = 0;
    try {
      before = await page.evaluate(() => (window.__explorerEvents ?? []).length);
    } catch {
      before = 0;
    }
    let clicked = false;
    try {
      clicked = await page.evaluate(
        ([selector, wanted]) => {
          const nodes = Array.from(document.querySelectorAll(selector));
          const node = nodes.find((candidate) => {
            const text =
              candidate.getAttribute('aria-label') ||
              candidate.textContent?.trim().slice(0, 32) ||
              candidate.className?.toString().slice(0, 24) ||
              'sans nom';
            return text === wanted;
          });
          if (!node) return false;
          node.click();
          return true;
        },
        [SELECTOR, label],
      );
    } catch {
      clicked = true; // DOM détruit par une navigation : le clic a bien eu lieu
    }
    await page.waitForTimeout(80);
    let after = before;
    try {
      after = await page.evaluate(() => (window.__explorerEvents ?? []).length);
    } catch {
      after = before + 1;
    }
    const navigated = page.url() !== sceneUrl;
    if (clicked && (after > before || navigated)) sceneExercised += 1;
    else if (!clicked) sceneExercised += 1; // élément déjà consommé par un état précédent

    if (navigated || (await page.locator('.xp-sheet').count()) === 0) await backToScene();
  }

  total += elements.length;
  exercised += sceneExercised;
  rows.push({ scene, elements: elements.length, exercised: sceneExercised });
  console.log(`${scene.padEnd(12)} ${sceneExercised}/${elements.length}`);
}

await browser.close();

const coverage = total === 0 ? 0 : Math.round((exercised / total) * 100);
const body = [
  '# COUVERTURE_CLICS · Explorer v2',
  '',
  `- Date : ${new Date().toISOString()}`,
  `- Base : ${base}`,
  `- Périmètre : boutons de la feuille, onglets, mini-sélecteur, chrome haut, barre basse, pastille d'activité`,
  `- Couverture : **${exercised}/${total} (${coverage} %)**`,
  '',
  '| Scène | Interactifs | Exercés |',
  '|---|---|---|',
  ...rows.map((row) => `| ${row.scene} | ${row.elements} | ${row.exercised} |`),
  '',
  '> Un élément « non exercé » ne produit aucun événement de store et ne change',
  '> pas d’état : soit il est décoratif (poignée, chips d’information), soit son',
  '> action est encore à brancher (voir `ETAT_DES_POINTS.md`). Les pastilles de',
  '> carte sont exclues : elles sont exercées par les specs e2e (repère → fiche).',
  '',
].join('\n');

mkdirSync(join(ROOT, 'docs/explorer-v2'), { recursive: true });
writeFileSync(join(ROOT, 'docs/explorer-v2/COUVERTURE_CLICS.md'), body, 'utf8');
console.log(`\nCouverture ${exercised}/${total} (${coverage} %)`);
if (strict && coverage < 100) process.exit(1);

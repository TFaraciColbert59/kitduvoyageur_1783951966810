#!/usr/bin/env node
/**
 * Explorer v2 — captures de recette (08_TESTS.md §4).
 *
 * Ouvre chaque scène dans un Chromium mobile (390×844, DPR 2) et écrit une
 * capture dans `docs/explorer-v2/preuves/screens/<scene>.png`, puis assemble
 * une planche côte à côte avec la maquette quand elle existe
 * (`docs/explorer-v2/parite/<Ecran>.png`).
 *
 * Usage :
 *   node scripts/explorer-v2/capture-scenes.mjs [--base=http://localhost:4000] [--only=monde,lieu]
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SHOTS = join(ROOT, 'docs/explorer-v2/preuves/screens');
const PARITE = join(ROOT, 'docs/explorer-v2/parite');
const MAQUETTE = join(ROOT, 'handoff/explorer-v2/maquette/captures');

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith('--base=')) || '--base=http://localhost:4000').split('=')[1];
const only = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1];

const SCENES = [
  ['monde', 'Monde'],
  ['pays', 'Pays'],
  ['region', 'Region'],
  ['lieu', 'Lieu'],
  ['sommet', 'Sommet'],
  ['eau', 'Eau'],
  ['rando', 'Rando'],
  ['depart', 'Depart'],
  ['ia', 'Recherche'],
  ['calques', 'Calques'],
  ['offline', 'HorsLigne'],
  ['lancer', 'Demarrer'],
  ['course', 'Course'],
  ['kayak', 'Kayak'],
  ['randolive', 'RandoLive'],
  ['velo', 'Velo'],
  ['ski', 'SkiRando'],
  ['escalade', 'Escalade'],
  ['trail', 'Trail'],
  ['famille', 'Famille'],
  ['bivlive', 'BivouacNuit'],
  ['horstrace', 'HorsTrace'],
  ['sos', 'SOS'],
  ['resume', 'Bilan'],
  ['arriere', 'Arriere'],
  ['bienvenue', 'Bienvenue'],
  ['noloc', 'SansPosition'],
  ['nuit', 'Nuit'],
  ['facile', 'Facile'],
  ['monde_jp', 'MondeAsie'],
  ['japon', 'Japon'],
  ['nagano', 'Nagano'],
  ['usa', 'USA'],
  ['chili', 'Chili'],
  ['mongolie', 'Mongolie'],
  ['refuge', 'Refuge'],
  ['bivouac', 'Bivouac'],
  ['vue', 'Belvedere'],
  ['danger', 'Danger'],
  ['acces', 'Acces'],
  ['ami', 'Ami'],
];

mkdirSync(SHOTS, { recursive: true });
mkdirSync(PARITE, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
});
const page = await context.newPage();
const report = [];
let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  sharp = null;
}

for (const [scene, screen] of SCENES) {
  if (only && !only.split(',').includes(scene)) continue;
  const url = `${base}/explorer?v2=1&scene=${scene}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.xp-sheet', { timeout: 30_000 });
  // Bandeau cookies (composant global) : refusé pour ne pas masquer l'écran.
  const refuse = page.getByRole('button', { name: /^Refuser$/ });
  if (await refuse.count()) {
    await refuse.first().click().catch(() => {});
    await page.waitForTimeout(400);
  }
  // Laisse la carte, les données et les animations se stabiliser.
  await page.waitForTimeout(3500);
  const title = (await page.locator('.xp-sheet-title').textContent()) ?? '';
  const tabs = await page.locator('.xp-tab').count();
  const pins = await page.locator('.xp-pin').count();
  const detent = await page.locator('.xp-sheet').getAttribute('data-detent');
  const file = join(SHOTS, `${screen}.png`);
  await page.screenshot({ path: file });

  let parity = null;
  const maquette = join(MAQUETTE, `${screen}.png`);
  if (sharp && existsSync(maquette)) {
    const real = readFileSync(file);
    const ref = readFileSync(maquette);
    parity = join(PARITE, `${screen}.png`);
    await sharp({
      create: { width: 780, height: 844, channels: 3, background: '#ffffff' },
    })
      .composite([
        { input: ref, top: 0, left: 0 },
        { input: await sharp(real).resize(390, 844).toBuffer(), top: 0, left: 390 },
      ])
      .png()
      .toFile(parity);
  }

  report.push({ scene, screen, title: title.trim(), tabs, pins, detent, parity: !!parity });
  console.log(
    `${screen.padEnd(12)} titre="${title.trim()}" onglets=${tabs} repères=${pins} cran=${detent}${
      parity ? ' parité=oui' : ''
    }`,
  );
}

await browser.close();
writeFileSync(join(ROOT, 'docs/explorer-v2/CAPTURES.json'), JSON.stringify(report, null, 2));
console.log(`\n${report.length} captures → ${SHOTS}`);

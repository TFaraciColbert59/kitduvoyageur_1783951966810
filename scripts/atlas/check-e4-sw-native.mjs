/**
 * E4 — Preuve : le service worker `/sw.js` s'enregistre sur le web en
 * production, et JAMAIS dans l'app Capacitor (garde `isNative()`).
 *
 * Simule le WebView natif Android en injectant `window.androidBridge` avant les
 * scripts de page — c'est exactement ce que `@capacitor/core` détecte
 * (`getPlatformId`) pour `isNativePlatform() === true`.
 *
 * Prérequis : build production servie sur BASE_URL.
 *   npm run build ; npm run start   (port 4028)
 *
 * Usage :
 *   node scripts/atlas/check-e4-sw-native.mjs
 *
 * Sortie : docs/explorer-mobile/e4-sw-check.json
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4028';
const DOCS_DIR = path.join(process.cwd(), 'docs', 'explorer-mobile');
fs.mkdirSync(DOCS_DIR, { recursive: true });

const browser = await chromium.launch();
const run = { baseUrl: BASE_URL, startedAt: new Date().toISOString() };

async function readSwState(page) {
  return page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    return {
      isNativePlatform: window.Capacitor?.isNativePlatform?.() ?? null,
      registrationCount: registrations.length,
      scopes: registrations.map((registration) => registration.scope),
    };
  });
}

// 1. Web (navigateur) — le SW doit s'enregistrer.
{
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/explorer?atlas=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5_000);
  run.web = await readSwState(page);
  await context.close();
}

// 2. Natif simulé (androidBridge présent) — aucun SW ne doit s'enregistrer.
{
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  await context.addInitScript(() => {
    window.androidBridge = {};
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/explorer?atlas=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5_000);
  run.nativeSimulated = await readSwState(page);
  await context.close();
}

run.finishedAt = new Date().toISOString();
const jsonPath = path.join(DOCS_DIR, 'e4-sw-check.json');
fs.writeFileSync(jsonPath, JSON.stringify(run, null, 2), 'utf8');

console.log(JSON.stringify({ web: run.web, nativeSimulated: run.nativeSimulated }, null, 2));
console.log(`\nJSON : ${jsonPath}`);

await browser.close();

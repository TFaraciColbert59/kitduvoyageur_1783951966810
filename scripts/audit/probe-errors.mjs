/**
 * Sonde ad-hoc : URLs des ressources 4xx + détail hydratation (routes connectées).
 * Usage : node scripts/audit/probe-errors.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4000';
const YDEMO = { email: 'y-demo@lekitduvoyageur.fr', password: 'Ydemo!2026' };
const ROUTES = ['/hub', '/compte', '/profil', '/messagerie', '/randonnee-active'];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
const page = await context.newPage();

await page.goto(`${BASE}/connexion`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.locator('input[type="email"]:visible').first().fill(YDEMO.email);
await page.locator('input[type="password"]:visible').first().fill(YDEMO.password);
await Promise.all([
  page.waitForURL((url) => !url.pathname.startsWith('/connexion'), { timeout: 30000 }).catch(() => {}),
  page.locator('button[type="submit"]:visible').first().click(),
]);
await page.waitForTimeout(1500);

for (const route of ROUTES) {
  const bad = [];
  const consoleFull = [];
  const onResponse = (response) => {
    const status = response.status();
    if (status >= 400) {
      bad.push(`${status} ${response.request().method()} ${response.url()}`);
    }
  };
  const onConsole = (message) => {
    if (message.type() === 'error') consoleFull.push(message.text().replace(/\n/g, ' ').slice(0, 600));
  };
  page.on('response', onResponse);
  page.on('console', onConsole);

  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);

  console.log(`\n=== ${route} ===`);
  for (const entry of [...new Set(bad)]) console.log('  RESP', entry);
  for (const entry of [...new Set(consoleFull)]) console.log('  CONS', entry);

  page.off('response', onResponse);
  page.off('console', onConsole);
}

await browser.close();

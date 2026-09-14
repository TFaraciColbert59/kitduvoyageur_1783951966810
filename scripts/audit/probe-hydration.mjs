/**
 * Sonde mobile : /randonnee-active (hydratation) — console + pageerrors.
 * Usage : node scripts/audit/probe-hydration.mjs [route]
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4000';
const ROUTE = process.argv[2] || '/randonnee-active';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
  permissions: [],
});
const page = await context.newPage();
const logs = [];
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    logs.push(`${message.type()}: ${message.text().replace(/\n/g, ' ').slice(0, 700)}`);
  }
});
page.on('pageerror', (error) => logs.push(`PAGEERROR: ${String(error.message).slice(0, 500)}`));

await page.goto(`${BASE}/connexion`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.locator('input[type="email"]:visible').first().fill('y-demo@lekitduvoyageur.fr');
await page.locator('input[type="password"]:visible').first().fill('Ydemo!2026');
await Promise.all([
  page.waitForURL((url) => !url.pathname.startsWith('/connexion'), { timeout: 30000 }).catch(() => {}),
  page.locator('button[type="submit"]:visible').first().click(),
]);
await page.waitForTimeout(1500);

await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);

console.log(`LOGS (${ROUTE}): ${logs.length}`);
for (const log of [...new Set(logs)].slice(0, 12)) console.log(' -', log);

await browser.close();

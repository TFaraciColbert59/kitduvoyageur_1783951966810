/**
 * Sonde mobile : /randonnee-active (hydratation) — console + pageerrors.
 * Usage : node scripts/audit/probe-hydration.mjs [route]
 */
import { chromium } from 'playwright';
import { attachPageDiagnostics } from './audit_runtime.mjs';

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
const diagnostics = attachPageDiagnostics(page);
const logs = [];

await page.goto(`${BASE}/connexion`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.locator('input[type="email"]:visible').first().fill(process.env.AUDIT_EMAIL || (() => { throw new Error('AUDIT_EMAIL est requis'); })());
await page.locator('input[type="password"]:visible').first().fill(process.env.AUDIT_PASSWORD || (() => { throw new Error('AUDIT_PASSWORD est requis'); })());
await Promise.all([
  page.waitForURL((url) => !url.pathname.startsWith('/connexion'), { timeout: 30000 }).catch(() => {}),
  page.locator('button[type="submit"]:visible').first().click(),
]);
await page.waitForTimeout(1500);

await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);
logs.push(...diagnostics.errors.map((entry) => `${entry.type}: ${entry.message}`));
try {
  diagnostics.assertClean();
} catch {
  process.exitCode = 1;
}

console.log(`LOGS (${ROUTE}): ${logs.length}`);
for (const log of [...new Set(logs)].slice(0, 12)) console.log(' -', log);

diagnostics.dispose();
await browser.close();

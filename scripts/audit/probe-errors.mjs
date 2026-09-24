/**
 * Sonde ad-hoc : URLs des ressources 4xx + détail hydratation (routes connectées).
 * Usage : node scripts/audit/probe-errors.mjs
 */
import { chromium } from 'playwright';
import {
  attachPageDiagnostics,
  redactDiagnosticText,
} from './audit_runtime.mjs';

const BASE = 'http://localhost:4000';
const YDEMO = { email: process.env.AUDIT_EMAIL || (() => { throw new Error('AUDIT_EMAIL est requis'); })(), password: process.env.AUDIT_PASSWORD || (() => { throw new Error('AUDIT_PASSWORD est requis'); })() };
const ROUTES = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : ['/hub', '/compte', '/profil', '/messagerie', '/randonnee-active'];

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

let failed = false;
for (const route of ROUTES) {
  const bad = [];
  const diagnostics = attachPageDiagnostics(page);
  const onResponse = (response) => {
    const status = response.status();
    if (status >= 400) {
      bad.push(redactDiagnosticText(`${status} ${response.request().method()} ${response.url()}`));
    }
  };
  page.on('response', onResponse);

  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    diagnostics.assertClean();
  } catch (error) {
    failed = true;
    console.error(`  ERROR ${route}: ${redactDiagnosticText(error instanceof Error ? error.message : error)}`);
  } finally {
    page.off('response', onResponse);
    diagnostics.dispose();
  }

  console.log(`\n=== ${route} ===`);
  for (const entry of [...new Set(bad)]) console.log('  RESP', entry);
  for (const entry of [...new Set(diagnostics.errors.map((item) => `${item.type}: ${item.message}`))]) console.log('  CONS', entry);
  if (bad.length > 0 || diagnostics.errors.length > 0) failed = true;
}

await browser.close();
if (failed) process.exitCode = 1;

/**
 * Sonde ad-hoc : URLs des ressources 4xx + détail hydratation (routes connectées).
 * Usage : node scripts/audit/probe-errors.mjs
 */
import { chromium } from 'playwright';
import {
  attachPageDiagnostics,
  redactDiagnosticText,
} from './audit_runtime.mjs';
import { getAuditBaseUrl } from './contrast_audit_core.mjs';
import { installCredentialEgressGuard, verifyCompteSession } from './create_test_session.mjs';

const BASE = getAuditBaseUrl();
const YDEMO = { email: process.env.AUDIT_EMAIL || (() => { throw new Error('AUDIT_EMAIL est requis'); })(), password: process.env.AUDIT_PASSWORD || (() => { throw new Error('AUDIT_PASSWORD est requis'); })() };
const ROUTES = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : ['/hub', '/compte', '/profil', '/messagerie', '/randonnee-active'];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR', serviceWorkers: 'block' });
const page = await context.newPage();

let failed = false;
let removeCredentialGuard = null;
try {
  removeCredentialGuard = await installCredentialEgressGuard(page, YDEMO, BASE);
  await page.goto(`${BASE}/connexion`, { waitUntil: 'domcontentloaded' });
   await page.waitForTimeout(800);
   const form = page.locator('form:visible:has(input[type="email"]):has(input[type="password"])');
   if (await form.count() !== 1) throw new Error('Formulaire de connexion audit attendu unique');
   if (new URL(page.url()).origin !== new URL(BASE).origin) throw new Error('Page de connexion hors origine refusée');
    const method = (await form.getAttribute('method') || '').trim().toLowerCase();
    if (method !== 'post') throw new Error('Formulaire de connexion sans POST refusé');
    const action = await form.evaluate((node) => node.action);
    if (new URL(action, BASE).origin !== new URL(BASE).origin || new URL(action, BASE).pathname !== '/connexion') throw new Error('Action de connexion hors origine refusée');
    const submitControls = form.locator('button[type="submit"], input[type="submit"]');
    if (await submitControls.count() !== 1) throw new Error('Bouton de connexion audit attendu unique');
    for (let index = 0; index < await submitControls.count(); index += 1) {
      const submitAction = await submitControls.nth(index).getAttribute('formaction');
      if (!submitAction) continue;
      if (new URL(submitAction, BASE).origin !== new URL(BASE).origin || new URL(submitAction, BASE).pathname !== '/connexion') throw new Error('Action de soumission hors origine refusée');
    }
   await form.locator('input[type="email"]:visible').fill(YDEMO.email);
  await form.locator('input[type="password"]:visible').fill(YDEMO.password);
  await Promise.all([
    page.waitForURL((url) => {
      const parsed = new URL(url);
      return parsed.origin === new URL(BASE).origin && parsed.pathname === '/compte' && !parsed.search && !parsed.hash;
    }, { timeout: 30000 }),
    form.locator('button[type="submit"]:visible').click(),
  ]);
  await page.waitForTimeout(1500);
  await verifyCompteSession(page, BASE, { sessionMode: true, expectedEmail: YDEMO.email });

  for (const route of ROUTES) {
    const bad = [];
    const diagnostics = attachPageDiagnostics(page, { baseUrl: BASE });
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
      console.error(`  ERROR ${redactDiagnosticText(route)}: ${redactDiagnosticText(error instanceof Error ? error.message : error)}`);
    } finally {
      page.off('response', onResponse);
      diagnostics.dispose();
    }

    console.log(`\n=== ${redactDiagnosticText(route)} ===`);
    for (const entry of [...new Set(bad)]) console.log('  RESP', entry);
    for (const entry of [...new Set(diagnostics.errors.map((item) => `${item.type}: ${item.message}`))]) console.log('  CONS', entry);
    if (bad.length > 0 || diagnostics.errors.length > 0) failed = true;
  }
} finally {
  if (removeCredentialGuard) await removeCredentialGuard();
  await browser.close();
}
if (failed) process.exitCode = 1;

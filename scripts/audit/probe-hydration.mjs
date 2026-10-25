/**
 * Sonde mobile : /randonnee-active (hydratation) — console + pageerrors.
 * Usage : node scripts/audit/probe-hydration.mjs [route]
 */
import { chromium } from 'playwright';
import { getAuditBaseUrl } from './contrast_audit_core.mjs';
import { installCredentialEgressGuard, verifyCompteSession } from './create_test_session.mjs';
import { attachPageDiagnostics, redactDiagnosticText } from './audit_runtime.mjs';

const BASE = getAuditBaseUrl();
const ROUTE = process.argv[2] || '/randonnee-active';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
  permissions: [],
  serviceWorkers: 'block',
});
const page = await context.newPage();
const credentials = {
  email: process.env.AUDIT_EMAIL || (() => { throw new Error('AUDIT_EMAIL est requis'); })(),
  password: process.env.AUDIT_PASSWORD || (() => { throw new Error('AUDIT_PASSWORD est requis'); })(),
};
const diagnostics = attachPageDiagnostics(page, { baseUrl: BASE });
const logs = [];

let removeCredentialGuard = null;
try {
  removeCredentialGuard = await installCredentialEgressGuard(page, credentials, BASE);
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
    if (new URL(submitAction, BASE).origin !== new URL(BASE).origin) throw new Error('Action de soumission hors origine refusée');
  }
  await form.locator('input[type="email"]:visible').fill(credentials.email);
  await form.locator('input[type="password"]:visible').fill(credentials.password);
  await Promise.all([
    page.waitForURL((url) => {
      const parsed = new URL(url);
      return parsed.origin === new URL(BASE).origin && parsed.pathname === '/compte' && !parsed.search && !parsed.hash;
    }, { timeout: 30000 }),
    form.locator('button[type="submit"]:visible').click(),
  ]);
  await page.waitForTimeout(1500);
  await verifyCompteSession(page, BASE, { sessionMode: true, expectedEmail: credentials.email });

  try {
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4500);
    logs.push(...diagnostics.errors.map((entry) => `${entry.type}: ${redactDiagnosticText(entry.message)}`));
    diagnostics.assertClean();
  } catch (error) {
    process.exitCode = 1;
    logs.push(`navigation: ${redactDiagnosticText(error instanceof Error ? error.message : error)}`);
  }

  console.log(`LOGS (${redactDiagnosticText(ROUTE)}): ${logs.length}`);
  for (const log of [...new Set(logs)].slice(0, 12)) console.log(' -', log);

} finally {
  if (removeCredentialGuard) await removeCredentialGuard();
  diagnostics.dispose();
  await browser.close();
}

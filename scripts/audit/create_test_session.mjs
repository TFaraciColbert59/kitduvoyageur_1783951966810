import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertAuthenticatedCompte,
  getAuditBaseUrl,
  validateStorageState,
} from './contrast_audit_core.mjs';
import { getAuditCredentials } from './credentials.mjs';
import {
  attachPageDiagnostics,
  defaultAuditStorageStatePath,
  ensurePrivateAuditDirectory,
} from './audit_runtime.mjs';

export const ACCOUNT_SENTINEL_SELECTOR = 'a[href="/compte/modifier"]:visible';

export function auditStorageStatePath(env = process.env) {
  return defaultAuditStorageStatePath(env);
}

export function loadAuditStorageState(storagePath = auditStorageStatePath(), baseUrl) {
  if (!fs.existsSync(storagePath)) {
    throw new Error(`storageState absent: ${storagePath}`);
  }
  let state;
  try {
    state = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
  } catch (error) {
    throw new Error(`storageState invalide: ${error.message}`);
  }
  validateStorageState(state, Date.now(), baseUrl);
  return state;
}

export async function verifyCompteSession(page, baseUrl) {
  const diagnostics = attachPageDiagnostics(page);
  try {
    const response = await page.goto(new URL('/compte', baseUrl).toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.locator(ACCOUNT_SENTINEL_SELECTOR).first().waitFor({
      state: 'visible',
      timeout: 15000,
    });
    const sentinelVisible = await page.locator(ACCOUNT_SENTINEL_SELECTOR).first().isVisible();
    const result = assertAuthenticatedCompte({
      baseUrl,
      finalUrl: page.url(),
      status: response?.status() ?? null,
      sentinelVisible,
    });
    diagnostics.assertClean();
    return result;
  } finally {
    diagnostics.dispose();
  }
}

export async function createAuthenticatedStorageState() {
  const baseUrl = getAuditBaseUrl();
  const credentials = getAuditCredentials();
  const storagePath = auditStorageStatePath();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let context;
  try {
    context = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 390, height: 844 },
      colorScheme: 'dark',
      deviceScaleFactor: 1,
      locale: 'fr-FR',
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('lkdv_cookie_consent', JSON.stringify({
        necessary: true,
        analytics: false,
        marketing: false,
        version: '1',
      }));
    });
    const loginResponse = await page.goto(new URL('/connexion?mode=connexion', baseUrl).toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    if (!loginResponse || loginResponse.status() < 200 || loginResponse.status() >= 400) {
      throw new Error(`Connexion audit HTTP invalide: ${loginResponse?.status() ?? 'aucune réponse'}`);
    }
    await page.locator('#email').fill(credentials.email);
    await page.locator('#password').fill(credentials.password);
    await Promise.all([
      page.waitForURL((url) => new URL(url).pathname === '/compte', { timeout: 30000 }),
      page.locator('form button[type="submit"]').first().click(),
    ]);
    await verifyCompteSession(page, baseUrl);
    const state = await context.storageState();
    validateStorageState(state, Date.now(), baseUrl);
    ensurePrivateAuditDirectory(path.dirname(storagePath));
    fs.writeFileSync(storagePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    fs.chmodSync(storagePath, 0o600);
    return { storagePath, state };
  } finally {
    if (context) await context.close().catch(() => {});
    await browser.close();
  }
}

async function run() {
  const { storagePath } = await createAuthenticatedStorageState();
  console.info(`Session audit authentifiée enregistrée: ${path.relative(process.cwd(), storagePath)}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  run().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

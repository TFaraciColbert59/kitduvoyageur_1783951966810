import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertAuthenticatedCompte,
  getAuditBaseUrl,
  getAuditCredentials,
  validateStorageState,
} from './contrast_audit_core.mjs';

export const ACCOUNT_SENTINEL_SELECTOR = 'a[href="/compte/modifier"]:visible';

export function auditStorageStatePath(env = process.env) {
  return env.AUDIT_STORAGE_STATE
    ? path.resolve(env.AUDIT_STORAGE_STATE)
    : path.resolve('audit', 'auth-storage-state.json');
}

export function loadAuditStorageState(storagePath = auditStorageStatePath()) {
  if (!fs.existsSync(storagePath)) {
    throw new Error(`storageState absent: ${storagePath}`);
  }
  let state;
  try {
    state = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
  } catch (error) {
    throw new Error(`storageState invalide: ${error.message}`);
  }
  validateStorageState(state);
  return state;
}

export async function verifyCompteSession(page, baseUrl) {
  const response = await page.goto(new URL('/compte', baseUrl).toString(), {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.locator(ACCOUNT_SENTINEL_SELECTOR).first().waitFor({
    state: 'visible',
    timeout: 15000,
  });
  const sentinelVisible = await page.locator(ACCOUNT_SENTINEL_SELECTOR).first().isVisible();
  return assertAuthenticatedCompte({
    baseUrl,
    finalUrl: page.url(),
    status: response?.status() ?? null,
    sentinelVisible,
  });
}

export async function createAuthenticatedStorageState() {
  const baseUrl = getAuditBaseUrl();
  const credentials = getAuditCredentials();
  const storagePath = auditStorageStatePath();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext({
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
    validateStorageState(state);
    fs.mkdirSync(path.dirname(storagePath), { recursive: true });
    fs.writeFileSync(storagePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await context.close();
    return { storagePath, state };
  } finally {
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

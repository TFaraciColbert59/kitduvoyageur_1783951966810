import { chromium } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertAuthenticatedCompte,
  getAuditBaseUrl,
  sanitizeStorageState,
  validateStorageState,
} from './contrast_audit_core.mjs';
import { getAuditCredentials } from './credentials.mjs';
import {
  attachPageDiagnostics,
  assertNoSymlinkComponents,
  defaultAuditStorageStatePath,
  enforcePrivateAuditPermissions,
  ensurePrivateAuditDirectory,
  redactDiagnosticText,
} from './audit_runtime.mjs';

loadEnv({ path: path.resolve('.env.local'), quiet: true });
loadEnv({ path: path.resolve('.env'), quiet: true });

export const ACCOUNT_SENTINEL_SELECTOR = 'a[href="/compte/modifier"]:visible';

export function auditStorageStatePath(env = process.env) {
  return defaultAuditStorageStatePath(env);
}

function assertPrivateStorageStatePath(storagePath) {
  const resolved = path.resolve(storagePath);
  const privateRoot = path.join(os.tmpdir(), 'lkdv-audit');
  const relative = path.relative(privateRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Chemin storageState hors zone privée autorisée');
  }
  return resolved;
}

export function loadAuditStorageState(storagePath = auditStorageStatePath(), baseUrl) {
  storagePath = assertPrivateStorageStatePath(storagePath);
  ensurePrivateAuditDirectory(path.dirname(storagePath));
  assertNoSymlinkComponents(path.dirname(storagePath));
  if (!fs.existsSync(storagePath)) {
    throw new Error('storageState absent');
  }
  const stateStat = fs.lstatSync(storagePath);
  if (stateStat.isSymbolicLink() || !stateStat.isFile()) throw new Error('storageState non régulier refusé');
  enforcePrivateAuditPermissions(storagePath, 0o600);
  let state;
  let descriptor;
  try {
    descriptor = fs.openSync(storagePath, 'r');
    const descriptorStat = fs.fstatSync(descriptor);
    if (!descriptorStat.isFile()) throw new Error('storageState non régulier refusé');
    state = JSON.parse(fs.readFileSync(descriptor, 'utf8'));
  } catch {
    throw new Error('storageState invalide');
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  validateStorageState(state, Date.now(), baseUrl);
  return sanitizeStorageState(state, baseUrl);
}

export async function fillVisibleLoginForm(page, credentials, baseUrl) {
  const form = page.locator('form:visible:has(input#email:visible):has(input#password:visible)');
  if (await form.count() !== 1) {
    throw new Error('Formulaire de connexion audit attendu unique');
  }
  if (new URL(page.url()).origin !== new URL(baseUrl).origin) {
    throw new Error('Page de connexion hors origine refusée');
  }
  const method = (await form.getAttribute('method') || '').trim().toLowerCase();
  if (method !== 'post') {
    throw new Error('Formulaire de connexion sans POST refusé');
  }
  const action = await form.evaluate((node) => node.action);
  const actionUrl = new URL(action, page.url());
  if (actionUrl.origin !== new URL(baseUrl).origin || actionUrl.pathname !== '/connexion') {
    throw new Error('Action de connexion hors origine refusée');
  }
  const submitControls = form.locator('button[type="submit"], input[type="submit"]');
  if (await submitControls.count() !== 1) {
    throw new Error('Bouton de connexion audit attendu unique');
  }
  for (let index = 0; index < await submitControls.count(); index += 1) {
    const submitAction = await submitControls.nth(index).getAttribute('formaction');
    if (!submitAction) continue;
    const submitUrl = new URL(submitAction, page.url());
    if (submitUrl.origin !== new URL(baseUrl).origin || submitUrl.pathname !== '/connexion') {
      throw new Error('Action de soumission hors origine refusée');
    }
  }
  await form.locator('input#email:visible').fill(credentials.email);
  await form.locator('input#password:visible').fill(credentials.password);
  return form;
}

export async function installCredentialEgressGuard(page, credentials, baseUrl) {
  const origin = new URL(baseUrl).origin;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  let supabaseOrigin = '';
  try {
    const parsed = supabaseUrl ? new URL(supabaseUrl) : null;
    const hostname = parsed?.hostname.toLowerCase() || '';
    const normalizedHostname = hostname.replace(/^\[|\]$/g, '');
    const loopback = normalizedHostname === 'localhost' || normalizedHostname === '127.0.0.1' || normalizedHostname === '::1';
    if (parsed && (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && loopback))) {
      supabaseOrigin = parsed.origin;
    }
  } catch {
    supabaseOrigin = '';
  }
  const encodedCredentials = [credentials.email, credentials.password]
    .flatMap((value) => {
      const encoded = encodeURIComponent(value);
      const base64 = Buffer.from(value, 'utf8').toString('base64');
      return [
        value,
        encoded,
        encoded.replace(/%20/g, '+'),
        base64,
        base64.replace(/=+$/, ''),
        base64.replace(/\+/g, '-').replace(/\//g, '_'),
        JSON.stringify(value).slice(1, -1),
      ];
    });
  const unescapeUnicode = (text) => text.replace(/\\u([0-9a-f]{4})/gi, (_match, hex) => (
    String.fromCharCode(parseInt(hex, 16))
  ));
  const containsCredential = (text) => {
    if (!text) return false;
    let decoded = text;
    try {
      decoded = decodeURIComponent(text);
    } catch {
      decoded = text;
    }
    return encodedCredentials.some((value) => (
      text.includes(value)
      || decoded.includes(value)
      || unescapeUnicode(text).includes(value)
      || unescapeUnicode(decoded).includes(value)
    ));
  };
  const carriesCredentials = (request) => {
    const rawBody = request.postData() || '';
    let body = rawBody;
    try {
      body = decodeURIComponent(rawBody.replace(/\+/g, ' '));
    } catch {
      body = rawBody;
    }
    let headers = '';
    try {
      headers = JSON.stringify(request.headers?.() || {});
    } catch {
      headers = '';
    }
    return containsCredential([
      request.url(),
      rawBody,
      body,
      unescapeUnicode(rawBody),
      unescapeUnicode(body),
      unescapeUnicode(headers),
    ].join(' '));
  };
  const isAllowed = (request) => {
    try {
      const requestUrl = new URL(request.url());
      if (request.method() !== 'POST') return false;
      if (requestUrl.origin === origin && requestUrl.pathname === '/connexion') return true;
      return requestUrl.origin === supabaseOrigin
        && requestUrl.pathname === '/auth/v1/token'
        && requestUrl.searchParams.get('grant_type') === 'password';
    } catch {
      return false;
    }
  };
  const context = typeof page.context === 'function' ? page.context() : null;
  if (!context || typeof context.route !== 'function') {
    throw new Error('Credential egress guard: interception de contexte indisponible');
  }
  const onRoute = async (route) => {
    const request = route.request();
    if (carriesCredentials(request) && !isAllowed(request)) {
      await route.abort('blockedbyclient').catch(() => {});
      return;
    }
    await route.continue().catch(() => {});
  };
  await context.route('**/*', onRoute);
  if (typeof context.routeWebSocket === 'function') {
    await context.routeWebSocket(
      (webSocketUrl) => containsCredential(String(webSocketUrl?.href ?? webSocketUrl ?? '')),
      async (webSocketRoute) => {
        await webSocketRoute.close({ code: 1008 }).catch(() => {});
      },
    );
  }
  return async () => {
    try {
      await context.unroute('**/*', onRoute).catch(() => {});
    } catch {
      await Promise.resolve();
    }
  };
}

export async function verifyCompteSession(page, baseUrl, options = {}) {
  if (options.sessionMode === true
    && (typeof options.expectedEmail !== 'string' || options.expectedEmail.trim() === '')) {
    throw new Error('AUDIT_EMAIL requis pour attester la session');
  }
  if (options.sessionMode === true) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    let validSupabaseUrl = false;
    try {
      const parsed = new URL(supabaseUrl || '');
      const hostname = parsed.hostname.toLowerCase();
      const normalizedHostname = hostname.replace(/^\[|\]$/g, '');
    const loopback = normalizedHostname === 'localhost' || normalizedHostname === '127.0.0.1' || normalizedHostname === '::1';
      validSupabaseUrl = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && loopback);
    } catch {}
    if (!validSupabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_URL requis pour attester la session');
  }
  const diagnostics = attachPageDiagnostics(page, {
    baseUrl,
    sessionMode: options.sessionMode === true,
    expectedAuthEmail: options.expectedEmail,
  });
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
     let result = assertAuthenticatedCompte({
       baseUrl,
       finalUrl: page.url(),
       status: response?.status() ?? null,
       sentinelVisible,
     });
     if (options.sessionMode === true) {
       const adminResponse = await page.goto(new URL('/admin', baseUrl).toString(), {
         waitUntil: 'domcontentloaded',
         timeout: 30000,
       });
         if (typeof page.waitForTimeout === 'function') await page.waitForTimeout(600);
         await diagnostics.waitForAuthVerification();
         const adminUrl = new URL(page.url());
        if (adminUrl.username || adminUrl.password
          || adminUrl.origin !== new URL(baseUrl).origin
          || adminUrl.pathname !== '/'
          || adminUrl.search
          || adminUrl.hash
          || !adminResponse
          || !Number.isInteger(adminResponse.status())
          || adminResponse.status() < 200
          || adminResponse.status() >= 300) {
         throw new Error('Attestation serveur refusée');
       }
       if (!diagnostics.authVerified) throw new Error('Réponse Auth serveur non vérifiée');
       const finalResponse = await page.goto(new URL('/compte', baseUrl).toString(), {
         waitUntil: 'domcontentloaded',
         timeout: 30000,
       });
       await page.locator(ACCOUNT_SENTINEL_SELECTOR).first().waitFor({
         state: 'visible',
         timeout: 15000,
       });
       result = assertAuthenticatedCompte({
         baseUrl,
         finalUrl: page.url(),
         status: finalResponse?.status() ?? null,
         sentinelVisible: await page.locator(ACCOUNT_SENTINEL_SELECTOR).first().isVisible(),
       });
     }
     diagnostics.assertClean();
     return result;
  } finally {
    diagnostics.dispose();
  }
}

function writePrivateStorageState(storagePath, state) {
  assertNoSymlinkComponents(path.dirname(storagePath));
  const temporaryPath = `${storagePath}.${randomUUID()}.tmp`;
  const backupPath = `${storagePath}.${randomUUID()}.bak`;
  let published = false;
  let backedUp = false;
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8' });
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    enforcePrivateAuditPermissions(temporaryPath, 0o600);
    if (fs.existsSync(storagePath)) {
      fs.renameSync(storagePath, backupPath);
      backedUp = true;
    }
    fs.renameSync(temporaryPath, storagePath);
    published = true;
    enforcePrivateAuditPermissions(storagePath, 0o600);
    if (backedUp) fs.unlinkSync(backupPath);
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch {}
    }
    try {
      fs.unlinkSync(temporaryPath);
    } catch {}
    if (published) {
      try {
        fs.unlinkSync(storagePath);
      } catch {}
    }
    let restored = !backedUp;
    if (backedUp && !fs.existsSync(storagePath)) {
      try {
        fs.renameSync(backupPath, storagePath);
        restored = true;
      } catch {}
    }
    if (restored) {
      try { fs.unlinkSync(backupPath); } catch {}
    }
    throw error;
  }
}

export async function createAuthenticatedStorageState() {
  const baseUrl = getAuditBaseUrl();
  const credentials = getAuditCredentials();
  const storagePath = auditStorageStatePath();
  const browser = await chromium.launch({
     headless: true,

  });

  let context;
  let removeCredentialGuard = null;
  try {
    context = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 390, height: 844 },
      colorScheme: 'dark',
      deviceScaleFactor: 1,
       locale: 'fr-FR',
       serviceWorkers: 'block',
     });
    const page = await context.newPage();
     removeCredentialGuard = await installCredentialEgressGuard(page, credentials, baseUrl);
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
     const loginForm = await fillVisibleLoginForm(page, credentials, baseUrl);
     await Promise.all([
       page.waitForURL((url) => {
         const parsed = new URL(url);
         return parsed.origin === new URL(baseUrl).origin && parsed.pathname === '/compte';
       }, { timeout: 30000 }),
       loginForm.locator('button[type="submit"]:visible').click(),
     ]);
     await verifyCompteSession(page, baseUrl, { sessionMode: true, expectedEmail: credentials.email });
     const state = await context.storageState();
     validateStorageState(state, Date.now(), baseUrl);
     const sanitizedState = sanitizeStorageState(state, baseUrl);
     ensurePrivateAuditDirectory(path.dirname(storagePath));
     writePrivateStorageState(storagePath, sanitizedState);
     return { storagePath, state: sanitizedState };
  } finally {
    if (removeCredentialGuard) await removeCredentialGuard();
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
    console.error(redactDiagnosticText(error.message));
    process.exit(1);
  });
}

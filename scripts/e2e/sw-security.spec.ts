import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';

/**
 * SEC-1 — Isolation inter-comptes du service worker (RGPD, bloquant CI).
 * Garantit qu'aucun HTML authentifié ni aucune réponse API privée n'est
 * jamais mis en cache par public/sw.js, et que le message
 * LKDV_PURGE_PRIVATE vide les caches privés (déconnexion / changement de compte).
 * CI hermétique (Supabase absent) : skip propre — le test reste bloquant
 * partout où les identifiants de démo existent.
 */

const PRIVATE_PATH_RE = /^\/(hub|compte|voyages|equipages|communaute|messagerie|carnets|groupes)(\/|$)/;
const PRIVATE_API_RE = /^\/api\/(hub|voyages|trips|materiel|equipages|carnets)(\/|$)/;

const SW_RUNTIME = 'lkdv-runtime-lkdv-v4';
const SW_STATIC = 'lkdv-static-lkdv-v4';

function demoAuthAvailable(): boolean {
  if (process.env.NEXT_PUBLIC_CI === 'true') return false;
  try {
    const raw = fs.readFileSync(fs.existsSync('.env.local') ? '.env.local' : '.env', 'utf8');
    return Boolean(
      raw.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim() &&
        raw.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim()
    );
  } catch {
    return false;
  }
}

const HAS_AUTH = demoAuthAvailable();

async function loginDemo(page: Page, context: BrowserContext) {
  // Environnement headless : neutraliser les faux états hors-ligne émis par
  // Chromium (navigator.onLine ET événements offline) qui bloquent le signIn.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
    window.addEventListener('offline', (e) => e.stopImmediatePropagation(), true);
  });
  await page.goto('/connexion');
  await page.locator('input:visible#email').first().fill('demo@lkdv.app');
  await page.locator('input:visible#password').first().fill('DemoPass!2026');
  await page.locator('main form:visible').first().locator('button[type="submit"]').click();
  let tries = 0;
  while (tries < 12) {
    const cookies = await context.cookies();
    if (cookies.some((c) => c.name.includes('auth-token'))) break;
    await page.waitForTimeout(500);
    tries++;
  }
  await page.waitForTimeout(800);
}

async function swReady(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), { timeout: 15_000 });
}

async function privateCacheEntries(page: Page): Promise<string[]> {
  return page.evaluate(
    ([runtime, statique]) =>
      (async () => {
        const bad: string[] = [];
        for (const name of await caches.keys()) {
          if (name !== runtime && name !== statique) continue;
          const cache = await caches.open(name);
          for (const req of await cache.keys()) {
            bad.push(`${name} ${req.method} ${req.url}`);
          }
        }
        return bad;
      })(),
    [SW_RUNTIME, SW_STATIC]
  );
}

test.describe('SEC-1 — Service Worker : jamais de données cross-comptes', () => {
  test('pré-cache installation : aucune route applicative authentifiée', async ({ page }) => {
    test.skip(!HAS_AUTH, 'CI hermétique : Supabase indisponible');
    await swReady(page);
    const entries = await privateCacheEntries(page);
    const bad = entries.filter((e) => PRIVATE_PATH_RE.test(new URL(e.split(' ')[2]).pathname));
    expect(bad, `Entrées privées dans les caches SW : ${bad.join(' | ')}`).toEqual([]);
  });

  test('visite /hub authentifiée : le SW ne met rien en cache pour ce HTML ni pour les API privées', async ({ page }) => {
    test.skip(!HAS_AUTH, 'CI hermétique : Supabase indisponible');
    await swReady(page);
    await loginDemo(page, page.context());
    await page.goto('/hub', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const entries = await privateCacheEntries(page);
    const badNav = entries.filter((e) => {
      const url = new URL(e.split(' ')[2]);
      return PRIVATE_PATH_RE.test(url.pathname) || e.includes('navigate');
    });
    const badApi = entries.filter((e) => {
      const url = new URL(e.split(' ')[2]);
      return /^\/api\/(hub|voyages|trips|materiel|equipages|carnets)/.test(url.pathname);
    });
    expect(badNav, `HTML authentifié en cache : ${badNav.join(' | ')}`).toEqual([]);
    expect(badApi, `API privée en cache : ${badApi.join(' | ')}`).toEqual([]);
  });

  test('LKDV_PURGE_PRIVATE vide les caches privés ; hors-ligne sur /hub ne révèle aucune donnée', async ({ page }) => {
    test.skip(!HAS_AUTH, 'CI hermétique : Supabase indisponible');
    await swReady(page);
    await loginDemo(page, page.context());
    await page.goto('/hub', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await page.evaluate(() => navigator.serviceWorker.controller?.postMessage({ type: 'LKDV_PURGE_PRIVATE' }));
    await page.waitForTimeout(1200);

    const after = await privateCacheEntries(page);
    expect(after.filter((e) => e.startsWith(SW_RUNTIME)), 'runtime non purgé').toEqual([]);

    await page.context().setOffline(true);
    try {
      await page.goto('/hub', { waitUntil: 'domcontentloaded' });
      const body = (await page.locator('body').innerText().catch(() => '')) as string;
      expect(body).not.toContain('demo@lkdv.app');
      expect(body).not.toContain('Aperçu de l\'équipement');
    } finally {
      await page.context().setOffline(false);
    }
  });
});

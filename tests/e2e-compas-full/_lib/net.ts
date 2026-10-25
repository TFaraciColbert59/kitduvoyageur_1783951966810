import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Page, Response } from '@playwright/test';
import { BASE_URL, RUN_DIR, VERCEL_SHARE } from './env';

/** Erreurs de transport qui méritent une reprise (jamais une erreur de l'application). */
const TRANSIENT = /net::ERR_(CONNECTION|NETWORK|TIMED_OUT|NAME_NOT_RESOLVED|EMPTY_RESPONSE|HTTP2|SOCKET|INTERNET_DISCONNECTED|ABORTED)|Timeout \d+ms exceeded|ECONNRESET|socket hang up/i;
const RETRY_STATUS = new Set([502, 503, 504]);

/** Journal des reprises : une reprise n'est jamais silencieuse. */
export function logRetry(what: string, attempt: number, error: string) {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  fs.appendFileSync(
    path.join(RUN_DIR, 'reprises.jsonl'),
    JSON.stringify({ at: new Date().toISOString(), what, attempt, error: error.slice(0, 300) }) + '\n'
  );
}

/**
 * Navigation avec reprise sur échec RÉSEAU (coupure, délai, 502/503/504 de la
 * plateforme) : 3 essais espacés. Une page de l'application en erreur (500,
 * écran d'erreur) n'est PAS reprise : c'est un résultat.
 */
export async function gotoRetry(page: Page, url: string, attempts = 3): Promise<Response | null> {
  let last: unknown;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      if (res && RETRY_STATUS.has(res.status()) && i < attempts) {
        logRetry(`goto ${url}`, i, `HTTP ${res.status()}`);
        await page.waitForTimeout(5_000 * i);
        continue;
      }
      return res;
    } catch (e) {
      last = e;
      const msg = String(e);
      if (!TRANSIENT.test(msg) || i === attempts) throw e;
      logRetry(`goto ${url}`, i, msg);
      await page.waitForTimeout(5_000 * i);
    }
  }
  throw last;
}

/** Aperçu protégé : ouvrir le lien partagé pose le cookie d'accès pour tout le contexte. */
export async function ensureShareCookie(page: Page) {
  if (!VERCEL_SHARE) return;
  const cookies = await page.context().cookies(BASE_URL);
  if (cookies.some((c) => c.name.startsWith('_vercel'))) return;
  await gotoRetry(page, `${BASE_URL}/?_vercel_share=${encodeURIComponent(VERCEL_SHARE)}`);
}

/** Le bandeau de cookies est refusé d'avance, comme le ferait la personne (aucun traceur). */
export async function refuseCookies(context: BrowserContext) {
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'lkdv_cookie_consent',
        JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' })
      );
    } catch {
      /* stockage bloqué : le bandeau restera, refusé à la main par les aides */
    }
  });
}

/** Hors ligne : coupe le réseau du contexte (le service worker et le cache restent). */
export async function setOffline(context: BrowserContext, offline: boolean) {
  await context.setOffline(offline);
}

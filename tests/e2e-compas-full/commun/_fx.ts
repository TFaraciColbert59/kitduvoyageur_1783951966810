import fs from 'node:fs';
import path from 'node:path';
import { expect, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test';
import { test as base, type Account, type PreparedTrip } from '../_lib/fixtures';
import { Cover, makeRecorder } from '../_lib/coverage';
import { launchPreparation, login, openStart, prepPanel } from '../_lib/compas';
import { PHONE } from '../_lib/device';
import { BASE_URL, LEDGER_DIR, REFERENCE_REQUEST, RUN_DIR } from '../_lib/env';
import { ensureShareCookie, gotoRetry, refuseCookies } from '../_lib/net';
import { installCoverageProbe } from '../_lib/probe';

/**
 * Aides LOCALES du lot « Départ, Commun, Verdict » (rien ici ne remplace `_lib/`).
 *
 *  - `account` est surchargé : le site n'accepte que 5 « Essayer sans compte » par heure et par
 *    adresse, et trois lots tournent depuis la même adresse. L'espace d'essai de ce lot est donc
 *    GARDÉ d'un passage à l'autre (`proof/compas-full/dcv-state/account.json`, non versionné) ; il
 *    n'est recréé que si la session ne vaut plus. Le site le garde 7 jours sans visite.
 *  - `preparedTrip` est surchargé pour la même raison : si l'espace contient déjà son aventure
 *    préparée, on la réutilise au lieu de relancer une préparation (IA, Overpass, file partagée).
 *  - `anonymousPage` : une page SANS session (Compas vide « non connecté »), avec la sonde et
 *    l'enregistrement de couverture.
 *  - `coverInert` : crédite un contrôle volontairement inerte (bouton désactivé) par son effet
 *    « rien ne bouge », jamais par un clic effectif.
 */
const STATE_DIR = path.join(LEDGER_DIR, 'dcv-state');
const STATE_FILE = path.join(STATE_DIR, 'account.json');
const KEY = 'essai-dcv-reutilise';

async function sessionStillValid(browser: Browser): Promise<boolean> {
  if (!fs.existsSync(STATE_FILE)) return false;
  const context = await browser.newContext({ ...PHONE, storageState: STATE_FILE });
  try {
    await refuseCookies(context);
    const page = await context.newPage();
    await ensureShareCookie(page);
    await gotoRetry(page, `${BASE_URL}/compas?nouvelle=1`);
    const ok = !new URL(page.url()).pathname.startsWith('/connexion');
    if (ok) await context.storageState({ path: STATE_FILE });
    return ok;
  } catch {
    return false;
  } finally {
    await context.close();
  }
}

export const test = base.extend<{ anonymousPage: { page: Page; cover: Cover; context: BrowserContext } }, { account: Account; preparedTrip: PreparedTrip }>({
  account: [
    async ({ browser }, provide) => {
      fs.mkdirSync(STATE_DIR, { recursive: true });
      if (await sessionStillValid(browser)) return provide({ mode: 'essai', statePath: STATE_FILE, key: KEY });
      // Chaque essai refusé compte aussi dans la limite du site : après un refus, on ne réessaie pas
      // avant 40 minutes (sauf DCV_LOGIN=1), et les scénarios sans session continuent de tourner.
      const marker = path.join(STATE_DIR, 'dernier-refus.txt');
      const lastFail = fs.existsSync(marker) ? Number(fs.readFileSync(marker, 'utf8')) : 0;
      if (process.env.DCV_LOGIN === '1' || Date.now() - lastFail > 40 * 60_000) {
        const context = await browser.newContext(PHONE);
        try {
          await refuseCookies(context);
          const page = await context.newPage();
          await login(page);
          await context.storageState({ path: STATE_FILE });
          await context.close();
          return provide({ mode: 'essai', statePath: STATE_FILE, key: KEY });
        } catch (e) {
          fs.writeFileSync(marker, String(Date.now()));
          fs.appendFileSync(path.join(RUN_DIR, 'reprises.jsonl'), JSON.stringify({ at: new Date().toISOString(), what: 'essai sans compte refusé (limite par adresse ?)', error: String(e).slice(0, 200) }) + '\n');
          await context.close().catch(() => undefined);
        }
      }
      // Pas de session : état vide. Les scénarios qui en exigent une échouent, dit clairement.
      const empty = path.join(STATE_DIR, 'vide.json');
      fs.writeFileSync(empty, JSON.stringify({ cookies: [], origins: [] }));
      await provide({ mode: 'essai', statePath: empty, key: KEY });
    },
    { scope: 'worker', timeout: 240_000 },
  ],

  preparedTrip: [
    async ({ browser, account }, provide) => {
      const context = await browser.newContext({ ...PHONE, storageState: account.statePath });
      await refuseCookies(context);
      const page = await context.newPage();
      await ensureShareCookie(page);
      await gotoRetry(page, `${BASE_URL}/compas`);
      const hasTrip = (await page.locator('.compas .cp-steps .cp-step').count()) > 0 && (await page.locator('.compas--start').count()) === 0;
      if (hasTrip) {
        await context.storageState({ path: account.statePath });
        await context.close();
        await provide({ outcome: 'prête', seconds: 0, text: 'aventure déjà préparée (espace gardé)', waitedMs: 0, ok: true });
        return;
      }
      await openStart(page);
      const res = await launchPreparation(page, REFERENCE_REQUEST, account.key);
      if (res.outcome !== 'prête') await page.screenshot({ path: path.join(RUN_DIR, `preparation-de-reference-${res.outcome}.png`) });
      expect(res.outcome, `préparation de référence : ${res.text}`).toBe('prête');
      await prepPanel(page).getByRole('button', { name: 'Voir mon aventure' }).click();
      await expect(prepPanel(page)).toBeHidden();
      await context.storageState({ path: account.statePath });
      await context.close();
      await provide({ ...res, ok: true });
    },
    { scope: 'worker', timeout: 15 * 60_000 },
  ],

  anonymousPage: async ({ browser }, provide, testInfo: TestInfo) => {
    // `browser.newContext` reprend la session du test (storageState) : on la vide explicitement.
    const context = await browser.newContext({ ...PHONE, storageState: { cookies: [], origins: [] } });
    await refuseCookies(context);
    await context.addInitScript(installCoverageProbe);
    const write = makeRecorder(testInfo.workerIndex);
    const scenario = testInfo.titlePath.slice(1).join(' › ');
    await context.exposeBinding('__cpCoverageRecord', (_src, r: Record<string, unknown>) => {
      write({ ...r, verified: false, scenario } as never);
    });
    const page = await context.newPage();
    await ensureShareCookie(page);
    await provide({ page, cover: new Cover(page, scenario, write), context });
    await context.close();
  },
});

export { expect };

/**
 * Crédite un contrôle INERTE (désactivé à dessein) : on tente le geste (clic forcé) et l'assertion
 * décrit ce qui doit rester vrai. Le rapport rattache l'enregistrement par la description du contrôle.
 */
export function coverInert(cover: Cover, target: Locator, effet: string, verify: () => Promise<unknown>, opts?: { control?: string }) {
  return (cover as unknown as { run: (...a: unknown[]) => Promise<void> })['run'](
    target,
    'clic (inerte)',
    effet,
    async () => {
      await target.click({ force: true, timeout: 5_000 }).catch(() => undefined);
    },
    verify,
    opts ?? {}
  );
}

import fs from 'node:fs';
import path from 'node:path';
import { test as base, expect, type Browser } from '@playwright/test';
import { Cover, makeRecorder } from './coverage';
import { capture, launchPreparation, login, openStart, prepPanel, type LoginMode, type PrepOutcome } from './compas';
import { PHONE } from './device';
import { REFERENCE_REQUEST, RUN_DIR } from './env';
import { refuseCookies } from './net';
import { installCoverageProbe } from './probe';

/**
 * Fixtures du banc :
 *  - `account` (worker) : UN espace d'essai propre par worker (« Essayer sans
 *    compte »), ou le compte démo partagé si l'essai est fermé. Sa session est
 *    réenregistrée après chaque test (jetons renouvelés : pas de session perdue) ;
 *  - `page` / `context` : téléphone 393 × 852, cookies refusés, sonde de
 *    couverture installée, enregistrement passif de chaque activation ;
 *  - `cover` : les aides qui CRÉDITENT un contrôle (activation + assertion) ;
 *  - `preparedTrip` (worker) : une aventure réellement préparée (phrase de
 *    référence), créée une fois par worker et réutilisée (file des préparations) ;
 *  - `freshAccount` : un AUTRE espace d'essai neuf (compte sans voyage), pour un test ;
 *  - `goOffline` : couper / rétablir le réseau du contexte.
 */
export type Account = { mode: LoginMode; statePath: string; key: string };
export type PreparedTrip = PrepOutcome & { ok: boolean };

const RUN_ID = path.basename(RUN_DIR);

async function newAccount(browser: Browser, label: string): Promise<Account> {
  const statePath = path.join(RUN_DIR, 'state', `${label}.json`);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const context = await browser.newContext(PHONE);
  await refuseCookies(context);
  const page = await context.newPage();
  const mode = await login(page);
  await context.storageState({ path: statePath });
  await context.close();
  // La limite de préparations est par personne : le compte démo est UNE personne pour tous.
  return { mode, statePath, key: mode === 'demo' ? 'demo' : `essai-${RUN_ID}-${label}` };
}

type WorkerFx = { account: Account; preparedTrip: PreparedTrip };
type TestFx = { cover: Cover; freshAccount: Account; goOffline: (on: boolean) => Promise<void> };

export const test = base.extend<TestFx, WorkerFx>({
  account: [
    async ({ browser }, provide, workerInfo) => {
      await provide(await newAccount(browser, `w${workerInfo.workerIndex}`));
    },
    { scope: 'worker', timeout: 180_000 },
  ],

  storageState: async ({ account }, provide) => {
    await provide(account.statePath);
  },

  context: async ({ context, account }, provide, testInfo) => {
    const write = makeRecorder(testInfo.workerIndex);
    const scenario = testInfo.titlePath.slice(1).join(' › ');
    await refuseCookies(context);
    await context.addInitScript(installCoverageProbe);
    await context.exposeBinding('__cpCoverageRecord', (_src, r: Record<string, unknown>) => {
      write({ ...r, verified: false, scenario } as never);
    });
    await provide(context);
    // Jetons renouvelés pendant le test : la session suivante du worker les reprend.
    await context.storageState({ path: account.statePath }).catch(() => undefined);
  },

  cover: async ({ page }, provide, testInfo) => {
    const write = makeRecorder(testInfo.workerIndex);
    await provide(new Cover(page, testInfo.titlePath.slice(1).join(' › '), write));
  },

  freshAccount: async ({ browser }, provide, testInfo) => {
    await provide(await newAccount(browser, `w${testInfo.workerIndex}-neuf-${testInfo.testId.slice(0, 8)}`));
  },

  goOffline: async ({ context }, provide) => {
    await provide((on: boolean) => context.setOffline(on));
    await context.setOffline(false);
  },

  preparedTrip: [
    async ({ browser, account }, provide) => {
      // Contexte de préparation hors couverture : ce n'est pas un scénario, c'est un état.
      const context = await browser.newContext({ ...PHONE, storageState: account.statePath });
      await refuseCookies(context);
      const page = await context.newPage();
      await openStart(page);
      const res = await launchPreparation(page, REFERENCE_REQUEST, account.key);
      if (res.outcome !== 'prête') {
        await page.screenshot({ path: path.join(RUN_DIR, `preparation-de-reference-${res.outcome}.png`) });
      }
      expect(res.outcome, `préparation de référence : ${res.text}`).toBe('prête');
      await prepPanel(page).getByRole('button', { name: 'Voir mon aventure' }).click();
      await expect(prepPanel(page)).toBeHidden();
      await context.storageState({ path: account.statePath });
      await context.close();
      await provide({ ...res, ok: true });
    },
    { scope: 'worker', timeout: 15 * 60_000 },
  ],
});

export { expect, capture };

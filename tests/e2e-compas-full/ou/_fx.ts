import fs from 'node:fs';
import path from 'node:path';
import { expect, test as base } from '../_lib/fixtures';
import { launchPreparation, login, openStart, prepPanel, type LoginMode } from '../_lib/compas';
import { PHONE } from '../_lib/device';
import { REFERENCE_REQUEST, RUN_DIR } from '../_lib/env';
import { refuseCookies } from '../_lib/net';

/**
 * Fixtures locales des lots Où et Résa. Même contrat que `_lib/fixtures.ts`, avec UNE
 * différence de mise en place, jamais de contenu : `COMPAS_REUSE_STATE=<fichier d'état>`
 * réutilise un espace d'essai déjà créé (et déjà préparé) au lieu d'en ouvrir un —
 * l'ouverture d'un essai sans compte est limitée par connexion (« réessaie dans une
 * heure »), ce qui bloquerait les rejeux de mise au point. Sans cette variable, le
 * comportement est celui du banc : un espace neuf et une vraie préparation.
 */
const REUSE = process.env.COMPAS_REUSE_STATE ?? '';
const RUN_ID = path.basename(RUN_DIR);

type Acct = { mode: LoginMode; statePath: string; key: string };

export const test = base.extend<object, { account: Acct; preparedTrip: Awaited<ReturnType<typeof prepare>> }>({
  account: [
    async ({ browser }, provide, workerInfo) => {
      if (REUSE) {
        const statePath = path.join(RUN_DIR, 'state', `w${workerInfo.workerIndex}-reuse.json`);
        fs.mkdirSync(path.dirname(statePath), { recursive: true });
        fs.copyFileSync(REUSE, statePath);
        await provide({ mode: 'essai', statePath, key: `reuse-${RUN_ID}` });
        return;
      }
      const statePath = path.join(RUN_DIR, 'state', `w${workerInfo.workerIndex}.json`);
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      const context = await browser.newContext(PHONE);
      await refuseCookies(context);
      const page = await context.newPage();
      const mode = await login(page);
      await context.storageState({ path: statePath });
      await context.close();
      await provide({ mode, statePath, key: mode === 'demo' ? 'demo' : `essai-${RUN_ID}-w${workerInfo.workerIndex}` });
    },
    { scope: 'worker', timeout: 180_000 },
  ],

  preparedTrip: [
    async ({ browser, account }, provide) => {
      await provide(await prepare(browser, account));
    },
    { scope: 'worker', timeout: 15 * 60_000 },
  ],
});

async function prepare(browser: import('@playwright/test').Browser, account: Acct) {
  if (REUSE) return { outcome: 'prête' as const, seconds: 0, text: 'espace réutilisé (COMPAS_REUSE_STATE)', waitedMs: 0, ok: true };
  const context = await browser.newContext({ ...PHONE, storageState: account.statePath });
  await refuseCookies(context);
  const page = await context.newPage();
  await openStart(page);
  const res = await launchPreparation(page, REFERENCE_REQUEST, account.key);
  expect(res.outcome, `préparation de référence : ${res.text}`).toBe('prête');
  await prepPanel(page).getByRole('button', { name: 'Voir mon aventure' }).click();
  await expect(prepPanel(page)).toBeHidden();
  await context.storageState({ path: account.statePath });
  await context.close();
  return { ...res, ok: true };
}

export { expect };
export { capture } from '../_lib/fixtures';

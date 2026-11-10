import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import { freezeClock, installCommunityV2Mock, waitForHydration } from '../e2e/communaute-v2.fixtures';
import { CARNET_ID } from './scenarios/common';

/**
 * Porte Phase 8 — axe-core sur la fiche carnet v2 : participant, visiteur, mode
 * modification, chaque tiroir, le tiroir « Carnet », la feuille d'édition.
 * Critère : 0 violation `critical` ou `serious`, contraste de couleur compris
 * (FIDELITY_AXE_CONTRAST=0 le retire quand le verre fausse l'échantillonnage).
 *
 * Serveur : celui du banc de fidélité (build fixtures, `FIDELITY_REUSE`/port).
 *   FIDELITY_PORT=4129 npx playwright test --config=tests/fidelity/fidelity.config.ts a11y-carnet
 */

const CONTRAST = process.env.FIDELITY_AXE_CONTRAST !== '0';
const CONSENT = JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' });

interface Blocking {
  id: string;
  impact: string | null;
  help: string;
  targets: string[];
}

async function scan(page: Page): Promise<Blocking[]> {
  const builder = new AxeBuilder({ page });
  if (!CONTRAST) builder.disableRules(['color-contrast']);
  const results = await builder.analyze();
  return results.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({
      id: v.id,
      impact: v.impact ?? null,
      help: v.help,
      targets: v.nodes.slice(0, 4).map((n) => n.target.join(' ')),
    }));
}

async function open(page: Page, baseURL: string, session: 'member' | 'anonymous', query = '') {
  await installCommunityV2Mock(page, { role: session, appOrigin: baseURL });
  await page.addInitScript((value) => localStorage.setItem('lkdv_cookie_consent', value), CONSENT);
  await freezeClock(page);
  await page.goto(`/carnets/${CARNET_ID}${query}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.lkdv-title-pill').first().waitFor({ state: 'visible', timeout: 30_000 });
  await waitForHydration(page, '.lkdv-title-pill');
  await page.waitForTimeout(900);
}

const SLOTS = ['fil', 'route', 'sac', 'chiffres', 'equipage'] as const;

test.describe('axe — fiche carnet v2', () => {
  test.setTimeout(180_000);

  test('participant : page, chaque tiroir, tiroir Carnet', async ({ page, baseURL }) => {
    await open(page, baseURL as string, 'member');
    expect(await scan(page), 'page (participant)').toEqual([]);

    for (const slot of SLOTS) {
      await page.goto(`/carnets/${CARNET_ID}?tiroir=${slot}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.lkdv-carnet-drawer').waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForTimeout(900);
      expect(await scan(page), `tiroir ${slot}`).toEqual([]);
    }

    await page.goto(`/carnets/${CARNET_ID}`, { waitUntil: 'domcontentloaded' });
    await page.locator('.lkdv-title-pill').first().waitFor({ state: 'visible', timeout: 30_000 });
    await waitForHydration(page, '.lkdv-title-pill');
    await page.getByRole('button', { name: /Carnet : notifications, partage, paramètres/ }).click();
    await page.getByRole('dialog', { name: 'Paramètres du carnet' }).waitFor();
    for (const tab of ['Notifications', 'Partage', 'Paramètres', 'Gérer']) {
      await page.getByRole('tab', { name: tab }).click();
      await page.waitForTimeout(400);
      expect(await scan(page), `tiroir Carnet › ${tab}`).toEqual([]);
    }
  });

  test('participant : mode modification et feuille d’édition', async ({ page, baseURL }) => {
    await open(page, baseURL as string, 'member', '?modifier=1&tiroir=route');
    await page.locator('.lkdv-carnet-drawer').waitFor({ state: 'visible', timeout: 30_000 });
    expect(await scan(page), 'mode modification, tiroir Route').toEqual([]);
    await page.getByRole('button', { name: 'Ajouter une étape' }).click();
    await page.getByRole('dialog', { name: 'Ajouter une étape' }).waitFor();
    await page.waitForTimeout(500);
    expect(await scan(page), 'feuille « Ajouter une étape »').toEqual([]);
  });

  test('visiteur : page et chaque tiroir', async ({ page, baseURL }) => {
    await open(page, baseURL as string, 'anonymous');
    expect(await scan(page), 'page (visiteur)').toEqual([]);
    for (const slot of SLOTS) {
      await page.goto(`/carnets/${CARNET_ID}?tiroir=${slot}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.lkdv-carnet-drawer').waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForTimeout(900);
      expect(await scan(page), `tiroir ${slot} (visiteur)`).toEqual([]);
    }
  });
});

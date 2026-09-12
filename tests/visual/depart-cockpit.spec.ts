import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { prepareVisualPage } from './_helpers/prepareVisualPage';

/**
 * CHANTIER DÉPART — Task 12 : captures visuelles du cockpit canonique.
 * Un test par projet (desktop-chrome / iphone-14-pro / ipad-portrait) :
 * /hub/depart?id=none&route=375 → testid prêt → capture viewport
 * docs/depart/depart-<project>.png, zéro pageerror.
 *
 * Lancement (le config démarre `npm run dev` sur 4000) :
 *   npx playwright test --config=playwright.visual.config.ts tests/visual/depart-cockpit.spec.ts
 */

const OUT_DIR = path.join('docs', 'depart');
const DEPART_URL = '/hub/depart?id=none&route=375';
const MOBILE_EXPERIENCE_PROJECTS = new Set(['iphone-14-pro', 'ipad-portrait']);

test.describe('DÉPART — captures cockpit (desktop + mobile)', () => {
  test('capture le cockpit du projet courant, zéro pageerror', async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.addInitScript(() => {
      Object.defineProperty(navigator.serviceWorker, 'register', {
        value: () => new Promise<never>(() => {}),
        configurable: true,
      });
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
    });

    await prepareVisualPage(page, DEPART_URL);

    const testId = MOBILE_EXPERIENCE_PROJECTS.has(testInfo.project.name)
      ? 'depart-mobile-experience'
      : 'depart-cockpit';
    // HubShell rend `children` deux fois (slot mobile + desktop) : cibler la copie visible.
    await expect(page.locator(`[data-testid="${testId}"]:visible`).first()).toBeVisible({
      timeout: 45_000,
    });

    // Laisse cartes (tuiles) et météo se stabiliser avant la capture.
    await page.waitForTimeout(2_500);

    mkdirSync(OUT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(OUT_DIR, `depart-${testInfo.project.name}.png`),
      fullPage: false,
    });

    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});

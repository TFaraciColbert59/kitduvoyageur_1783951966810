import { test, expect } from '@playwright/test';

import { SKIP_SERVER, isServerReady } from './communaute-v2.fixtures';

/**
 * tests/e2e/communaute-v2-flag.spec.ts
 *
 * `05-QUALITE-ET-TESTS.md` § 2 scénario 11 — **drapeau à `false`** : les
 * anciens tiroirs v1 s'affichent et fonctionnent (retour arrière sans
 * redéploiement de code, `06-DEPLOIEMENT` § 4.5).
 *
 * Particularité : le drapeau est figé au BUILD (`NEXT_PUBLIC_COMMUNAUTE_V2`).
 * Une même exécution Playwright ne peut donc pas tester les deux valeurs.
 * Cette spec ne s'exécute que sur un build `false` explicite :
 *   NEXT_PUBLIC_COMMUNAUTE_V2=false npm run build && npm run start
 *   LKDV_E2E_V2_FLAG=false npx playwright test tests/e2e/communaute-v2-flag.spec.ts
 * Sinon elle se saute avec une raison explicite (jamais de faux vert).
 */

const FLAG_FALSE = process.env.LKDV_E2E_V2_FLAG === 'false';
const SKIP_FLAG =
  'Build avec la v2 active (ou drapeau non déclaré) : le scénario « drapeau à false » exige ' +
  'un build `NEXT_PUBLIC_COMMUNAUTE_V2=false` et LKDV_E2E_V2_FLAG=false.';

let serverReady = false;

test.beforeAll(async ({ baseURL, request }) => {
  serverReady = await isServerReady(request, baseURL);
});

test.beforeEach(() => {
  test.skip(!serverReady, SKIP_SERVER);
  test.skip(!FLAG_FALSE, SKIP_FLAG);
});

test.describe('Drapeau v2 à false — anciens tiroirs @mobile', () => {
  test('11a. l’ancien tiroir de sections s’ouvre par « Explorer »', async ({ page }) => {
    await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Explorer et rechercher' }).click();

    // v2 non montée…
    await expect(page.getByTestId('communaute-v2-explore')).toHaveCount(0);
    // …et le tiroir v1 reste fonctionnel (dialogue des sections).
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
  });

  test('11b. l’ancien tiroir de création s’ouvre par le +', async ({ page }) => {
    await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Créer dans l’application' }).click();

    await expect(page.getByTestId('communaute-v2-create')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
  });

  test('11c. la barre des stories reste fonctionnelle', async ({ page }) => {
    await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /Publier une story/ }).first()).toBeVisible();
  });
});

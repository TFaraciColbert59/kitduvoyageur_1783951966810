import { test, expect, type Page } from '@playwright/test';

/**
 * CHANTIER DÉPART — Task 12 : e2e du cockpit canonique /hub/depart.
 * Preuves :
 *  - desktop : cockpit en flux visible, nom réel du sentier 375 affiché
 *    (jamais le showcase « Tour du Mont-Blanc — 4j Bivouac »), 5 sections ;
 *  - mobile 390×844 : expérience mobile canonique, cockpit desktop caché, CTA matériel.
 *
 * Note : HubShell rend `children` deux fois (slot mobile + contenu desktop) —
 * les testids existent donc en double dans le DOM, d'où le ciblage `:visible`.
 *
 * Lancement (le config démarre `npm run start` sur 4028, sans PW_BASE_URL) :
 *   npx playwright test --config=playwright.config.ts scripts/e2e/depart-cockpit.spec.ts
 */

const DEPART_URL = '/hub/depart?id=none&route=375';
const TRAIL_NAME = 'Boucle Val de Sambre et Maroilles';
const TMB_SHOWCASE = 'Tour du Mont-Blanc — 4j Bivouac';
const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function neutraliserServiceWorker(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.serviceWorker, 'register', {
      value: () => new Promise<never>(() => {}),
      configurable: true,
    });
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
  });
}

test.describe('DÉPART — cockpit canonique', () => {
  test('desktop : cockpit visible, sentier 375 réel, 5 sections, zéro pageerror', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await neutraliserServiceWorker(page);

    await page.goto(DEPART_URL);

    const cockpit = page.locator('[data-testid="depart-cockpit"]:visible').first();
    await expect(cockpit).toBeVisible({ timeout: 30_000 });

    // Identité du départ = nom réel du sentier 375, jamais le showcase Mont-Blanc.
    // (Le sélecteur de kit anonyme liste « Tour du Mont-Blanc — 4j Bivouac »
    // comme option : artefact de la liste de kits, pas le titre — cf. concern report.)
    await expect(cockpit.getByRole('heading', { name: TRAIL_NAME, exact: true })).toBeVisible();
    await expect(cockpit.getByRole('heading', { name: TMB_SHOWCASE, exact: true })).toHaveCount(0);
    await expect(cockpit.getByText(TRAIL_NAME).first()).toBeVisible();

    await expect(cockpit.getByText('Départ', { exact: true }).first()).toBeVisible();
    await expect(cockpit.getByText('Terrain', { exact: true }).first()).toBeVisible();
    await expect(cockpit.getByText('Sac', { exact: true }).first()).toBeVisible();
    await expect(cockpit.locator('section[aria-label="Équipement"]')).toBeVisible();
    await expect(cockpit.getByText('Équipe', { exact: true }).first()).toBeVisible();

    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });

  test('mobile : 390×844 → expérience mobile, cockpit desktop caché, CTA matériel', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await neutraliserServiceWorker(page);

    await page.goto(DEPART_URL);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.reload();

    const mobile = page.locator('[data-testid="depart-mobile-experience"]:visible').first();
    await expect(mobile).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid="depart-cockpit"]:visible')).toHaveCount(0);
    await expect(mobile.getByRole('button', { name: 'Gérer le matériel' })).toBeVisible();
    await expect(mobile.getByText(TRAIL_NAME).first()).toBeVisible();

    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});

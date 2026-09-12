import { test, expect } from '@playwright/test';

/**
 * CHANTIER ATLAS — Phase 3 (palier local)
 * - preuve d'annulation des requêtes viewport obsolètes (AbortController + debounce) ;
 * - réutilisation du panneau de détail existant (CTA « Préparer le matériel » → /hub/depart).
 *
 * Lancement : PW_BASE_URL=http://localhost:4000 npx playwright test --config=playwright.config.ts scripts/e2e/atlas-explorer.spec.ts
 */

test.use({
  geolocation: { latitude: 50.784, longitude: 2.666 },
  permissions: ['geolocation'],
});

async function waitForUnifiedMap(page: import('@playwright/test').Page) {
  await page.goto('/explorer?atlas=1');
  const mapRoot = page.getByTestId('unified-explorer-map');
  await expect(mapRoot).toHaveAttribute('data-atlas-ready', 'true', { timeout: 45_000 });
  await expect(mapRoot.locator('canvas.maplibregl-canvas')).toBeVisible();
}

test.describe('ATLAS — explorateur unifié, palier local', () => {
  test('pan/zoom annule les requêtes viewport obsolètes', async ({ page }) => {
    // Réponses volontairement lentes : garantit des requêtes en vol à superséder.
    await page.route('**/api/hikes*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue().catch(() => {});
    });

    const aborted: string[] = [];
    page.on('requestfailed', (request) => {
      if (request.url().includes('/api/hikes')) {
        aborted.push(request.failure()?.errorText ?? '');
      }
    });

    await waitForUnifiedMap(page);
    await page.waitForTimeout(2_500); // laisse le premier fetch viewport partir

    const zoomIn = page.getByRole('button', { name: 'Zoom avant' });
    const zoomOut = page.getByRole('button', { name: 'Zoom arrière' });
    for (let index = 0; index < 3; index += 1) {
      await zoomIn.click();
      await page.waitForTimeout(350);
      await zoomOut.click();
      await page.waitForTimeout(350);
    }
    await page.waitForTimeout(1_500);

    console.log('REQUÊTES ANNULÉES:', JSON.stringify(aborted));
    expect(
      aborted.some((errorText) => errorText.includes('ERR_ABORTED')),
      `aucune requête /api/hikes annulée — requestfailed=${JSON.stringify(aborted)}`
    ).toBeTruthy();
  });

  test('la sélection réutilise le panneau de détail existant (CTA /hub/depart)', async ({ page }) => {
    await waitForUnifiedMap(page);

    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible({ timeout: 30_000 });
    await firstCard.click();

    // Carte compacte desktop → CTA réel /hub/depart.
    await expect(page.getByRole('button', { name: 'Préparer' }).first()).toBeVisible({ timeout: 15_000 });

    // Fiche complète (panneau existant réutilisé, logique intacte).
    await page.getByRole('button', { name: 'Voir la fiche complète' }).click();
    await expect(page.getByText('Préparer le matériel').first()).toBeVisible({ timeout: 15_000 });
  });
});

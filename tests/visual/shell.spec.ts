import { test, expect } from '@playwright/test';
import { prepareVisualPage, expectVisualSnapshot } from './_helpers/prepareVisualPage';

/**
 * Tests de régression visuelle — Shell Mobile LKDV
 * Viewport : iPhone 14 Pro (430 × 932)
 *
 * Première exécution : génère les baselines (état actuel, bugs compris).
 * Les phases suivantes du plan feront converger les screenshots vers un état propre.
 */

// Routes publiques ne nécessitant pas d'authentification
const PUBLIC_ROUTES = [
  { path: '/pays',              name: 'pays-globe' },
  { path: '/communaute',        name: 'communaute' },
  { path: '/carte-interactive', name: 'carte-interactive' },
];

// Tests de screenshot pour chaque route publique
for (const route of PUBLIC_ROUTES) {
  test(`shell visuel — ${route.name} (iPhone 14 Pro)`, async ({ page }) => {
    await prepareVisualPage(page, route.path);

    // Vérifier qu'il y a du contenu (pas d'écran blanc total)
    const elementCount = await page.locator('body *').count();
    expect(elementCount).toBeGreaterThan(10);

    await expectVisualSnapshot(page, `${route.name}.png`);
  });
}

// Test dédié : le spinner DOIT rester visible pendant le chargement du globe.
// Il n'utilise PAS le protocole helper (prepareVisualPage attend la disparition
// des spinners) : la route est interceptée et ralentie AVANT navigation, et la
// capture fige volontairement l'état de chargement.
test('pays — skeleton visible pendant le chargement du globe (réseau ralenti)', async ({ page }) => {
  // Intercepter le GeoJSON local et le retarder de 2 secondes
  await page.route('/data/countries-110m.geojson', async route => {
    await new Promise<void>(resolve => setTimeout(resolve, 2_000));
    await route.continue();
  });

  await page.goto('/pays');

  // Le spinner DOIT être visible immédiatement
  await expect(page.locator('[class*="animate-spin"]').first()).toBeVisible({ timeout: 5_000 });

  // Screenshot du skeleton (avec le spinner présent)
  await expect(page).toHaveScreenshot('pays-skeleton-loading.png', {
    threshold: 0.03,
  });
});

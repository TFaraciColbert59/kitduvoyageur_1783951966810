import { test, expect, Page } from '@playwright/test';

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

async function waitForShellReady(page: Page): Promise<void> {
  // Attendre la stabilisation du réseau
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {
    // Certaines pages ont des WebSocket persistants — on continue
  });
  // Attendre la disparition des spinners de chargement
  await page.waitForSelector('[class*="animate-spin"]', {
    state: 'hidden',
    timeout: 15_000,
  }).catch(() => {
    // Pas de spinner = déjà chargé
  });
  // Pause pour les transitions CSS/Framer Motion
  await page.waitForTimeout(800);
}

// Tests de screenshot pour chaque route publique
for (const route of PUBLIC_ROUTES) {
  test(`shell visuel — ${route.name} (iPhone 14 Pro)`, async ({ page }) => {
    await page.goto(route.path);
    await waitForShellReady(page);

    // Vérifier qu'il y a du contenu (pas d'écran blanc total)
    const elementCount = await page.locator('body *').count();
    expect(elementCount).toBeGreaterThan(10);

    await expect(page).toHaveScreenshot(`${route.name}.png`, {
      fullPage: false,
      threshold: 0.01,
      maxDiffPixels: 500,
    });
  });
}

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

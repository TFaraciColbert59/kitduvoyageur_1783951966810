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

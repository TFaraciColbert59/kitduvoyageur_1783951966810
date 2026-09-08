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
// des spinners) : la route est interceptée et suspendue AVANT navigation, et la
// capture fige volontairement l'état de chargement.
//
// ⚠ Deux pièges traités ici :
// 1. Le service worker (public/sw.js, scope /) contourne page.route et peut
//    servir le GeoJSON depuis son cache — register() est neutralisé (l'option
//    serviceWorkers:'block' casse l'hydratation de l'app).
// 2. Un pattern de route sans wildcard ne matche jamais l'URL absolue.
test.describe('pays — chargement ralenti (sans service worker)', () => {
  test('pays — skeleton visible pendant le chargement du globe (réseau ralenti)', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.serviceWorker, 'register', {
        value: () => new Promise<never>(() => {}),
        configurable: true,
      });
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });

    // Requête GeoJSON suspendue (jamais de réponse) : l'état « Chargement des
    // pays… » dure jusqu'à l'abort sécurité de 4 s de CountryGlobe.
    await page.route('**/data/countries-110m.geojson', async () => {
      await new Promise<void>(() => {});
    });

    await page.goto('/pays');

    // Le spinner DOIT être visible pendant le chargement — 15 s pour couvrir
    // le chargement du chunk dynamique du globe (three.js, cache froid).
    await expect(page.locator('[class*="animate-spin"]').first()).toBeVisible({ timeout: 15_000 });

    // Masquage persistant (feuille de style) du canvas WebGL et de la vidéo :
    // globe.gl peut recréer son canvas après un display:none ponctuel, et la
    // première frame décodée de la vidéo varie d'un run à l'autre. Le fond
    // statique .page-background sert de référence — hors périmètre du test.
    await page.addStyleTag({
      content: 'canvas, video.earth-bg-video { display: none !important; }',
    });

    // Screenshot du skeleton (avec le spinner présent) — maxDiffPixels couvre
    // l'anti-aliasing du bord du spinner (1-3 px constatés entre runs).
    await expect(page).toHaveScreenshot('pays-skeleton-loading.png', {
      threshold: 0.03,
      maxDiffPixels: 20,
    });
  });
});

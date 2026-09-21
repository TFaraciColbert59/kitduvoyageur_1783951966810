import { test, expect } from '@playwright/test';

/**
 * CHANTIER ATLAS — Phase 3 (palier local)
 * - preuve d'annulation des requêtes viewport obsolètes (AbortController + debounce) ;
 * - réutilisation du panneau de détail existant (CTA « Préparer le matériel » → /preparer-sentier/[id]).
 *
 * Lancement : PW_BASE_URL=http://localhost:4000 npx playwright test --config=playwright.config.ts scripts/e2e/atlas-explorer.spec.ts
 */

test.use({
  geolocation: { latitude: 50.784, longitude: 2.666 },
  permissions: ['geolocation'],
  // Le service worker de prod intercepte les fetch (stale-while-revalidate) et
  // empêche page.route de simuler la latence → les preuves d'abort deviennent
  // inobservables. On le neutralise pour que la spec tourne identiquement en
  // dev (SW absent) et en prod.
  serviceWorkers: 'block',
});

async function waitForUnifiedMap(page: import('@playwright/test').Page) {
  await page.goto('/explorer?atlas=1');
  const mapRoot = page.getByTestId('unified-explorer-map');
  await expect(mapRoot).toHaveAttribute('data-atlas-ready', 'true', { timeout: 45_000 });
  await expect(mapRoot.locator('canvas.maplibregl-canvas')).toBeVisible();

  // L'explorateur ouvre sur le globe : on plonge explicitement vers la vue locale.
  const dive = page.getByRole('button', { name: 'Explorer ma zone (vue locale)' });
  if (await dive.isVisible().catch(() => false)) {
    await dive.click();
    await page.waitForTimeout(4_000);
  }
}

test.describe('ATLAS — explorateur unifié, palier local', () => {
  // Même protocole consentement que voyage.spec.ts / a11y : sans lui, la
  // bannière cookies recouvre les CTA bas de page et intercepte les clics.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'lkdv_cookie_consent',
        JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' })
      );
    });
  });

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

  test('la sélection réutilise le panneau de détail existant (CTA /preparer-sentier)', async ({ page }) => {
    await waitForUnifiedMap(page);

    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible({ timeout: 30_000 });
    await firstCard.click();

    // Carte compacte desktop → CTA réel /preparer-sentier/[id].
    await expect(page.getByRole('link', { name: 'Préparer' }).first()).toBeVisible({ timeout: 15_000 });

    // Fiche complète (panneau existant réutilisé, logique intacte).
    await page.getByRole('button', { name: 'Voir la fiche complète' }).click();
    await expect(page.getByText('Préparer le matériel').first()).toBeVisible({ timeout: 15_000 });
  });

  test('le CTA Préparer navigue réellement vers la route serveur /preparer-sentier', async ({ page }) => {
    await waitForUnifiedMap(page);

    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible({ timeout: 30_000 });
    await firstCard.click();

    const prepare = page.getByRole('link', { name: 'Préparer' }).first();
    await expect(prepare).toBeVisible({ timeout: 15_000 });
    await prepare.click();

    // Garde anti-régression « le bouton Préparer ne fait rien » : la navigation
    // DOIT aboutir sur la route serveur ; visiteur anonyme → connexion avec
    // reprise `?next=`, jamais une page morte.
    await page.waitForURL(/\/connexion\?next=%2Fpreparer-sentier%2F/, { timeout: 20_000 });
    expect(new URL(page.url()).searchParams.get('next')).toMatch(/^\/preparer-sentier\/\d+$/);
  });
});

import { test, expect, type Page } from '@playwright/test';

/**
 * CHANTIER PRÉPARER — Task 5 : les CTAs « Préparer » mènent à la route serveur
 * `/preparer-sentier/[id]` (GET à effet de bord, jamais prefetché) et un
 * visiteur anonyme est renvoyé vers la connexion avec reprise (`?next=`).
 *
 * Preuves :
 *  - (a) mobile 390×844 : tap sur « Préparer » du carrousel de l'explorateur →
 *        URL `/connexion?next=%2Fpreparer-sentier%2F<id>` ;
 *  - (b) `/preparer-sentier/999999999` → page honnête « Données réelles
 *        indisponibles pour ce sentier », zéro pageerror.
 *
 * Lancement (le config démarre `npm run start` sur 4028, build requis) :
 *   npx playwright test --config=playwright.config.ts scripts/e2e/preparer-sentier.spec.ts
 */

test.use({
  geolocation: { latitude: 50.784, longitude: 2.666 },
  permissions: ['geolocation'],
  serviceWorkers: 'block',
});

const MOBILE_VIEWPORT = { width: 390, height: 844 };

/** Le SW ne doit pas s'enregistrer : en prod, l'échec du register génère un
 * pageerror parasite (« reading 'scope' ») sans rapport avec la route testée. */
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

test('mobile : le CTA Préparer du carrousel redirige l’anonyme vers la connexion avec reprise', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await neutraliserServiceWorker(page);

  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/explorer?atlas=1');

  const mapRoot = page.getByTestId('unified-explorer-map');
  await expect(mapRoot).toHaveAttribute('data-atlas-ready', 'true', { timeout: 45_000 });

  // La bannière cookies recouvre les contrôles bas d'écran en mobile : on la
  // ferme avant d'utiliser la plongée vers la vue locale.
  const refuseCookies = page.getByRole('button', { name: 'Refuser' });
  if (await refuseCookies.isVisible().catch(() => false)) {
    await refuseCookies.click();
  }

  // Géolocalisation accordée → la plongée locale charge les sentiers réels du
  // viewport (le carrousel recouvre ensuite la zone centrale : on clique avant).
  const dive = page.getByRole('button', { name: 'Explorer ma zone (vue locale)' });
  await expect(dive).toBeVisible({ timeout: 15_000 });
  await dive.click();

  const prepare = page.getByRole('link', { name: 'Préparer' }).first();
  await expect(prepare).toBeVisible({ timeout: 30_000 });
  await expect(prepare).toHaveAttribute('href', /^\/preparer-sentier\/\d+$/);
  await prepare.click();

  // Sentier réel + anonyme → la route serveur redirige vers la connexion en
  // conservant la reprise ; aucun prefetch n'a déclenché la préparation.
  await page.waitForURL(/\/connexion\?next=%2Fpreparer-sentier%2F/, { timeout: 30_000 });
  const next = new URL(page.url()).searchParams.get('next');
  expect(next).toMatch(/^\/preparer-sentier\/\d+$/);

  expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
});

test('sentier inconnu : page honnête, aucune donnée inventée, zéro pageerror', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await neutraliserServiceWorker(page);

  await page.goto('/preparer-sentier/999999999');

  await expect(
    page.getByRole('heading', { name: 'Données réelles indisponibles pour ce sentier' })
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Ce sentier n'existe pas dans nos données réelles.")).toBeVisible();

  expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
});

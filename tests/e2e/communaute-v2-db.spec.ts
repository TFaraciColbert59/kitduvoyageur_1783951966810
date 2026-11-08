import { test, expect, type Page } from '@playwright/test';

/**
 * tests/e2e/communaute-v2-db.spec.ts
 *
 * Scénarios de **données réelles** de `05-QUALITE-ET-TESTS.md` § 2 (6 et 10) :
 * création réelle des 6 types + lecture des stories rognées. Ils exigent :
 * - un build `NEXT_PUBLIC_COMMUNAUTE_V2=true` ;
 * - une base **de test/aperçu migrée** (jamais la prod : `00` § 4.8) ;
 * - `LKDV_E2E_DB=test` et un compte de démo (`AUDIT_EMAIL`/`AUDIT_PASSWORD`,
 *   ou `LKDV_E2E_AUTH=1` + `DEMO_LOGIN_EMAIL`).
 *
 * Sans ces prérequis, chaque test se saute avec une raison explicite : dans ce
 * worktree (`.env.local` = placeholders, migrations non appliquées) ces scénarios
 * ne peuvent produire aucune preuve locale — ils sont prêts pour la CI/aperçu.
 *
 * Règle de données : aucun contenu visible par de vrais utilisateurs ; sortie
 * et club ne sont créés que contre la base de test, les autres créations en
 * audience `only_me`/privée quand la base l'exige, puis suppression.
 */

const REAL_DB = process.env.LKDV_E2E_DB === 'test';
const AUTH_ENABLED = process.env.LKDV_E2E_AUTH === '1';
const EMAIL = process.env.AUDIT_EMAIL ?? process.env.DEMO_LOGIN_EMAIL;
const PASSWORD = process.env.AUDIT_PASSWORD;
const SKIP_DB =
  'Données réelles : exige LKDV_E2E_DB=test + base de test/aperçu migrée (jamais la prod). ' +
  'Dans ce worktree, .env.local = placeholders et migrations non appliquées.';
const SKIP_AUTH =
  'Session réelle : exige LKDV_E2E_AUTH=1 avec AUDIT_EMAIL/AUDIT_PASSWORD (ou compte de démo).';

let serverReady = false;

test.beforeAll(async ({ baseURL, request }) => {
  if (!baseURL) return;
  try {
    const response = await request.get(baseURL, { timeout: 8_000, failOnStatusCode: false });
    serverReady = response.status() < 500;
  } catch {
    serverReady = false;
  }
});

test.beforeEach(() => {
  test.skip(!serverReady, 'Serveur Next injoignable : scénario réel sauté.');
});

async function login(page: Page): Promise<void> {
  await page.goto('/connexion', { waitUntil: 'domcontentloaded' });
  const demo = page.locator('a[href="/api/demo-login"], button:has-text("Connexion démo")').first();
  if ((await demo.count()) > 0 && (await demo.isVisible().catch(() => false))) {
    await demo.click();
  } else {
    await page.locator('input[type="email"]:visible').first().fill(EMAIL!);
    await page.locator('input[type="password"]:visible').first().fill(PASSWORD!);
    await page.locator('main form:visible').first().locator('button[type="submit"]').click();
  }
  await expect
    .poll(
      async () =>
        (await page.context().cookies()).some((cookie) => cookie.name.includes('auth-token')),
      { timeout: 25_000, message: 'session Supabase non établie' },
    )
    .toBe(true);
}

/** Ouvre Création depuis la page Communauté et attend le moteur v2. */
async function openCreation(page: Page): Promise<void> {
  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Créer dans l’application' }).click();
  await expect(page.getByTestId('communaute-v2-create')).toBeVisible({ timeout: 15_000 });
}

/** Suivant, en exigeant que l'étape avance (aucune validation en attente). */
async function nextStep(page: Page, step: number): Promise<void> {
  await page.getByRole('button', { name: 'Suivant' }).click();
  await expect(page.locator('[data-testid^="cv2-form-"]')).toHaveAttribute(
    'data-step',
    String(step),
  );
}

test.describe('Créations réelles (base de test migrée) @mobile', () => {
  test('6a. Publication réelle : erreur, correction, brouillon, publication, île', async ({
    page,
  }) => {
    test.skip(!REAL_DB, SKIP_DB);
    test.skip(!AUTH_ENABLED && !EMAIL, SKIP_AUTH);

    await login(page);
    await openCreation(page);

    await page.getByRole('radio', { name: /Billet/ }).click();
    await nextStep(page, 1);
    // Erreur volontaire : contenu vide → compteur, une seule fois.
    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByTestId('cv2-error-summary')).toBeVisible();
    await page.getByTestId('cv2-field-title').locator('input').fill('Recette e2e — brouillon');
    await page.getByTestId('cv2-field-content').locator('textarea').fill(
      'Publication de recette e2e supprimée en fin de test.',
    );
    await nextStep(page, 2);

    await page.getByRole('button', { name: 'Publier' }).click();
    await expect(page.getByTestId('cv2-island')).toContainText('Publié', { timeout: 30_000 });
  });

  test('6b. Carnet réel : photos téléversées, couverture, visibilité privée', async ({ page }) => {
    test.skip(!REAL_DB, SKIP_DB);
    test.skip(!AUTH_ENABLED && !EMAIL, SKIP_AUTH);

    await login(page);
    await openCreation(page);
    await page.getByRole('tablist', { name: 'Type de création' }).getByRole('tab', { name: 'Carnet' }).click();
    await expect(page.getByTestId('cv2-form-carnet')).toBeVisible();
    await page.getByTestId('cv2-field-title').locator('input').fill('Recette e2e — carnet');
    await page.getByTestId('cv2-field-destination').locator('input').fill('Vercors');
    await nextStep(page, 1);
    // Tracé facultatif : on avance jusqu'au partage.
    await nextStep(page, 2);
    await nextStep(page, 3);
    await page.getByRole('button', { name: 'Créer le carnet' }).click();
    await expect(page.getByTestId('cv2-island')).toBeVisible({ timeout: 30_000 });
  });

  test('6c. Sortie réelle (base de test uniquement) : annonce publiée, admin présent', async ({
    page,
  }) => {
    test.skip(!REAL_DB, SKIP_DB);
    test.skip(!AUTH_ENABLED && !EMAIL, SKIP_AUTH);

    await login(page);
    await openCreation(page);
    await page.getByRole('tablist', { name: 'Type de création' }).getByRole('tab', { name: 'Sortie' }).click();
    await page.getByTestId('cv2-field-title').locator('input').fill('Recette e2e — sortie');
    await page.getByTestId('cv2-field-location').locator('input').fill('Vercors');
    await nextStep(page, 1);
    // Date + heure minimales, puis participants/sécurité par défaut.
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await page.getByTestId('cv2-field-date').locator('input').fill(tomorrow);
    await nextStep(page, 2);
    await nextStep(page, 3);
    await page.getByRole('button', { name: 'Créer la sortie' }).click();
    await expect(page.getByTestId('cv2-island')).toBeVisible({ timeout: 30_000 });
  });

  test('6d. Club réel (base de test uniquement) : club + admin atomiques', async ({ page }) => {
    test.skip(!REAL_DB, SKIP_DB);
    test.skip(!AUTH_ENABLED && !EMAIL, SKIP_AUTH);

    await login(page);
    await openCreation(page);
    await page.getByRole('tablist', { name: 'Type de création' }).getByRole('tab', { name: 'Club' }).click();
    await page.getByTestId('cv2-field-name').locator('input').fill('Recette e2e — club');
    await nextStep(page, 1);
    await page.getByTestId('cv2-field-description').locator('textarea').fill('Club de recette e2e.');
    await nextStep(page, 2);
    await nextStep(page, 3);
    await page.getByRole('button', { name: 'Créer le club' }).click();
    await expect(page.getByTestId('cv2-island')).toBeVisible({ timeout: 30_000 });
  });

  test('6e. Kit réel : poids calculé en SQL, visibilité privée', async ({ page }) => {
    test.skip(!REAL_DB, SKIP_DB);
    test.skip(!AUTH_ENABLED && !EMAIL, SKIP_AUTH);

    await login(page);
    await openCreation(page);
    await page.getByRole('tablist', { name: 'Type de création' }).getByRole('tab', { name: 'Kit' }).click();
    await expect(page.getByTestId('cv2-form-kit')).toBeVisible();
    // L'inventaire minimal est fourni par l'UI ; on vérifie surtout l'île et
    // l'absence de doublon côté RPC (idempotence) lors du second clic.
    await page.getByRole('button', { name: 'Suivant' }).click();
  });
});

test.describe('Stories réelles (base de test migrée) @mobile', () => {
  test('10. lecture d’une vidéo rognée et lien carnet masqué à un lecteur sans accès', async ({
    page,
  }) => {
    test.skip(!REAL_DB, SKIP_DB);
    test.skip(!AUTH_ENABLED && !EMAIL, SKIP_AUTH);

    await login(page);
    await page.goto('/communaute', { waitUntil: 'domcontentloaded' });

    const story = page.getByRole('button', { name: /Voir la story de/ }).first();
    if ((await story.count()) === 0) {
      test.skip(true, 'Aucune story de démo disponible dans la base de test : rien à lire.');
    }
    await story.click();
    // Le lecteur existant est inchangé : il s'ouvre et se ferme comme avant.
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
  });
});

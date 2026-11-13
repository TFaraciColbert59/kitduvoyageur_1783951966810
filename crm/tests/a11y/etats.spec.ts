import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { signIn } from '../support/flows';
import { appText, expectNoAxeViolations, expectTapTargets, expectTokenContrast, expectVisibleFocus } from './support';

/**
 * Couche 5 — les états (vide, chargement, erreur, déjà décidé, mode solo) et les
 * écrans publics. Un écran accessible seulement quand il est rempli ne l'est pas :
 * les états sont testés séparément.
 */

test.describe('Accessibilité — états et écrans publics', () => {
  test('connexion : formulaire accessible, erreur annoncée, cibles ≥ 44 px', async ({ page }) => {
    await page.goto('/connexion');
    await expectNoAxeViolations(page, 'Connexion');
    await expectTapTargets(page);
    await page.getByRole('button', { name: /se connecter/i }).click();
    // L'erreur est associée au champ et annoncée (aria-live ou role=alert).
    await expect(page.locator('[role="alert"], [aria-live="polite"]').first()).toBeVisible();
    await expectNoAxeViolations(page, 'Connexion — erreur');
  });

  test('double authentification : code lisible au clavier et au lecteur d’écran', async ({ page }) => {
    await page.goto('/double-authentification');
    await expectNoAxeViolations(page, 'Double authentification');
    await expectVisibleFocus(page, 6);
    await expectTapTargets(page);
  });

  test('accès refusé : message clair, aucun détail technique', async ({ page }) => {
    await page.goto('/acces-refuse');
    await expectNoAxeViolations(page, 'Accès refusé');
    const body = await appText(page);
    expect(body).not.toMatch(/42501|pgrst|stack|traceback|jwt/);
  });

  test.describe('états de la file', () => {
    test.beforeEach(async ({ page }) => {
      test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
      await signIn(page);
    });

    for (const state of ['vide', 'erreur', 'chargement']) {
      test(`file — état ${state} accessible`, async ({ page }) => {
        test.skip(true, 'Jeu de données dédié requis pour cet état (voir crm/tests/README.md § 5).');
        await page.goto('/');
        await expectNoAxeViolations(page, `File — ${state}`);
        await expectTapTargets(page);
      });
    }

    test('cas — décision déjà prise : aucun bouton mort, contexte annoncé', async ({ page }) => {
      test.skip(true, 'Cas déjà décidé : exige un cas de test déjà traité (jeu de données), voir README § 5.');
      await page.goto('/cas/post_report/demo-post-already-decided');
      await expectNoAxeViolations(page, 'Cas déjà décidé');
      await expect(page.getByText(/déjà (été )?décid/i).first()).toBeVisible();
    });
  });

  test.describe('mode mobile 390 × 844', () => {
    test.beforeEach(async ({ page }) => {
      test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
      await signIn(page);
    });

    test('SOS — contraste des jetons et cibles tactiles sur téléphone', async ({ page }) => {
      await page.goto('/sos/demo-sos');
      await expectTokenContrast(page);
      await expectTapTargets(page);
      await expectNoAxeViolations(page, 'SOS mobile');
    });
  });
});

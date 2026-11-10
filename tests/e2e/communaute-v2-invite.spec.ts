import { test, expect } from '@playwright/test';

import {
  SKIP_SERVER,
  SKIP_V2_BUILD,
  expectNoWrites,
  freezeClock,
  gotoCommunity,
  installCommunityV2Mock,
  isServerReady,
  openExplorer,
  waitForHydration,
} from './communaute-v2.fixtures';

/**
 * tests/e2e/communaute-v2-invite.spec.ts
 *
 * `05-QUALITE-ET-TESTS.md` § 2 scénario 8 — **invité** (session Supabase
 * anonyme, le vrai « invité » de l'app) : Explorer lisible, toute écriture
 * passe par `requireAuth` (redirection `/connexion`), aucun appel d'écriture.
 *
 * `@ui-mock @mobile` : données mockées, aucun réseau, aucune base.
 */

let serverReady = false;

test.beforeAll(async ({ baseURL, request }) => {
  serverReady = await isServerReady(request, baseURL);
});

test.beforeEach(() => {
  test.skip(!serverReady, SKIP_SERVER);
});

test.describe('Invité — lecture seule et requireAuth @ui-mock @mobile', () => {
  test('8a. Explorer lisible en session anonyme, sans écriture', async ({ page }) => {
    const mock = await installCommunityV2Mock(page, { role: 'anonymous' });
    await freezeClock(page);
    await gotoCommunity(page);
    const opened = await openExplorer(page);
    test.skip(!opened, SKIP_V2_BUILD);

    await expect(page.getByTestId('cv2-tile-carnet').first()).toBeVisible();
    await expect(page.getByTestId('cv2-sort-button')).toBeVisible();
    // FID-077 : marqueur visible « Mode invité · lecture seule ».
    await expect(page.getByTestId('cv2-guest-mode')).toBeVisible();
    await expect(page.getByTestId('cv2-guest-mode')).toContainText(/invité/i);

    // Lecture des 3 volets accessible à l'invité.
    const tabs = page.getByRole('tablist', { name: 'Volets de l’explorateur' });
    await tabs.getByRole('tab', { name: 'Clubs' }).click();
    await expect(page.getByTestId('cv2-tile-club').first()).toBeVisible({ timeout: 15_000 });
    await tabs.getByRole('tab', { name: 'Sorties' }).click();
    await expect(page.getByTestId('cv2-tile-sortie').first()).toBeVisible({ timeout: 15_000 });

    // Lecture seule : aucune RPC/table d'écriture partie, le tiroir reste ouvert.
    expectNoWrites(mock, 'Explorer invité : lecture seule');
    await expect(page.getByTestId('communaute-v2-explore')).toBeVisible();
  });

  test('8b. like en invité → requireAuth (redirection connexion)', async ({ page }) => {
    const mock = await installCommunityV2Mock(page, { role: 'anonymous' });
    await freezeClock(page);
    await gotoCommunity(page);
    const opened = await openExplorer(page);
    test.skip(!opened, SKIP_V2_BUILD);

    await page.getByTestId('cv2-carnet-like').first().click();
    // Maquette (`requireAuth`) : l'île « Se connecter » s'affiche D'ABORD, sans navigation.
    await expect(page.getByText(/Créez un compte pour enregistrer/).first()).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/\/connexion/);
    // Jamais un like appliqué en local.
    expectNoWrites(mock, 'like invité');
    // Le bouton de l'île mène à la connexion. L'invité anonyme est envoyé vers
    // /inscription?next=…, que le middleware redirige vers /connexion?mode=inscription&next=… :
    // on vérifie la destination finale, pas la forme exacte de la query.
    await page.getByRole('button', { name: 'Se connecter' }).first().click();
    await expect(page).toHaveURL(/\/connexion/, { timeout: 15_000 });
    expect(decodeURIComponent(page.url())).toContain('/communaute');
  });

  test('8c. ouvrir Création en invité → requireAuth (le tiroir ne s’ouvre pas)', async ({ page }) => {
    const mock = await installCommunityV2Mock(page, { role: 'anonymous' });
    await freezeClock(page);
    await gotoCommunity(page);

    // On passe par le `+` de la barre des stories : même garde `requireAuth`
    // (anonyme) que le `+` de la barre haute, sans dépendre de l'hydratation du
    // bouton de la barre haute (instabilité RSC constatée sur ce dernier).
    // Qualification 2026-11-08 : le clic natif fonctionne dès que le bouton est
    // hydraté (aucun recouvrement) — l'échec précédent était un artefact de
    // timing de test. On attend explicitement l'hydratation du `+` puis on
    // utilise le clic natif de l'utilisateur.
    await waitForHydration(page, 'button[aria-label="Créer dans l’application"]');
    await page.getByRole('button', { name: 'Créer dans l’application' }).click();
    // `requireAuth` se manifeste par le toast d'invitation ET l'amorce de
    // redirection vers /inscription → /connexion ; la navigation RSC peut être
    // avalée par un préchargement annulé (ERR_ABORTED), donc on accepte l'un ou
    // l'autre comme preuve — le tiroir ne doit jamais s'ouvrir.
    await expect
      .poll(
        async () => {
          if (/\/connexion/.test(page.url())) return 'redirect';
          const toast = page.getByText(/Créez un compte|Connectez-vous pour continuer/).first();
          return (await toast.isVisible().catch(() => false)) ? 'toast' : 'none';
        },
        { timeout: 15_000, message: 'requireAuth non déclenché à l’ouverture de Création' },
      )
      .not.toBe('none');
    await expect(page.getByTestId('communaute-v2-create')).toHaveCount(0);
    await expect(page.getByText(/Créez un compte pour enregistrer/).first()).toBeVisible({ timeout: 10_000 });
    expectNoWrites(mock, 'ouverture Création invitée');
  });

  test('8d. rejoindre un club en invité → requireAuth', async ({ page }) => {
    const mock = await installCommunityV2Mock(page, { role: 'anonymous' });
    await freezeClock(page);
    await gotoCommunity(page);
    const opened = await openExplorer(page);
    test.skip(!opened, SKIP_V2_BUILD);

    await page.getByRole('tablist', { name: 'Volets de l’explorateur' }).getByRole('tab', { name: 'Clubs' }).click();
    // Club ouvert dont le viewer n'est pas membre dans les fixtures : « Cordée
    // des Écrins ». (Les autres ouvrent un aperçu d'action, pas l'adhésion.)
    await page
      .getByTestId('cv2-tile-club')
      .filter({ hasText: 'Cordée des Écrins' })
      .first()
      .getByTestId('cv2-club-join')
      .click();
    await expect(page).toHaveURL(/\/connexion/, { timeout: 15_000 });
    await expect(page.getByText(/Créez un compte pour enregistrer/).first()).toBeVisible({ timeout: 10_000 });
    expectNoWrites(mock, 'adhésion invitée');
  });

  /**
   * FID-077 — « s'inscrire » (4e action d'écriture) : la garde `requireAuth`
   * s'applique aussi à l'inscription à une sortie, sans aucune mutation émise.
   */
  test('8f. s’inscrire à une sortie en invité → requireAuth, aucune inscription', async ({ page }) => {
    const mock = await installCommunityV2Mock(page, { role: 'anonymous' });
    await freezeClock(page);
    await gotoCommunity(page);
    const opened = await openExplorer(page);
    test.skip(!opened, SKIP_V2_BUILD);

    await page.getByRole('tablist', { name: 'Volets de l’explorateur' }).getByRole('tab', { name: 'Sorties' }).click();
    const register = page.getByTestId('cv2-event-register').first();
    await expect(register).toBeVisible({ timeout: 15_000 });
    await register.click();

    await expect(page).toHaveURL(/\/connexion/, { timeout: 15_000 });
    expect(decodeURIComponent(page.url())).toContain('/communaute');
    await expect(page.getByText(/Créez un compte pour enregistrer/).first()).toBeVisible({ timeout: 10_000 });
    // Aucune confirmation locale ni inscription dans le journal.
    await expect(page.locator('.lkdv-island-pill')).toHaveCount(0);
    expectNoWrites(mock, 'inscription invitée');
  });

  test('8e. session absente : le middleware renvoie vers /connexion (contrôle de garde)', async ({
    page,
  }) => {
    await installCommunityV2Mock(page, { role: 'signed-out' });
    await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/connexion/, { timeout: 10_000 });
    await expect(page.getByTestId('communaute-v2-explore')).toHaveCount(0);
  });
});

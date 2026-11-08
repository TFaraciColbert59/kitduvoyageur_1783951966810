import { test, expect } from '@playwright/test';

import {
  SKIP_SERVER,
  SKIP_V2_BUILD,
  freezeClock,
  gotoCommunity,
  installCommunityV2Mock,
  isServerReady,
  openExplorer,
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

    // Lecture seule : aucune RPC d'écriture partie, le tiroir reste ouvert.
    const writes = mock.calls.filter(
      (call) => call.kind === 'rpc' && /^(join_|leave_|create_|review_|cancel_)/.test(call.name),
    );
    expect(writes).toEqual([]);
  });

  test('8b. like en invité → requireAuth (redirection connexion)', async ({ page }) => {
    await installCommunityV2Mock(page, { role: 'anonymous' });
    await freezeClock(page);
    await gotoCommunity(page);
    const opened = await openExplorer(page);
    test.skip(!opened, SKIP_V2_BUILD);

    await page.getByTestId('cv2-carnet-like').first().click();
    // L'invité anonyme est envoyé vers /inscription?next=…, que le middleware
    // redirige vers /connexion?mode=inscription&next=… : on vérifie la destination
    // finale, pas la forme exacte de la query.
    await expect(page).toHaveURL(/\/connexion/, { timeout: 15_000 });
    expect(decodeURIComponent(page.url())).toContain('/communaute');
  });

  test('8c. ouvrir Création en invité → requireAuth (le tiroir ne s’ouvre pas)', async ({ page }) => {
    await installCommunityV2Mock(page, { role: 'anonymous' });
    await freezeClock(page);
    await gotoCommunity(page);

    await page.getByRole('button', { name: 'Créer dans l’application' }).click();
    await expect(page).toHaveURL(/\/connexion/, { timeout: 15_000 });
    await expect(page.getByTestId('communaute-v2-create')).toHaveCount(0);
  });

  test('8d. rejoindre un club en invité → requireAuth', async ({ page }) => {
    await installCommunityV2Mock(page, { role: 'anonymous' });
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

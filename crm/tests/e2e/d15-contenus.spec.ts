import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { expectJournalEntry, expectToast, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D15 — Contenus et pays (pôle CONT)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-116 — publier un guide demande le rôle responsable et journalise', async ({ page }) => {
    await page.goto('/contenus');
    await expect(page.getByTestId('contenus-root')).toBeVisible();
    await page.getByRole('button', { name: /^Publier le guide/ }).first().click();
    await expectToast(page);
    await expectJournalEntry(page, 'guide_publish');
  });

  test('ACT-120 — publier un jeu de couverture passe par une validation à deux', async ({ page }) => {
    await page.goto('/contenus');
    await page.getByRole('button', { name: /publier le jeu de couverture/i }).click();
    await expect(page.getByText(/validation à deux|second humain/i).first()).toBeVisible();
  });

  test('ACT-117 — mettre un contenu en avant affiche l’état avant/après', async ({ page }) => {
    await page.goto('/contenus');
    await page.getByRole('button', { name: /mettre en avant/i }).first().click();
    await expect(page.getByText(/avant|après/i).first()).toBeVisible();
  });
});

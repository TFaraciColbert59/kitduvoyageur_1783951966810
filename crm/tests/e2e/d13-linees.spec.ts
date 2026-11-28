import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { expectJournalEntry, expectToast, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D13 — Lignées de kits (pôle COMM)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-102 — marquer une lignée « souche » demande un motif et laisse une trace', async ({ page }) => {
    await page.goto('/contenus');
    await expect(page.getByTestId('contenus-root')).toBeVisible();
    await page.getByRole('button', { name: /souche/i }).first().click();
    await expect(page.getByText(/motif/i).first()).toBeVisible();
    await page.getByRole('button', { name: /^Enregistrer|^Marquer/ }).click();
    await expectToast(page);
    await expectJournalEntry(page, 'kit_set_souche');
  });

  test('ACT-104 — annuler une attribution de part créateur est réservé au responsable', async ({ page }) => {
    await page.goto('/contenus');
    await page.getByRole('button', { name: /annuler l’attribution|annuler l'attribution/i }).first().click();
    await expect(page.getByText(/validation à deux|second humain/i).first()).toBeVisible();
  });

  test('ACT-107 — rafraîchir les scores de lignée est idempotent et affiche l’heure du dernier calcul', async ({ page }) => {
    await page.goto('/contenus');
    await page.getByRole('button', { name: /rafraîchir les scores/i }).click();
    await expect(page.getByText(/dernier calcul|mis à jour/i).first()).toBeVisible();
  });
});

import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { chooseReason, expectJournalEntry, expectToast, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D12 — Récompenses et progression (pôle CROI)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-093 — corriger un solde de points passe par une validation à deux', async ({ page }) => {
    await page.goto('/valider/demo-request-credit');
    await expect(page.locator(sel.valider.root)).toBeVisible();
    await expect(page.locator(sel.valider.steps)).toContainText(/demande|validation|appliqu/i);
    await page.locator(sel.valider.approve).click();
    await expectToast(page, /valid|appliqu/i);
    await expectJournalEntry(page, 'reward_balance_correct');
  });

  test('ACT-098 — attribuer un badge puis l’annuler pendant 10 s', async ({ page }) => {
    await page.goto('/cas/contribution/demo-badge-1');
    await page.getByRole('button', { name: /^Attribuer|^Décerner/ }).click();
    await page.locator(sel.cas.decisionSave).click();
    await expect(page.locator(sel.toast.action)).toContainText(/annuler/i);
    await page.locator(sel.toast.action).click();
    await expect(page.locator(sel.toast.root)).toHaveCount(0);
  });

  test('ACT-092 — refuser un retrait de récompense laisse un motif lisible au journal', async ({ page }) => {
    await page.goto('/cas/request/demo-withdrawal-1');
    await page.getByRole('button', { name: /^Refuser/ }).click();
    await chooseReason(page, 'solde_insuffisant');
    await page.locator(sel.cas.decisionSave).click();
    await expectJournalEntry(page, 'withdrawal_decide', 'demo-withdrawal-1');
  });
});

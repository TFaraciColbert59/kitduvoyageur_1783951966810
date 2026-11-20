import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { chooseReason, expectJournalEntry, expectToast, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D8 — Avis et questions (pôle CONF)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-061 — masquer un avis produit depuis sa fiche, motif obligatoire', async ({ page }) => {
    await page.goto('/cas/review_report/demo-review-1');
    await expect(page.locator(sel.cas.root)).toBeVisible();
    await page.getByRole('button', { name: /^Masquer l’avis|^Masquer l'avis/ }).click();
    await page.locator(sel.cas.decisionSave).click();
    await expect(page.getByText(/motif/i).first()).toBeVisible();
    await chooseReason(page, 'hors_sujet');
    await page.locator(sel.cas.decisionSave).click();
    await expectToast(page);
    await expectJournalEntry(page, 'product_review_hide', 'demo-review-1');
  });

  test('ACT-064 — modérer une question/réponse laisse une trace horodatée', async ({ page }) => {
    await page.goto('/cas/qa_report/demo-qa-1');
    await expect(page.locator(sel.cas.root)).toBeVisible();
    await page.getByRole('button', { name: /^Masquer/ }).first().click();
    await chooseReason(page, 'publicite');
    await page.locator(sel.cas.decisionSave).click();
    await expectJournalEntry(page, 'qa_moderate', 'demo-qa-1');
  });
});

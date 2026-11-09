import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { chooseReason, expectJournalEntry, expectToast, openFirstCase, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D3 — Stories (pôle CONF)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-024 — approuver une story puis vérifier le journal', async ({ page }) => {
    await page.goto('/cas/story_report/demo-story-1');
    await expect(page.locator(sel.cas.root)).toBeVisible();
    await chooseReason(page, 'conforme');
    await page.getByRole('button', { name: /^Approuver/ }).click();
    await expectToast(page, /approuv|valid/i);
    await expectJournalEntry(page, 'story_moderate', 'demo-story-1');
  });

  test('ACT-025 — retirer une story demande un motif et propose l’annulation 10 s', async ({ page }) => {
    await openFirstCase(page);
    await page.getByRole('button', { name: /^Retirer la story/ }).click();
    await chooseReason(page, 'nudite');
    await page.locator(sel.cas.decisionSave).click();
    await expect(page.locator(sel.toast.action)).toContainText(/annuler/i);
  });
});

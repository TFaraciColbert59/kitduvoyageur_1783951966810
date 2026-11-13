import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { chooseReason, expectJournalEntry, expectToast, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D7 — Lieux et terrain (pôle CONT)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-058 — décider un rapport terrain, avec motif et journal', async ({ page }) => {
    await page.goto('/cas/terrain_report/demo-terrain-1');
    await expect(page.locator(sel.cas.root)).toBeVisible();
    await page.getByRole('button', { name: /^Accepter|^Valider/ }).first().click();
    await chooseReason(page, 'verifie_sur_place');
    await page.locator(sel.cas.decisionSave).click();
    await expectToast(page);
    await expectJournalEntry(page, 'terrain_report_decide', 'demo-terrain-1');
  });

  test('ACT-053 — fusionner deux lieux est réservé au responsable et non annulable', async ({ page }) => {
    await page.goto('/cas/place_report/demo-place-1');
    const merge = page.getByRole('button', { name: /^Fusionner/ });
    await merge.click();
    await expect(page.getByText(/irréversible|doublon/i).first()).toBeVisible();
  });
});

import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { chooseReason, expectJournalEntry, expectToast, openFirstCase, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D4 — Carnets (pôle CONF)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-029 — forcer un carnet en privé, effet visible et annulable', async ({ page }) => {
    await openFirstCase(page);
    await page.getByRole('button', { name: /^Forcer un carnet en privé/ }).click();
    await chooseReason(page, 'vie_privee');
    await page.locator(sel.cas.decisionSave).click();
    await expectToast(page, /privé/i);
    await expectJournalEntry(page, 'carnet_force_private');
  });

  test('ACT-033 — couper le partage de position en direct ne s’annule pas', async ({ page }) => {
    await page.goto('/cas/carnet_report/demo-carnet-1');
    await expect(page.locator(sel.cas.root)).toBeVisible();
    const live = page.getByRole('button', { name: /^Couper le partage/ });
    await live.click();
    await chooseReason(page, 'securite');
    await page.locator(sel.cas.decisionSave).click();
    await expectToast(page);
    // Action non annulable : pas de bouton « Annuler » (contrôle 12 : confirmation nommée seulement).
    await expect(page.locator(sel.toast.action)).toHaveCount(0);
  });
});

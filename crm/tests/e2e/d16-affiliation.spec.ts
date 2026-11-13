import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { expectJournalEntry, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D16 — Affiliation (pôle CROI)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-122 — désactiver un partenaire d’affiliation est annulable 10 s', async ({ page }) => {
    await page.goto('/pole/CROI');
    await expect(page.locator(sel.inbox.root)).toBeVisible();
    await page.getByRole('button', { name: /^Désactiver le partenaire/ }).first().click();
    await page.getByRole('button', { name: /^Enregistrer/ }).click();
    await expect(page.locator(sel.toast.action)).toContainText(/annuler/i);
    await expectJournalEntry(page, 'affiliate_partner_toggle');
  });

  test('ACT-125 — valider une conversion exige deux personnes', async ({ page }) => {
    await page.goto('/valider/demo-request-affiliate');
    await expect(page.locator(sel.valider.root)).toBeVisible();
    await expect(page.locator(sel.valider.fingerprint)).toContainText(/[0-9a-f]{8}/);
  });

  test('ACT-126 — la vue des clics n’expose aucune donnée personnelle', async ({ page }) => {
    await page.goto('/pole/CROI');
    await expect(page.getByText(/clics/i).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/@[a-z0-9-]+\.(com|fr|test)/);
  });
});

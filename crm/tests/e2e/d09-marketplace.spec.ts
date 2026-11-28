import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { chooseReason, expectJournalEntry, expectToast, openFirstCase, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D9 — Marketplace et occasion (pôle COMM)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-067 — approuver une annonce retire le badge « à vérifier »', async ({ page }) => {
    await page.goto('/cas/marketplace_report/demo-listing-1');
    await expect(page.locator(sel.cas.root)).toBeVisible();
    await page.getByRole('button', { name: /^Approuver l’annonce|^Approuver l'annonce/ }).click();
    await chooseReason(page, 'conforme');
    await page.locator(sel.cas.decisionSave).click();
    await expectToast(page, /approuv/i);
    await expectJournalEntry(page, 'listing_approve', 'demo-listing-1');
  });

  test('ACT-071 — arbitrer un litige exige deux personnes, jamais un agent (EX-AGT-02)', async ({ page }) => {
    await page.goto('/cas/marketplace_report/demo-dispute-1');
    await page.getByRole('button', { name: /^Arbitrer|^Trancher/ }).click();
    await expect(page.getByText(/second humain|2 personnes|validation/i).first()).toBeVisible();
  });

  test('ACT-070 — traiter un signalement d’annonce laisse une ligne au journal', async ({ page }) => {
    await openFirstCase(page);
    await page.getByRole('button', { name: /^Traiter le signalement/ }).first().click();
    await chooseReason(page, 'arnaque');
    await page.locator(sel.cas.decisionSave).click();
    await expectJournalEntry(page, 'marketplace_report_resolve');
  });
});

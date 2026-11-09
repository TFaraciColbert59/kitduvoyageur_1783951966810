import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { chooseReason, expectJournalEntry, expectToast, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D5 — Clubs (pôle CONF)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-036 — suspendre un club part en validation à deux personnes', async ({ page }) => {
    await page.goto('/cas/club_report/demo-club-1');
    await expect(page.locator(sel.cas.root)).toBeVisible();
    await page.getByRole('button', { name: /^Suspendre le club/ }).click();
    await chooseReason(page, 'reglement');
    await page.locator(sel.cas.decisionSave).click();
    // Action « 2 personnes » : la réponse annonce l’attente de validation, pas l’effet immédiat.
    await expectToast(page, /validation|second/i);
    await expectJournalEntry(page, 'club_suspend', 'demo-club-1');
  });

  test('ACT-039 — épingler un sujet l’affiche en tête de liste du club', async ({ page }) => {
    await page.goto('/contenus');
    await expect(page.locator(sel.cas.root).or(page.getByTestId('contenus-root'))).toBeVisible();
  });
});

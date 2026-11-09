import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { chooseReason, expectJournalEntry, expectToast, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D6 — Groupes, tribus, messagerie (pôle CONF)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-049 — lire une conversation signalée exige un motif et reste journalisé', async ({ page }) => {
    await page.goto('/cas/group_report/demo-group-1');
    await expect(page.locator(sel.cas.root)).toBeVisible();
    await page.getByRole('button', { name: /lire la conversation/i }).click();
    // Accès motivé et limité à un contenu privé (contrôle 23).
    await expect(page.getByText(/motif/i).first()).toBeVisible();
    await chooseReason(page, 'signalement_grave');
    await page.getByRole('button', { name: /^Ouvrir|^Afficher/ }).click();
    await expect(page.getByText(/accès journalisé|consultation enregistrée/i).first()).toBeVisible();
  });

  test('ACT-048 — supprimer un message avec motif puis vérifier le journal', async ({ page }) => {
    await page.goto('/cas/message_report/demo-message-1');
    await page.getByRole('button', { name: /^Supprimer le message/ }).click();
    await chooseReason(page, 'harcelement');
    await page.locator(sel.cas.decisionSave).click();
    await expectToast(page);
    await expectJournalEntry(page, 'message_remove', 'demo-message-1');
  });
});

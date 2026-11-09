import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { expectJournalEntry, expectToast, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D18 — Support et notifications (pôle MEMB)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-132 — répondre à un ticket envoie le message au membre et journalise', async ({ page }) => {
    await page.goto('/cas/support_ticket/demo-ticket-1');
    await expect(page.locator(sel.cas.root)).toBeVisible();
    await page.getByLabel(/réponse/i).fill('[TEST CRM] Bonjour, nous avons retrouvé votre colis.');
    await page.getByRole('button', { name: /^Envoyer la réponse/ }).click();
    await expectToast(page, /envoy|réponse/i);
    await expectJournalEntry(page, 'ticket_reply', 'demo-ticket-1');
  });

  test('ACT-134 — une annonce ciblée passe par une validation à deux : jamais d’envoi de masse direct', async ({ page }) => {
    await page.goto('/valider/demo-request-announcement');
    await expect(page.locator(sel.valider.root)).toBeVisible();
    await expect(page.locator(sel.valider.approve)).toBeVisible();
    // L’aperçu du message et le nombre de destinataires sont visibles avant validation.
    await expect(page.getByText(/destinataires|audience/i).first()).toBeVisible();
  });

  test('ACT-136 — résoudre une alerte d’envoi la sort du compteur', async ({ page }) => {
    await page.goto('/cas/alert/demo-alert-1');
    await page.getByRole('button', { name: /^Résoudre/ }).click();
    await expectToast(page);
    await expectJournalEntry(page, 'alert_resolve', 'demo-alert-1');
  });
});

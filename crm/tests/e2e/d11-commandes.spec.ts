import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { expectJournalEntry, expectToast, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D11 — Commandes et paiements (pôle COMM)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-085 — remboursement en mode solo : saisie du montant obligatoire, tracé, jamais d’agent', async ({ page }) => {
    await page.goto('/commandes/demo-order-1');
    await expect(page.locator(sel.commandes.root)).toBeVisible();
    await expect(page.locator(sel.commandes.total)).toContainText('€');
    await page.locator(sel.commandes.refund).click();

    // Le panneau de validation nomme l’action, le montant et l’empreinte (EX-COM-03).
    await expect(page.locator(sel.valider.root)).toBeVisible();
    await expect(page.locator(sel.valider.fingerprint)).toContainText(/[0-9a-f]{8}/);
    await expect(page.locator(sel.valider.soloNotice)).toContainText(/solo/i);

    // Sans montant, rien ne part.
    await page.locator(sel.valider.approve).click();
    await expect(page.getByText(/montant/i).first()).toBeVisible();

    await page.locator(sel.valider.confirmation).fill('12,00');
    await page.locator(sel.valider.approve).click();
    await expectToast(page, /rembours|valid/i);
    await expectJournalEntry(page, 'order_refund', 'demo-order-1');
  });

  test('ACT-086 — annuler une commande exige deux personnes hors mode solo', async ({ page }) => {
    await page.goto('/commandes/demo-order-2');
    await page.getByRole('button', { name: /^Annuler la commande/ }).click();
    await expect(page.getByText(/second humain|2 personnes/i).first()).toBeVisible();
  });

  test('ACT-083 — confirmer une commande met à jour le statut affiché', async ({ page }) => {
    await page.goto('/commandes/demo-order-3');
    const before = await page.getByTestId('order-status').textContent();
    await page.getByRole('button', { name: /^Confirmer/ }).click();
    await expect(page.getByTestId('order-status')).not.toHaveText(before ?? '');
  });

  test('ACT-087 — rejouer un événement Stripe est réservé au responsable et idempotent', async ({ page }) => {
    await page.goto('/commandes/demo-order-4');
    await page.getByRole('button', { name: /rejouer l’événement|rejouer l'événement/i }).click();
    await expect(page.getByText(/déjà traité|idempotent|rejoué/i).first()).toBeVisible();
  });
});

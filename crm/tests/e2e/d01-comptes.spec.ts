import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { expectJournalEntry, expectToast, openFirstCase, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D1 — Comptes et identité (pôle MEMB)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-001 — la fiche 360° s’ouvre depuis un cas, données personnelles masquées', async ({ page }) => {
    await openFirstCase(page);
    await page.getByRole('link', { name: /fiche membre|fiche 360/i }).first().click();
    await expect(page).toHaveURL(/\/membres\/[0-9a-f-]+/);
    await expect(page.locator(sel.membres.root)).toBeVisible();
    await expect(page.locator(sel.membres.email)).toContainText('•••');
    // Le dévoilement est une action motivée et journalisée (contrôle 23).
    await expect(page.locator(sel.membres.reveal)).toBeVisible();
  });

  test('ACT-005 — bannir un membre exige deux personnes : la demande part en validation', async ({ page }) => {
    await page.goto('/membres/demo-member-banned');
    const ban = page.getByRole('button', { name: /^Bannir/ });
    await expect(ban).toBeVisible();
    await ban.click();
    // Saisie du pseudo obligatoire avant l’envoi (contrôle 13).
    const confirmation = page.locator(sel.valider.confirmation);
    await expect(page.getByText(/saisissez le pseudo|pseudo du membre/i).first()).toBeVisible();
    await confirmation.fill('mauvais-pseudo');
    await page.locator(sel.valider.approve).click();
    await expect(page.getByText(/pseudo ne correspond pas|vérifiez le pseudo/i).first()).toBeVisible();
    await confirmation.fill('membre-demo');
    await page.locator(sel.valider.approve).click();
    await expectToast(page, /validation|2 personnes|second/i);
    await expectJournalEntry(page, 'member_ban', 'demo-member-banned');
  });

  test('ACT-009 — changer un rôle d’équipe est réservé au super admin et validé à deux', async ({ page }) => {
    await page.goto('/equipe');
    await expect(page.locator(sel.equipe.root)).toBeVisible();
    await page.getByRole('button', { name: /inviter|changer le rôle/i }).first().click();
    await expect(page.locator(sel.valider.root).or(page.getByText(/second humain|validation/i))).toBeVisible();
  });
});

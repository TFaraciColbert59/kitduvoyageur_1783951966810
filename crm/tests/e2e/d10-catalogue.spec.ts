import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { expectJournalEntry, expectToast, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D10 — Catalogue (pôle COMM)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-076 — changer un prix passe par une validation à deux personnes', async ({ page }) => {
    await page.goto('/catalogue');
    await expect(page.locator(sel.catalogue.root)).toBeVisible();
    const row = page.locator(sel.catalogue.row, { hasText: 'sac-demo' }).first();
    await row.getByRole('button', { name: /prix/i }).click();
    await expect(page.getByText(/validation à deux|second humain|2 personnes/i).first()).toBeVisible();
    // Aucun prix n’est écrit sans confirmation explicite (garde-fous § 1.7).
    await expect(page.locator(sel.valider.approve)).toBeVisible();
  });

  test('ACT-077 — un mouvement de stock affiche la quantité avant/après', async ({ page }) => {
    await page.goto('/catalogue');
    const row = page.locator(sel.catalogue.row).first();
    await row.getByRole('button', { name: /stock/i }).click();
    await expect(page.getByText(/avant|après/i).first()).toBeVisible();
  });

  test('ACT-082 — le catalogue d’une seule référence reste consultable en lecture', async ({ page }) => {
    await page.goto('/catalogue?sac-demo');
    await expect(page.locator(sel.catalogue.row)).not.toHaveCount(0);
    await expect(page.locator(sel.catalogue.search)).toBeVisible();
  });

  test('ACT-075 — modifier un produit écrit une ligne de journal avec avant/après', async ({ page }) => {
    await page.goto('/catalogue');
    const row = page.locator(sel.catalogue.row).first();
    await row.getByRole('button', { name: /modifier/i }).click();
    await page.getByLabel(/nom du produit/i).fill('[TEST CRM] sac modifié');
    await page.getByRole('button', { name: /^Enregistrer/ }).click();
    await expectToast(page);
    await expectJournalEntry(page, 'product_upsert');
  });
});

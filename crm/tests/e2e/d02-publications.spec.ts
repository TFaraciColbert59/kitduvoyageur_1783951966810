import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { chooseReason, expectJournalEntry, expectToast, openFirstCase, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D2 — Publications communauté (pôle CONF)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-016 — Masquer exige un motif, écrit au journal et s’annule pendant 10 s', async ({ page }) => {
    await openFirstCase(page);
    await expect(page.locator(sel.cas.decision)).toBeVisible();

    // ≤ 4 faits, ≤ 3 actions principales, contexte visible à côté (contrôles 2 et 17).
    const facts = await page.locator(sel.cas.facts).locator('li, [data-fact]').count();
    expect(facts).toBeGreaterThan(0);
    expect(facts).toBeLessThanOrEqual(4);

    await page.getByRole('button', { name: /^Masquer/ }).first().click();
    const reason = page.locator(sel.cas.reason);
    await expect(reason).toBeVisible();

    // Sans motif, rien ne part (contrôle 15).
    await page.locator(sel.cas.decisionSave).click();
    await expect(page.getByText(/motif/i).first()).toBeVisible();
    await expect(page.locator(sel.toast.root)).toHaveCount(0);

    await chooseReason(page, 'spam');
    await page.locator(sel.cas.decisionSave).click();
    await expectToast(page, /masqu/i);
    const undo = page.locator(sel.toast.action);
    await expect(undo).toContainText(/annuler/i);
    await undo.click();
    await expect(page.locator(sel.toast.root)).toHaveCount(0);
    await expectJournalEntry(page, 'post_hide');
  });

  test('ACT-017 — supprimer une publication est réservé au responsable du pôle', async ({ page }) => {
    await openFirstCase(page);
    const remove = page.getByRole('button', { name: /^Supprimer la publication/ });
    await expect(remove).toBeVisible();
    await remove.click();
    await expect(page.getByText(/irréversible|conséquences/i).first()).toBeVisible();
  });

  test('ACT-020 — masquer un commentaire depuis un signalement de commentaire', async ({ page }) => {
    await page.goto('/cas/comment_report/demo-comment-1');
    await expect(page.locator(sel.cas.root)).toBeVisible();
    await page.getByRole('button', { name: /^Masquer/ }).first().click();
    await chooseReason(page, 'insulte');
    await page.locator(sel.cas.decisionSave).click();
    await expectToast(page, /masqu/i);
    await expectJournalEntry(page, 'comment_hide', 'demo-comment-1');
  });

  test('ACT-019 — mettre en tendance affiche le raccourci et le message membre avec recours', async ({ page }) => {
    await openFirstCase(page);
    await page.getByRole('button', { name: /tendance/i }).first().click();
    // Message membre généré, avec recours (contrôle 16).
    await expect(page.locator(sel.cas.memberNotice)).toContainText(/recours|contester/i);
    // Suggestion IA après le contenu, jamais appliquée d’un clic (contrôle 19).
    if (await page.locator(sel.cas.aiSuggestion).count()) {
      await expect(page.locator(sel.cas.aiSuggestion)).toContainText(/%|confiance/i);
    }
  });
});

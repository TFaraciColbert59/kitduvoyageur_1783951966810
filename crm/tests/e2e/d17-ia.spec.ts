import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { expectJournalEntry, expectToast, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D17 — IA et coûts (pôle PRIA)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-129 — le coupe-circuit IA arrête les agents et le dit sans jargon', async ({ page }) => {
    await page.goto('/ia');
    await expect(page.getByTestId('ia-root')).toBeVisible();
    await page.getByRole('button', { name: /coupe-circuit|arrêter les agents/i }).click();
    await page.getByRole('button', { name: /^Confirmer|^Arrêter/ }).click();
    await expectToast(page, /arrêt|éteint/i);
    await expect(page.locator(sel.equipe.agentCard).first()).toContainText(/arrêté|inactif/i);
    await expectJournalEntry(page, 'ai_kill_switch');
  });

  test('ACT-128 — relever un quota IA demande le motif et reste annulable', async ({ page }) => {
    await page.goto('/ia');
    await page.getByRole('button', { name: /relever le quota/i }).click();
    await expect(page.getByText(/motif/i).first()).toBeVisible();
    await expectJournalEntry(page, 'ai_quota_raise');
  });

  test('ACT-127 — l’usage IA affiche un coût mesuré ou « non renseigné », jamais un chiffre inventé', async ({ page }) => {
    await page.goto('/ia');
    const cost = page.getByTestId('ia-cost');
    await expect(cost).toBeVisible();
    await expect(cost).toHaveText(/€|non renseigné/);
  });
});

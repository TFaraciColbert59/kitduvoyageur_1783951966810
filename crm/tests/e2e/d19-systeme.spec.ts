import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { expectJournalEntry, expectToast, signIn } from '../support/flows';
import { sel } from '../support/selectors';

test.describe('D19 — Système et équipe (pôle TECH)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('ACT-144 — gérer l’équipe est réservé au super admin et validé à deux', async ({ page }) => {
    await page.goto('/equipe');
    await expect(page.locator(sel.equipe.root)).toBeVisible();
    await page.getByRole('button', { name: /inviter|changer le rôle|révoquer/i }).first().click();
    await expect(page.getByText(/validation|second humain|2 personnes/i).first()).toBeVisible();
  });

  test('ACT-137 — basculer un drapeau de fonctionnalité est annulable 10 s', async ({ page }) => {
    await page.goto('/technique');
    await expect(page.getByTestId('technique-root')).toBeVisible();
    await page.getByRole('switch', { name: /drapeau|feature/i }).first().click();
    await expect(page.locator(sel.toast.action)).toContainText(/annuler/i);
  });

  test('ACT-141 — lancer une tâche planifiée à la main affiche son identifiant de reprise', async ({ page }) => {
    await page.goto('/technique');
    await page.getByRole('button', { name: /lancer maintenant/i }).first().click();
    await expect(page.getByText(/request_id|référence|reprise/i).first()).toBeVisible();
    await expectJournalEntry(page, 'cron_run_now');
  });

  test('ACT-139 — les erreurs serveur s’affichent avec cause, solution et « Réessayer »', async ({ page }) => {
    await page.goto('/technique');
    await expect(page.locator(sel.equipe.root).or(page.getByTestId('technique-root'))).toBeVisible();
    await expect(page.getByRole('button', { name: /Réessayer/ })).toBeVisible();
  });
});

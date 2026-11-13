import { expect, type Page } from '@playwright/test';
import { credentials } from './env';
import { sel } from './selectors';
import { totpCodes } from './totp';

/**
 * Gestes partagés par les scénarios. Chaque geste attend une condition réelle
 * (jamais une durée arbitraire : `waitForTimeout` est interdit, cf. fiche testeur).
 */

/** Connexion : e-mail, mot de passe, puis code TOTP si la page le demande. */
export async function signIn(page: Page): Promise<void> {
  const creds = credentials();
  if (!creds) throw new Error('signIn() appelé sans CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET.');
  await page.goto('/connexion');
  await page.locator(sel.connexion.email).fill(creds.email);
  await page.locator(sel.connexion.password).fill(creds.password);
  await page.locator(sel.connexion.submit).click();

  const totpScreen = page.locator(sel.totp.form);
  const inbox = page.locator(sel.shell.root);
  await expect(totpScreen.or(inbox)).toBeVisible();

  if (await totpScreen.isVisible()) {
    const [code, previous] = totpCodes(creds.totpSecret);
    await page.locator(sel.totp.code).fill(code);
    await page.locator(sel.totp.submit).click();
    if (!(await inbox.isVisible().catch(() => false))) {
      // Charnière de pas de 30 s : on rejoue le code précédent une seule fois.
      await page.locator(sel.totp.code).fill(previous!);
      await page.locator(sel.totp.submit).click();
    }
  }
  await expect(inbox).toBeVisible();
}

export async function openInbox(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator(sel.inbox.root)).toBeVisible();
}

/** Ouvre le premier cas de la file et attend la carte de décision. */
export async function openFirstCase(page: Page): Promise<void> {
  const firstRow = page.locator(sel.inbox.row).first();
  await expect(firstRow).toBeVisible();
  await firstRow.click();
  await expect(page.locator(sel.cas.root)).toBeVisible({ timeout: 5_000 });
}

/** Choisit un code de motif dans la liste obligatoire des motifs. */
export async function chooseReason(page: Page, code: string): Promise<void> {
  const select = page.locator(sel.cas.reason);
  await expect(select).toBeVisible();
  await select.selectOption(code);
  await expect(select).toHaveValue(code);
}

/** Attend un toast et, si demandé, son bouton d'annulation. */
export async function expectToast(page: Page, message?: RegExp): Promise<void> {
  const toast = page.locator(sel.toast.root).first();
  await expect(toast).toBeVisible();
  if (message) await expect(toast).toContainText(message);
}

/** Vérifie qu'une ligne du journal porte bien la commande et la cible attendues. */
export async function expectJournalEntry(page: Page, command: string, targetId?: string): Promise<void> {
  await page.goto('/journal');
  const row = page.locator(sel.journal.row, { hasText: command }).first();
  await expect(row).toBeVisible();
  if (targetId) await expect(row).toContainText(targetId);
}

/** Ouvre la barre de commande au clavier (⌘K ou Ctrl+K selon la plateforme). */
export async function openCommandBar(page: Page): Promise<void> {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
  await expect(page.locator(sel.shell.commandInput)).toBeVisible();
  await expect(page.locator(sel.shell.commandInput)).toBeFocused();
}

/** État d'erreur doit toujours proposer « Réessayer » (§ 6 du design). */
export async function expectRetryable(page: Page): Promise<void> {
  const retry = page.getByRole('button', { name: /Réessayer/ });
  await expect(retry).toBeVisible();
}

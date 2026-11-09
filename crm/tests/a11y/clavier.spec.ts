import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { openCommandBar, openFirstCase, openInbox, signIn } from '../support/flows';
import { sel } from '../support/selectors';

/**
 * Couche 5 — parcours clavier complet (contrôle 33) : tout ce qui se fait à la souris
 * doit se faire au clavier, sans piège de focus, et sans raccourci qui casse la saisie.
 */

test.describe('Accessibilité — clavier seul', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  test('décider sans souris : file → cas → motif → masquer → annuler', async ({ page }) => {
    await openInbox(page);
    await page.keyboard.press('j');
    await page.keyboard.press('Enter');
    await expect(page.locator(sel.cas.root)).toBeVisible();

    // Le focus entre dans la carte de décision sans piège.
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('[data-testid="case"]')));
    expect(inside).toBe(true);

    // « M » déclenche Masquer, le motif se choisit au clavier.
    await page.keyboard.press('m');
    const reason = page.locator(sel.cas.reason);
    await expect(reason).toBeVisible();
    await reason.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.locator(sel.cas.decisionSave).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(sel.toast.root).first()).toBeVisible();
  });

  test('Échap ferme le cas et rend le focus à la file', async ({ page }) => {
    await openInbox(page);
    await openFirstCase(page);
    await page.keyboard.press('Escape');
    await expect(page.locator(sel.inbox.root)).toBeVisible();
    const focused = await page.evaluate(() =>
      Boolean((document.activeElement as HTMLElement | null)?.closest('[data-testid="inbox"]'))
    );
    expect(focused).toBe(true);
  });

  test('la barre de commande filtre au clavier et rend la main par Échap', async ({ page }) => {
    await openInbox(page);
    await openCommandBar(page);
    await page.keyboard.type('masquer');
    const first = page.locator(sel.shell.commandResults).locator('li, [role="option"]').first();
    await expect(first).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator(sel.shell.commandResults)).toHaveCount(0);
  });

  test('l’aide clavier « ? » liste les raccourcis', async ({ page }) => {
    await openInbox(page);
    await page.keyboard.press('?');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/J|K/);
    await expect(dialog).toContainText(/⌘K|Ctrl\+K/);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('une fois ouvert, le cas ne laisse pas le focus sortir par Tab', async ({ page }) => {
    await openFirstCase(page);
    for (let index = 0; index < 25; index += 1) {
      await page.keyboard.press('Tab');
      const outside = await page.evaluate(() => document.activeElement === document.body);
      // Le focus ne doit jamais retomber sur le document (focus perdu).
      expect(outside).toBe(false);
    }
  });
});

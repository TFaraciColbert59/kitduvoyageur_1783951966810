import { test, expect } from '@playwright/test';

/**
 * `/messagerie` — garde-fous de la grammaire Compte (état invité).
 *
 * Ce spec ne mesure pas les 19 ancres (c'est le rôle de
 * `npm run design:fidelity`) : il empêche la régression vers l'ancien shell
 * (double recherche, barre flottante globale, page qui défile) et vérifie les
 * interactions de base accessibles sans session.
 */
test.describe('Messagerie — grammaire Compte @messagerie', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/messagerie', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.card.cs', { timeout: 60_000 });
  });

  test('écran verrouillé et carte dans la boîte mesurée', async ({ page }) => {
    const metrics = await page.evaluate(() => {
      const box = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
      };
      return {
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        card: box('.card.cs'),
        topBar: box('.ig-top'),
        bar: box('.tb'),
        buttons: document.querySelectorAll('.ig-top-btn').length,
        rings: document.querySelectorAll('.ig-hl').length,
        pills: box('.ig-handle'),
      };
    });

    expect(metrics.scrollHeight).toBe(metrics.innerHeight);
    expect(metrics.card).toEqual([12, 48, 406, 541]);
    expect(metrics.topBar).toEqual([12, 6, 406, 36]);
    expect(metrics.bar).toEqual([14, 868, 402, 48]);
    expect(metrics.buttons).toBe(3);
    expect(metrics.rings).toBe(4);
    expect(metrics.pills?.[3]).toBe(34);
  });

  test('un seul champ de recherche, et l’ancienne barre globale a disparu', async ({ page }) => {
    await expect(page.locator('nav.lkdv-floating-tabbar')).toHaveCount(0);
    await expect(page.locator('.lkdv-compte-v8.lkdv-messages')).toHaveCount(1);
    await expect(page.locator('input[placeholder*="Rechercher"]:visible')).toHaveCount(0);
  });

  test('les 4 filtres sont atteignables et l’état actif est exposé', async ({ page }) => {
    const demandes = page.getByRole('button', { name: /^Demandes/ }).first();
    await expect(page.locator('.ig-hl')).toHaveCount(4);
    await demandes.click();
    await expect(demandes).toHaveAttribute('aria-pressed', 'true');
    // Invité : la liste reste l'état honnête « connectez-vous » (l'état vide
    // « Aucune demande en attente » n'est visible qu'avec une session).
    await expect(page.locator('.ig-grid-wrap .mstate')).toHaveCount(1);
  });

  test('la recherche ouvre un drawer, sort la barre, et Échap le referme', async ({ page }) => {
    await page.getByRole('button', { name: 'Rechercher une discussion' }).click();
    const drawer = page.locator('.sw-wrap[data-det="open"]');
    await expect(drawer).toHaveCount(1);
    await expect(drawer).toContainText('Rechercher');
    await expect
      .poll(async () => page.evaluate(() => getComputedStyle(document.querySelector('.lkdv-account-bar')!).opacity))
      .toBe('0');

    await page.keyboard.press('Escape');
    await expect(page.locator('.sw-wrap[data-det="open"]')).toHaveCount(0);
    await expect
      .poll(async () => page.evaluate(() => getComputedStyle(document.querySelector('.lkdv-account-bar')!).opacity))
      .toBe('1');
  });

  test('invité : la carte de connexion remplace la liste', async ({ page }) => {
    await expect(page.locator('.ig-grid-wrap')).toContainText('Connectez-vous pour voir vos messages');
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  });
});

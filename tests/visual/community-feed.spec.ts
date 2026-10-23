import { expect, test, type Page } from '@playwright/test';

async function gotoFeed(page: Page) {
  const response = await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(900);
  return response;
}

test.describe('Communauté — fil Instagram LKDV', () => {
  test('le fil affiche les posts carrés, les stories et la barre du Compte', async ({ page }, testInfo) => {
    const response = await gotoFeed(page);
    expect(response?.status()).toBeLessThan(500);

    await expect(page.locator('.lkdv-feed-post').first()).toBeVisible();
    await expect(page.locator('.lkdv-feed-stories').first()).toBeVisible();
    await expect(page.locator('.tb a')).toHaveCount(5);
    await expect(page.locator('.tb a').first()).toHaveText(/Explorer/);
    await expect(page.locator('.tb a').last()).toHaveText(/Compte/);

    const first = page.locator('.lkdv-feed-post').first();
    await expect(first.locator('.pmi-author').first()).toBeVisible();
    await expect(first.getByRole('button', { name: "J'aime" })).toBeVisible();
    await expect(first.getByRole('button', { name: 'Commenter' })).toBeVisible();
    await expect(first.getByRole('button', { name: 'Partager' })).toBeVisible();
    await expect(first.getByRole('button', { name: 'Options de la publication' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('community-feed.png') });
  });

  test('le + ouvre le drawer de création du Compte (5 lignes)', async ({ page }, testInfo) => {
    await gotoFeed(page);
    await page.getByRole('button', { name: 'Créer dans l’application' }).click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Nouveau carnet de voyage')).toBeVisible();
    await expect(dialog.getByText('Nouvelle story à la une')).toBeVisible();
    await expect(dialog.locator('.lkdv-create-row')).toHaveCount(5);
    await page.screenshot({ path: testInfo.outputPath('community-create.png') });
  });

  test('le menu ··· a les 4 actions du Compte', async ({ page }) => {
    await gotoFeed(page);
    await page.getByRole('button', { name: 'Options de la publication' }).first().click();
    const menu = page.locator('.pmi-options-menu').first();
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Enregistrer');
    await expect(menu).toContainText('Republier');
    await expect(menu).toContainText('Copier le lien');
    await expect(menu).toContainText('Signaler');
  });

  test('le commentaire ouvre la feuille basse', async ({ page }, testInfo) => {
    await gotoFeed(page);
    await page.getByRole('button', { name: 'Commenter' }).first().click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.lkdv-comments-sheet')).toBeVisible();
    await expect(dialog.locator('.lkdv-comments-gate')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('community-comments.png') });
  });

  test('la matrice responsive ne déborde pas', async ({ page }, testInfo) => {
    const projectWidth = testInfo.project.use.viewport?.width;
    const viewports = [393, 430, 768, 1024, 1440];
    const selected = viewports.filter((width) => width === projectWidth);
    for (const width of selected) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 932 });
      for (const mode of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
        await gotoFeed(page);
        await expect(page.locator('.lkdv-feed-shell')).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        );
        expect(overflow, `${width} ${mode}`).toBe(false);
        await page.screenshot({
          path: testInfo.outputPath(`community-feed-${width}-${mode}.png`),
          fullPage: false,
        });
      }
    }
  });
});

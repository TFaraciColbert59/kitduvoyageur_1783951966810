import { expect, test, type Page } from '@playwright/test';

async function gotoFeed(page: Page) {
  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.lkdv-feed-post', { timeout: 20_000 });
  const banner = page.locator('[aria-label="Gestion des cookies"]');
  if (await banner.count()) {
    await banner.getByRole('button', { name: 'Refuser' }).click({ force: true }).catch(() => {});
    await expect(banner).toHaveCount(0, { timeout: 3_000 }).catch(() => {});
  }
  await page.waitForTimeout(600);
}

test.describe('Communauté — actions réelles du fil', () => {
  test('invité : like, commentaire et story renvoient vers la connexion', async ({ page }) => {
    await gotoFeed(page);

    await page.getByRole('button', { name: "J'aime" }).first().click();
    await expect(page).toHaveURL(/\/connexion\?next=%2Fcommunaute|\/connexion\?next=\/communaute/);

    await gotoFeed(page);
    await page.getByRole('button', { name: 'Commenter' }).first().click();
    await expect(page.locator('.lkdv-comments-gate')).toBeVisible();
    await expect(page.locator('.lkdv-comments-gate')).toContainText('Connectez-vous pour commenter');
    await expect(page.getByPlaceholder('Ajouter un commentaire…')).toHaveCount(0);
    await page.keyboard.press('Escape');

    await gotoFeed(page);
    await page.getByRole('button', { name: 'Créer dans l’application' }).click();
    await page.getByRole('button', { name: /Nouvelle story à la une/ }).click();
    await expect(page).toHaveURL(/\/connexion/);
  });

  test('les 5 lignes du drawer de création ont les bonnes destinations', async ({ page }) => {
    await gotoFeed(page);
    await page.getByRole('button', { name: 'Créer dans l’application' }).click();
    const rows = page.locator('.lkdv-create-row');
    await expect(rows).toHaveCount(5, { timeout: 10_000 });
    await expect(rows.nth(0)).toHaveAttribute('href', '/carnets/nouveau');
    await expect(rows.nth(1)).toHaveAttribute('href', '/voyages');
    await expect(rows.nth(2)).toHaveAttribute('href', '/materiel');
    await expect(rows.nth(3)).toHaveAttribute('href', '/clubs/nouveau');
    await expect(rows.nth(4)).not.toHaveAttribute('href');
  });

  test('la barre basse pointe vers les 5 pages du Compte', async ({ page }) => {
    await gotoFeed(page);
    const links = page.locator('.tb a');
    await expect(links).toHaveCount(5);
    const hrefs = await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(hrefs).toEqual(['/explorer', '/compas', '/materiel', '/hub', '/compte']);
  });

  test('le lien profond ?post scrolle jusqu’au post et ?comment ouvre la feuille', async ({ page }) => {
    await gotoFeed(page);
    const fifth = page.locator('.lkdv-feed-post').nth(4);
    const id = (await fifth.getAttribute('id'))?.replace('feed-post-', '');
    expect(id).toBeTruthy();

    await page.goto(`/communaute?post=${id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.lkdv-feed-post', { timeout: 20_000 });
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 8_000 }).toBeGreaterThan(0);

    await page.goto(`/communaute?post=${id}&comment=${id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
  });

  test('Charger plus ajoute 10 posts', async ({ page }) => {
    await gotoFeed(page);
    await expect(page.locator('.lkdv-feed-post')).toHaveCount(10);
    const more = page.getByRole('button', { name: 'Charger plus' });
    await more.scrollIntoViewIfNeeded();
    await more.click({ force: true });
    await expect(page.locator('.lkdv-feed-post')).toHaveCount(20, { timeout: 10_000 });
  });

  test('Copier le lien affiche un toast', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await gotoFeed(page);
    await page.getByRole('button', { name: 'Options de la publication' }).first().click();
    await page.getByRole('button', { name: 'Copier le lien' }).first().click();
    await expect(page.locator('[role="status"]')).toContainText('Lien copié');
  });
});

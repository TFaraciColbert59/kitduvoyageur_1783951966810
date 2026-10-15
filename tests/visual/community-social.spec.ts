import { expect, test } from '@playwright/test';

test.describe('LKDV · Social-first responsive UX', () => {
  test('discovery is navigable, filters respond, and captures a screenshot', async ({ page }, testInfo) => {
    await page.goto('/communaute/decouvrir', { waitUntil: 'domcontentloaded' });
    const discoveryBg = await page.locator('.lkdv-community-discovery').evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(discoveryBg).not.toBe('rgba(0, 0, 0, 0)');
    const header = page.locator('.lkdv-community-discovery-header');
    await expect(header).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Découvrir' })).toBeVisible();
    const videoFilter = page.getByRole('button', { name: 'Vidéos', exact: true });
    await videoFilter.click();
    await expect(videoFilter).toHaveAttribute('aria-pressed', 'true');
    const photoFilter = page.getByRole('button', { name: 'Photos', exact: true });
    await photoFilter.click();
    await expect(photoFilter).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('link', { name: /Regarder les Reels/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('community-discovery.png'), fullPage: true });
  });

  test('reels have full-screen shell with accessible navigation', async ({ page }, testInfo) => {
    await page.goto('/communaute/reels', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Reels · LKDV' })).toBeVisible();
    // Full-screen Reels must not be covered by the shared 5-tab navigation.
    await expect(page.locator('nav[aria-label="Navigation principale"]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Retour à la découverte' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('community-reels.png'), fullPage: false });
  });

  test('community feed and its social shell render without horizontal overflow', async ({ page }, testInfo) => {
    await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.lkdv-community-experience')).toBeVisible();
    // Reading surfaces must be opaque — screenshots previously revealed the
    // global mountain wallpaper bleeding through the entire social app.
    const background = await page.locator('.lkdv-community-experience').evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(background).not.toBe('rgba(0, 0, 0, 0)');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('community-feed.png'), fullPage: false });
  });
});

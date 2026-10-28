import { expect, test } from '@playwright/test';
import { installCommunityFeedFixture } from './_helpers/communityFeedFixture';

/** La barre du bas : une seule instance fixe, jamais remontée, masquée seulement par un tiroir. */
test('la barre reste la même instance et à la même place entre les pages', async ({ page }) => {
  await installCommunityFeedFixture(page);
  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  const bar = page.locator('nav.lkdv-floating-tabbar');
  await expect(bar).toBeVisible();
  await page.waitForTimeout(4000);
  await bar.evaluate((el) => { (el as HTMLElement & { __id?: string }).__id = 'same'; });
  const before = await bar.boundingBox();
  await bar.getByRole('link', { name: /Messages/ }).click();
  await page.waitForURL(/\/messagerie/);
  await expect(bar).toBeVisible();
  const after = await bar.boundingBox();
  expect(after?.y).toBe(before?.y);
  expect(await bar.evaluate((el) => (el as HTMLElement & { __id?: string }).__id)).toBe('same');
  await bar.getByRole('link', { name: /Communaut/ }).click();
  await page.waitForURL(/\/communaute/);
  await expect(bar).toBeVisible();
  expect(await bar.evaluate((el) => (el as HTMLElement & { __id?: string }).__id)).toBe('same');
});

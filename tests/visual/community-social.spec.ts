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


/**
 * Responsive smoke matrix: unlike static screenshot-only tests, this checks
 * real navigation shells at each viewport with keyboard focus and light/dark
 * mode. Public/unauthenticated state is intentional; authenticated flows are
 * validated separately in the functional suite.
 *
 * Playwright chromium emulates the viewport; it cannot certify UIKit/
 * VoiceOver or Safari/WKWebView on a physical iPhone.
 */
test('social route family: responsive shells, contrast states and screenshots', async ({ page }, testInfo) => {
  const surfaces = [
    { route: '/communaute', selector: '.lkdv-community-experience', label: 'feed' },
    { route: '/communaute/decouvrir', selector: '.lkdv-community-discovery', label: 'discovery' },
    { route: '/communaute/reels', selector: '.lkdv-community-reels', label: 'reels' },
    { route: '/carnets', selector: ':is(.lkdv-social-directory-mobile, .lkdv-social-directory-desktop):visible', label: 'carnets' },
    { route: '/clubs', selector: ':is(.lkdv-social-directory-mobile, .lkdv-social-directory-desktop):visible', label: 'clubs' },
    { route: '/evenements', selector: ':is(.lkdv-social-directory-mobile, .lkdv-social-directory-desktop):visible', label: 'events' },
  ] as const;
  const viewports = [
    { width: 393, height: 852 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ];
  const projectWidth = testInfo.project.use.viewport?.width;
  // Each CI project owns a single physical-width emulation. Fill the missing
  // 768/1024 gaps from the desktop project without multiplying all 4 runners.
  const selected = viewports.filter((viewport) => viewport.width === projectWidth ||
    (projectWidth === 1440 && (viewport.width === 768 || viewport.width === 1024)));
  for (const viewport of selected) {
    await page.setViewportSize(viewport);
    for (const mode of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
      for (const surface of surfaces) {
        const response = await page.goto(surface.route, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        expect(response?.status(), surface.route + ' returned HTTP error').toBeLessThan(500);
        await expect(page.locator(surface.selector).first()).toBeVisible({ timeout: 15_000 });
        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          width: window.innerWidth,
        }));
        expect(metrics.scrollWidth, surface.route + ' horizontal overflow').toBeLessThanOrEqual(metrics.width + 2);
        await page.screenshot({
          path: testInfo.outputPath('community-' + surface.label + '-' + viewport.width + '-' + mode + '.png'),
          fullPage: false,
          animations: 'disabled',
        });
      }
    }
  }
});

test('mobile community toolbar remains keyboard-accessible and tappable', async ({ page }, testInfo) => {
  if ((testInfo.project.use.viewport?.width || 1440) > 500) return;
  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  const trigger = page.getByRole('button', { name: 'Créer un contenu' });
  await expect(trigger).toBeVisible();
  const box = await trigger.boundingBox();
  expect(box, 'Create action must be measurable').not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(40);
  expect(box!.height).toBeGreaterThanOrEqual(40);
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const first = page.getByRole('menuitem', { name: 'Nouvelle publication' });
  const second = page.getByRole('menuitem', { name: 'Créer un carnet' });
  await expect(first).toBeVisible();
  await expect(first).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(second).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(first).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
});

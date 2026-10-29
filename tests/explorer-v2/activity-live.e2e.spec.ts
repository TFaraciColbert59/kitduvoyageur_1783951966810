import { expect, test, type Page } from '@playwright/test';

/**
 * Suivi GPS d'une activité (P2-11, P7-16) : des positions sont rejouées via le
 * hook de recette `window.__xpPushFix` (aucun GPS physique requis), la pastille
 * et les métriques se mettent à jour, et la caméra suit la position.
 */

declare global {
  interface Window {
    __xpPushFix?: (fix: {
      t: number;
      lat: number;
      lng: number;
      ele?: number | null;
      acc?: number | null;
      speed?: number | null;
    }) => void;
    __xpMap?: { getCenter: () => { lng: number; lat: number }; getBearing: () => number };
  }
}

function root(page: Page) {
  return page.locator('.xp-root').last();
}

test.describe.configure({ retries: 2 });

test('suivi GPS : métriques et caméra @explorer-v2', async ({ page }) => {
  test.slow();
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'lkdv_cookie_consent',
      JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }),
    );
  });
  await page.goto('/explorer?v2=1&scene=course', { waitUntil: 'commit', timeout: 60_000 });
  await expect(root(page).locator('.xp-activity-pill')).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(1500);

  const start = await page.evaluate(() => {
    const map = window.__xpMap;
    return map ? { lng: map.getCenter().lng, lat: map.getCenter().lat } : null;
  });

  // Six positions, ~10 m par seconde : distance ≈ 55 m, D+ ≈ 8 m.
  await page.evaluate(() => {
    const push = window.__xpPushFix;
    if (!push) return;
    let lat = 45.9237;
    let lng = 6.8694;
    for (let index = 0; index < 6; index += 1) {
      lat += 0.00009;
      lng += 0.00006;
      push({ t: Date.now() + index * 1000, lat, lng, ele: 1035 + index * 3, acc: 6, speed: 1.4 });
    }
  });
  await page.waitForTimeout(1500);

  const pill = (await root(page).locator('.xp-activity-pill').textContent()) ?? '';
  expect(pill).toMatch(/\d+\s?m|\d+,\d\s?km/);

  const metrics = await root(page).locator('.xp-metric').allTextContents();
  expect(metrics.join(' ')).toContain('Distance');
  expect(metrics.join(' ')).toMatch(/\d/);

  const end = await page.evaluate(() => {
    const map = window.__xpMap;
    return map ? { lng: map.getCenter().lng, lat: map.getCenter().lat } : null;
  });
  if (start && end) {
    expect(Math.abs(end.lat - start.lat) + Math.abs(end.lng - start.lng)).toBeGreaterThan(0.0001);
  }

  // Hors-trace : le rejeu ne déclenche pas de fausse alerte sans itinéraire.
  await expect(root(page).locator('.xp-offroute')).toHaveCount(0);
});

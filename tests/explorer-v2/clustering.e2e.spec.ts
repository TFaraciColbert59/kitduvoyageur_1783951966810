import { expect, test, type Page } from '@playwright/test';

/**
 * Agrégation des repères (04_CARTE §1) : au-delà de 6 repères dans une cellule
 * de 100×100 px, la carte affiche une pastille chiffrée qui zoome au toucher.
 */

test.describe.configure({ retries: 2 });

function root(page: Page) {
  return page.locator('.xp-root').last();
}

test('pastille chiffrée puis zoom au toucher @explorer-v2', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'lkdv_cookie_consent',
      JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }),
    );
  });
  await page.goto('/explorer?v2=1&scene=lieu', { waitUntil: 'commit', timeout: 60_000 });
  await page.waitForSelector('.xp-map[data-ready="1"]', { timeout: 45_000 });
  await page.waitForTimeout(2500);

  // Zoom de niveau lieu, dense en repères (Chamonix).
  await page.evaluate(() => {
    const map = (
      window as unknown as {
        __xpMap?: {
          getZoom: () => number;
          jumpTo: (options: { center?: [number, number]; zoom?: number }) => void;
        };
      }
    ).__xpMap;
    if (!map) return;
    map.jumpTo({ center: [6.8694, 45.9237], zoom: 12 });
  });

  const cluster = root(page).locator('.xp-cluster').first();
  await expect(cluster).toBeVisible({ timeout: 20_000 });
  const count = Number((await cluster.textContent())?.trim() ?? '0');
  expect(count).toBeGreaterThan(6);
  // Moins de 6 repères individuels par cellule : la pastille remplace le tas.
  const pins = await root(page).locator('.xp-pin').count();
  expect(pins).toBeLessThanOrEqual(60);

  const before = await page.evaluate(
    () =>
      (
        window as unknown as {
          __xpMap?: { getZoom: () => number };
        }
      ).__xpMap?.getZoom() ?? 0,
  );
  // Le toucher est joué sur l'élément (le centre du viewport peut être couvert
  // par le tiroir) : c'est le même gestionnaire `onClick`.
  await cluster.dispatchEvent('click');
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __xpMap?: { getZoom: () => number };
              }
            ).__xpMap?.getZoom() ?? 0,
        ),
      { timeout: 10_000 },
    )
    .toBeGreaterThan(before + 1.5);
});

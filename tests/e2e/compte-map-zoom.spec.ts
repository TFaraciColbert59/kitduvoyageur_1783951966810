import { expect, test } from '@playwright/test';

/**
 * Hiérarchie de la carte du Compte.
 *
 * Ces assertions décrivent la règle produit, pas l'implémentation :
 * - Monde / Pays : traces + massifs, aucun POI ni carnet ;
 * - Région : carnets et extrémités, toujours aucun POI ;
 * - Lieu : POI et carnets autour du viewport ;
 * - un point ne grossit jamais quand on dézoome.
 */
test.describe('carte du Compte — hiérarchie de zoom', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.request.post(`${baseURL}/api/demo-login`);
    await page.goto('/compte');
    await page.waitForSelector('.lkdv-map-root');
    await page.waitForFunction(() => Boolean((window as any).__lkdvCompteMapInstance));
  });

  async function zoomTo(page: import('@playwright/test').Page, zoom: number, center: [number, number] = [2.5, 46.5]) {
    await page.evaluate(
      ({ nextZoom, nextCenter }) => {
        (window as any).__lkdvCompteMapInstance.jumpTo({ zoom: nextZoom, center: nextCenter });
      },
      { nextZoom: zoom, nextCenter: center }
    );
    await page.waitForTimeout(450);
  }

  test('applique les quatre bandes et masque les POI hors du Lieu', async ({ page }) => {
    await zoomTo(page, 3);
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'world');
    await expect(page.locator('.lkdv-map-poi:visible')).toHaveCount(0);

    await zoomTo(page, 5);
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'country');
    await expect(page.locator('.lkdv-map-poi:visible')).toHaveCount(0);

    await zoomTo(page, 8, [6.86, 45.9]);
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'region');
    await expect(page.locator('.lkdv-map-poi:visible')).toHaveCount(0);

    await zoomTo(page, 12, [6.86, 45.9]);
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'place');
  });

  test('ne grossit pas les points au dézoom', async ({ page }) => {
    await zoomTo(page, 3);
    const far = await page.locator('.lkdv-map-massif').first().evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    }));
    expect(far.width).toBeLessThanOrEqual(8);
    expect(far.height).toBeLessThanOrEqual(8);

    await zoomTo(page, 8, [6.86, 45.9]);
    const near = await page.locator('.lkdv-map-massif').first().evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    }));
    expect(near.width).toBeGreaterThanOrEqual(20);
    expect(near.height).toBeGreaterThanOrEqual(20);
  });

  test('aligne les couches natives POI sur la bande Lieu', async ({ page }) => {
    await zoomTo(page, 8);
    const region = await page.evaluate(() => {
      const map = (window as any).__lkdvCompteMapInstance;
      return map.getLayoutProperty('compte-pois-dot', 'visibility') ?? 'visible';
    });
    expect(region).toBe('none');

    await zoomTo(page, 12, [6.86, 45.9]);
    const place = await page.evaluate(() => {
      const map = (window as any).__lkdvCompteMapInstance;
      return map.getLayoutProperty('compte-pois-dot', 'visibility') ?? 'visible';
    });
    expect(place).not.toBe('none');
  });
});

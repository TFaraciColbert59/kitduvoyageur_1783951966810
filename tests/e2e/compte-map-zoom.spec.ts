import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Hiérarchie de la carte du Compte.
 *
 * Ces assertions décrivent la règle produit, pas l'implémentation :
 * - Monde / Pays : traces + massifs, aucun POI ni carnet ;
 * - Région : carnets et extrémités, toujours aucun POI ;
 * - Lieu : POI et carnets autour du viewport ;
 * - un point ne grossit jamais quand on dézoome.
 *
 * Les sélecteurs sont `:visible` et les rectangles nuls sont écartés
 * explicitement : un marqueur masqué (`display: none`) ne doit jamais satisfaire
 * une assertion de taille avec un rectangle 0 × 0.
 */

type MapPayload = {
  tracks: Array<{ id: string }>;
  massifs: Array<{ id: string; center: { lng: number; lat: number } }>;
  pois: Array<{ id: string; position: { lng: number; lat: number } }>;
};

type Box = { width: number; height: number };

async function readPayload(page: Page): Promise<MapPayload> {
  return page.evaluate(async () => {
    const response = await fetch('/api/compte/map');
    if (!response.ok) throw new Error(`map_http_${response.status}`);
    return (await response.json()) as MapPayload;
  });
}

/** Rectangles non nuls des éléments visibles : un masqué ne compte pas. */
async function visibleBoxes(locator: Locator): Promise<Box[]> {
  return locator.evaluateAll((elements) =>
    elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      })
      .filter((box) => box.width > 0 && box.height > 0)
  );
}

async function zoomTo(
  page: Page,
  zoom: number,
  center: [number, number] = [2.5, 46.5]
) {
  await page.evaluate(
    ({ nextZoom, nextCenter }) => {
      const map = (window as unknown as { __lkdvCompteMapInstance: any })
        .__lkdvCompteMapInstance;
      // Coupe un éventuel flyTo (ouverture de fiche) avant le saut : la bande
      // testée doit être celle demandée, pas une frame d'animation.
      map.stop();
      map.jumpTo({ zoom: nextZoom, center: nextCenter });
    },
    { nextZoom: zoom, nextCenter: center }
  );
  await page.waitForTimeout(450);
}

test.describe('carte du Compte — hiérarchie de zoom', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.request.post(`${baseURL}/api/demo-login`);
    // Caméra instantanée : les flyTo/fitBounds de la fiche et du mode ne
    // peuvent pas se superposer au `jumpTo` du test.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/compte');
    await page.waitForSelector('.lkdv-map-root');
    await page.waitForFunction(() => Boolean((window as any).__lkdvCompteMapInstance));
    await page.waitForFunction(
      () => typeof (window as any).__lkdvCompteMapContext === 'function'
    );
  });

  test('applique les quatre bandes et masque les POI hors du Lieu', async ({ page }) => {
    const payload = await readPayload(page);
    expect(payload.massifs.length, 'la démo doit exposer au moins un massif').toBeGreaterThan(0);
    expect(payload.pois.length, 'la démo doit exposer au moins un POI').toBeGreaterThan(0);

    const massif = payload.massifs[0]!;
    const poi = payload.pois[0]!;
    const massifCenter: [number, number] = [massif.center.lng, massif.center.lat];

    await zoomTo(page, 3, massifCenter);
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'world');
    await expect(page.locator('.lkdv-map-poi:visible')).toHaveCount(0);
    await expect(page.locator('.lkdv-map-carnet:visible')).toHaveCount(0);

    await zoomTo(page, 5, massifCenter);
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'country');
    await expect(page.locator('.lkdv-map-poi:visible')).toHaveCount(0);
    await expect(page.locator('.lkdv-map-carnet:visible')).toHaveCount(0);

    await zoomTo(page, 8, massifCenter);
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'region');
    // Les POI apparaissent dès la bande Région.
    expect(
      await page.evaluate(() => {
        const map = (window as any).__lkdvCompteMapInstance;
        return map.getLayoutProperty('compte-pois-dot', 'visibility') ?? 'visible';
      })
    ).not.toBe('none');
    // Le massif centré est forcément dans le cadre : la bande Région le montre
    // en pastille individuelle (pas d'agrégat à cette échelle).
    await expect(
      page.locator(`.lkdv-map-massif[data-massif-id="${massif.id}"]:visible`)
    ).toHaveCount(1);
    await expect(page.locator('.lkdv-map-cluster:visible')).toHaveCount(0);

    await zoomTo(page, 12, [poi.position.lng, poi.position.lat]);
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'place');
  });

  test('ne grossit pas les points au dézoom', async ({ page }) => {
    const payload = await readPayload(page);
    const massif = payload.massifs[0]!;
    const massifCenter: [number, number] = [massif.center.lng, massif.center.lat];

    await zoomTo(page, 3, massifCenter);
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'world');

    // Monde : soit le massif isolé de 7 px, soit l'agrégat de 22 px — jamais un
    // rectangle 0 px d'un marqueur caché, jamais un `.first()` arbitraire.
    const farMassifs = await visibleBoxes(page.locator('.lkdv-map-massif:visible'));
    const farClusters = await visibleBoxes(page.locator('.lkdv-map-cluster:visible'));
    expect(
      farMassifs.length + farClusters.length,
      'un massif ou un agrégat doit être visible en bande Monde'
    ).toBeGreaterThan(0);
    for (const box of farMassifs) {
      expect(box.width, 'massif Monde largeur').toBeGreaterThan(0);
      expect(box.width, 'massif Monde largeur').toBeLessThanOrEqual(8);
      expect(box.height, 'massif Monde hauteur').toBeGreaterThan(0);
      expect(box.height, 'massif Monde hauteur').toBeLessThanOrEqual(8);
    }
    for (const box of farClusters) {
      expect(box.width, 'agrégat Monde largeur').toBeGreaterThan(0);
      expect(box.width, 'agrégat Monde largeur').toBeLessThanOrEqual(24);
      expect(box.height, 'agrégat Monde hauteur').toBeGreaterThan(0);
      expect(box.height, 'agrégat Monde hauteur').toBeLessThanOrEqual(24);
    }

    await zoomTo(page, 8, massifCenter);
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'region');
    const near = page.locator(`.lkdv-map-massif[data-massif-id="${massif.id}"]:visible`);
    await expect(near).toHaveCount(1);
    const [nearBox] = await visibleBoxes(near);
    expect(nearBox, 'massif Région visible').toBeDefined();
    expect(nearBox!.width).toBeGreaterThanOrEqual(18);
    expect(nearBox!.height).toBeGreaterThanOrEqual(18);
  });

  test('aligne les couches natives POI sur la bande Lieu', async ({ page }) => {
    const payload = await readPayload(page);
    const massif = payload.massifs[0]!;
    const poi = payload.pois[0]!;
    const massifCenter: [number, number] = [massif.center.lng, massif.center.lat];
    const poiCenter: [number, number] = [poi.position.lng, poi.position.lat];

    const visibility = (layer: string) =>
      page.evaluate((layerId) => {
        const map = (window as unknown as { __lkdvCompteMapInstance: any })
          .__lkdvCompteMapInstance;
        return map.getLayoutProperty(layerId, 'visibility') ?? 'visible';
      }, layer);

    await zoomTo(page, 8, massifCenter);
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'region');
    expect(await visibility('compte-pois-dot')).toBe('none');
    // Les extrémités sont le fond natif de la bande Région : elles restent là.
    expect(await visibility('compte-track-starts-dot')).not.toBe('none');

    await zoomTo(page, 12, poiCenter);
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'place');
    // Aucun comptage de POI n'est exigé ici : la bande doit être `place` et la
    // couche native doit être visible, même si le viewport n'a aucun POI.
    expect(await visibility('compte-pois-dot')).not.toBe('none');
    expect(await visibility('compte-track-starts-dot')).not.toBe('none');

    /* Régression : en mode sortie (massifs désactivés), sélectionner un POI au
       Lieu puis franchir le seuil 10 dans les deux sens ne doit ni perdre
       `.is-selected` ni exiger un rebuild pour le retrouver. */
    const trackId = payload.tracks[0]?.id ?? '';
    await page.evaluate((outingId) => {
      (window as any).__lkdvCompteMapContext?.({
        kind: 'outing_drawer',
        step: 0,
        slot: null,
        detent: 'open',
        outingId,
      });
    }, trackId);
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-map-mode', 'sortie');
    // L'effet de cadrage du mode sortie s'exécute après l'attribut : on le
    // laisse poser la caméra avant de reprendre la main.
    await page.waitForTimeout(300);

    await zoomTo(page, 12, poiCenter);
    const marker = page.locator(`.lkdv-map-poi[data-poi-id="${poi.id}"]`);
    await expect(marker).toBeVisible();
    await marker.evaluate((element) => (element as HTMLElement).click());
    await expect(marker).toHaveClass(/is-selected/);
    // Laisse le flyTo d'ouverture de fiche démarrer : `zoomTo` le coupe ensuite.
    await page.waitForTimeout(350);

    await zoomTo(page, 9.6, poiCenter);
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'region');
    await expect(marker).toBeVisible();
    await expect(marker).toHaveClass(/is-selected/);

    await zoomTo(page, 12.4, poiCenter);
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-zoom-band', 'place');
    await expect(marker).toBeVisible();
    await expect(marker).toHaveClass(/is-selected/);
  });
});

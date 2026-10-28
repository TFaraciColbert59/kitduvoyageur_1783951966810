import { expect, test, type Page } from '@playwright/test';
import { AUTHOR_ID, cors, installCommunityFeedFixture } from './_helpers/communityFeedFixture';

/**
 * Carnet par jours : général → un jour par étape → carte avec tracé accroché.
 * Routeur et géocodeur sont simulés ; les écritures REST sont capturées.
 */

type Captured = { table: string; body: unknown };

async function openCarnet(page: Page) {
  const captured: Captured[] = [];
  const fixture = await installCommunityFeedFixture(page);

  // Pas de tuiles réelles : fond vide, mais la carte reste interactive.
  await page.route(/\.(png|jpg|jpeg|webp)(\?.*)?$/, (route) =>
    route.request().url().startsWith('http://localhost') ? route.continue() : route.abort(),
  );
  await page.route('**/api/route**', (route) => {
    const points = new URL(route.request().url()).searchParams.get('points') ?? '';
    const coords = points.split(';').map((p) => p.split(',').map(Number) as [number, number]);
    return route.fulfill({ json: { status: 'ok', provider: 'geoapify', legs: [{ distanceKm: 4.26, durationMin: 60, geometry: coords }] } });
  });
  await page.route('**/api/geocode**', (route) =>
    route.fulfill({ json: { status: 'ok', matches: [{ id: 'a1', name: 'Saint-Pierre-de-Chartreuse', context: 'Isère', country: 'FR', lat: 45.33, lon: 5.8, provider: 'photon' }] } }),
  );

  // Écritures : on répond comme PostgREST (objet unique pour `.single()`), et on garde le corps.
  await page.route(/\/rest\/v1\/(carnets|carnet_moments|carnet_day_traces|community_posts)(\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(route) });
    if (request.method() !== 'POST') return route.fallback();
    const table = new URL(request.url()).pathname.split('/').at(-1) as string;
    captured.push({ table, body: request.postDataJSON() });
    const wantsObject = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    return route.fulfill({ status: 201, headers: cors(route), json: wantsObject ? { id: `${table}-new-id` } : [{ id: `${table}-new-id` }] });
  });

  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.lkdv-feed-post').first()).toBeVisible();
  await fixture.signIn();
  await page.getByRole('button', { name: 'Créer dans l’application' }).click();
  await page.getByRole('tab', { name: 'Carnet', exact: true }).click();
  return { pane: page.getByRole('tabpanel', { name: 'Carnet', exact: true }), captured };
}

const overflowOf = (pane: ReturnType<Page['getByRole']>) => pane.evaluate((el) => el.scrollHeight - el.clientHeight);

test.describe('Carnet par jours', () => {
  test('étape générale puis un jour par étape, sans défilement', async ({ page }, testInfo) => {
    const { pane } = await openCarnet(page);

    await expect(pane.getByText('Général', { exact: true })).toBeVisible();
    expect(await overflowOf(pane), 'étape Général').toBeLessThanOrEqual(1);
    await pane.getByLabel('Titre').fill('Traversée du Vercors');
    await pane.getByLabel('Destination').fill('Vercors, France');
    await pane.getByLabel('Début').fill('2026-07-01');
    await pane.getByLabel('Fin').fill('2026-07-03');
    await page.screenshot({ path: testInfo.outputPath('carnet-general.png') });
    await pane.getByRole('button', { name: 'Suivant' }).click();

    for (const day of [1, 2, 3]) {
      await expect(pane.getByText(new RegExp(`^Jour ${day}`))).toBeVisible();
      await expect(pane.getByLabel('Petit commentaire')).toBeVisible();
      await expect(pane.getByLabel('Ce qu’on a fait')).toBeVisible();
      expect(await overflowOf(pane), `Jour ${day}`).toBeLessThanOrEqual(1);
      await pane.getByLabel('Petit commentaire').fill(`Commentaire du jour ${day}`);
      if (day === 3) await page.screenshot({ path: testInfo.outputPath('carnet-jour.png') });
      await pane.getByRole('button', { name: 'Suivant' }).click();
    }
    await expect(pane.getByText('Carte', { exact: true })).toBeVisible();
    expect(await overflowOf(pane), 'étape Carte').toBeLessThanOrEqual(1);
  });

  test('un jour de plus se rajoute depuis le dernier jour', async ({ page }) => {
    const { pane } = await openCarnet(page);
    await pane.getByLabel('Titre').fill('Un jour');
    await pane.getByLabel('Destination').fill('Chartreuse');
    await pane.getByRole('button', { name: 'Suivant' }).click();
    await expect(pane.getByText('2/3')).toBeVisible();
    await pane.getByRole('button', { name: '+ Un jour de plus' }).click();
    await expect(pane.getByText('2/4')).toBeVisible();
  });

  test('dessin au doigt accroché, adresse, puis enregistrement avec tracés et jours', async ({ page }, testInfo) => {
    const { pane, captured } = await openCarnet(page);
    await pane.getByLabel('Titre').fill('Traversée du Vercors');
    await pane.getByLabel('Destination').fill('Vercors, France');
    await pane.getByLabel('Début').fill('2026-07-01');
    await pane.getByLabel('Fin').fill('2026-07-02');
    await pane.getByRole('button', { name: 'Suivant' }).click();
    await pane.getByLabel('Petit commentaire').fill('Départ sous la brume');
    await pane.getByLabel('Ce qu’on a fait').fill('Montée au col puis crête.');
    await pane.getByRole('button', { name: 'Suivant' }).click();
    await pane.getByRole('button', { name: 'Suivant' }).click();
    await expect(pane.locator('.lkdv-tr-map[data-ready="true"]')).toBeVisible();

    // Dessin au doigt sur la carte (jour 1).
    await pane.getByTestId('trace-draw').click();
    const map = pane.locator('.lkdv-tr-map');
    const box = (await map.boundingBox())!;
    const x0 = box.x + box.width * 0.35;
    const y0 = box.y + box.height * 0.6;
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (let i = 1; i <= 14; i++) await page.mouse.move(x0 + i * 9, y0 - i * 6, { steps: 2 });
    await page.mouse.up();
    await expect(pane.getByRole('status')).toContainText('accroché aux chemins');
    expect(await pane.locator('.leaflet-overlay-pane path').count()).toBeGreaterThanOrEqual(2);
    await expect(pane.locator('.lkdv-tr-pin').first()).toContainText('J1');

    // Adresse : recale l'arrivée du jour.
    await pane.getByTestId('trace-address').click();
    await pane.getByRole('searchbox').fill('Saint-Pierre');
    await pane.getByRole('button', { name: /Saint-Pierre-de-Chartreuse/ }).click();
    await pane.getByTestId('address-end').click();
    await expect(pane.getByRole('status')).toContainText('recalé sur « Saint-Pierre-de-Chartreuse »');

    // Le volet ne doit jamais avoir défilé (focus du champ adresse, glissement du doigt).
    expect(await pane.evaluate((el) => el.scrollTop)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('carnet-carte.png') });

    // Jour 2 : la sous-capsule bascule de jour.
    await pane.getByRole('tab', { name: 'Jour 2' }).click();
    await expect(pane.getByRole('tab', { name: 'Jour 2' })).toHaveAttribute('aria-selected', 'true');

    await pane.getByRole('button', { name: 'Créer le carnet' }).click();
    await expect.poll(() => captured.some((entry) => entry.table === 'carnet_day_traces'), { timeout: 8000 }).toBe(true);

    const carnet = captured.find((entry) => entry.table === 'carnets')!.body as Record<string, unknown>;
    expect(carnet).toMatchObject({ title: 'Traversée du Vercors', author_id: AUTHOR_ID, nb_nuits: 1 });
    const traces = captured.find((entry) => entry.table === 'carnet_day_traces')!.body as Array<Record<string, unknown>>;
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({ jour_numero: 1, snapped: true, end_label: 'Saint-Pierre-de-Chartreuse' });
    expect((traces[0]!.waypoints as unknown[]).length).toBeLessThanOrEqual(12);
    const moments = captured.find((entry) => entry.table === 'carnet_moments')!.body as Array<Record<string, unknown>>;
    expect(moments.map((m) => m.jour_numero)).toEqual([1, 1]);
    expect(moments[0]).toMatchObject({ citation: 'Départ sous la brume' });
  });
});

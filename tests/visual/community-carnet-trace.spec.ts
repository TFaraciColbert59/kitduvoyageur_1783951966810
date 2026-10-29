import { expect, test, type Page } from '@playwright/test';
import { installCommunityFeedFixture } from './_helpers/communityFeedFixture';

/**
 * Carnet : le tracé se colle au chemin PENDANT le geste (plusieurs requêtes de
 * routage avant de lever le doigt), distance et dénivelé mesurés, annulation,
 * jours dans la capsule en bas à droite.
 */

async function openCarnet(page: Page) {
  const routeCalls: string[] = [];
  await page.route('**/api/route?**', async (route) => {
    const url = new URL(route.request().url());
    routeCalls.push(url.searchParams.get('points') ?? '');
    const points = (url.searchParams.get('points') ?? '').split(';').map((pair) => pair.split(',').map(Number));
    // Chemin simulé : la ligne du geste, décalée de ~30 m vers le nord et densifiée.
    const geometry: number[][] = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      for (let t = 0; t < 4; t += 1) {
        geometry.push([points[i][0] + ((points[i + 1][0] - points[i][0]) * t) / 4, points[i][1] + ((points[i + 1][1] - points[i][1]) * t) / 4 + 0.0003]);
      }
    }
    const last = points[points.length - 1];
    geometry.push([last[0], last[1] + 0.0003]);
    await route.fulfill({ json: { status: 'ok', legs: [{ distanceKm: 1, durationMin: 10, geometry }], provider: 'valhalla' } });
  });
  await page.route('**/api/elevation?**', async (route) => {
    const count = (new URL(route.request().url()).searchParams.get('points') ?? '').split(';').length;
    await route.fulfill({ json: { status: 'ok', elevations: Array.from({ length: count }, (_, i) => 1000 + i * 20), provider: 'test' } });
  });
  const fixture = await installCommunityFeedFixture(page);
  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.lkdv-feed-post').first()).toBeVisible();
  await fixture.signIn();
  await page.getByRole('button', { name: 'Créer dans l’application' }).click();
  await page.getByRole('tab', { name: 'Carnet', exact: true }).click();
  const map = page.locator('.lkdv-carnet-map');
  await expect(map).toBeVisible({ timeout: 45_000 });
  await page.waitForFunction(() => Boolean(document.querySelector('.lkdv-carnet-map .maplibregl-canvas')), null, { timeout: 30_000 });
  await page.waitForTimeout(1200);
  return { map, routeCalls };
}

test('le tracé se colle aux chemins pendant le geste, avec distance et dénivelé', async ({ page }, testInfo) => {
  const { map, routeCalls } = await openCarnet(page);
  await page.getByRole('button', { name: 'Dessiner le tracé' }).click();
  const box = await page.locator('.lkdv-map-draw-layer').boundingBox();
  if (!box) throw new Error('calque de dessin absent');
  const y = box.y + box.height * 0.5;
  await page.mouse.move(box.x + 40, y);
  await page.mouse.down();
  // Geste long et lent : l'accrochage doit commencer avant que le doigt ne se lève.
  for (let step = 1; step <= 30; step += 1) {
    await page.mouse.move(box.x + 40 + step * 9, y - step * 2);
    await page.waitForTimeout(80);
  }
  const callsBeforeUp = routeCalls.length;
  await page.mouse.up();
  expect(callsBeforeUp).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => Number(await map.getAttribute('data-trace-points')), { timeout: 15_000 }).toBeGreaterThan(5);
  // Jamais plus de 12 points de passage par requête.
  for (const call of routeCalls) expect(call.split(';').length).toBeLessThanOrEqual(12);
  await expect(page.locator('.lkdv-map-stats')).toContainText(/km|m/);
  await expect(page.locator('.lkdv-map-stats')).toContainText(/m D\+/, { timeout: 10_000 });
  await page.screenshot({ path: testInfo.outputPath('carnet-trace.png') });

  // Un second geste repart de la fin du tracé ; « annuler » le retire.
  const before = Number(await map.getAttribute('data-trace-points'));
  await page.mouse.move(box.x + 300, y - 70);
  await page.mouse.down();
  for (let step = 1; step <= 6; step += 1) await page.mouse.move(box.x + 300, y - 70 + step * 10);
  await page.mouse.up();
  await expect.poll(async () => Number(await map.getAttribute('data-trace-points')), { timeout: 15_000 }).toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Annuler le dernier tronçon' }).click();
  await expect.poll(async () => Number(await map.getAttribute('data-trace-points'))).toBe(before);
});

test('les jours sont dans la capsule en bas à droite', async ({ page }, testInfo) => {
  await openCarnet(page);
  const days = page.locator('.lkdv-drawer-secondary').getByRole('tablist', { name: 'Jours du carnet' });
  await expect(days).toBeVisible();
  await days.getByRole('tab', { name: 'Ajouter un jour' }).click();
  await expect(days.getByRole('tab', { name: 'Jour 1' })).toHaveAttribute('aria-selected', 'true');
  await days.getByRole('tab', { name: 'Ajouter un jour' }).click();
  await expect(days.getByRole('tab', { name: 'Jour 2' })).toHaveAttribute('aria-selected', 'true');
  await days.getByRole('tab', { name: 'Réglages du carnet' }).click();
  await expect(page.getByLabel('Titre', { exact: true })).toBeInViewport();
  const capsule = await page.locator('.lkdv-drawer-secondary').boundingBox();
  const card = await page.locator('.lkdv-cd').boundingBox();
  expect(capsule && card && capsule.x + capsule.width > card.x + card.width - 30).toBe(true);
  expect(capsule && card && capsule.y + capsule.height > card.y + card.height - 40).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('carnet-jours.png') });
});

test('créer sans titre ni destination affiche le manque au lieu de rester muet', async ({ page }) => {
  await openCarnet(page);
  await page.getByRole('button', { name: 'Créer le carnet' }).click();
  await expect(page.locator('.lkdv-form-error')).toContainText(/requis/);
});

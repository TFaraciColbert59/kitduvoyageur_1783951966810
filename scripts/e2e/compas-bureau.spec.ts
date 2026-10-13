import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

/**
 * Plan 5.5 et 5.6 — le Compas sur mobile (390 × 844), tablette (768 × 1024) et bureau (1280 × 800).
 *
 * Deux pages :
 *  - `/compas?nouvelle=1` : la VRAIE route, sans compte ni donnée (le Compas vide) ;
 *  - `/dev/compas` : l'écran COMPLET sur des données d'essai (`src/features/compas/dev/labData.ts`),
 *    ouvert seulement en `next dev` (introuvable sinon : le test est alors sauté). Le vrai `/compas`
 *    avec une aventure exige une session et une base : ce laboratoire permet de voir la mise en page.
 *
 * Hors réseau (laboratoire sans base) : trois appels sont remplacés par des réponses vides, comme les
 * frontières réseau des tests jsdom : la télémétrie du hub (refusée sans session), et les lectures de
 * sentiers et de points de la carte (`/api/hikes`, `/api/pois`). Rien d'autre n'est simulé : l'écran,
 * le CSS, la carte et les tuiles ArcGIS sont réels.
 *
 * Chaque test exige 0 erreur console et 0 débordement horizontal. `CAPTURE_DIR=<dossier>` écrit aussi
 * les captures (JPEG).
 */

const CAPTURE_DIR = process.env.CAPTURE_DIR ? path.resolve(process.env.CAPTURE_DIR) : null;

async function stubOfflineBoundaries(page: Page) {
  await page.route('**/api/telemetry/hub', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/hikes?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/pois?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror : ${String(e)}`));
  return errors;
}

async function open(page: Page, url: string) {
  const res = await page.goto(url, { waitUntil: 'load' });
  return res?.status() ?? 0;
}

async function dismissCookies(page: Page) {
  await page.getByRole('button', { name: 'Refuser' }).click({ timeout: 4000 }).catch(() => undefined);
}

async function settle(page: Page) {
  await expect(page.locator('.compas')).toBeVisible();
  await dismissCookies(page);
  await page.waitForTimeout(1500);
}

async function snap(page: Page, name: string) {
  if (CAPTURE_DIR) await page.screenshot({ path: path.join(CAPTURE_DIR, name), type: 'jpeg', quality: 80 });
}

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const box = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  }, selector);

test.describe('Compas — mobile, tablette, bureau', { tag: '@local-web' }, () => {
  test.beforeEach(async ({ page }) => {
    await stubOfflineBoundaries(page);
  });

  for (const vp of [
    { name: '390x844', width: 390, height: 844 },
    { name: '1280x800', width: 1280, height: 800 },
  ]) {
    test(`Compas vide (route réelle) ${vp.name} : 0 débordement, 0 erreur`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const errors = watchConsole(page);
      expect(await open(page, '/compas?nouvelle=1')).toBe(200);
      await settle(page);
      expect(await noOverflow(page)).toBeLessThanOrEqual(0);
      await snap(page, `compas-vide-${vp.name}.jpg`);
      expect(errors).toEqual([]);
    });
  }

  test('mobile 390 × 844 : le tiroir monte du bas et la carte reste sous lui (rien ne change)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = watchConsole(page);
    const status = await open(page, '/dev/compas');
    test.skip(status === 404, 'Laboratoire /dev/compas : ouvert seulement en `next dev`.');
    await settle(page);
    await snap(page, 'compas-390x844.jpg');
    expect(await noOverflow(page)).toBeLessThanOrEqual(0);

    await page.getByRole('button', { name: 'Détails : Kit' }).click();
    const sheet = page.getByRole('dialog', { name: 'Kit' });
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(700);
    const s = (await box(page, '.cp-sheet'))!;
    const m = (await box(page, '.cp-map'))!;
    expect(s.width).toBeGreaterThan(390 * 0.9);
    expect(s.bottom).toBeLessThanOrEqual(m.top + 12);
    await snap(page, 'compas-390x844-tiroir.jpg');
    expect(await noOverflow(page)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test('bureau 1280 × 800 : carte large, tiroir latéral sur la colonne de l’étape, carte entière', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const errors = watchConsole(page);
    const status = await open(page, '/dev/compas');
    test.skip(status === 404, 'Laboratoire /dev/compas : ouvert seulement en `next dev`.');
    await settle(page);
    await snap(page, 'compas-1280x800.jpg');

    const map = (await box(page, '.cp-map'))!;
    const top = (await box(page, '.cp-top'))!;
    expect(map.width).toBeGreaterThan(1280 * 0.55);
    expect(top.right).toBeLessThanOrEqual(map.left);
    expect(map.height).toBeGreaterThan(800 * 0.85);
    expect(await noOverflow(page)).toBeLessThanOrEqual(0);

    await page.getByRole('button', { name: 'Détails : Kit' }).click();
    await expect(page.getByRole('dialog', { name: 'Kit' })).toBeVisible();
    await page.waitForTimeout(700);
    const sheet = (await box(page, '.cp-sheet'))!;
    expect(sheet.width).toBeLessThanOrEqual(448);
    expect(sheet.height).toBeGreaterThan(800 * 0.85);
    // Le tiroir est latéral : il ne recouvre pas la carte (crédit « Powered by Esri » compris).
    expect(sheet.right).toBeLessThanOrEqual(map.left + 1);
    await snap(page, 'compas-1280x800-tiroir.jpg');

    // Équipe en lecture : rôle, niveau (les autres lignes tiennent sur la page suivante de la liste), invitation en attente, renvoi vers le Hub.
    await page.keyboard.press('Escape');
    await page.getByRole('navigation', { name: 'Étapes du Compas' }).getByRole('button', { name: /Nous/ }).click();
    await page.getByRole('button', { name: 'Détails : Nous' }).click();
    const nous = page.getByRole('dialog', { name: 'Nous' });
    await expect(nous.getByText('Organisateur')).toBeVisible();
    await expect(nous.getByText('Niveau confirmé · estimé')).toBeVisible();
    await expect(nous.getByText('Invitation en attente · peut modifier')).toBeVisible();
    await expect(nous.getByRole('link', { name: /Gérer le groupe dans le Hub/ })).toHaveAttribute('href', '/hub/groupe');
    await page.waitForTimeout(500);
    await snap(page, 'compas-1280x800-equipe.jpg');
    expect(await noOverflow(page)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test('tablette 768 × 1024 : deux colonnes, carte large, aucun débordement', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const errors = watchConsole(page);
    const status = await open(page, '/dev/compas');
    test.skip(status === 404, 'Laboratoire /dev/compas : ouvert seulement en `next dev`.');
    await settle(page);
    const map = (await box(page, '.cp-map'))!;
    const top = (await box(page, '.cp-top'))!;
    expect(top.right).toBeLessThanOrEqual(map.left);
    expect(map.width).toBeGreaterThan(300);
    expect(await noOverflow(page)).toBeLessThanOrEqual(0);
    await snap(page, 'compas-768x1024.jpg');
    expect(errors).toEqual([]);
  });

  test('767 px : encore la mise en page mobile (une colonne, carte sous l’étape)', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 900 });
    const status = await open(page, '/dev/compas');
    test.skip(status === 404, 'Laboratoire /dev/compas : ouvert seulement en `next dev`.');
    await settle(page);
    const map = (await box(page, '.cp-map'))!;
    const top = (await box(page, '.cp-top'))!;
    expect(map.top).toBeGreaterThanOrEqual(top.bottom - 1);
    expect(map.width).toBeGreaterThan(767 * 0.95);
    expect(await noOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('carte 1280 × 800 : fond Satellite, pastilles D / A, encart du point touché', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const errors = watchConsole(page);
    const status = await open(page, '/dev/compas');
    test.skip(status === 404, 'Laboratoire /dev/compas : ouvert seulement en `next dev`.');
    await settle(page);
    await page.getByRole('button', { name: 'Personnaliser la carte' }).click();
    const fond = page.getByRole('group', { name: 'Fond de carte' });
    await expect(fond.getByRole('button', { name: 'Relief' })).toHaveAttribute('aria-pressed', 'true');
    await fond.getByRole('button', { name: 'Satellite' }).click();
    await expect(fond.getByRole('button', { name: 'Satellite' })).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(2500);
    await snap(page, 'compas-1280x800-satellite.jpg');
    await page.getByRole('button', { name: 'Personnaliser la carte' }).click();

    // Pastilles pleines (jamais translucides sur la carte) : fond opaque pour D, A et les numéros.
    const fonds = await page.evaluate(() =>
      [...document.querySelectorAll('.cp-pin__disc')].map((d) => getComputedStyle(d).backgroundColor)
    );
    expect(fonds.length).toBe(4);
    for (const f of fonds) expect(f).toMatch(/^rgb\(/);

    const depart = page.getByRole('button', { name: 'Départ : Gavarnie' });
    await expect(depart).toBeVisible();
    expect((await depart.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    await depart.click();
    const encart = page.getByRole('group', { name: 'Point touché' });
    await expect(encart).toContainText('Gavarnie');
    await expect(encart).toContainText('Jour 1');
    await page.waitForTimeout(400);
    await snap(page, 'compas-1280x800-encart.jpg');
    await encart.getByRole('button', { name: 'Fermer l’encart' }).click();
    await expect(encart).toHaveCount(0);
    expect(await noOverflow(page)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
});

import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { prepareVisualPage } from './_helpers/prepareVisualPage';

/**
 * Explorer v2 — preuve visuelle du moteur MapLibre (projection globe).
 *
 * Remplace les captures de l'ancien moteur ATLAS (`?atlas=1`,
 * `data-testid="unified-explorer-map"`), supprimé en phase 10 (P10-04).
 * Géolocalisation simulée côté Nord-France/Belgique, comme avant.
 */

const OUT_DIR = path.join('docs', 'atlas', 'captures');

test.use({
  geolocation: { latitude: 50.784, longitude: 2.666 },
  permissions: ['geolocation'],
});

test.describe.configure({ timeout: 120_000 });

test.describe('Explorer v2 (MapLibre globe)', () => {
  test('rend le canvas globe, zéro pageerror, capture par projet', async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    // Service worker neutralisé : son cache « hors ligne » peut servir un HTML
    // périmé et empêcher le chargement de la carte.
    await page.addInitScript(() => {
      Object.defineProperty(navigator.serviceWorker, 'register', {
        value: () => new Promise<never>(() => {}),
        configurable: true,
      });
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
    });

    await prepareVisualPage(page, '/explorer');

    const mapRoot = page.getByTestId('xp-map');
    await expect(mapRoot).toBeVisible();
    await expect(mapRoot.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 45_000 });
    await expect(mapRoot).toHaveAttribute('data-ready', '1', { timeout: 45_000 });

    // Laisse les données pays/régions et les repères se poser.
    await page.waitForTimeout(6_000);

    mkdirSync(OUT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(OUT_DIR, `explorer-v2-${testInfo.project.name}.png`),
      fullPage: false,
    });

    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });

  test('globe → pays : la caméra plonge et la feuille suit', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chrome',
      'Séquence de plongée capturée sur desktop (mobile couvert par les captures de parité).',
    );

    await page.addInitScript(() => {
      Object.defineProperty(navigator.serviceWorker, 'register', {
        value: () => new Promise<never>(() => {}),
        configurable: true,
      });
    });

    await prepareVisualPage(page, '/explorer');
    const rootLocator = page.locator('.xp-root').last();
    await expect(rootLocator.locator('.xp-sheet')).toBeVisible({ timeout: 45_000 });
    await page.waitForFunction(() => document.querySelectorAll('.xp-pin').length > 0, undefined, {
      timeout: 45_000,
    });
    await page.screenshot({ path: path.join(OUT_DIR, 'explorer-v2-globe.png') });

    // Toucher un pays : niveau 1 + caméra qui descend.
    await rootLocator.locator('.xp-pin').first().click({ force: true });
    await expect(rootLocator).toHaveAttribute('data-level', '1', { timeout: 20_000 });
    await page.waitForTimeout(2_500);
    await page.screenshot({ path: path.join(OUT_DIR, 'explorer-v2-pays.png') });
  });
});

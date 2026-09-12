import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { prepareVisualPage } from './_helpers/prepareVisualPage';

/**
 * CHANTIER ATLAS — Phase 2
 * Preuve visuelle du moteur unique MapLibre (projection globe) derrière ?atlas=1.
 * Géolocalisation simulée côté Nord-France/Belgique (zone où les données réelles
 * sont concentrées) pour un rendu représentatif.
 */

const OUT_DIR = path.join('docs', 'atlas', 'captures');

test.use({
  geolocation: { latitude: 50.784, longitude: 2.666 },
  permissions: ['geolocation'],
});

test.describe.configure({ timeout: 120_000 });

test.describe('Explorateur unifié (MapLibre globe)', () => {
  test('rend le canvas globe, zéro pageerror, capture par projet', async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    // Service worker neutralisé : son cache « hors ligne » peut servir un HTML
    // périmé et empêcher le chargement de la carte (même garde que shell.spec).
    await page.addInitScript(() => {
      Object.defineProperty(navigator.serviceWorker, 'register', {
        value: () => new Promise<never>(() => {}),
        configurable: true,
      });
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
    });

    await prepareVisualPage(page, '/explorer?atlas=1');

    const mapRoot = page.getByTestId('unified-explorer-map');
    await expect(mapRoot).toBeVisible();

    await expect(mapRoot.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 45_000 });
    await expect(mapRoot).toHaveAttribute('data-atlas-ready', 'true', { timeout: 45_000 });

    // Laisse la géolocalisation + le fetch viewport (/api/hikes) alimenter la liste.
    await page.waitForTimeout(7_000);

    mkdirSync(OUT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(OUT_DIR, `atlas-explorer-${testInfo.project.name}.png`),
      fullPage: false,
    });

    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});

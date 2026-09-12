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

  test('clic direct sur un sentier de la carte → panneau de détail', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chrome',
      'Clic carte vérifié sur desktop : en mobile le carrousel recouvre la zone centrale (sélection couverte par l’e2e via la liste).'
    );

    // Le hook __atlasTestMap n'existe qu'en dev (ce spec tourne sur `npm run dev`).
    await page.addInitScript(() => {
      Object.defineProperty(navigator.serviceWorker, 'register', {
        value: () => new Promise<never>(() => {}),
        configurable: true,
      });
    });

    await prepareVisualPage(page, '/explorer?atlas=1');

    const mapRoot = page.getByTestId('unified-explorer-map');
    await expect(mapRoot).toHaveAttribute('data-atlas-ready', 'true', { timeout: 45_000 });
    await page.waitForTimeout(5_000); // viewport data (sentiers) chargés

    const clickPoint = await page.evaluate(() => {
      const map = (window as unknown as { __atlasTestMap?: any }).__atlasTestMap;
      if (!map) return null;
      const features = map.queryRenderedFeatures({ layers: ['atlas-trails-points'] });
      for (const feature of features) {
        if (feature.geometry?.type !== 'Point') continue;
        const point = map.project(feature.geometry.coordinates);
        // Évite la zone couverte par la liste desktop (colonne gauche).
        if (point.x > 420 && point.x < window.innerWidth - 80 && point.y > 90 && point.y < window.innerHeight - 120) {
          return { x: point.x, y: point.y };
        }
      }
      return null;
    });
    expect(clickPoint, 'aucun sentier rendu cliquable dans la zone sûre').not.toBeNull();

    const box = await page.locator('canvas.maplibregl-canvas').boundingBox();
    await page.mouse.click(box!.x + clickPoint!.x, box!.y + clickPoint!.y);

    // Sélection carte → carte compacte (CTA /hub/depart), puis fiche complète.
    await expect(page.getByRole('button', { name: 'Préparer' }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Voir la fiche complète' }).click();
    await expect(page.getByText('Préparer le matériel').first()).toBeVisible({ timeout: 15_000 });
  });
});

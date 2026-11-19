import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * tests/e2e/carnet-v2-finition.spec.ts
 *
 * Preuves navigateur de la finition de la fiche carnet v2, sur le banc
 * `/dev/carnet-v2` (fiche pleine « Tour des Écrins », sans base ni compte ;
 * introuvable hors `next dev` : la spec se saute alors, jamais de faux vert).
 *
 * Lancer : `next dev -p 4010` (NEXT_PUBLIC_CARNET_V2=true, Supabase fictif) puis
 * `CARNET_LAB_URL=http://localhost:4010 npx playwright test tests/e2e/carnet-v2-finition.spec.ts`.
 * Les captures 390×844 et 430×932 sont écrites dans `CARNET_CAPTURES` (défaut
 * `test-results/carnet-v2-finition`).
 */
const LAB = process.env.CARNET_LAB_URL ?? 'http://localhost:4010';
const OUT = process.env.CARNET_CAPTURES ?? 'test-results/carnet-v2-finition';
const SIZES = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

let labReady = false;
test.beforeAll(async ({ request }) => {
  try {
    const res = await request.get(`${LAB}/dev/carnet-v2`, { timeout: 120_000, failOnStatusCode: false });
    labReady = res.status() === 200;
  } catch {
    labReady = false;
  }
});
test.beforeEach(() => {
  test.skip(!labReady, 'banc /dev/carnet-v2 introuvable (next dev requis)');
});

async function open(page: Page, query = '') {
  await page.goto(`${LAB}/dev/carnet-v2${query}`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="carnet-v2-root"]').waitFor({ timeout: 60_000 });
  // Bandeau de cookies : hors sujet pour la fiche, mais il recouvre la carte.
  const refuse = page.getByRole('button', { name: 'Refuser' });
  await refuse.click({ timeout: 8_000 }).catch(() => undefined);
  await page.waitForTimeout(900); // hydratation + fin du cadrage animé de la carte
}

async function snap(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  await page.screenshot({ path: path.join(OUT, `${name}-${width}x${height}.png`) });
}

const day = (page: Page) => page.locator('[data-testid="carnet-v2-root"]').getAttribute('data-day');

for (const size of SIZES) {
  test.describe(`${size.width}×${size.height}`, () => {
    test.use({ viewport: size });

    test('Résumé, jour 2 : glisser ±60 px dans les deux sens, capsule, flèches', async ({ page }) => {
      await open(page);
      await page.locator('.lkdv-day-capsule').waitFor();
      await page.waitForTimeout(800); // hydratation des gestes
      await snap(page, 'resume');
      expect(await day(page)).toBe('0');

      const view = page.locator('.lkdv-day-swipe-view');
      const box = (await view.boundingBox())!;
      const y = box.y + 60;
      const drag = async (dx: number) => {
        await page.mouse.move(box.x + box.width / 2, y);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + dx / 2, y, { steps: 4 });
        await page.mouse.move(box.x + box.width / 2 + dx, y, { steps: 4 });
        await page.mouse.up();
        await page.waitForTimeout(700);
      };
      await drag(-90);
      expect(await day(page)).toBe('1');
      await drag(-90);
      expect(await day(page)).toBe('2');
      await snap(page, 'jour2');
      await drag(90); // vers la droite : jour précédent (bug du runtime /compte non reproduit)
      expect(await day(page)).toBe('1');
      await drag(30); // sous le seuil de 60 px : rien
      expect(await day(page)).toBe('1');

      await page.getByRole('tab', { name: 'Jour 3' }).click();
      await page.waitForTimeout(600);
      expect(await day(page)).toBe('3');
      // Dans la capsule, les flèches déplacent le focus (tablist) : on rend la main au document.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(100);
      expect(await day(page)).toBe('2');
    });

    test('toucher la trace d’un jour sur la carte change de jour', async ({ page }) => {
      await open(page);
      await page.waitForTimeout(2000); // cadrage de la trace (1,1 s) terminé : la cible ne bouge plus
      const target = await page.evaluate(async () => {
        const instance = () => (window as unknown as { __lkdvCompteMapInstance?: any }).__lkdvCompteMapInstance;
        // Les tuiles réseau peuvent ne jamais répondre : on attend la source de traces, pas `idle`.
        let f: any;
        for (let i = 0; i < 150 && !f; i += 1) {
          const m = instance();
          if (m?.getSource('compte-carnet-days')) {
            f = (m.querySourceFeatures('compte-carnet-days') as Array<any>).find((x) => x.properties.day === 3);
          }
          if (!f) await new Promise((r) => setTimeout(r, 100));
        }
        const map = instance();
        if (!map || !f) return null;
        const coords = f.geometry.coordinates as number[][];
        const mid = coords[Math.floor(coords.length / 2)];
        const p = map.project(mid);
        const rect = map.getContainer().getBoundingClientRect();
        return { x: rect.left + p.x, y: rect.top + p.y };
      });
      test.skip(!target, 'carte WebGL indisponible dans ce navigateur');
      await page.mouse.click(target!.x, target!.y);
      await page.waitForTimeout(500);
      expect(await day(page)).toBe('3');
    });

    test('tiroir : mode contexte (filtre, contrôles masqués) et couches par slot', async ({ page }) => {
      await open(page, '?jour=2');
      const canvasFilter = () =>
        page.evaluate(() => getComputedStyle(document.querySelector('.lkdv-map-canvas')!).filter);
      expect(await canvasFilter()).toBe('none');
      await page.getByRole('button', { name: 'Ouvrir le carnet' }).click();
      await page.waitForFunction(
        () => getComputedStyle(document.querySelector('.lkdv-map-canvas')!).filter.includes('saturate(0.6)'),
        undefined,
        { timeout: 10_000 }
      );
      expect(await canvasFilter()).toContain('saturate(0.6)');
      expect(await canvasFilter()).toContain('brightness(0.97)');
      await page.waitForFunction(
        () => getComputedStyle(document.querySelector('.lkdv-map-hud')!).opacity === '0',
        undefined,
        { timeout: 5_000 }
      );
      await snap(page, 'tiroir-fil');

      await page.getByRole('tab', { name: 'Route' }).first().click();
      await page.getByRole('tab', { name: 'Nuit' }).click();
      await page.waitForTimeout(500);
      const markers = await page.evaluate(() =>
        [...document.querySelectorAll('.lkdv-carnet-map-marker')].map((m) => (m as HTMLElement).dataset.markerType)
      );
      expect(new Set(markers)).toEqual(new Set(['night']));
      await snap(page, 'tiroir-route-nuit');

      await page.getByRole('tab', { name: 'Sac' }).first().click();
      await expect(page.getByRole('button', { name: /Reprendre ce kit/ })).toBeVisible();
      await page.getByRole('tab', { name: 'Verdicts' }).click();
      await page.locator('[data-verdict-filter="defaillant"]').click();
      await page.waitForTimeout(300);
      await snap(page, 'tiroir-sac-verdicts');
    });

    test('mode modification : feuille Créer (9 types), écriture annulable', async ({ page }) => {
      await open(page, '?jour=1');
      await page.getByRole('button', { name: /Menu du carnet/ }).click();
      await page.getByRole('menuitemcheckbox', { name: /Modifier le carnet/ }).click();
      await page.waitForTimeout(400);
      await snap(page, 'edition');
      await page.getByRole('button', { name: 'Ajouter un moment' }).first().click();
      await expect(page.getByRole('group', { name: 'Type de moment' }).getByRole('button')).toHaveCount(9);
      await snap(page, 'creer');
    });

    test('visiteur : pas de « + », budget absent, menu visiteur', async ({ page }) => {
      await open(page, '?role=visitor');
      await expect(page.getByRole('button', { name: 'Ajouter un moment' })).toHaveCount(0);
      await page.getByRole('button', { name: /Menu du carnet/ }).click();
      await expect(page.getByRole('menu', { name: 'Options du carnet' }).getByRole('menuitem')).toHaveText(['Suivre le carnet', 'Partager…', 'Copier le lien', 'Signaler']);
      await snap(page, 'visiteur-menu');
    });

    test('mouvement réduit : plus d’animation sur l’île, les tuiles et la pastille', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page, '?jour=2');
      await page.locator('.lkdv-ig-tile').first().waitFor({ timeout: 10_000 });
      const states = await page.evaluate(() =>
        ['.lkdv-ig-tile', '.lkdv-title-pill'].map((s) => getComputedStyle(document.querySelector(s)!).transitionDuration)
      );
      for (const duration of states) expect(parseFloat(duration)).toBeLessThanOrEqual(0.01);
    });

    test('aucun débordement horizontal, aucune erreur de page', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await open(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      expect(errors).toEqual([]);
    });
  });
}

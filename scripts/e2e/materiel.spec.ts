import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * H-AUTO-42 — les écrans matériels sont canoniques dans le hub :
 * /hub (aperçu possession), /hub/kit, /hub/inventaire, /hub/alertes,
 * /hub/depart. Les URLs /materiel/* redirigent 307 (voir hubRedirects.spec).
 */

async function loginDemo(page: Page, context: BrowserContext) {
  await page.goto('/connexion');
  await page.locator('input:visible#email').first().fill('demo@lkdv.app');
  await page.locator('input:visible#password').first().fill('DemoPass!2026');
  await page.locator('button:visible', { hasText: 'Se connecter' }).click();
  let tries = 0;
  while (tries < 12) {
    const cookies = await context.cookies();
    if (cookies.some((c) => c.name.includes('auth-token'))) break;
    await page.waitForTimeout(500);
    tries++;
  }
  await page.waitForTimeout(800);
}

test('hub possession — connexion démo + aperçu équipement affiché', async ({ page, context }) => {
  await loginDemo(page, context);
  await page.goto('/hub');
  await expect(page.getByRole('heading', { name: /Aperçu de l'équipement/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kits' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Inventaire' })).toBeVisible();
});

test('hub possession — navigation vers la section kits', async ({ page, context }) => {
  await loginDemo(page, context);
  await page.goto('/hub');
  await page.getByRole('link', { name: 'Kits' }).click();
  await expect(page).toHaveURL(/\/hub\/kit/);
  await expect(page.getByRole('heading', { name: 'Kits', exact: true })).toBeVisible();
  await expect(page.getByText(/Nouveau kit/i).first()).toBeVisible();
});

test('hub depart — cockpit plein écran avec widgets réels (pas l\'état vide)', async ({ page, context }) => {
  await loginDemo(page, context);
  await page.goto('/hub/depart');
  await expect(page.getByText(/Terrain Readiness Score/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Météo 48h/i)).toBeVisible();
  await expect(page.getByText(/Kit assigné/i)).toBeVisible();
  await expect(page.getByText(/Aucun kit assigné/i)).toHaveCount(0);
});

test('hub sections inventaire / alertes — données présentes', async ({ page, context }) => {
  await loginDemo(page, context);
  await page.goto('/hub/inventaire');
  await expect(page.getByRole('heading', { name: 'Inventaire', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ajouter/i }).first()).toBeVisible();
  await page.goto('/hub/alertes');
  await expect(page.getByRole('heading', { name: 'Alertes', exact: true })).toBeVisible();
});

test('redirections 307 des routes héritées /materiel/*', async ({ page, context }) => {
  await loginDemo(page, context);
  await page.goto('/materiel/inventaire');
  await expect(page).toHaveURL(/\/hub\/inventaire/);
  await expect(page.getByRole('heading', { name: 'Inventaire', exact: true })).toBeVisible();
  await page.goto('/materiel/kits');
  await expect(page).toHaveURL(/\/hub\/kit/);
});

test('accessibilité — hub possession (axe)', async ({ page, context }) => {
  await loginDemo(page, context);
  await page.goto('/hub');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

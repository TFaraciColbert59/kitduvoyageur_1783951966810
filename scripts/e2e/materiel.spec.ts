import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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

test('grille Mon Matériel — connexion démo + données affichées', async ({ page, context }) => {
  await loginDemo(page, context);
  await page.goto('/materiel');
  await expect(page.getByRole('heading', { name: 'Mon Matériel' })).toBeVisible();
  await expect(page.getByText(/Mes kits/i).first()).toBeVisible();
  await expect(page.getByText(/Aucun départ planifié/i)).toHaveCount(0);
});

test('grille Mon Matériel — navigation vers kits', async ({ page, context }) => {
  await loginDemo(page, context);
  await page.goto('/materiel');
  await page.getByRole('link', { name: /Gérer les kits/i }).click();
  await expect(page).toHaveURL(/\/materiel\/kits/);
});

test('plein écran départ — widgets réels (pas l\'état vide)', async ({ page, context }) => {
  await loginDemo(page, context);
  await page.goto('/materiel');
  const cockpit = page.getByRole('link', { name: /Ouvrir le cockpit/i });
  await expect(cockpit).toBeVisible();
  await cockpit.first().click();
  await page.waitForTimeout(2500);
  await expect(page).toHaveURL(/\/materiel\/depart\//);
  await expect(page.getByText(/Aucun kit assigné/i)).toHaveCount(0);
  await expect(page.getByText(/Terrain Readiness Score/i)).toBeVisible();
  await expect(page.getByText(/Météo 48h/i)).toBeVisible();
  await expect(page.getByText(/Kit assigné/i)).toBeVisible();
});

test('écrans kits / inventaire / alertes — données présentes', async ({ page, context }) => {
  await loginDemo(page, context);
  await page.goto('/materiel/kits');
  await expect(page.getByRole('heading', { name: 'Mes kits' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Nouveau kit/i }).first()).toBeVisible();
  await page.goto('/materiel/inventaire');
  await expect(page.getByRole('heading', { name: 'Inventaire' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Ajouter/i }).first()).toBeVisible();
  await page.goto('/materiel/alertes');
  await expect(page.getByRole('heading', { name: 'Alertes & fiabilité' })).toBeVisible();
});

test('accessibilité — grille Mon Matériel (axe)', async ({ page, context }) => {
  await loginDemo(page, context);
  await page.goto('/materiel');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
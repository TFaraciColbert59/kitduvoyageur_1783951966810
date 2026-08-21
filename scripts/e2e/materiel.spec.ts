import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function loginDemo(page: Page) {
  await page.goto('/connexion');
  await page.getByLabel('Adresse email').first().fill('demo@lkdv.app');
  await page.getByLabel('Mot de passe').first().fill('DemoPass!2026');
  await page.getByRole('button', { name: /Se connecter|Connexion/i }).first().click();
  await page.waitForTimeout(2500);
}

test('grille Mon Matériel — connexion démo + données affichées', async ({ page }) => {
  await loginDemo(page);
  await page.goto('/materiel');
  await expect(page.getByRole('heading', { name: 'Mon Matériel' })).toBeVisible();
  await expect(page.getByText(/Mes kits/i).first()).toBeVisible();
  await expect(page.getByText(/Inventaire/i).first()).toBeVisible();
});

test('grille Mon Matériel — navigation vers kits', async ({ page }) => {
  await loginDemo(page);
  await page.goto('/materiel');
  await page.getByRole('link', { name: /Gérer les kits/i }).click();
  await expect(page).toHaveURL(/\/materiel\/kits/);
});

test('cockpit départ — axe + widgets', async ({ page }) => {
  await loginDemo(page);
  await page.goto('/materiel');
  const cockpit = page.getByRole('link', { name: /Ouvrir le cockpit/i });
  if (await cockpit.count()) {
    await cockpit.first().click();
    await page.waitForTimeout(2500);
    await expect(page).toHaveURL(/\/materiel\/depart\//);
  } else {
    await page.goto('/materiel/depart/test-id');
  }
  await expect(page.getByText(/Prochain départ|Terrain Readiness/i).first()).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('accessibilité — grille Mon Matériel (axe)', async ({ page }) => {
  await loginDemo(page);
  await page.goto('/materiel');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
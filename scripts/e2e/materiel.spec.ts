import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('grille Mon Matériel — rendu + navigation vers kits', async ({ page }) => {
  await page.goto('/materiel');
  await expect(page.getByRole('heading', { name: 'Mon Matériel' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Gérer les kits/i })).toBeVisible();
  await page.getByRole('link', { name: /Gérer les kits/i }).click();
  await expect(page).toHaveURL(/\/materiel\/kits/);
});

test('grille Mon Matériel — accessibilité (axe)', async ({ page }) => {
  await page.goto('/materiel');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('page inventaire — retour vers la grille', async ({ page }) => {
  await page.goto('/materiel/inventaire');
  await expect(page.getByRole('heading', { name: 'Inventaire' })).toBeVisible();
  await page.getByRole('link', { name: /Retour/i }).click();
  await expect(page).toHaveURL('/materiel');
});

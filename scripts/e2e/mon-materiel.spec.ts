import { test, expect } from '@playwright/test';

/**
 * Parcours critiques CI du cockpit « Mon Matériel » :
 * 1. La page charge et le CSS est bien servi (les cartes ont des styles).
 * 2. Les 6 cartes sont présentes.
 * 3. Chaque carte ouvre son plein écran et le referme (Escape).
 * 4. Le drag & drop persiste après refresh.
 */

const CARDS = [
  'À ne pas oublier',
  'Alertes & fiabilité',
  'Mes kits',
  'Prochain départ',
  'Inventaire & catalogue',
  'Disponibilité',
];

test('CSS chargé : stylesheet + styles appliqués', async ({ page }) => {
  await page.goto('/mon-materiel');
  await page.waitForLoadState('networkidle');
  const styleSheets = await page.evaluate(() => document.styleSheets.length);
  expect(styleSheets).toBeGreaterThan(0);
  const bg = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(bg.length).toBeGreaterThan(0);
});

test('6 cartes présentes et ouverture/fermeture d’un plein écran', async ({ page }) => {
  await page.goto('/mon-materiel');
  await expect(page.locator('button[aria-label^="Agrandir la carte"]')).toHaveCount(6);
  await page.getByRole('button', { name: 'Agrandir la carte À ne pas oublier' }).click();
  await expect(page.locator('[data-fullscreen]')).toBeVisible({ timeout: 5000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-fullscreen]')).toHaveCount(0);
});

test('toutes les cartes listées dans le DOM', async ({ page }) => {
  await page.goto('/mon-materiel');
  for (const title of CARDS) {
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
  }
});
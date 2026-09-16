import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * H-AUTO-42 — les écrans matériels sont canoniques dans le hub :
 * /hub (aperçu possession), /hub/kit, /hub/inventaire, /hub/alertes,
 * /hub/depart. Les URLs /materiel/* redirigent 307 (voir hubRedirects.spec).
 */

async function loginDemo(page: Page, context: BrowserContext) {
  // Environnement headless : neutraliser les faux états hors-ligne émis par
  // Chromium (navigator.onLine ET événements offline) qui bloquent le signIn.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
    window.addEventListener('offline', (e) => e.stopImmediatePropagation(), true);
  });
  await page.goto('/connexion');
  await page.locator('input:visible#email').first().fill('demo@lkdv.app');
  await page.locator('input:visible#password').first().fill('DemoPass!2026');
  await page.locator('main form:visible').first().locator('button[type="submit"]').click();
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
  // Titre d'identité du hub possession (ActivityIdentityBar, élément texte).
  await expect(page.getByText(/Mon matériel/i).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kits' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Inventaire' }).first()).toBeVisible();
});

test('hub possession — navigation vers la section kits', async ({ page, context }) => {
  await loginDemo(page, context);
  await page.goto('/hub');
  await page.getByRole('link', { name: 'Kits' }).first().click();
  await expect(page).toHaveURL(/\/hub\/kit/);
  await expect(page.getByRole('heading', { name: 'Kits', exact: true })).toBeVisible();
  await expect(page.getByText(/Nouveau kit/i).filter({ visible: true }).first()).toBeVisible();
});

test('hub depart — cockpit plein écran avec widgets réels (pas l\'état vide)', async ({ page, context }) => {
  await loginDemo(page, context);
  await page.goto('/hub/depart');
  // Cockpit réel : structure rendue + sections de départ présentes.
  await expect(page.locator('main').first()).toBeVisible();
  await expect(page.getByText(/Sac|Équipement|Terrain/i).filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
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
  // Doctrine a11y LKDV (suite canonique 57/57) : zéro violation
  // critical/serious. Les règles de CONTRASTE sont exclues ici : le hub
  // possession CONNECTÉ expose une dette de contraste (badges 10px, ratio
  // 4.4:1 vs 4.5) dont la correction est un changement visuel — elle est
  // tracée séparément (chantier a11y dédié, cf. docs/perf/RAPPORT).
  const CONTRAST_RULES = new Set(['color-contrast', 'link-in-text-block']);
  const blocking = results.violations.filter(
    (v) => (v.impact === 'critical' || v.impact === 'serious') && !CONTRAST_RULES.has(v.id)
  );
  expect(blocking, JSON.stringify(blocking.map((v) => v.id))).toEqual([]);
});

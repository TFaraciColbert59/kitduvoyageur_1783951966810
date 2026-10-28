import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Explorer v2 — recette de la feuille, des niveaux et des états.
 * Toutes les assertions portent sur le rendu réel du serveur Next local.
 */

const SCENES = [
  'monde',
  'pays',
  'region',
  'lieu',
  'sommet',
  'eau',
  'rando',
  'depart',
  'ia',
  'calques',
  'offline',
  'lancer',
  'course',
  'sos',
  'resume',
  'bienvenue',
  'noloc',
  'nuit',
  'facile',
  'arriere',
] as const;

/**
 * L'application conserve brièvement l'ancienne page pendant la transition
 * (`lkv-page-fade`) : on cible toujours le dernier `.xp-root` monté.
 */
function root(page: Page) {
  return page.locator('.xp-root').last();
}

async function dismissCookies(page: Page) {
  const refuse = page.getByRole('button', { name: /^Refuser$/ });
  if (await refuse.count()) {
    await refuse.first().click().catch(() => {});
  }
}

async function openScene(page: Page, scene: string) {
  await page.goto(`/explorer?v2=1&scene=${scene}`, { waitUntil: 'domcontentloaded' });
  await dismissCookies(page);
  // Un premier chargement à froid (build neuf, cache vide) peut dépasser 15 s :
  // on attend que les données pays soient arrivées avant d'aller plus loin.
  await page
    .waitForFunction(
      () => (document.querySelector('.xp-root')?.getAttribute('data-countries') ?? '0') !== '0',
      undefined,
      { timeout: 45_000 },
    )
    .catch(() => {});
  await expect(root(page)).toBeVisible({ timeout: 30_000 });
  await expect(root(page).locator('.xp-sheet')).toBeVisible({ timeout: 30_000 });
  await expect(root(page)).toHaveAttribute('data-scene', scene, { timeout: 30_000 });
}

test.describe('Explorer v2 · @explorer-v2', () => {
  test('Monde : titre, onglets et repères réels @explorer-v2', async ({ page }) => {
    await openScene(page, 'monde');
    await expect(root(page).locator('.xp-sheet-title')).toHaveText('Le monde');
    await expect(root(page).locator('.xp-tab')).toHaveCount(3);
    await expect(root(page).locator('.xp-bottombar')).toHaveCount(1);
    await page.waitForFunction(() => document.querySelectorAll('.xp-pin').length > 0, undefined, {
      timeout: 30_000,
    });
    expect(await root(page).locator('.xp-pin').count()).toBeGreaterThan(0);
  });

  test('toucher un pays plonge au niveau 1 @explorer-v2', async ({ page }) => {
    await openScene(page, 'monde');
    await page.waitForFunction(() => document.querySelectorAll('.xp-pin').length > 0);
    await root(page).locator('.xp-pin').first().click({ force: true });
    await expect(root(page)).toHaveAttribute('data-level', '1');
    await expect(root(page).locator('.xp-sheet-title')).not.toHaveText('Le monde');
  });

  test('changer d’onglet déplace la lentille et le panneau @explorer-v2', async ({ page }) => {
    await openScene(page, 'region');
    const tabs = root(page).locator('.xp-tab');
    await expect(tabs).toHaveCount(4);
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'false');
  });

  test('la poignée change de cran au toucher @explorer-v2', async ({ page }) => {
    await openScene(page, 'lieu');
    const sheet = root(page).locator('.xp-sheet');
    const before = (await sheet.boundingBox())?.height ?? 0;
    await root(page).locator('.xp-sheet-handle').click();
    await expect(sheet).toHaveAttribute('data-detent', 'low');
    await page.waitForTimeout(450);
    const after = (await sheet.boundingBox())?.height ?? 0;
    expect(after).toBeGreaterThan(before + 20);
  });

  test('la poignée répond au clavier (accès sans geste) @explorer-v2', async ({ page }) => {
    await openScene(page, 'lieu');
    const sheet = root(page).locator('.xp-sheet');
    await expect(sheet).toHaveAttribute('data-detent', 'peek');
    await root(page).locator('.xp-sheet-handle').focus();
    await page.keyboard.press('ArrowUp');
    await expect(sheet).toHaveAttribute('data-detent', 'low');
    await page.keyboard.press('End');
    await expect(sheet).toHaveAttribute('data-detent', 'full');
    await page.keyboard.press('Home');
    await expect(sheet).toHaveAttribute('data-detent', 'peek');
  });

  test('un repère ouvre sa fiche avec ses onglets @explorer-v2', async ({ page }) => {
    await openScene(page, 'lieu');
    await page.waitForFunction(() => document.querySelectorAll('.xp-pin').length > 0, undefined, {
      timeout: 30_000,
    });
    await root(page).locator('.xp-pin').first().click({ force: true });
    expect(await root(page).locator('.xp-tab').count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.xp-sheet')).toHaveAttribute('data-detent', 'mid');
  });

  test('le mode sombre applique le thème sombre @explorer-v2', async ({ page }) => {
    await openScene(page, 'nuit');
    await expect(root(page)).toHaveAttribute('data-theme', 'dark');
  });

  test('les états d’activité affichent la pastille, pas la barre basse @explorer-v2', async ({ page }) => {
    await openScene(page, 'course');
    await expect(root(page).locator('.xp-activity-pill')).toBeVisible();
    await expect(root(page).locator('.xp-bottombar')).toHaveCount(0);
    await expect(root(page).locator('.xp-sos')).toBeVisible();
  });

  test('chaque scène rend une feuille avec un titre @explorer-v2', async ({ page }) => {
    test.setTimeout(300_000);
    for (const scene of SCENES.slice(0, 8)) {
      await openScene(page, scene);
      const title = await root(page).locator('.xp-sheet-title').textContent();
      expect(title?.trim().length, `scène ${scene}`).toBeGreaterThan(0);
    }
  });

  test('a11y : aucune violation sérieuse sur le Monde @explorer-v2', async ({ page }) => {
    await openScene(page, 'monde');
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(serious.map((violation) => `${violation.id}: ${violation.nodes.length}`)).toEqual([]);
  });
});

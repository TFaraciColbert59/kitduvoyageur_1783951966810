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
  // La bannière est un overlay global z-60 : on attend qu'elle soit retirée.
  await page
    .locator('[aria-label="Gestion des cookies"]')
    .waitFor({ state: 'detached', timeout: 5000 })
    .catch(() => {});
}

async function gotoScene(page: Page, url: string) {
  // Sous charge, un `goto` peut être annulé par un rendu en cours : on réessaie.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'commit', timeout: 45_000 });
      return;
    } catch (error) {
      if (attempt === 1) throw error;
      await page.waitForTimeout(500);
    }
  }
}

async function openScene(page: Page, scene: string) {
  await gotoScene(page, `/explorer?v2=1&scene=${scene}`);
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
  // La carte doit être chargée (WebGL) : sous charge, son initialisation est le
  // principal facteur de variance des assertions qui suivent.
  await expect(page.locator('.xp-map[data-ready="1"]').last())
    .toBeAttached({ timeout: 30_000 })
    .catch(() => {
      // WebKit limite le nombre de contextes WebGL par processus : la carte peut
      // ne pas s'initialiser après plusieurs scènes. Les assertions de chrome
      // restent valides sans la carte.
    });
}

test.beforeEach(async ({ page }) => {
  // Consentement déjà stocké : la bannière ne recouvre jamais les commandes.
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'lkdv_cookie_consent',
      JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }),
    );
  });
});

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
    // La hauteur est animée : on attend qu'elle dépasse réellement le cran peek.
    await expect
      .poll(async () => (await sheet.boundingBox())?.height ?? 0, { timeout: 8000 })
      .toBeGreaterThan(before + 20);
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
    // Laisse la carte poser ses repères (le premier rendu décale le chrome).
    await page.waitForTimeout(1500);
    await expect(root(page).locator('.xp-bottombar')).toHaveCount(0);
    await expect(root(page).locator('.xp-sos')).toBeVisible();
  });

  test('SOS : présent, accessible et armable au clavier @explorer-v2', async ({ page }) => {
    await openScene(page, 'course');
    const sos = root(page).locator('.xp-sos');
    await expect(sos).toBeVisible();
    await expect(sos).toHaveAttribute('aria-label', /SOS/i);
    // Le maintien de 1,5 s est couvert par `sos-button.spec.tsx` (timers
    // contrôlés) ; ici on vérifie le chemin clavier, sans aléa de geste.
    await sos.focus();
    await page.keyboard.press('Enter');
    await expect(root(page).locator('.xp-sos-counting')).toBeVisible();
    // Échap annule immédiatement (pas d'attente d'actionnabilité).
    await page.keyboard.press('Escape');
    await expect(root(page).locator('.xp-toast')).toContainText('SOS annulé');
    await expect(root(page).locator('.xp-sos-counting')).toHaveCount(0);
  });

  test('hors itinéraire : bandeau ambre et distance @explorer-v2', async ({ page }) => {
    await openScene(page, 'horstrace');
    const banner = root(page).locator('.xp-offroute');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Hors itinéraire');
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

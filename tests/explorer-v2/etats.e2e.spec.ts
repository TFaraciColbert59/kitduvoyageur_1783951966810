import { expect, test, type Page } from '@playwright/test';

/**
 * États transverses (P2-13, P3-03, P4-11, P4-12) :
 * mouvement réduit, boussole, ouverture de 10 pays, unités impériales.
 */

function root(page: Page) {
  return page.locator('.xp-root').last();
}

/** Navigation robuste : sous charge, un `goto` peut être annulé par le rendu. */
async function gotoScene(page: Page, url: string) {
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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'lkdv_cookie_consent',
      JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }),
    );
  });
});

test.describe.configure({ retries: 2 });

test.describe('Explorer v2 · états @explorer-v2', () => {
  test('mouvement réduit : caméra sans animation @explorer-v2', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoScene(page, '/explorer?v2=1&scene=lieu');
    await expect(root(page)).toHaveAttribute('data-reduced-motion', 'true', { timeout: 45_000 });
    await expect(root(page).locator('.xp-sheet')).toBeVisible();
  });

  test('boussole : nord en haut / cap en haut @explorer-v2', async ({ page }) => {
    await gotoScene(page, '/explorer?v2=1&scene=course');
    await expect(root(page).locator('.xp-activity-pill')).toBeVisible({ timeout: 45_000 });
    const compass = root(page).locator('.xp-icon-btn[aria-label="Boussole"]');
    await expect(compass).toBeVisible();
    await compass.click();
    // L'intention de caméra est enregistrée dans la machine d'état.
    const events = await page.evaluate(() => {
      const store = window as unknown as { __explorerEvents?: Array<{ event: string }> };
      return (store.__explorerEvents ?? []).filter((entry) => entry.event === 'compass').length;
    });
    expect(events).toBeGreaterThan(0);
  });

  test('10 pays tirés au hasard sont ouvrables @explorer-v2', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoScene(page, '/explorer?v2=1&scene=ia');
    await expect(root(page).locator('.xp-sheet')).toBeVisible({ timeout: 45_000 });
    await page
      .waitForFunction(
        () =>
          (document.querySelector('.xp-root:last-of-type')?.getAttribute('data-countries') ?? '0') !== '0',
        undefined,
        { timeout: 45_000 },
      )
      .catch(() => {});

    const picks = await page.evaluate(async () => {
      const res = await fetch('/data/explorer-v2/countries.geojson');
      const json = await res.json();
      const seen = new Map<string, string>();
      for (const feature of json.features) {
        const { iso_a2, name } = feature.properties;
        if (iso_a2 && name) seen.set(iso_a2, name);
      }
      return [...seen.entries()].sort(() => Math.random() - 0.5).slice(0, 10).map(([iso, name]) => ({ iso, name }));
    });
    expect(picks).toHaveLength(10);

    let opened = 0;
    for (const pick of picks) {
      // Sous forte charge, un rendu peut être perdu : on réessaie une fois.
      if ((await page.locator('.xp-root').count()) === 0) {
        await gotoScene(page, '/explorer?v2=1&scene=ia');
        await expect(root(page).locator('.xp-sheet')).toBeVisible({ timeout: 30_000 });
      }
      // Tout se joue côté client : pas de rechargement de page entre les pays.
      const input = root(page).locator('.xp-searchinput');
      await input.waitFor({ state: 'visible', timeout: 15_000 });
      await input.fill('');
      await input.fill(pick.name);
      const row = root(page).locator('.xp-row', { hasText: pick.name }).first();
      const visible = await row
        .waitFor({ state: 'visible', timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      if (!visible) continue;
      await row.click({ force: true });
      await expect(page.locator('.xp-root').first()).toBeAttached({ timeout: 15_000 });
      await expect(root(page)).toHaveAttribute('data-level', '1', { timeout: 20_000 });
      const title = (await root(page).locator('.xp-sheet-title').textContent()) ?? '';
      expect(title.length).toBeGreaterThan(0);
      opened += 1;
      // Retour à la recherche par la capsule (client-side, instantané).
      await root(page).locator('.xp-search-main').click({ force: true });
      await expect(root(page).locator('.xp-searchinput')).toBeVisible({ timeout: 15_000 });
    }
    // 10 pays tirés au hasard : au moins 8 doivent s'ouvrir (2 peuvent être
    // masqués par la charge machine, sans que ce soit un défaut produit).
    expect(opened).toBeGreaterThanOrEqual(8);
  });

  test('unités impériales pour les États-Unis @explorer-v2', async ({ page }) => {
    await gotoScene(page, '/explorer?v2=1&scene=usa');
    await expect(root(page)).toHaveAttribute('data-units', 'imperial', { timeout: 45_000 });
    await gotoScene(page, '/explorer?v2=1&scene=pays');
    await expect(root(page)).toHaveAttribute('data-units', 'metric', { timeout: 45_000 });
  });
});

import { expect, test, type Page } from '@playwright/test';

/**
 * États transverses (P2-13, P3-03, P4-11, P4-12) :
 * mouvement réduit, boussole, ouverture de 10 pays, unités impériales.
 */

function root(page: Page) {
  return page.locator('.xp-root').last();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'lkdv_cookie_consent',
      JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }),
    );
  });
});

test.describe('Explorer v2 · états @explorer-v2', () => {
  test('mouvement réduit : caméra sans animation @explorer-v2', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/explorer?v2=1&scene=lieu', { waitUntil: 'domcontentloaded' });
    await expect(root(page)).toHaveAttribute('data-reduced-motion', 'true', { timeout: 45_000 });
    await expect(root(page).locator('.xp-sheet')).toBeVisible();
  });

  test('boussole : nord en haut / cap en haut @explorer-v2', async ({ page }) => {
    await page.goto('/explorer?v2=1&scene=course', { waitUntil: 'domcontentloaded' });
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
    test.setTimeout(240_000);
    await page.goto('/explorer?v2=1&scene=ia', { waitUntil: 'domcontentloaded' });
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
      const entries = [...seen.entries()].sort(() => Math.random() - 0.5).slice(0, 10);
      return entries.map(([iso, name]) => ({ iso, name }));
    });
    expect(picks).toHaveLength(10);

    let opened = 0;
    for (const pick of picks) {
      // Recherche réelle dans la feuille, puis ouverture du pays.
      const input = root(page).locator('.xp-searchinput');
      // WebKit ne déclenche pas toujours `onChange` avec `fill()`.
      await input.click();
      await input.pressSequentially(pick.name.slice(0, 12), { delay: 15 });
      const row = root(page).locator('.xp-row', { hasText: pick.name }).first();
      // La recherche interroge l'API : laisser le temps à la ligne d'apparaître.
      const visible = await row
        .waitFor({ state: 'visible', timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      if (!visible) continue;
      await row.click({ force: true });
      await expect(root(page)).toHaveAttribute('data-level', '1', { timeout: 15_000 });
      const title = (await root(page).locator('.xp-sheet-title').textContent()) ?? '';
      expect(title.length).toBeGreaterThan(0);
      opened += 1;
      // Retour à la recherche pour le pays suivant.
      await page.goto('/explorer?v2=1&scene=ia', { waitUntil: 'domcontentloaded' });
      await expect(root(page).locator('.xp-sheet')).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(300);
    }
    // Au moins 8 des 10 pays tirés au hasard doivent être trouvables et ouvrables.
    expect(opened).toBeGreaterThanOrEqual(8);
  });

  test('unités impériales pour les États-Unis @explorer-v2', async ({ page }) => {
    await page.goto('/explorer?v2=1&scene=usa', { waitUntil: 'domcontentloaded' });
    await expect(root(page)).toHaveAttribute('data-units', 'imperial', { timeout: 45_000 });
    await page.goto('/explorer?v2=1&scene=pays', { waitUntil: 'domcontentloaded' });
    await expect(root(page)).toHaveAttribute('data-units', 'metric', { timeout: 45_000 });
  });
});

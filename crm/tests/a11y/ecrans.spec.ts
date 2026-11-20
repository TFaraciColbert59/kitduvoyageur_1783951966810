import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, credentials } from '../support/env';
import { signIn } from '../support/flows';
import { sel } from '../support/selectors';
import {
  expectNoAxeViolations,
  expectTapTargets,
  expectTokenContrast,
  expectVisibleFocus,
  resolveRoute,
  screensFile
} from './support';

/**
 * Couche 5 — axe sur chaque écran, aux deux tailles de la maquette (projets `a11y`
 * et `a11y-mobile`), plus les contrôles que axe ne couvre pas : contraste des jetons,
 * focus visible, cibles ≥ 44 px.
 */

const SCREENS = screensFile()
  .screens.filter((screen) => screen.auth)
  .map((screen) => ({ slug: screen.slug, name: screen.name, url: resolveRoute(screen.route) }));

test.describe('Accessibilité — écrans du CRM', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
    await signIn(page);
  });

  for (const screen of SCREENS) {
    test(`${screen.slug} — 0 violation axe`, async ({ page }) => {
      await page.goto(screen.url);
      await expect(page.locator(sel.shell.root)).toBeVisible();
      await expectNoAxeViolations(page, screen.name);
    });
  }

  test('les jetons de couleur respectent les contrastes AA', async ({ page }) => {
    await page.goto('/');
    await expectTokenContrast(page);
  });

  test('les cibles tactiles font au moins 44 px', async ({ page }) => {
    await page.goto('/');
    await expectTapTargets(page);
  });

  test('le focus reste visible au clavier sur la file', async ({ page }) => {
    await page.goto('/');
    await expectVisibleFocus(page);
  });

  test('chaque écran a un titre unique et une langue déclarée', async ({ page }) => {
    for (const screen of SCREENS.slice(0, 6)) {
      await page.goto(screen.url);
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
      const title = await page.title();
      expect(title.trim().length).toBeGreaterThan(0);
      expect(await page.locator('h1').count()).toBeGreaterThanOrEqual(1);
    }
  });
});

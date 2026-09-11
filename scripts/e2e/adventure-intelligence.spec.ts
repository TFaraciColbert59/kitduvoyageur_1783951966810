import { test, expect } from '@playwright/test';

/**
 * A10 (10.11) — E2E Adventure Intelligence montée sur le hub réel.
 *
 * Anonyme-sûr : `/hub` replie sur possession vide côté serveur ; le bloc
 * Adventure affiche alors son état vide gracieux (jamais d'écran mort).
 * `terrain_live` est désactivé par défaut (aucun flag de domaine activé) :
 * la liste des conditions ne doit jamais apparaître.
 *
 * Même protocole consentement que voyage.spec.ts — aucune session requise.
 */

/** Bruit navigateur toléré (ressources externes), jamais une erreur applicative. */
const IGNORED_CONSOLE_PATTERNS = [
  /Failed to load resource/i,
  /favicon/i,
  /net::ERR_/i,
  /Download the React DevTools/i,
];

test.describe('Adventure Intelligence — montage hub', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      window.localStorage.setItem(
        'lkdv_cookie_consent',
        JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' })
      );
    });
  });

  test('TEST-A10-E2E-01: /hub rend la section Adventure sans erreur console', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await page.goto('/hub', { waitUntil: 'domcontentloaded' });

    const section = page.getByTestId('adventure-intelligence');
    await expect(section).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cockpit aventure' })).toBeVisible();

    // Données réelles OU état vide gracieux — jamais les deux absents.
    const emptyIndicators = section.getByText('Aucune donnée disponible pour le moment.');
    const realIndicators = section.locator('[aria-label="État global"] li');
    await expect(emptyIndicators.or(realIndicators.first())).toBeVisible();

    // Laisse passer l'hydratation et les requêtes de premier rendu avant de
    // juger le journal console (aucune erreur applicative tolérée).
    await page.waitForTimeout(750);

    const unexpectedErrors = consoleErrors.filter(
      (text) => !IGNORED_CONSOLE_PATTERNS.some((pattern) => pattern.test(text))
    );
    expect(unexpectedErrors).toEqual([]);
  });

  test('TEST-A10-E2E-02: focus clavier visible dans la section Adventure', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'domcontentloaded' });
    const section = page.getByTestId('adventure-intelligence');
    await expect(section).toBeVisible();

    let reached = false;
    for (let press = 0; press < 200 && !reached; press += 1) {
      reached = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        const root = document.querySelector('[data-testid="adventure-intelligence"]');
        return Boolean(active && root && active !== root && root.contains(active));
      });
      if (!reached) await page.keyboard.press('Tab');
    }
    expect(reached, 'un contrôle de la section Adventure doit être atteignable au clavier').toBe(
      true
    );

    const focusRing = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return { boxShadow: 'none', outlineStyle: 'none' };
      const style = getComputedStyle(active);
      return { boxShadow: style.boxShadow, outlineStyle: style.outlineStyle };
    });
    const hasVisibleIndicator =
      (focusRing.boxShadow !== '' && focusRing.boxShadow !== 'none') ||
      (focusRing.outlineStyle !== '' && focusRing.outlineStyle !== 'none');
    expect(hasVisibleIndicator, 'indicateur de focus visible attendu').toBe(true);
  });

  test('TEST-A10-E2E-03: terrain_live inactif par défaut ⇒ aucune liste de conditions', async ({ page }) => {
    await page.goto('/hub', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('adventure-intelligence')).toBeVisible();
    await expect(page.getByTestId('terrain-conditions')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Conditions terrain' })).toHaveCount(0);
  });
});

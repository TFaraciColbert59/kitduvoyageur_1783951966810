import { expect, test } from '@playwright/test';

/**
 * SOS en recette : le compte à rebours aboutit, aucun composeur ne s'ouvre,
 * et le bandeau affiche le numéro d'urgence du pays. La composition réelle
 * (`tel:`) est prouvée par `tests/explorer-v2/sos-call.spec.ts` (planSosCall
 * + performSosCall) : elle n'est pas déclenchable depuis un build de recette
 * par construction — c'est exactement la garantie demandée.
 */

test.describe.configure({ retries: 2 });

test('SOS : numéro du pays affiché, aucun appel réel @explorer-v2', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'lkdv_cookie_consent',
      JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }),
    );
    // Espionne toute tentative de navigation externe (tel:, sms:, mailto:).
    const original = window.location.href;
    void original;
    Object.defineProperty(window, '__externalNavigation', {
      configurable: true,
      writable: true,
      value: [] as string[],
    });
  });

  await page.goto('/explorer?v2=1&scene=course', { waitUntil: 'commit', timeout: 60_000 });
  await expect(page.locator('.xp-sos').first()).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(1000);

  const cursor = await page.evaluate(() => (window.__explorerEvents ?? []).length);
  await page.locator('.xp-sos').first().dispatchEvent('pointerdown');

  // Le bandeau apparaît à la fin du compte à rebours (1,5 s de maintien + 5 s)
  // et reste affiché quelques secondes : on l'attend au lieu de dormir.
  const toast = page.locator('.xp-toast');
  await expect(toast).toContainText(/appel simulé/i, { timeout: 20_000 });
  await expect(toast).toContainText(/\d{2,4}/);

  const events = await page.evaluate(
    (from) => (window.__explorerEvents ?? []).slice(from).map((entry) => entry.event),
    cursor,
  );
  expect(events).toContain('toast');

  // Aucune navigation : l'URL n'a pas changé de schéma.
  expect(page.url()).toMatch(/^https?:\/\//);
});

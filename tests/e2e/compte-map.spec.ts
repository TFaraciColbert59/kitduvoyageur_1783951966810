import { test, expect, type Page } from '@playwright/test';

/**
 * Compte — carte vivante.
 *
 * Le test invité s'exécute sans session et sans donnée fabriquée. Les parcours
 * propriétaire (données réelles, contextes, sortie) exigent une session
 * Supabase, comme les autres specs Compte : ils se sautent explicitement.
 */

const AUTH_ENABLED = process.env.LKDV_E2E_AUTH === '1';
const EMAIL = process.env.AUDIT_EMAIL;
const PASSWORD = process.env.AUDIT_PASSWORD;

async function login(page: Page) {
  await page.goto('/connexion');
  await page.locator('input[type="email"]:visible').first().fill(EMAIL!);
  await page.locator('input[type="password"]:visible').first().fill(PASSWORD!);
  await page.locator('main form:visible').first().locator('button[type="submit"]').click();
  await expect
    .poll(
      async () =>
        (await page.context().cookies()).some((cookie) => cookie.name.includes('auth-token')),
      { timeout: 20_000, message: 'session Supabase non établie' }
    )
    .toBe(true);
}

test.describe('Compte — carte invité', () => {
  test('carte neutre, CTA, aucun appel de données, contextes accessibles', async ({ page }) => {
    const mapCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/compte/map')) mapCalls.push(request.url());
    });

    await page.goto('/compte');
    await expect(page.locator('.lkdv-map-root')).toBeVisible();
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-map-ready', 'true');
    await expect(page.getByText('Connecte-toi pour voir ta carte.')).toBeVisible();
    await expect(page.locator('.lkdv-map-massif')).toHaveCount(0);
    expect(mapCalls).toHaveLength(0);

    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-map-mode', 'overview');

    await page.evaluate(() => {
      (window as unknown as { __lkdvOpenSlot?: (slot: string) => void }).__lkdvOpenSlot?.(
        'souvenirs'
      );
    });
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-map-mode', 'souvenirs');
  });
});

test.describe('Compte — carte propriétaire', () => {
  test.skip(!AUTH_ENABLED || !EMAIL || !PASSWORD, 'session Supabase requise');

  test('les drawers pilotent le mode de carte', async ({ page }) => {
    await login(page);
    await page.goto('/compte');
    await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-map-ready', 'true');

    for (const [slot, mode] of [
      ['vitrine', 'vitrine'],
      ['kit', 'kit'],
      ['prets', 'prets'],
      ['souvenirs', 'souvenirs'],
      ['communaute', 'communaute'],
    ] as const) {
      await page.evaluate((value) => {
        (window as unknown as { __lkdvOpenSlot?: (slot: string) => void }).__lkdvOpenSlot?.(
          value
        );
      }, slot);
      await expect(page.locator('.lkdv-map-root')).toHaveAttribute('data-map-mode', mode);
    }
  });
});

import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { prepareVisualPage } from './_helpers/prepareVisualPage';

/**
 * T10 — Captures de l'aperçu dev du rail de préparation
 * (`/preparer-sentier/apercu`, interdite en production) : rail aux 6 phases,
 * 4 squelettes, reveals. Un test par projet (desktop-chrome / iphone-14-pro-chromium /
 * ipad-portrait) → docs/preparer/apercu-<project>.png, zéro pageerror.
 *
 *   npx playwright test --config=playwright.visual.config.ts tests/visual/preparer-live.spec.ts
 */

const OUT_DIR = path.join('docs', 'preparer');
const APERCU_URL = '/preparer-sentier/apercu';
const PHASES = ['waiting', 'itinerary', 'moments', 'affiliation', 'kit', 'done'] as const;
const SKELETONS = ['timeline', 'moments', 'affiliate', 'kit'] as const;

test.describe('PRÉPARER — aperçu rail live (dev only)', () => {
  test('capture rail + squelettes + reveals, zéro pageerror', async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await prepareVisualPage(page, APERCU_URL);

    await expect(page.locator('[data-testid="preparer-apercu"]')).toBeVisible({ timeout: 45_000 });
    for (const phase of PHASES) {
      await expect(page.locator(`[data-phase="${phase}"]`)).toBeVisible();
    }
    for (const variant of SKELETONS) {
      await expect(page.locator(`[data-skeleton="${variant}"]`)).toBeVisible();
    }

    await page.waitForTimeout(1_200);

    mkdirSync(OUT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(OUT_DIR, `apercu-${testInfo.project.name}.png`),
      fullPage: true,
    });

    expect(pageErrors, pageErrors.join('\n')).toHaveLength(0);
  });
});

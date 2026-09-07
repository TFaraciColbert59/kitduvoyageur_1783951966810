import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Y0.5 — Protocole de capture déterministe du chantier Y.
 * Factorise le protocole historique des specs tests/visual/* et le renforce :
 *   - horloge figée (les compteurs J-N ne bougent plus d'un jour à l'autre) ;
 *   - consentement posé avant navigation (pas de bandeau dans les captures) ;
 *   - reducedMotion + colorScheme light ;
 *   - masques NOMMÉS uniquement ([data-visual-mask]) — on ne masque plus
 *     canvas/img en aveugle : chaque masque est posé explicitement sur le
 *     composant non déterministe concerné (globe three, tuiles de carte).
 *
 * Source du protocole historique : tests/visual/voyages-export-visual.spec.ts.
 */

/** Horloge de référence du chantier Y (données seed ancrées au 01/06/2026). */
export const VISUAL_CLOCK = new Date('2026-06-01T09:00:00Z');

export const CONSENT_STORAGE_KEY = 'lkdv_cookie_consent';

const DEV_OVERLAY_CSS =
  'nextjs-portal, [data-nextjs-toast], #nextjs-dev-overlay { display: none !important; opacity: 0 !important; visibility: hidden !important; }';

/**
 * Prépare la page de façon déterministe puis navigue.
 * À appeler AVANT toute interaction ; l'horloge est figée avant le goto pour
 * que le premier rendu serveur/hydraté voie déjà la date figée.
 */
export async function prepareVisualPage(page: Page, url: string): Promise<void> {
  await page.clock.setFixedTime(VISUAL_CLOCK);
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(
        key,
        JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' })
      );
    },
    { key: CONSENT_STORAGE_KEY }
  );
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto(url);
  await waitForVisualReady(page);
}

/** Attentes communes : contenu, disparition des spinners, polices, overlay dev masqué. */
export async function waitForVisualReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('main, .max-w-4xl', { timeout: 15_000 }).catch(() => {});
  await page
    .waitForSelector('[class*="animate-spin"]', { state: 'hidden', timeout: 10_000 })
    .catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: DEV_OVERLAY_CSS });
  await page.waitForTimeout(1200);
}

/**
 * Masques de capture — NOMMÉS uniquement.
 * Un élément non déterministe (globe, tuiles distantes) doit poser
 * data-visual-mask dans son JSX, avec un commentaire justifiant le masque.
 */
export function visualMasks(page: Page): Locator[] {
  return [page.locator('[data-visual-mask]'), page.locator('nextjs-portal')];
}

/** Capture de référence avec les tolérances canoniques du chantier. */
export async function expectVisualSnapshot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(name, {
    fullPage: false,
    mask: visualMasks(page),
    threshold: 0.02,
    maxDiffPixels: 300,
  });
}

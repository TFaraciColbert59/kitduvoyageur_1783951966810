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
 *
 * `opts.clock: false` — réservé aux pages sans compteurs temporels (J-N) :
 * sous horloge figée, l'évaluation d'images de /pays/fr ne résout jamais
 * (cause non élucidée, blocage page+clock) et l'horloge n'y apporte rien.
 */
export async function prepareVisualPage(
  page: Page,
  url: string,
  opts?: { clock?: boolean }
): Promise<void> {
  if (opts?.clock !== false) await page.clock.setFixedTime(VISUAL_CLOCK);
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
  // goto sur domcontentloaded : l'événement `load` n'arrive jamais sur les
  // pages à connexions persistantes (WebSocket communaute/carte, vidéos pays)
  // et fait exploser le timeout de test à 60 s.
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForVisualReady(page);
}

/** Attentes communes : contenu, disparition des spinners, polices, overlay dev masqué. */
export async function waitForVisualReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('main, .max-w-4xl', { timeout: 15_000 }).catch(() => {});
  await page
    .waitForSelector('[class*="animate-spin"]', { state: 'hidden', timeout: 10_000 })
    .catch(() => {});
  await page
    .evaluate(() => Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
    ]))
    .catch(() => {});
  // Images distantes (photos pays, tuiles OSM des cartes) : une <img> capturée
  // avant la fin de son chargement rend la capture non déterministe d'un run à
  // l'autre. Pas de networkidle ici : plusieurs pages tiennent des connexions
  // persistantes (WebSocket, SSE) qui ne s'arrêtent jamais.
  await page
    .evaluate(() =>
      Promise.race([
        Promise.all(
          Array.from(document.images)
            .filter((img) => !img.complete)
            .map((img) => new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            }))
        ),
        new Promise<void>((resolve) => setTimeout(resolve, 8_000)),
      ])
    )
    .catch(() => {});
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

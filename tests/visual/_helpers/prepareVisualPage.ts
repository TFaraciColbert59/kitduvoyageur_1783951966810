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
 * Neutralise transitions et animations au moment de la capture : les états
 * `.active` (ex. `glass-capsule-segment`, `transition: all`) appliqués après
 * hydratation pouvaient être photographiés en plein vol sous charge CI
 * (diff stable de ~1583 px sur l'onglet actif de /carte-interactive).
 * Les états finaux restent identiques — seule la trajectoire est supprimée.
 */
const FREEZE_TRANSITIONS_CSS =
  '*, *::before, *::after { transition-duration: 0s !important; transition-delay: 0s !important; animation-duration: 0s !important; animation-delay: 0s !important; }';

/**
 * Scrollbars overlay (Chromium Linux) : leur visibilité est transitoire
 * (fondu d'apparition/disparition) et tombait parfois dans la capture de la
 * barre `overflow-x-auto` des filtres de /carte-interactive — diff stable de
 * ~1583 px, une bande pleine largeur en bas du conteneur. Masquées pendant la
 * capture uniquement : aucun impact sur les états fonctionnels.
 */
const HIDE_SCROLLBARS_CSS =
  '*::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; } * { scrollbar-width: none !important; }';

/**
 * Prépare la page de façon déterministe puis navigue.
 * À appeler AVANT toute interaction ; l'horloge est figée avant le goto pour
 * que le premier rendu serveur/hydraté voie déjà la date figée (VISUAL_CLOCK).
 * Les timeouts d'attente (polices, images) sont gérés côté Node.js pour éviter
 * tout blocage avec l'horloge figée du navigateur.
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
  // Polices : attente avec timeout Node.js (immunisé contre le gel de page.clock)
  await Promise.race([
    page.evaluate(() => document.fonts.ready),
    new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
  ]).catch(() => {});

  // Images distantes (photos pays, tuiles OSM des cartes) : attente de chargement
  // avec timeout Node.js pour éviter le blocage sous page.clock figée.
  await Promise.race([
    page.evaluate(() =>
      Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map((img) => new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }))
      )
    ),
    new Promise<void>((resolve) => setTimeout(resolve, 8_000)),
  ]).catch(() => {});
  await page.addStyleTag({ content: FREEZE_TRANSITIONS_CSS });
  await page.addStyleTag({ content: HIDE_SCROLLBARS_CSS });
  await page.addStyleTag({ content: DEV_OVERLAY_CSS });
  await page.waitForTimeout(1200);
}

/**
 * Masques de capture — NOMMÉS uniquement.
 * Un élément non déterministe (globe, tuiles distantes) doit poser
 * data-visual-mask dans son JSX, avec un commentaire justifiant le masque.
 */
export function visualMasks(page: Page): Locator[] {
  return [
    page.locator('[data-visual-mask]'),
    // Tuiles OSM Leaflet : chargement réseau non déterministe (une tuile
    // peut manquer ou se peindre après la capture → diff ~1 tuile). Seul le
    // pane de tuiles est masqué ; marqueurs et contrôles restent vérifiés.
    page.locator('.leaflet-tile-pane'),
    page.locator('nextjs-portal'),
  ];
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

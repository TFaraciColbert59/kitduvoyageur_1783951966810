import { test, expect, type Page } from '@playwright/test';

/**
 * Kit Studio v2 — parcours mobile (T19).
 *
 * Vérifie l'écran unique : route plein écran, tiroir à 30 % ouvert seul,
 * rail de trois cartes, feuilles du tiroir (pilule → Bilan, Échap), sélection
 * sans bordure colorée. Quatre tailles d'écran, captures de référence.
 *
 * Aucune donnée fabriquée : le kit vient de `createInitialState` (localStorage
 * vidé avant chaque test), la scène est la vraie scène three.js.
 */

const CAPTURES = 'docs/kit-studio/captures';

/** Le squelette de `loading.tsx` garde la même racine : on vise l'écran hydraté (celui qui porte la pilule). */
const DOCK = 'section.ks-dock:not(.ks-skel-dock)';
const root = (page: Page) => page.locator('.ks-root:visible').last();
const pill = (page: Page) => page.locator('button.ks-pill').first();
const dockOf = (page: Page) => page.locator(DOCK).first();

const SIZES = [
  { w: 402, h: 874, name: '402x874' },
  { w: 393, h: 852, name: '393x852' },
  { w: 430, h: 932, name: '430x932' },
  { w: 360, h: 800, name: '360x800' },
] as const;

async function open(page: Page) {
  await page.goto('/kit-studio');
  // La bannière de consentement couvre le tiroir tant qu'elle est là : on refuse (aucun traceur).
  try {
    await page.getByRole('button', { name: 'Refuser' }).click({ timeout: 3_000 });
  } catch {
    /* cache déjà posé */
  }
  await expect(pill(page)).toBeVisible({ timeout: 15_000 });
  // Le tiroir s'ouvre seul à 750 ms (AUTO_OPEN_MS).
  await expect(dockOf(page)).toHaveAttribute('data-open', 'true', { timeout: 10_000 });
}

test.beforeEach(async ({ page }) => {
  await page.context().addInitScript(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* stockage indisponible */
    }
  });
});

test.describe('Kit Studio v2 — écran unique @mobile @webkit', () => {
  test("la route est plein écran, sans chrome d'application", async ({ page }) => {
    await page.setViewportSize({ width: 402, height: 874 });
    await open(page);
    const box = await root(page).boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box!.width)).toBe(402);
    expect(Math.round(box!.height)).toBe(874);
    // Aucune barre d'onglets ni en-tête d'application au-dessus du studio
    // (MobileNavWrapper ne rend que la bannière hors ligne sur /kit-studio).
    await expect(page.locator('nav')).toHaveCount(0);
    // La pilule du bilan est le seul contrôle permanent.
    await expect(pill(page)).toBeVisible();
  });

  test('le tiroir occupe 30 % de la hauteur et s’ouvre seul', async ({ page }) => {
    await page.setViewportSize({ width: 402, height: 874 });
    await open(page);
    // La hauteur est animée à l'ouverture : on mesure après la transition (0,5 s).
    await page.waitForTimeout(700);
    const box = await dockOf(page).boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box!.height - 874 * 0.3)).toBeLessThanOrEqual(2);
    // Marges latérales de 12 px (--gx) et basse de 12 px (--gb) : jamais collé au bord.
    expect(Math.round(box!.width)).toBe(402 - 24);
    const gap = 874 - (box!.y + box!.height);
    expect(gap).toBeGreaterThanOrEqual(10);
    expect(gap).toBeLessThanOrEqual(14);
  });

  test('le rail montre trois cartes, jamais un quart de carte', async ({ page }) => {
    await page.setViewportSize({ width: 402, height: 874 });
    await open(page);
    const rail = page.locator('.ks-rail');
    await expect(rail).toBeVisible();
    const cards = rail.locator('.ks-card');
    const n = await cards.count();
    expect(n).toBeGreaterThanOrEqual(3);
    const [r, c0, c1, c2] = await Promise.all([
      rail.boundingBox(),
      cards.nth(0).boundingBox(),
      cards.nth(1).boundingBox(),
      cards.nth(2).boundingBox(),
    ]);
    expect(r && c0 && c1 && c2).toBeTruthy();
    // Trois cartes tiennent exactement dans la largeur du rail.
    expect(Math.round(c2!.x + c2!.width - c0!.x)).toBe(Math.round(r!.width));
    expect(Math.round(c1!.x - (c0!.x + c0!.width))).toBe(Math.round(c2!.x - (c1!.x + c1!.width)));
  });

  test('la pilule ouvre le Bilan, Échap referme sur les cartes', async ({ page }) => {
    await page.setViewportSize({ width: 402, height: 874 });
    await open(page);
    const dock = dockOf(page);
    await expect(dock).toHaveAttribute('aria-label', 'Ajouter un objet à l’inventaire');
    await pill(page).click();
    await expect(dock).toHaveAttribute('aria-label', 'Bilan');
    await expect(page.locator('.ks-bl-ready')).toBeVisible();
    // Quatre pages : Poids, Équilibre, Journée par journée, Prêt.
    await expect(page.locator('.ks-pager .ks-page')).toHaveCount(4);
    await page.keyboard.press('Escape');
    await expect(dock).toHaveAttribute('aria-label', 'Ajouter un objet à l’inventaire');
    await expect(page.locator('.ks-rail')).toBeVisible();
  });

  test("la sélection d'une carte ne pose aucune bordure colorée", async ({ page }) => {
    await page.setViewportSize({ width: 402, height: 874 });
    await open(page);
    const first = page.locator('.ks-rail .ks-card').first();
    // La sélection se lit en mode Apparence : une carte d'option porte la pastille ✓.
    const look = page.getByRole('radio', { name: 'Apparence du sac' });
    // L'hydratation peut perdre le premier clic : on rejoue jusqu'à ce que le mode bascule.
    await expect(async () => {
      await look.click();
      await expect(look).toHaveAttribute('aria-checked', 'true', { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    // Le rail entre en fondu : on laisse l'animation finir avant de mesurer.
    await page.waitForTimeout(700);
    // Le clic laisse le focus : l'anneau de focus est un repère d'accessibilité, pas une bordure de sélection.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const styles = await page.locator('.ks-rail .ks-card').evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        return { border: s.borderTopWidth, color: s.borderTopColor };
      }),
    );
    // Critère SPEC-DRAWER : la sélection ne pose aucune bordure colorée (aucun trait).
    // L'anneau de focus reste libre : c'est un repère d'accessibilité, pas une sélection.
    for (const s of styles) {
      expect(s.border).toBe('0px');
    }
    // La sélection reste lisible : pastille ✓ sur la carte choisie.
    await expect(page.locator('.ks-card--on .ks-card__ck')).toHaveCount(1);
  });

  test('captures de référence aux quatre tailles', async ({ page }) => {
    for (const s of SIZES) {
      await page.setViewportSize({ width: s.w, height: s.h });
      await open(page);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${CAPTURES}/kit-studio-${s.name}.png` });
    }
  });
});

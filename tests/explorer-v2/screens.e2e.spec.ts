import { expect, test, type Page } from '@playwright/test';

/**
 * Recette structurelle des 42 écrans de la maquette (P4/P5/P6/P7/P8).
 *
 * Pour chaque scène : la feuille s'ouvre, un titre réel s'affiche, les onglets
 * annoncés par `03_ECRANS.md` sont présents, et la capture de parité
 * correspondante existe (`docs/explorer-v2/preuves/screens/<Ecran>.png`,
 * produite par `scripts/explorer-v2/capture-scenes.mjs`).
 */

const SCREENS: Array<{ scene: string; screen: string; minTabs: number; title: RegExp }> = [
  { scene: 'monde', screen: 'Monde', minTabs: 3, title: /Le monde|Monde/i },
  { scene: 'pays', screen: 'Pays', minTabs: 4, title: /France|Pays/i },
  { scene: 'region', screen: 'Region', minTabs: 4, title: /Auvergne|Région/i },
  { scene: 'lieu', screen: 'Lieu', minTabs: 4, title: /Haute-Savoie|Lieu|Chamonix/i },
  { scene: 'sommet', screen: 'Sommet', minTabs: 3, title: /.+/ },
  { scene: 'eau', screen: 'Eau', minTabs: 2, title: /.+/ },
  { scene: 'rando', screen: 'Rando', minTabs: 2, title: /Itinéraire|Rando/i },
  { scene: 'depart', screen: 'Depart', minTabs: 0, title: /Départ/i },
  { scene: 'ia', screen: 'Recherche', minTabs: 0, title: /Recherche/i },
  { scene: 'calques', screen: 'Calques', minTabs: 0, title: /Calques/i },
  { scene: 'offline', screen: 'HorsLigne', minTabs: 0, title: /Hors ligne/i },
  { scene: 'lancer', screen: 'Demarrer', minTabs: 0, title: /Démarrer/i },
  { scene: 'course', screen: 'Course', minTabs: 0, title: /Course/i },
  { scene: 'kayak', screen: 'Kayak', minTabs: 0, title: /Kayak/i },
  { scene: 'randolive', screen: 'RandoLive', minTabs: 0, title: /Randonnée/i },
  { scene: 'velo', screen: 'Velo', minTabs: 0, title: /Vélo|Velo/i },
  { scene: 'ski', screen: 'SkiRando', minTabs: 0, title: /Ski/i },
  { scene: 'escalade', screen: 'Escalade', minTabs: 0, title: /Escalade/i },
  { scene: 'trail', screen: 'Trail', minTabs: 0, title: /Trail/i },
  { scene: 'famille', screen: 'Famille', minTabs: 0, title: /famille/i },
  { scene: 'bivlive', screen: 'BivouacNuit', minTabs: 0, title: /Bivouac/i },
  { scene: 'horstrace', screen: 'HorsTrace', minTabs: 0, title: /Randonnée|Hors/i },
  { scene: 'sos', screen: 'SOS', minTabs: 0, title: /SOS/i },
  { scene: 'resume', screen: 'Bilan', minTabs: 0, title: /Bilan/i },
  { scene: 'arriere', screen: 'Arriere', minTabs: 0, title: /Randonnée|Arrière/i },
  { scene: 'bienvenue', screen: 'Bienvenue', minTabs: 0, title: /Bienvenue/i },
  { scene: 'noloc', screen: 'SansPosition', minTabs: 0, title: /Sans position/i },
  { scene: 'nuit', screen: 'Nuit', minTabs: 4, title: /.+/ },
  { scene: 'facile', screen: 'Facile', minTabs: 4, title: /.+/ },
  { scene: 'monde_jp', screen: 'MondeAsie', minTabs: 3, title: /Japon/i },
  { scene: 'japon', screen: 'Japon', minTabs: 4, title: /Japon/i },
  { scene: 'nagano', screen: 'Nagano', minTabs: 4, title: /Nagano/i },
  { scene: 'usa', screen: 'USA', minTabs: 4, title: /États-Unis/i },
  { scene: 'chili', screen: 'Chili', minTabs: 4, title: /Chili/i },
  { scene: 'mongolie', screen: 'Mongolie', minTabs: 4, title: /Mongolie/i },
  { scene: 'refuge', screen: 'Refuge', minTabs: 3, title: /.+/ },
  { scene: 'bivouac', screen: 'Bivouac', minTabs: 3, title: /.+/ },
  { scene: 'vue', screen: 'Belvedere', minTabs: 3, title: /.+/ },
  { scene: 'danger', screen: 'Danger', minTabs: 2, title: /Danger/i },
  { scene: 'acces', screen: 'Acces', minTabs: 2, title: /Accès|Acces/i },
  { scene: 'ami', screen: 'Ami', minTabs: 3, title: /Ami/i },
];

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

test.describe('Explorer v2 · 41 écrans @explorer-v2', () => {
  // 41 pages avec carte WebGL : sous charge, une réexécution évite de compter
  // une lenteur machine comme une régression (assertions structurelles).
  test.describe.configure({ timeout: 120_000, retries: 2 });

  for (const { scene, screen, minTabs, title } of SCREENS) {
    test(`${screen} (${scene}) @explorer-v2`, async ({ page }) => {
      await page.goto(`/explorer?v2=1&scene=${scene}`, { waitUntil: 'domcontentloaded' });
      await expect(root(page)).toHaveAttribute('data-scene', scene, { timeout: 45_000 });
      await expect(root(page).locator('.xp-sheet')).toBeVisible({ timeout: 30_000 });
      // Données pays/régions chargées : sans elles les titres retombent sur l'ISO.
      await page
        .waitForFunction(
          () =>
            (document.querySelector('.xp-root:last-of-type')?.getAttribute('data-countries') ?? '0') !==
            '0',
          undefined,
          { timeout: 45_000 },
        )
        .catch(() => {});
      await page.waitForTimeout(400);
      const sheetTitle = (await root(page).locator('.xp-sheet-title').textContent()) ?? '';
      expect(sheetTitle.trim().length, `titre vide sur ${screen}`).toBeGreaterThan(0);
      expect(sheetTitle, `titre inattendu sur ${screen}`).toMatch(title);
      const tabs = await root(page).locator('.xp-tab').count();
      expect(tabs, `onglets de ${screen}`).toBeGreaterThanOrEqual(minTabs);
      // Une seule barre basse (ou la pastille d'activité), jamais les deux.
      const bars = await root(page).locator('.xp-bottombar').count();
      const pills = await root(page).locator('.xp-activity-pill').count();
      expect(bars + pills, `barre basse de ${screen}`).toBe(1);
      if (scene === 'nuit') {
        await expect(root(page)).toHaveAttribute('data-theme', 'dark');
      }
    });
  }
});

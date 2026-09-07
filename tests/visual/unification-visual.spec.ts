import { test, expect } from '@playwright/test';

/**
 * Tests de non-régression visuelle pixel — Chantier U (Design Unifié)
 * Vérifie l'intégrité graphique des 4 écrans de référence :
 * - /materiel (référence Liquid Glass)
 * - /compte (référence profils et onglets)
 * - /voyages (module voyages harmonisé)
 * - /pays/fr (layout 3 colonnes desktop libéré via AppShellDesktop)
 */

const ROUTES = [
  { path: '/materiel', name: 'materiel' },
  { path: '/compte', name: 'compte' },
  { path: '/voyages', name: 'voyages' },
  { path: '/pays/fr', name: 'pays-fr' },
];

test.describe('Chantier U — Non-Régression Visuelle Pixel', () => {
  for (const route of ROUTES) {
    test(`rendu stable et contrastes — ${route.name}`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // Vérifier la présence d'éléments interactifs
      const count = await page.locator('body *').count();
      expect(count).toBeGreaterThan(15);

      // Capture de validation de page complète
      await expect(page).toHaveScreenshot(`unification-${route.name}.png`, {
        maxDiffPixelRatio: 0.05,
        threshold: 0.2,
      });
    });
  }
});

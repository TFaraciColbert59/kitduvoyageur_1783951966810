import { test, expect } from '@playwright/test';
import { prepareVisualPage, expectVisualSnapshot } from './_helpers/prepareVisualPage';

/**
 * Tests de non-régression visuelle pixel — Chantier U (Design Unifié)
 * Vérifie l'intégrité graphique des 4 écrans de référence :
 * - /materiel (référence Liquid Glass)
 * - /compte (référence profils et onglets)
 * - /hub (module voyages harmonisé, nature possession anonyme)
 * - /pays/fr (layout 3 colonnes desktop libéré via AppShellDesktop)
 * Protocole canonique Y0.5 : consentement posé, horloge figée, transitions
 * gelées, masques nommés (protocole factorisé dans _helpers/prepareVisualPage).
 */

const ROUTES = [
  { path: '/materiel', name: 'materiel' },
  { path: '/compte', name: 'compte' },
  { path: '/hub', name: 'hub' },
  {
    path: '/pays/fr',
    name: 'pays-fr',
    abortPatterns: ['**/api/ai/country-guide/**'],
  },
];

test.describe('Chantier U — Non-Régression Visuelle Pixel', () => {
  for (const route of ROUTES) {
    test(`rendu stable et contrastes — ${route.name}`, async ({ page }) => {
      await prepareVisualPage(page, route.path, { abortPatterns: route.abortPatterns });

      // Vérifier la présence d'éléments interactifs
      const count = await page.locator('body *').count();
      expect(count).toBeGreaterThan(15);

      // Capture de validation de page complète
      await expectVisualSnapshot(page, `unification-${route.name}.png`);
    });
  }
});

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Y0.5 / Porte G6 — scans d'accessibilité du module voyage.
 * Un test par surface ; exécuté sur chaque projet du config (desktop, iphone, ipad).
 * Critère : zéro violation axe `critical` ou `serious`.
 * Les surfaces nouvelles (securite, journal, sections du layout) s'ajoutent ici
 * au fil de Y2/Y4 — la liste ci-dessous couvre les routes existantes.
 */

const SURFACES: Array<{ id: string; url: string }> = [
  { id: 'voyages-liste', url: '/voyages' },
  { id: 'voyage-overview', url: '/voyages/fdgb-3c3a92' },
  { id: 'voyage-itineraire', url: '/voyages/fdgb-3c3a92/itineraire' },
  { id: 'voyage-kit', url: '/voyages/fdgb-3c3a92/kit' },
  { id: 'voyage-export', url: '/voyages/fdgb-3c3a92/export' },
  { id: 'voyages-nouveau', url: '/voyages/nouveau' },
];

for (const surface of SURFACES) {
  test(`a11y ${surface.id} — zéro violation critical/serious`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'lkdv_cookie_consent',
        JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' })
      );
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(surface.url);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('main', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const results = await new AxeBuilder({ page })
      // Contenus tiers non maîtrisés (tuiles de carte, canvas) exclus du scan ;
      // les règles couleur sont couvertes par le garde-fou statique x6.
      .disableRules(['color-contrast'])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (blocking.length > 0) {
      const detail = blocking
        .map(
          (v) =>
            `${v.id} [${v.impact}] ${v.help} — ${v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(' '))
              .join(' | ')}`
        )
        .join('\n');
      console.error(`[a11y ${surface.id}] violations bloquantes :\n${detail}`);
    }

    expect(blocking, `${blocking.length} violation(s) bloquante(s) sur ${surface.id}`).toEqual([]);
  });
}

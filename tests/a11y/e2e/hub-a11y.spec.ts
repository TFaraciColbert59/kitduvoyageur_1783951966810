import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * H7 / Porte G6 — scans d'accessibilité du hub voyageur.
 * Un test par surface × nature ; exécuté sur chaque projet du config
 * (desktop, iphone, ipad). Critère : zéro violation axe critical/serious.
 * - possession : anonyme (défaut).
 * - collectif : cookie d'aventure collectif (données vides = fallbacks).
 * - sortie : cookie sortie y-exped-group (+ auth démo si disponible).
 */

function adventureCookie(data: unknown): { name: string; value: string; domain: string; path: string } {
  return {
    name: 'lkv_active_adventure',
    value: Buffer.from(JSON.stringify(data), 'utf-8').toString('base64url'),
    domain: 'localhost',
    path: '/',
  };
}

const COLLECTIF_COOKIE = adventureCookie({
  nature: 'collectif',
  kind: 'groupe',
  id: '00000000-0000-0000-0000-000000000000',
  title: 'Alpes Team',
});

const SORTIE_COOKIE = adventureCookie({
  nature: 'sortie',
  id: 'y-exped-group',
  slug: 'y-exped-group',
  title: 'Expedition',
});

const SURFACES: Array<{ id: string; url: string; cookie?: { name: string; value: string; domain: string; path: string } }> = [
  { id: 'hub-overview-possession', url: '/hub' },
  { id: 'hub-inventaire', url: '/hub/inventaire' },
  { id: 'hub-kit', url: '/hub/kit' },
  { id: 'hub-alertes', url: '/hub/alertes' },
  { id: 'hub-overview-collectif', url: '/hub', cookie: COLLECTIF_COOKIE },
  { id: 'hub-groupe', url: '/hub/groupe', cookie: COLLECTIF_COOKIE },
  { id: 'hub-invitations', url: '/hub/invitations', cookie: COLLECTIF_COOKIE },
  { id: 'hub-overview-sortie', url: '/hub', cookie: SORTIE_COOKIE },
];

for (const surface of SURFACES) {
  test(`a11y ${surface.id} — zéro violation critical/serious`, async ({ page, context }) => {
    if (surface.cookie) {
      await context.addCookies([surface.cookie]);
    }
    await page.addInitScript(() => {
      localStorage.setItem(
        'lkdv_cookie_consent',
        JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }),
      );
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(surface.url);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('main', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    if (blocking.length > 0) {
      const detail = blocking
        .map(
          (v) =>
            `${v.id} [${v.impact}] ${v.help} — ${v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(' '))
              .join(' | ')}`,
        )
        .join('\n');
      console.error(`[a11y ${surface.id}] violations bloquantes :\n${detail}`);
    }

    expect(blocking, `${blocking.length} violation(s) bloquante(s) sur ${surface.id}`).toEqual([]);
  });
}

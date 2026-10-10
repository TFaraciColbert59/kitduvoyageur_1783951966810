import { test, expect, type Page } from '@playwright/test';

/**
 * Plan 5.4 — « Zones sûres vérifiées sur iPhone à encoche (capture 393 × 852) ».
 *
 * Chromium sait imposer des zones sûres (`Emulation.setSafeAreaInsetsOverride`,
 * CDP) : `env(safe-area-inset-*)` rend alors les valeurs d'un iPhone à encoche
 * et on mesure où le Compas se pose. Ce que cela PROUVE : la mise en page du
 * Compas respecte les zones sûres quand le navigateur les annonce. Ce que cela
 * ne prouve PAS : le rendu du WKWebView de l'app Capacitor sur un iPhone réel
 * (moteur WebKit, Dynamic Island, clavier) — seul un appareil ou un simulateur
 * iOS le démontre.
 *
 * Valeurs d'un iPhone 15 : portrait 393 × 852 (haut 59, bas 34) ; paysage
 * 852 × 393 (côtés 59, bas 21). La page testée est le Compas vide
 * (`/compas?nouvelle=1`) : il ne demande ni compte ni donnée.
 *
 * `CAPTURE_DIR=<dossier>` écrit aussi la capture 393 × 852 (×3) en JPEG.
 */

const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

type Insets = { top: number; bottom: number; left: number; right: number };

async function openCompas(page: Page, context: import('@playwright/test').BrowserContext, insets: Insets) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets });
  await page.goto('/compas?nouvelle=1');
  await expect(page.locator('.compas')).toBeVisible();
  // Le bandeau de cookies masque la barre d'onglets : on le ferme comme le ferait la personne.
  await page
    .getByRole('button', { name: 'Refuser' })
    .click({ timeout: 5000 })
    .catch(() => undefined);
  await page.waitForTimeout(800);
}

/** Les bords du contenu du Compas, hors fond plein écran (`.cp-bg`, voulu sous l'encoche). */
function contentEdges(page: Page) {
  return page.evaluate(() => {
    let top = Infinity;
    let left = Infinity;
    let right = 0;
    for (const el of document.querySelectorAll('.compas *')) {
      if (el.closest('.cp-bg')) continue;
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (b.width < 2 || b.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      top = Math.min(top, b.top);
      left = Math.min(left, b.left);
      right = Math.max(right, b.right);
    }
    const nav = document.querySelector('nav[aria-label="Navigation principale"]');
    const items = nav ? [...nav.querySelectorAll('a,button')].map((e) => e.getBoundingClientRect()) : [];
    return {
      top,
      left,
      right,
      navBottom: items.length ? Math.max(...items.map((i) => i.bottom)) : null,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}

test.describe('Compas — zones sûres iPhone à encoche', { tag: '@mobile' }, () => {
  test.describe('portrait 393 × 852', () => {
    test.use({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA_IPHONE });

    test('rien sous l’encoche ni sous la barre d’accueil', async ({ page, context, browserName }) => {
      test.skip(browserName !== 'chromium', 'Zones sûres imposées par CDP : Chromium seulement.');
      const insets = { top: 59, bottom: 34, left: 0, right: 0 };
      await openCompas(page, context, insets);

      // viewport-fit=cover : sans lui, env(safe-area-inset-*) vaut 0 sur iOS.
      expect(await page.locator('meta[name="viewport"]').getAttribute('content')).toContain('viewport-fit=cover');

      const e = await contentEdges(page);
      expect(e.top).toBeGreaterThanOrEqual(insets.top);
      expect(e.navBottom).not.toBeNull();
      expect(e.navBottom!).toBeLessThanOrEqual(852 - insets.bottom);
      expect(e.scrollWidth).toBeLessThanOrEqual(393);

      if (process.env.CAPTURE_DIR) {
        await page.screenshot({
          path: `${process.env.CAPTURE_DIR}/compas-393x852-zones-sures.jpg`,
          type: 'jpeg',
          quality: 80,
        });
      }
    });
  });

  test.describe('paysage 852 × 393', () => {
    test.use({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA_IPHONE });

    test('rien sous l’encoche latérale', async ({ page, context, browserName }) => {
      test.skip(browserName !== 'chromium', 'Zones sûres imposées par CDP : Chromium seulement.');
      const insets = { top: 0, bottom: 21, left: 59, right: 59 };
      await openCompas(page, context, insets);

      const e = await contentEdges(page);
      expect(e.left).toBeGreaterThanOrEqual(insets.left);
      expect(e.right).toBeLessThanOrEqual(852 - insets.right);
      expect(e.scrollWidth).toBeLessThanOrEqual(852);
    });
  });
});

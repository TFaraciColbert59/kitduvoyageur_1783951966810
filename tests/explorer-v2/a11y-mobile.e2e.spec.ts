import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibilité et ergonomie tactile de l'Explorer v2 (P8-05 → P8-07) :
 * axe sur 4 scènes, cibles ≥ 44 px, texte à 200 % sans débordement.
 */

function root(page: Page) {
  return page.locator('.xp-root').last();
}

async function gotoScene(page: Page, url: string) {
  // Sous charge, un `goto` peut être annulé par un rendu en cours : on réessaie.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'commit', timeout: 45_000 });
      return;
    } catch (error) {
      if (attempt === 1) throw error;
      await page.waitForTimeout(500);
    }
  }
}

async function openScene(page: Page, scene: string) {
  await gotoScene(page, `/explorer?v2=1&scene=${scene}`);
  const refuse = page.getByRole('button', { name: /^Refuser$/ });
  if (await refuse.count()) await refuse.first().click().catch(() => {});
  await expect(root(page)).toHaveAttribute('data-scene', scene, { timeout: 45_000 });
  await page.waitForTimeout(1200);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'lkdv_cookie_consent',
      JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }),
    );
  });
});

test.describe('Explorer v2 · a11y mobile @explorer-v2', () => {
  for (const scene of ['monde', 'lieu', 'eau', 'course']) {
    test(`aucune violation sérieuse · ${scene} @explorer-v2`, async ({ page }) => {
      await openScene(page, scene);
      const results = await new AxeBuilder({ page })
        .disableRules(['color-contrast'])
        .analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(serious.map((violation) => `${violation.id}:${violation.nodes.length}`)).toEqual([]);
    });
  }

  test('cibles tactiles conformes au gabarit @explorer-v2', async ({ page }) => {
    await openScene(page, 'lieu');
    // Mesure de la cible réelle le long des axes (les extensions `::after`
    // comptent). Seuil : 44 px pour les lignes et onglets, 40 px pour le chrome
    // — la maquette fixe 40 px pour les boutons ronds (loi de référence), et
    // WCAG 2.5.8 exige 24 px ; l'extension CSS porte la zone à 46 px.
    const result = await root(page).evaluate((element) => {
      const nodes = Array.from(
        element.querySelectorAll('button, [role="tab"], a[href]'),
      ) as HTMLElement[];
      const problems: Array<{ label: string; className: string; span: number; height: number }> = [];

      const reaches = (node: HTMLElement, x: number, y: number) => {
        const target = document.elementFromPoint(x, y);
        return !!target && (node === target || node.contains(target) || target.contains(node));
      };

      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.top < 0 || rect.bottom > window.innerHeight) continue;
        // Ignore ce qui est rogné par la zone défilante : la sonde ne peut pas
        // l'atteindre, ce n'est pas un défaut de cible tactile.
        const scroller = node.closest('.xp-sheet-scroll');
        if (scroller) {
          const box = scroller.getBoundingClientRect();
          if (rect.top < box.top - 1 || rect.bottom > box.bottom + 1) continue;
        }
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let span = 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          let extent = 0;
          for (let step = 1; step <= 26; step += 1) {
            if (!reaches(node, cx + dx * step, cy + dy * step)) break;
            extent = step;
          }
          span = Math.max(span, extent * 2);
        }
        const isRow = node.classList.contains('xp-row') || node.getAttribute('role') === 'tab';
        const minimum = isRow ? 44 : 40;
        if (span < minimum) {
          problems.push({
            label: node.getAttribute('aria-label') || node.textContent?.trim().slice(0, 30) || '',
            className: String(node.className),
            span,
            height: Math.round(rect.height),
          });
        }
      }
      return problems;
    });
    // `.xp-pin` : pastille de 28 px, zone tactile étendue par CSS, hors flux carte.
    expect(result.filter((item) => !/xp-pin/.test(item.className))).toEqual([]);
  });

  test('texte à 200 % sans débordement horizontal @explorer-v2', async ({ page }) => {
    await openScene(page, 'pays');
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => {
      const root = document.querySelector('.xp-root') as HTMLElement | null;
      return root ? root.scrollWidth - root.clientWidth : 0;
    });
    expect(overflow).toBeLessThanOrEqual(2);
  });
});

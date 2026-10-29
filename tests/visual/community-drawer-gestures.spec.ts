import { expect, test, type Locator, type Page } from '@playwright/test';
import { cors, installCommunityFeedFixture } from './_helpers/communityFeedFixture';

/**
 * Carte-drawer : elle descend jusqu'au bas de l'écran et la barre du bas
 * s'efface ; glisser vers le bas n'importe où la ferme ; glisser à gauche ou
 * à droite change d'onglet ; la carte du carnet garde ses propres gestes.
 */

/** Glissement tactile (événements `touch*`, comme sur un téléphone). */
async function touchSwipe(target: Locator, dx: number, dy: number) {
  await target.evaluate(
    (el, [moveX, moveY]) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + Math.min(rect.height / 2, 120);
      const touch = (cx: number, cy: number) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: cy });
      const fire = (type: string, cx: number, cy: number, ended = false) =>
        el.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: ended ? [] : [touch(cx, cy)],
            targetTouches: ended ? [] : [touch(cx, cy)],
            changedTouches: [touch(cx, cy)],
          }),
        );
      fire('touchstart', x, y);
      for (let i = 1; i <= 8; i += 1) fire('touchmove', x + (moveX * i) / 8, y + (moveY * i) / 8);
      fire('touchend', x + moveX, y + moveY, true);
    },
    [dx, dy],
  );
}

async function open(page: Page) {
  const fixture = await installCommunityFeedFixture(page);
  await page.route(/\/rest\/v1\/(clubs|events|carnets|club_members|event_participants)(\?.*)?$/, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(route) });
    const table = new URL(route.request().url()).pathname.split('/').at(-1);
    const rows: Record<string, unknown[]> = {
      clubs: [{ id: 'k1', slug: 'cordee', name: 'La Cordée du Vercors', description: 'Sorties le week-end.', cover_image: '/assets/images/community-morning.jpg', category: 'Randonnée', members_count: 42, privacy: 'open', created_at: '2026-06-01T00:00:00Z' }],
    };
    return route.fulfill({ headers: cors(route), json: rows[table ?? ''] ?? [] });
  });
  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.lkdv-feed-post').first()).toBeVisible();
  await fixture.signIn();
}

test('ouverte, la carte descend jusqu’en bas et la barre du bas s’efface ; glisser vers le bas la ferme', async ({ page }) => {
  await open(page);
  const bar = page.locator('nav.lkdv-floating-tabbar');
  await expect(bar).toBeVisible();
  await page.getByRole('button', { name: 'Créer dans l’application' }).click();
  const card = page.locator('.lkdv-cd');
  await expect(card).toBeVisible();
  await expect(bar).toBeHidden();
  const box = await card.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && viewport.height - (box.y + box.height)).toBeLessThanOrEqual(12);

  await touchSwipe(page.getByRole('tabpanel', { name: 'Publication', exact: true }), 0, 180);
  await expect(card).toHaveCount(0);
  await expect(bar).toBeVisible();
});

test('glisser à gauche ou à droite change d’onglet dans l’Explorer', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Explorer et rechercher' }).click();
  const tabs = page.getByRole('tablist', { name: 'Sections' });
  await tabs.getByRole('tab', { name: 'Clubs', exact: true }).click();
  const pane = page.getByRole('tabpanel', { name: 'Clubs', exact: true });
  await expect(pane.locator('.lkdv-ex-card')).toBeVisible();
  await touchSwipe(pane.locator('.lkdv-ex-card'), -160, 6);
  await expect(tabs.getByRole('tab', { name: 'Sorties', exact: true })).toHaveAttribute('aria-selected', 'true');
  await touchSwipe(page.getByRole('tabpanel', { name: 'Sorties', exact: true }), 160, 4);
  await expect(tabs.getByRole('tab', { name: 'Clubs', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('la carte du carnet garde ses gestes : glisser vers le bas dessus ne ferme pas', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Créer dans l’application' }).click();
  await page.getByRole('tab', { name: 'Carnet', exact: true }).click();
  const map = page.locator('.lkdv-carnet-map');
  await expect(map).toBeVisible({ timeout: 45_000 });
  await touchSwipe(map, 0, 200);
  await expect(page.locator('.lkdv-cd')).toBeVisible();
});

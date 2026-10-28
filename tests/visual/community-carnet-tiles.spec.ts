import { expect, test, type Page } from '@playwright/test';
import { AUTHOR_ID, cors, installCommunityFeedFixture } from './_helpers/communityFeedFixture';

/** Explorer · Carnets : tuiles espacées à image pleine, titre bas droite, j'aime et commentaires fonctionnels. */

const CARNETS = [
  { id: 'c1', title: 'Vercors en 3 jours', description: 'Crêtes et bivouacs.', cover_image: null, author_id: AUTHOR_ID, created_at: '2026-06-01T08:00:00Z', visibility: 'public' },
  { id: 'c2', title: 'Tour du Mont-Blanc', description: 'Dix jours, trois pays.', cover_image: null, author_id: 'someone-else', created_at: '2026-05-01T08:00:00Z', visibility: 'public' },
  { id: 'c3', title: 'Laugavegur', description: null, cover_image: null, author_id: 'someone-else', created_at: '2026-04-01T08:00:00Z', visibility: 'public' },
];

async function openCarnets(page: Page) {
  const posted: Array<{ table: string; body: unknown }> = [];
  const fixture = await installCommunityFeedFixture(page);
  await page.route(/\/rest\/v1\/(carnets|clubs|events|club_members|event_participants|carnet_likes|carnet_comments)(\?.*)?$/, async (route) => {
    const request = route.request();
    const table = new URL(request.url()).pathname.split('/').at(-1) as string;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(route) });
    if (request.method() === 'POST') {
      posted.push({ table, body: request.postDataJSON() });
      return route.fulfill({ status: 201, headers: cors(route), json: [] });
    }
    if (request.method() !== 'GET') return route.fulfill({ status: 204, headers: cors(route) });
    const rows: Record<string, unknown[]> = {
      carnets: CARNETS,
      clubs: [],
      events: [],
      club_members: [],
      event_participants: [],
      carnet_likes: [
        { carnet_id: 'c1', user_id: 'u-a' },
        { carnet_id: 'c1', user_id: 'u-b' },
        { carnet_id: 'c2', user_id: 'u-a' },
      ],
      carnet_comments: [{ carnet_id: 'c1' }, { carnet_id: 'c1' }, { carnet_id: 'c1' }],
    };
    return route.fulfill({ headers: cors(route), json: rows[table] ?? [] });
  });
  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.lkdv-feed-post').first()).toBeVisible();
  await fixture.signIn();
  await page.getByRole('button', { name: 'Ouvrir les sections' }).click();
  const dialog = page.getByRole('dialog', { name: 'Explorer la communauté' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.lkdv-ct').first()).toBeVisible();
  return { dialog, posted };
}

test('Carnets : tuiles espacées, image pleine, titre à droite, j’aime et commentaires', async ({ page }, testInfo) => {
  const { posted } = await openCarnets(page);
  const tiles = page.locator('.lkdv-ct');
  await expect(tiles).toHaveCount(3);

  const [a, b] = await Promise.all([tiles.nth(0).boundingBox(), tiles.nth(1).boundingBox()]);
  expect(Math.round(b!.x - (a!.x + a!.width))).toBeGreaterThanOrEqual(10);

  const link = page.getByRole('link', { name: 'Ouvrir le carnet Vercors en 3 jours' });
  const [linkBox, tileBox] = await Promise.all([link.boundingBox(), tiles.nth(0).boundingBox()]);
  expect(Math.round(linkBox!.width)).toBe(Math.round(tileBox!.width));
  expect(Math.round(linkBox!.height)).toBe(Math.round(tileBox!.height));
  expect(await tiles.nth(0).locator('.lkdv-ct-title').evaluate((el) => getComputedStyle(el).textAlign)).toBe('right');

  const like = tiles.nth(0).getByRole('button', { name: /J’aime : 2/ });
  await expect(like).toBeVisible();
  await expect(tiles.nth(0).getByRole('link', { name: 'Commentaires : 3' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('carnets-tuiles.png') });

  await like.click();
  await expect(tiles.nth(0).getByRole('button', { name: /Retirer mon j’aime : 3/ })).toHaveAttribute('aria-pressed', 'true');
  expect(posted.find((entry) => entry.table === 'carnet_likes')?.body).toMatchObject({ carnet_id: 'c1', user_id: AUTHOR_ID });

  await link.click();
  await expect(page).toHaveURL(/\/carnets\/c1$/, { timeout: 30_000 });
});

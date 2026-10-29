import { expect, test } from '@playwright/test';
import { AUTHOR_ID, cors, installCommunityFeedFixture } from './_helpers/communityFeedFixture';

/** Fil : défilement infini au curseur, image prioritaire, drawers hors du chargement initial. */

const post = (n: number) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  author_id: AUTHOR_ID,
  content: `Publication numéro ${n}`,
  image_url: null,
  media_urls: [],
  created_at: new Date(Date.UTC(2026, 5, 30, 12, 0, 0) - n * 3600_000).toISOString(),
  likes_count: n,
  comments_count: 0,
  shares_count: 0,
  audience: 'public',
});

test('la page suivante est demandée au curseur en approchant de la fin du fil', async ({ page }) => {
  const requests: string[] = [];
  await installCommunityFeedFixture(page);
  await page.route(/\/rest\/v1\/community_posts(\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(route) });
    if (request.method() !== 'GET') return route.fallback();
    const url = decodeURIComponent(request.url());
    requests.push(url);
    const older = url.includes('created_at.lt.');
    const rows = older ? [11, 12, 13].map(post) : Array.from({ length: 10 }, (_, i) => post(i + 1));
    return route.fulfill({ headers: cors(route), json: rows });
  });

  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.lkdv-feed-post')).toHaveCount(10);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toContain('order=created_at.desc,id.desc');
  expect(requests[0]).not.toContain('offset=');

  // Le fil défile dans `.lkdv-feed-main` (pas dans la page).
  await page.locator('.lkdv-feed-main').evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await expect(page.locator('.lkdv-feed-post')).toHaveCount(13);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toContain(`created_at.lt."${post(10).created_at}"`);
  expect(requests[1]).toContain(`id.lt."${post(10).id}"`);

  // Page courte (3 < 10) : fin du fil, plus aucune requête.
  await expect(page.getByText('Tu as tout vu.')).toBeVisible();
  await page.locator('.lkdv-feed-main').evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await page.waitForTimeout(600);
  expect(requests).toHaveLength(2);
});

test('la première image est prioritaire, les suivantes différées', async ({ page }) => {
  await installCommunityFeedFixture(page);
  await page.route(/\/rest\/v1\/community_posts(\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(route) });
    if (request.method() !== 'GET') return route.fallback();
    return route.fulfill({
      headers: cors(route),
      json: Array.from({ length: 10 }, (_, i) => ({ ...post(i + 1), image_url: '/assets/images/community-morning.jpg' })),
    });
  });
  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.lkdv-feed-post')).toHaveCount(10);

  const images = page.locator('img.lkdv-feed-post-media');
  await expect(images.first()).toHaveAttribute('loading', 'eager');
  await expect(images.first()).toHaveAttribute('fetchpriority', 'high');
  await expect(images.nth(1)).toHaveAttribute('loading', 'lazy');
  await expect(images.nth(1)).toHaveAttribute('decoding', 'async');
});

test('les drawers ne sont pas montés tant qu’on ne les ouvre pas', async ({ page }) => {
  await installCommunityFeedFixture(page);
  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.lkdv-feed-post').first()).toBeVisible();
  await expect(page.locator('.lkdv-cd')).toHaveCount(0);
  await page.getByRole('button', { name: 'Rechercher dans la communauté' }).click();
  await expect(page.getByRole('dialog', { name: 'Explorer la communauté' })).toBeVisible();
});

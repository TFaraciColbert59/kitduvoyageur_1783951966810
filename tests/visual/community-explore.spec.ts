import { expect, test, type Page } from '@playwright/test';
import { AUTHOR_ID, cors, installCommunityFeedFixture } from './_helpers/communityFeedFixture';

/** Explorer la communauté : 5 volets sans défilement vertical, carrousels, détail en place. */

const CARNETS = [
  { id: 'c1', title: 'Vercors en 3 jours', description: 'Crêtes et bivouacs.', cover_image: null, author_id: AUTHOR_ID, created_at: '2026-06-01T08:00:00Z', visibility: 'public' },
  { id: 'c2', title: 'Tour du Mont-Blanc', description: 'Dix jours, trois pays.', cover_image: null, author_id: 'someone-else', created_at: '2026-05-01T08:00:00Z', visibility: 'public' },
  { id: 'c3', title: 'Laugavegur', description: null, cover_image: null, author_id: 'someone-else', created_at: '2026-04-01T08:00:00Z', visibility: 'public' },
];
const CLUBS = [
  { id: 'k1', slug: 'cordee', name: 'Cordée du Dauphiné', description: 'Rando et alpinisme.', cover_image: null, category: 'Randonnée', members_count: 12 },
  { id: 'k2', slug: 'trail', name: 'Trail Alpes', description: null, cover_image: null, category: 'Trail', members_count: 40 },
];
const EVENTS = [
  { id: 'e1', title: 'Lac Blanc au lever du jour', description: 'Départ 5 h.', event_date: '2030-07-01', location: 'Chamonix', cover_image: null, current_participants: 3, max_participants: 10, status: 'upcoming' },
];
const POSTS = [
  { id: 'p1', content: 'Bivouac au lac Blanc', image_url: null, media_urls: [] },
  { id: 'p2', content: 'Lac Blanc, matin brumeux', image_url: null, media_urls: [] },
];

async function openExplorer(page: Page) {
  const posted: Array<{ table: string; body: unknown }> = [];
  const fixture = await installCommunityFeedFixture(page);
  await page.route(/\/rest\/v1\/(carnets|clubs|events|community_posts|club_members|event_participants|carnet_likes|carnet_comments)(\?.*)?$/, async (route) => {
    const request = route.request();
    const table = new URL(request.url()).pathname.split('/').at(-1) as string;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(route) });
    if (request.method() === 'POST') {
      posted.push({ table, body: request.postDataJSON() });
      return route.fulfill({ status: 201, headers: cors(route), json: [] });
    }
    if (request.method() !== 'GET') return route.fulfill({ status: 204, headers: cors(route) });
    // Le fil lui-même (sans filtre de recherche) reste servi par le simulateur du fil.
    if (table === 'community_posts' && !request.url().includes('ilike')) return route.fallback();
    const rows: Record<string, unknown[]> = {
      carnets: CARNETS,
      clubs: CLUBS,
      events: EVENTS,
      community_posts: POSTS,
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
  await page.getByRole('button', { name: 'Rechercher dans la communauté' }).click();
  const dialog = page.getByRole('dialog', { name: 'Explorer la communauté' });
  await expect(dialog).toBeVisible();
  return { dialog, posted };
}

/** Onglet de la capsule principale (et non du filtre de recherche, qui porte parfois le même nom). */
const section = (dialog: ReturnType<Page['getByRole']>, name: string) =>
  dialog.getByRole('tablist', { name: 'Sections' }).getByRole('tab', { name, exact: true });

const overflow = (loc: ReturnType<Page['getByRole']>) => loc.evaluate((el) => el.scrollHeight - el.clientHeight);

test.describe('Explorer la communauté', () => {
  test('5 volets, tous sans défilement vertical', async ({ page }, testInfo) => {
    const { dialog } = await openExplorer(page);
    await expect(dialog.getByRole('tablist', { name: 'Sections' }).getByRole('tab')).toHaveCount(5);
    for (const name of ['Recherche', 'Pour toi', 'Carnets', 'Clubs', 'Sorties']) {
      if (name !== 'Recherche') await section(dialog, name).click();
      const pane = dialog.getByRole('tabpanel', { name, exact: true });
      await expect(pane).toBeVisible();
      expect(await overflow(pane), `volet ${name}`).toBeLessThanOrEqual(1);
      if (name === 'Carnets') await page.screenshot({ path: testInfo.outputPath('explorer-carnets.png') });
      if (name === 'Pour toi') await page.screenshot({ path: testInfo.outputPath('explorer-pour-toi.png') });
    }
    // Aucun défilement de page non plus.
    expect(await page.evaluate(() => (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight)).toBeLessThanOrEqual(1);
  });

  test('la recherche regroupe, pagine par 4 et se filtre par type', async ({ page }, testInfo) => {
    const { dialog } = await openExplorer(page);
    const pane = dialog.getByRole('tabpanel', { name: 'Recherche', exact: true });
    await pane.getByRole('searchbox').fill('lac');
    await expect(pane.getByRole('status').first()).toContainText(/\d+ résultats?/);
    const total = Number((await pane.locator('.lkdv-ex-count').innerText()).match(/\d+/)![0]);
    expect(total).toBeGreaterThan(4);
    await expect(pane.locator('.lkdv-ex-dots button')).toHaveCount(Math.ceil(total / 4));
    expect(await pane.locator('.lkdv-ex-result').count()).toBeGreaterThanOrEqual(4);
    await page.screenshot({ path: testInfo.outputPath('explorer-recherche.png') });

    const secondary = dialog.locator('.lkdv-drawer-secondary .ig-tabs');
    expect(Math.round((await secondary.boundingBox())!.height)).toBe(30);
    await expect(secondary.getByRole('tab')).toHaveCount(6);
    await secondary.getByRole('tab', { name: /^Clubs/ }).click();
    await expect(pane.locator('.lkdv-ex-count')).toContainText('2 résultats');
    expect(await overflow(pane)).toBeLessThanOrEqual(1);
  });

  test('Carnets : tuiles espacées à image pleine, titre en bas à droite, j’aime et commentaires fonctionnels', async ({ page }, testInfo) => {
    const { dialog, posted } = await openExplorer(page);
    await section(dialog, 'Carnets').click();
    const pane = dialog.getByRole('tabpanel', { name: 'Carnets', exact: true });
    const tiles = pane.locator('.lkdv-ct');
    await expect(tiles).toHaveCount(3);

    // Pas collées : au moins 8 px entre deux tuiles voisines.
    const [a, b] = await Promise.all([tiles.nth(0).boundingBox(), tiles.nth(1).boundingBox()]);
    expect(Math.round(b!.x - (a!.x + a!.width))).toBeGreaterThanOrEqual(8);
    // L’image (ou le fond) remplit toute la tuile.
    const link = pane.getByRole('link', { name: 'Ouvrir le carnet Vercors en 3 jours' });
    const [linkBox, tileBox] = await Promise.all([link.boundingBox(), tiles.nth(0).boundingBox()]);
    expect(Math.round(linkBox!.width)).toBe(Math.round(tileBox!.width));
    expect(Math.round(linkBox!.height)).toBe(Math.round(tileBox!.height));
    // Titre aligné à droite, compteurs sous le titre.
    expect(await tiles.nth(0).locator('.lkdv-ct-title').evaluate((el) => getComputedStyle(el).textAlign)).toBe('right');
    const likeButton = tiles.nth(0).getByRole('button', { name: /J’aime : 2/ });
    await expect(likeButton).toBeVisible();
    await expect(tiles.nth(0).getByRole('link', { name: 'Commentaires : 3' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('explorer-carnets-tuiles.png') });

    // J’aime : bascule tout de suite et écrit dans carnet_likes.
    await likeButton.click();
    await expect(tiles.nth(0).getByRole('button', { name: /Retirer mon j’aime : 3/ })).toHaveAttribute('aria-pressed', 'true');
    expect(posted.find((entry) => entry.table === 'carnet_likes')?.body).toMatchObject({ carnet_id: 'c1', user_id: AUTHOR_ID });

    expect(await overflow(pane)).toBeLessThanOrEqual(1);

    // Toute la tuile mène au carnet et ferme l’Explorer.
    await link.click();
    await expect(page).toHaveURL(/\/carnets\/c1$/, { timeout: 20_000 });
  });

  test('Carnets : « Proposer » mène à la page de création de carnet existante', async ({ page }) => {
    const { dialog } = await openExplorer(page);
    await section(dialog, 'Carnets').click();
    await dialog.locator('.lkdv-drawer-secondary .ig-tabs').getByRole('tab', { name: 'Proposer' }).click();
    await expect(page).toHaveURL(/\/carnets\/nouveau$/);
  });

  test('Carnets : le filtre « Mes carnets » ne garde que les miens', async ({ page }) => {
    const { dialog } = await openExplorer(page);
    await section(dialog, 'Carnets').click();
    const pane = dialog.getByRole('tabpanel', { name: 'Carnets', exact: true });
    await dialog.locator('.lkdv-drawer-secondary .ig-tabs').getByRole('tab', { name: 'Mes carnets' }).click();
    await expect(pane.locator('.lkdv-ct')).toHaveCount(1);
    await expect(pane.getByRole('link', { name: 'Ouvrir le carnet Vercors en 3 jours' })).toBeVisible();
  });

  test('Clubs : rejoindre envoie l’adhésion et le bouton devient « Quitter »', async ({ page }) => {
    const { dialog, posted } = await openExplorer(page);
    await section(dialog, 'Clubs').click();
    const pane = dialog.getByRole('tabpanel', { name: 'Clubs', exact: true });
    await pane.getByRole('button', { name: 'Rejoindre' }).first().click();
    await expect(pane.getByRole('button', { name: 'Quitter' }).first()).toBeVisible();
    expect(posted.find((entry) => entry.table === 'club_members')?.body).toMatchObject({ club_id: 'k1', user_id: AUTHOR_ID, status: 'active' });
  });

  test('Échap et re-clic sur l’onglet actif ferment l’Explorer', async ({ page }) => {
    const { dialog } = await openExplorer(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: 'Rechercher dans la communauté' }).click();
    await page.getByRole('dialog', { name: 'Explorer la communauté' }).getByRole('tablist', { name: 'Sections' }).getByRole('tab', { name: 'Recherche' }).click();
    await expect(page.getByRole('dialog', { name: 'Explorer la communauté' })).toHaveCount(0);
  });
});

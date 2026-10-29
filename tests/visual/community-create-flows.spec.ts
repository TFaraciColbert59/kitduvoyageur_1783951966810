import { expect, test, type Locator, type Page } from '@playwright/test';
import { AUTHOR_ID, cors, installCommunityFeedFixture } from './_helpers/communityFeedFixture';

/**
 * Drawer Créer : glissement entre étapes (avec rebond si l'étape est bloquée), Story en plein fond,
 * Club (image obligatoire, activité modérée) et Kit (blocs + sélecteur de produits).
 */

// PNG 1×1 : suffisant pour un aperçu local.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const GEAR = [
  { id: '00000000-0000-4000-8000-0000000000a1', user_id: AUTHOR_ID, name: 'Tente Nammatj', brand: 'Hilleberg', category: 'Tente', weight_g: 2400, wear_percentage: 40, image: null },
  { id: '00000000-0000-4000-8000-0000000000a2', user_id: AUTHOR_ID, name: 'Sac Osprey 55', brand: 'Osprey', category: 'Sac', weight_g: 1900, usage_count: 6, image: null },
];
const SHOP = [{ id: '00000000-0000-4000-8000-0000000000b1', slug: 'lampe-frontale', name: 'Lampe frontale', brand: 'Petzl', category: 'Éclairage', weight_g: 85, price_eur: 49.9, image: '', stock: 8, is_active: true }];
const LISTINGS = {
  location: [{ id: 'l1', owner_id: 'o', name: 'Réchaud Jetboil', brand: 'Jetboil', category: 'Cuisine', condition: 'bon', photo_url: null, mode: 'location', description: '', public_location: 'Annecy', price_cents: 800, deposit_cents: 3000, status: 'published', created_at: '2026-06-01T00:00:00Z' }],
  vente: [],
  pret: [],
};

async function openCreate(page: Page, tab: string) {
  const fixture = await installCommunityFeedFixture(page);
  await page.route(/\/rest\/v1\/(gear_items|shop_products|materiel_kits|materiel_kit_items)(\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(route) });
    const table = new URL(request.url()).pathname.split('/').at(-1);
    if (request.method() !== 'GET') return route.fulfill({ status: 201, headers: cors(route), json: [] });
    return route.fulfill({ headers: cors(route), json: table === 'gear_items' ? GEAR : table === 'shop_products' ? SHOP : [] });
  });
  await page.route('**/api/marketplace/listings**', async (route) => {
    const mode = new URL(route.request().url()).searchParams.get('mode') as keyof typeof LISTINGS;
    await route.fulfill({ json: { listings: LISTINGS[mode] ?? [] } });
  });
  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.lkdv-feed-post').first()).toBeVisible();
  await fixture.signIn();
  await page.getByRole('button', { name: 'Créer dans l’application' }).click();
  const card = page.locator('.lkdv-cd');
  await expect(card).toBeVisible();
  if (tab !== 'Publication') await page.getByRole('tab', { name: tab, exact: true }).click();
  return card;
}

/** Glissement tactile simulé par événements pointeur sur l'élément (le cadre écoute `pointer*`). */
async function swipe(target: Locator, dx: number) {
  await target.evaluate(
    (el, delta) => {
      const rect = el.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const fire = (type: string, x: number) =>
        el.dispatchEvent(
          new PointerEvent(type, { pointerId: 7, pointerType: 'touch', button: 0, isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }),
        );
      fire('pointerdown', startX);
      for (let i = 1; i <= 6; i += 1) fire('pointermove', startX + (delta * i) / 6);
      fire('pointerup', startX + delta);
    },
    dx,
  );
}

const stepLabel = (pane: Locator) => pane.locator('.lkdv-wz-count');

test.describe('Créer — glissement entre étapes', () => {
  test('glisser à gauche sur une étape incomplète rebondit sans avancer, puis avance une fois remplie', async ({ page }) => {
    await openCreate(page, 'Sortie');
    const pane = page.getByRole('tabpanel', { name: 'Sortie', exact: true });
    await expect(stepLabel(pane)).toHaveText('1/4');

    await swipe(pane.locator('.lkdv-wz-body'), -140);
    await expect(pane.locator('.lkdv-wz-swipe')).toHaveAttribute('data-bounce', 'left');
    await expect(stepLabel(pane)).toHaveText('1/4');
    await expect(pane.getByRole('alert')).toBeVisible();

    await pane.getByLabel('Titre').fill('Lac Blanc au lever du jour');
    await swipe(pane.locator('.lkdv-wz-body'), -140);
    await expect(stepLabel(pane)).toHaveText('2/4');

    await swipe(pane.locator('.lkdv-wz-body'), 140);
    await expect(stepLabel(pane)).toHaveText('1/4');
  });

  test('glisser à droite sur la première étape ouvre l’onglet précédent (Carnet, créé par la carte)', async ({ page }) => {
    await openCreate(page, 'Sortie');
    const pane = page.getByRole('tabpanel', { name: 'Sortie', exact: true });
    await swipe(pane.locator('.lkdv-wz-body'), 140);
    await expect(page.getByRole('tab', { name: 'Carnet', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/\/communaute/);
  });
});

test.describe('Créer — Story en plein fond', () => {
  test('le média prend la place du fond, les sélecteurs disparaissent, seule la flèche reste', async ({ page }, testInfo) => {
    const card = await openCreate(page, 'Story');
    const pane = page.getByRole('tabpanel', { name: 'Story', exact: true });
    await pane.locator('input[type="file"]:not([capture])').setInputFiles({ name: 'story.png', mimeType: 'image/png', buffer: PNG });

    const stage = card.locator('.lkdv-story-stage');
    await expect(stage).toBeVisible();
    const [cardBox, stageBox] = await Promise.all([card.boundingBox(), stage.boundingBox()]);
    expect(Math.round(stageBox!.width)).toBe(Math.round(cardBox!.width));
    expect(Math.round(stageBox!.height)).toBe(Math.round(cardBox!.height));
    for (const selector of ['.lkdv-drawer-topnav', '.lkdv-drawer-secondary']) {
      const nodes = card.locator(selector);
      if ((await nodes.count()) > 0) expect(await nodes.first().evaluate((el) => getComputedStyle(el).visibility)).toBe('hidden');
    }

    // Seul bouton du plein fond : une flèche en bas à droite.
    const next = stage.getByRole('button', { name: 'Continuer' });
    await expect(stage.locator('button')).toHaveCount(1);
    const nextBox = await next.boundingBox();
    expect(nextBox!.x + nextBox!.width).toBeGreaterThan(cardBox!.x + cardBox!.width - 40);
    expect(nextBox!.y + nextBox!.height).toBeGreaterThan(cardBox!.y + cardBox!.height - 40);
    await page.screenshot({ path: testInfo.outputPath('story-plein-fond.png') });

    await next.click();
    await expect(stage).toHaveCount(0);
    await expect(pane.locator('.lkdv-wz-kicker')).toHaveText(/Diffusion/i);
    await expect(card.locator('.lkdv-drawer-topnav')).toBeVisible();
  });
});

test.describe('Créer — Club', () => {
  test('image obligatoire, activité libre mais modérée', async ({ page }) => {
    await openCreate(page, 'Club');
    const pane = page.getByRole('tabpanel', { name: 'Club', exact: true });
    await pane.getByLabel('Nom du club').fill('La Cordée du Vercors');
    await pane.getByLabel('Activité', { exact: true }).fill('Trail');
    await pane.getByRole('button', { name: 'Suivant' }).click();
    await expect(pane.getByRole('alert')).toContainText('image');

    await pane.locator('input[type="file"]').first().setInputFiles({ name: 'club.png', mimeType: 'image/png', buffer: PNG });
    await pane.getByLabel('Activité', { exact: true }).fill('Porn');
    await pane.getByRole('button', { name: 'Suivant' }).click();
    await expect(pane.getByRole('alert')).toContainText('pas accepté');

    await pane.getByLabel('Activité', { exact: true }).fill('Ski de randonnée');
    await pane.getByRole('button', { name: 'Suivant' }).click();
    await expect(pane.locator('.lkdv-wz-count')).toHaveText('2/3');
  });
});

test.describe('Créer — Kit en blocs', () => {
  test('un « + » seul au milieu, puis un nouveau « + » à côté de chaque produit choisi', async ({ page }, testInfo) => {
    const card = await openCreate(page, 'Kit');
    const pane = page.getByRole('tabpanel', { name: 'Kit', exact: true });
    await pane.getByLabel('Nom du kit').fill('Kit bivouac');
    await pane.getByRole('button', { name: 'Suivant' }).click();

    const add = pane.getByRole('button', { name: 'Ajouter un élément au kit' });
    await expect(add).toHaveCount(1);
    const [addBox, paneBox] = await Promise.all([add.boundingBox(), pane.boundingBox()]);
    expect(Math.abs(addBox!.x + addBox!.width / 2 - (paneBox!.x + paneBox!.width / 2))).toBeLessThan(12);

    // Sans élément, l'étape ne se valide pas.
    await pane.getByRole('button', { name: 'Suivant' }).click();
    await expect(pane.getByRole('alert')).toContainText('au moins un élément');

    await add.click();
    const picker = card.getByRole('dialog', { name: 'Choisir un produit' });
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('tab', { name: 'Inventaire' })).toHaveAttribute('aria-selected', 'true');
    await expect(picker.getByRole('tab', { name: 'Boutique' })).toBeVisible();

    // Inventaire : jauge d'usure = le seul mot « usure » en petit, sans pourcentage affiché.
    const tent = picker.getByRole('button', { name: 'Ajouter Tente Nammatj au kit' });
    await expect(tent.locator('.lkdv-kp-wear small')).toHaveText('usure');
    await expect(tent.locator('.lkdv-kp-wear-bar')).toHaveAttribute('aria-valuenow', '40');
    expect(await tent.innerText()).not.toMatch(/\d+\s?%/);
    await expect(picker.getByRole('button', { name: /au panier/ })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('kit-selecteur-inventaire.png') });

    await tent.click();
    await expect(picker).toHaveCount(0);
    await expect(pane.locator('.lkdv-kb-filled')).toHaveCount(1);
    await expect(add).toHaveCount(1); // un nouveau « + » est apparu à côté

    // Boutique : rubriques Achat / Location / Occasion / Prêt, bouton panier sur l'achat.
    await add.click();
    await picker.getByRole('tab', { name: 'Boutique' }).click();
    const rubriques = picker.getByRole('tablist', { name: 'Rubrique de la boutique' });
    await expect(rubriques.getByRole('tab')).toHaveText(['Achat', 'Location', 'Occasion', 'Prêt']);
    await expect(picker.getByRole('button', { name: 'Ajouter Lampe frontale au panier' })).toBeVisible();
    await picker.getByRole('button', { name: 'Ajouter Lampe frontale au panier' }).click();
    expect(await page.evaluate(() => localStorage.getItem('kdv_cart'))).toContain('Lampe frontale');
    await expect(picker.getByRole('button', { name: 'Ajouter Lampe frontale au kit' }).locator('.lkdv-kp-wear')).toHaveCount(0);

    await rubriques.getByRole('tab', { name: 'Location' }).click();
    await expect(picker.getByRole('button', { name: 'Ajouter Réchaud Jetboil au kit' })).toBeVisible();
    await expect(picker.getByRole('button', { name: /au panier/ })).toHaveCount(0);
    await picker.getByRole('button', { name: 'Ajouter Réchaud Jetboil au kit' }).click();
    await expect(pane.locator('.lkdv-kb-filled')).toHaveCount(2);

    // Rien ne défile verticalement, y compris par le focus ou un clic dans le sélecteur.
    const offsets = await pane.evaluate((el) => {
      const out: Record<string, number> = { pane: el.scrollTop };
      let node: HTMLElement | null = el.parentElement;
      while (node && !node.classList.contains('lkdv-cd')) {
        out[node.className.toString().slice(0, 40) || node.tagName] = node.scrollTop;
        node = node.parentElement;
      }
      out.card = node?.scrollTop ?? 0;
      return out;
    });
    for (const [name, top] of Object.entries(offsets)) expect(top, `scrollTop de ${name}`).toBe(0);
    expect(await pane.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath('kit-blocs.png') });
  });
});

import { expect, test } from '@playwright/test';
import { AUTHOR_ID, cors, installCommunityFeedFixture } from './_helpers/communityFeedFixture';

/** Kit : blocs avec « + », sélecteur de produits par-dessus le drawer (Inventaire / Boutique). */

const OWNED = [
  { id: '00000000-0000-4000-8000-0000000000a1', user_id: AUTHOR_ID, name: 'Tente Nammatj', category: 'Abri', weight_g: 2400, condition: 'use', photo_url: null },
  { id: '00000000-0000-4000-8000-0000000000a2', user_id: AUTHOR_ID, name: 'Sac Osprey 55', category: 'Portage', weight_g: 1900, condition: 'neuf', photo_url: null },
];
const SHOP = [
  { id: '00000000-0000-4000-8000-0000000000b1', slug: 'lampe-frontale', name: 'Lampe frontale', brand: 'Petzl', category: 'Éclairage', weight_g: 85, price_eur: 49.9, image: '', stock: 8, is_active: true },
];
const LISTINGS: Record<string, unknown[]> = {
  location: [{ id: 'l1', owner_id: 'o', name: 'Réchaud Jetboil', brand: 'Jetboil', category: 'Cuisine', condition: 'bon', photo_url: null, mode: 'location', description: '', public_location: 'Annecy', price_cents: 800, deposit_cents: 3000, status: 'published', created_at: '2026-06-01T00:00:00Z' }],
  vente: [],
  pret: [],
};

test('Kit : un « + » seul, puis un nouveau « + » à côté de chaque produit choisi', async ({ page }, testInfo) => {
  const fixture = await installCommunityFeedFixture(page);
  await page.route(/\/rest\/v1\/(product_ownership|shop_products)(\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(route) });
    const table = new URL(request.url()).pathname.split('/').at(-1);
    return route.fulfill({ headers: cors(route), json: table === 'product_ownership' ? OWNED : SHOP });
  });
  await page.route('**/api/marketplace/listings**', async (route) => {
    const mode = new URL(route.request().url()).searchParams.get('mode') ?? '';
    await route.fulfill({ json: { listings: LISTINGS[mode] ?? [] } });
  });
  await page.goto('/communaute', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.lkdv-feed-post').first()).toBeVisible();
  await fixture.signIn();
  await page.getByRole('button', { name: 'Créer dans l’application' }).click();
  const dialog = page.getByRole('dialog', { name: 'Créer dans l’application' });
  await dialog.getByRole('tab', { name: 'Kit', exact: true }).click();

  const add = dialog.getByRole('button', { name: 'Ajouter un élément au kit' });
  await expect(add).toHaveCount(1);
  await add.click();

  const picker = dialog.getByRole('dialog', { name: 'Choisir un produit' });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole('tab', { name: 'Inventaire' })).toHaveAttribute('aria-selected', 'true');
  await expect(picker.getByRole('tab', { name: 'Boutique' })).toBeVisible();

  // Inventaire : le mot « usure » en petit au-dessus d'une barre, sans pourcentage ; pas de panier.
  const tent = picker.getByRole('button', { name: 'Ajouter Tente Nammatj au kit' });
  await expect(tent.locator('.lkdv-kp-wear small')).toHaveText('usure');
  await expect(tent.locator('.lkdv-kp-wear-bar')).toHaveAttribute('aria-valuenow', '60');
  expect(await tent.innerText()).not.toMatch(/\d+\s?%/);
  await expect(picker.getByRole('button', { name: /au panier/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('kit-selecteur-inventaire.png') });

  await tent.click();
  await expect(picker).toHaveCount(0);
  await expect(dialog.locator('.lkdv-kb-filled')).toHaveCount(1);
  await expect(add).toHaveCount(1); // un nouveau « + » est apparu à côté

  // Boutique : Achat / Location / Occasion / Prêt, bouton panier sur l'achat seulement.
  await add.click();
  await picker.getByRole('tab', { name: 'Boutique' }).click();
  const rubriques = picker.getByRole('tablist', { name: 'Rubrique de la boutique' });
  await expect(rubriques.getByRole('tab')).toHaveText(['Achat', 'Location', 'Occasion', 'Prêt']);
  await picker.getByRole('button', { name: 'Ajouter Lampe frontale au panier' }).click();
  expect(await page.evaluate(() => localStorage.getItem('kdv_cart'))).toContain('Lampe frontale');

  await rubriques.getByRole('tab', { name: 'Location' }).click();
  await expect(picker.getByRole('button', { name: /au panier/ })).toHaveCount(0);
  await picker.getByRole('button', { name: 'Ajouter Réchaud Jetboil au kit' }).click();
  await expect(dialog.locator('.lkdv-kb-filled')).toHaveCount(2);
  // La feuille ne se décale pas (focus / défilement programmatique).
  expect(await dialog.evaluate((el) => el.scrollLeft)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('kit-blocs.png') });
});

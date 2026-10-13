import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Lot AH — deux écritures du kit qui mentaient :
 *   1. « Emprunter » n'écrivait que le porteur : l'objet restait « à trouver ». `compasBorrowItemAction`
 *      écrit `borrowed_from` (ce que le modèle lit comme « disponible ») avec le porteur, et s'annule.
 *   2. « Choisir » une location l'écrivait « dans le panier » alors que le panier ne porte pas un prix
 *      par jour avec des dates. Une location n'est JAMAIS `in_cart`, ni par `compasPickShopProductAction`
 *      ni par le setter générique de l'état d'achat.
 *
 * Réel : les actions, `requireEditor`, zod. Remplacée : la base (client Supabase en mémoire, sans RLS).
 */
const h = vi.hoisted(() => ({
  db: null as unknown as MemorySupabase,
  report: vi.fn(async (..._args: unknown[]) => undefined),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: h.report }));

import { compasBorrowItemAction, compasPickShopProductAction } from '../server/compasActions';
import { setTripItemPurchaseState } from '@/lib/queries-trip-kit';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';

const OWNER = 'aaaaaaaa-0000-4000-8000-000000000001';
const LEA = 'aaaaaaaa-0000-4000-8000-000000000002';
const STRANGER = 'aaaaaaaa-0000-4000-8000-000000000009';
const TRIP = '11111111-1111-4111-8111-111111111111';
const OTHER_TRIP = '22222222-2222-4222-8222-222222222222';
const STOVE = 'bbbbbbbb-0000-4000-8000-000000000001';
const FOREIGN = 'bbbbbbbb-0000-4000-8000-000000000004';

const RENTAL = 'cccccccc-0000-4000-8000-000000000001';
const BUY = 'cccccccc-0000-4000-8000-000000000002';
const BUY_NO_SLUG = 'cccccccc-0000-4000-8000-000000000003';
const BUY_NO_PRICE = 'cccccccc-0000-4000-8000-000000000004';
const USED = 'cccccccc-0000-4000-8000-000000000005';
const AUCTION = 'cccccccc-0000-4000-8000-000000000006';
const RENTAL_BOTH = 'cccccccc-0000-4000-8000-000000000007';
const GONE = 'cccccccc-0000-4000-8000-000000000008';

function product(id: string, extra: Record<string, unknown>) {
  return {
    id,
    slug: `produit-${id.slice(-1)}`,
    name: 'Réchaud',
    brand: 'Jetboil',
    category_main: 'cook',
    category: 'cook',
    weight_g: 410,
    weight_grams: null,
    price_eur: 39,
    price_per_day: null,
    image: '/img/rechaud.jpg',
    image_alt: 'Un réchaud',
    transaction_type: 'achat',
    is_active: true,
    deleted_at: null,
    ...extra,
  };
}

function setup(opts: { user?: string | null; canEdit?: boolean; state?: string } = {}) {
  h.db = memorySupabase({
    user: () => (opts.user === null ? null : { id: opts.user ?? OWNER }),
    rpc: opts.canEdit === false ? () => ({ data: false, error: null }) : undefined,
  });
  h.db.rows('trips').push({
    id: TRIP,
    user_id: OWNER,
    title: 'Trek',
    start_date: null,
    end_date: null,
    destination_name: null,
    destination_country_code: null,
    party_size: 2,
    budget_currency: 'EUR',
    metadata: {},
    updated_at: '2026-10-09T08:00:00.000000+00:00',
  });
  h.db.rows('trip_collaborators').push({ trip_id: TRIP, user_id: LEA, role: 'editor' });
  h.db.rows('trip_items').push(
    {
      id: STOVE,
      trip_id: TRIP,
      item_name: 'Réchaud',
      owner_id: null,
      ownership: 'personal',
      borrowed_from: null,
      purchase_state: opts.state ?? 'needed',
      shop_product_id: null,
      weight_grams: null,
    },
    { id: FOREIGN, trip_id: OTHER_TRIP, item_name: 'Autre', owner_id: null, ownership: 'personal', borrowed_from: null, purchase_state: 'needed' }
  );
  h.db.rows('shop_products').push(
    product(RENTAL, { transaction_type: 'location', price_eur: null, price_per_day: 6, slug: 'jetboil-location' }),
    product(RENTAL_BOTH, { transaction_type: 'location', price_eur: 120, price_per_day: 6 }),
    product(BUY, {}),
    product(BUY_NO_SLUG, { slug: null }),
    product(BUY_NO_PRICE, { price_eur: null }),
    product(USED, { transaction_type: 'occasion', price_eur: 22 }),
    product(AUCTION, { transaction_type: 'enchere' }),
    product(GONE, { is_active: false })
  );
}

const stove = () => h.db.rows('trip_items').find((r) => r.id === STOVE) as Record<string, unknown>;
const itemWrites = () => h.db.writes.filter((w) => w.table === 'trip_items');

beforeEach(() => {
  vi.clearAllMocks();
});

const borrow = (extra: Record<string, unknown> = {}) =>
  compasBorrowItemAction({ tripId: TRIP, tripSlug: 'trek', itemId: STOVE, lenderId: LEA, ...extra } as never);

describe('compasBorrowItemAction : emprunter, c’est être disponible', () => {
  it('écrit le prêteur (borrowed_from) ET le porteur commun, en une seule écriture', async () => {
    setup();
    expect(await borrow()).toEqual({ success: true });
    expect(stove()).toMatchObject({ borrowed_from: LEA, owner_id: LEA, ownership: 'shared' });
    expect(itemWrites()).toHaveLength(1);
  });

  it('annuler (prêteur null) vide l’emprunt et rétablit le porteur et le mode d’avant', async () => {
    setup();
    await borrow();
    const res = await borrow({ lenderId: null, restore: { carrierId: OWNER, shared: false } });
    expect(res).toEqual({ success: true });
    expect(stove()).toMatchObject({ borrowed_from: null, owner_id: OWNER, ownership: 'personal' });
  });

  it('annuler plus tard (sans état d’avant fourni) rétablit le porteur et le mode gardés en base', async () => {
    setup();
    Object.assign(stove(), { owner_id: OWNER, ownership: 'personal' });
    await borrow();
    expect(stove()).toMatchObject({ borrow_prev_owner_id: OWNER, borrow_prev_ownership: 'personal' });
    expect(await borrow({ lenderId: null })).toEqual({ success: true });
    expect(stove()).toMatchObject({
      borrowed_from: null,
      owner_id: OWNER,
      ownership: 'personal',
      borrow_prev_owner_id: null,
      borrow_prev_ownership: null,
    });
  });

  it('changer de prêteur garde l’état d’origine, pas celui du premier emprunt', async () => {
    setup();
    Object.assign(stove(), { owner_id: OWNER, ownership: 'personal' });
    await borrow();
    h.db.rows('trip_collaborators').push({
      trip_id: TRIP,
      user_id: 'aaaaaaaa-0000-4000-8000-000000000003',
      role: 'viewer',
    });
    await borrow({ lenderId: 'aaaaaaaa-0000-4000-8000-000000000003' });
    expect(stove()).toMatchObject({ borrow_prev_owner_id: OWNER, borrow_prev_ownership: 'personal' });
  });

  it('un porteur d’origine qui a quitté le voyage n’est pas rétabli', async () => {
    setup();
    const OLD = 'aaaaaaaa-0000-4000-8000-000000000004';
    Object.assign(stove(), { owner_id: OLD, ownership: 'personal' });
    await borrow();
    expect(await borrow({ lenderId: null })).toEqual({ success: true });
    expect(stove()).toMatchObject({ borrowed_from: null, owner_id: null, ownership: 'personal' });
  });

  it('emprunt d’avant cette règle (rien de gardé) : le prêteur ne porte plus l’objet', async () => {
    setup();
    Object.assign(stove(), { borrowed_from: LEA, owner_id: LEA, ownership: 'shared' });
    expect(await borrow({ lenderId: null })).toEqual({ success: true });
    expect(stove()).toMatchObject({ borrowed_from: null, owner_id: null, ownership: 'shared' });
  });

  it('annuler avec « sans porteur » remet l’objet sans porteur', async () => {
    setup();
    await borrow();
    await borrow({ lenderId: null, restore: { carrierId: null, shared: true } });
    expect(stove()).toMatchObject({ borrowed_from: null, owner_id: null, ownership: 'shared' });
  });

  it('une personne étrangère au voyage ne prête pas : refusé, rien n’est écrit', async () => {
    setup();
    expect(await borrow({ lenderId: STRANGER })).toEqual({
      success: false,
      error: 'Cette personne ne fait pas partie du voyage.',
    });
    expect(itemWrites()).toHaveLength(0);
  });

  it('l’état d’avant d’une annulation doit nommer une personne du voyage aussi', async () => {
    setup();
    await borrow();
    h.db.writes.length = 0;
    const res = await borrow({ lenderId: null, restore: { carrierId: STRANGER, shared: true } });
    expect(res.success).toBe(false);
    expect(itemWrites()).toHaveLength(0);
    expect(stove().borrowed_from).toBe(LEA);
  });

  it('on n’emprunte pas à soi-même', async () => {
    setup();
    expect(await borrow({ lenderId: OWNER })).toEqual({ success: false, error: 'On n’emprunte pas à soi-même.' });
    expect(itemWrites()).toHaveLength(0);
  });

  it('un objet d’un autre voyage : « 0 ligne » est un échec, l’objet étranger n’est pas touché', async () => {
    setup();
    const res = await borrow({ itemId: FOREIGN });
    expect(res).toEqual({ success: false, error: 'Impossible d’enregistrer l’emprunt.' });
    expect(h.db.rows('trip_items').find((r) => r.id === FOREIGN)).toMatchObject({ borrowed_from: null, owner_id: null });
  });

  it.each([
    ['prêteur invalide', { lenderId: 'moi' }],
    ['objet invalide', { itemId: 'x' }],
    ['voyage invalide', { tripId: 'x' }],
    ['slug invalide', { tripSlug: 'Pas un slug' }],
    ['état d’avant invalide', { lenderId: null, restore: { carrierId: 'x', shared: true } }],
    ['état d’avant sans mode', { lenderId: null, restore: { carrierId: null } }],
  ])('entrée invalide (%s) : refusée par zod, rien n’est écrit', async (_name, extra) => {
    setup();
    expect((await borrow(extra)).success).toBe(false);
    expect(h.db.writes).toHaveLength(0);
  });

  it('un lecteur (ni propriétaire ni éditeur) : refusé', async () => {
    setup({ user: LEA, canEdit: false });
    expect(await borrow({ lenderId: OWNER })).toEqual({
      success: false,
      error: 'Seuls les organisateurs et éditeurs peuvent modifier le kit.',
    });
    expect(itemWrites()).toHaveLength(0);
  });

  it('sans session : refusé', async () => {
    setup({ user: null });
    expect(await borrow()).toEqual({ success: false, error: 'Connecte-toi pour modifier le voyage.' });
    expect(itemWrites()).toHaveLength(0);
  });
});

const pick = (shopProductId: string, itemId = STOVE) =>
  compasPickShopProductAction({ tripId: TRIP, tripSlug: 'trek', itemId, shopProductId });

describe('compasPickShopProductAction : une location n’est jamais « dans le panier »', () => {
  it('le cas normal d’une location (mode location, prix par jour, pas de prix d’achat) : reliée, jamais in_cart', async () => {
    setup();
    const res = await pick(RENTAL);
    expect(res).toEqual({ success: true, inCart: false });
    expect(stove().shop_product_id).toBe(RENTAL);
    expect(stove().purchase_state).toBe('needed');
    expect(h.db.writes.some((w) => JSON.stringify(w.payload).includes('in_cart'))).toBe(false);
  });

  it('même avec un prix d’achat renseigné, une location n’entre pas au panier', async () => {
    setup();
    const res = await pick(RENTAL_BOTH);
    expect(res).toEqual({ success: true, inCart: false });
    expect(stove().purchase_state).toBe('needed');
  });

  it('un objet « dans le panier » pour un autre produit, rebasculé sur une location, n’est plus dans le panier', async () => {
    setup();
    await pick(BUY);
    expect(stove().purchase_state).toBe('in_cart');
    await pick(RENTAL);
    expect(stove().shop_product_id).toBe(RENTAL);
    expect(stove().purchase_state).toBe('needed');
  });

  it('une commande déjà en livraison n’est pas levée par le choix d’une location', async () => {
    setup({ state: 'shipping' });
    await pick(RENTAL);
    expect(stove().purchase_state).toBe('shipping');
  });

  it('un achat avec prix et fiche est « dans le panier » et rend la ligne de panier construite en base', async () => {
    setup();
    const res = await pick(BUY);
    expect(res).toEqual({
      success: true,
      inCart: true,
      cartLine: {
        id: BUY,
        slug: 'produit-2',
        name: 'Réchaud',
        brand: 'Jetboil',
        priceEur: 39,
        weightG: 410,
        image: '/img/rechaud.jpg',
        imageAlt: 'Un réchaud',
        category: 'cook',
      },
    });
    expect(stove()).toMatchObject({ shop_product_id: BUY, purchase_state: 'in_cart', weight_grams: 410 });
  });

  it('une occasion avec prix est « dans le panier »', async () => {
    setup();
    expect(await pick(USED)).toMatchObject({ success: true, inCart: true });
    expect(stove().purchase_state).toBe('in_cart');
  });

  it.each([
    ['sans fiche (slug)', BUY_NO_SLUG],
    ['sans prix', BUY_NO_PRICE],
    ['une enchère', AUCTION],
  ])('un produit %s ne peut pas entrer au panier : relié seulement, jamais in_cart', async (_name, id) => {
    setup();
    const res = await pick(id);
    expect(res).toEqual({ success: true, inCart: false });
    expect(stove().shop_product_id).toBe(id);
    expect(stove().purchase_state).toBe('needed');
  });

  it('un produit retiré de la boutique : refusé, rien n’est écrit', async () => {
    setup();
    expect(await pick(GONE)).toEqual({ success: false, error: 'Produit indisponible.' });
    expect(itemWrites()).toHaveLength(0);
  });

  it('un objet d’un autre voyage : échec, et l’objet étranger n’est pas touché', async () => {
    setup();
    expect(await pick(BUY, FOREIGN)).toEqual({ success: false, error: 'Impossible de relier ce produit.' });
    expect(h.db.rows('trip_items').find((r) => r.id === FOREIGN)).toMatchObject({ purchase_state: 'needed' });
  });

  it('entrée invalide : refusée par zod', async () => {
    setup();
    expect(await compasPickShopProductAction({ tripId: TRIP, tripSlug: 'trek', itemId: 'x', shopProductId: RENTAL })).toEqual({
      success: false,
      error: 'Requête invalide',
    });
    expect(h.db.writes).toHaveLength(0);
  });
});

describe('setTripItemPurchaseState : le verrou vaut pour toute écriture de l’état d’achat', () => {
  it('une location liée à l’objet ne peut pas être mise « au panier »', async () => {
    setup();
    await pick(RENTAL);
    h.db.writes.length = 0;
    expect(await setTripItemPurchaseState(STOVE, 'in_cart')).toBe(false);
    expect(stove().purchase_state).toBe('needed');
    expect(h.db.writes).toHaveLength(0);
  });

  it('un achat lié peut l’être, et les autres états ne sont pas filtrés', async () => {
    setup();
    await pick(BUY);
    expect(await setTripItemPurchaseState(STOVE, 'shipping')).toBe(true);
    expect(await setTripItemPurchaseState(STOVE, 'in_cart')).toBe(true);
    expect(stove().purchase_state).toBe('in_cart');
  });

  it('une location liée peut repasser à « à ajouter »', async () => {
    setup();
    await pick(RENTAL);
    expect(await setTripItemPurchaseState(STOVE, 'added')).toBe(true);
    expect(stove().purchase_state).toBe('added');
  });
});

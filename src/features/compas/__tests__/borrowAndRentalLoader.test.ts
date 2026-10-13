/**
 * Lot AH : ce que le chargeur de l'écran (`getCompasData`) lit d'un emprunt et d'une location.
 *
 *   - `trip_items.borrowed_from` est lu : l'objet emprunté est disponible dans le modèle.
 *   - Une ligne qui dit `in_cart` alors que son produit est une location (écrite avant le verrou du
 *     serveur) n'est PAS dans le panier : l'objet vital reste « à trouver », il ne passe pas pour
 *     commandé.
 *
 * Frontières simulées : le hub, la base (en mémoire), la météo, les alertes, le relief, les taux.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';

const h = vi.hoisted(() => ({
  trip: null as Record<string, unknown> | null,
  db: null as unknown as MemorySupabase,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/features/hub/server/getHubAdventureData', () => ({
  getHubAdventureData: vi.fn(async () => ({ trip: h.trip, group: null, hiking: null, affiliateLinks: [] })),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));
vi.mock('@/features/booking/server/providerCredentials', () => ({
  getActiveProviderMode: () => ({ routestack: 'disabled', viator: 'disabled' }),
}));
vi.mock('../server/officialAlerts', () => ({
  getOfficialAlerts: vi.fn(async () => ({ status: 'hors_france', alerts: [], area: null })),
}));
vi.mock('../server/elevation', () => ({
  getRouteElevation: vi.fn(async () => null),
  pointsMaxAltitudeM: vi.fn(async () => null),
  pointsAltitudeRange: vi.fn(async () => null),
}));
vi.mock('../server/rates', () => ({
  getEurRate: vi.fn(async () => null),
  getBudgetFx: vi.fn(async () => null),
}));
vi.mock('../server/weather', async (orig) => ({
  ...(await orig<typeof import('../server/weather')>()),
  getClimateNormals: vi.fn(async () => null),
  getCompasWeather: vi.fn(async (input: { tripDays: Array<{ day: number; date: string; lat: number; lon: number }> }) => ({
    source: 'MET Norway',
    trendSource: 'NASA POWER',
    horizon: '2027-02-19',
    calendar: [],
    tripDays: input.tripDays.map((d) => ({ ...d, forecast: null })),
  })),
}));

import { getCompasData } from '../server/getCompasData';

const OWNER = 'user-1';
const LEA = '33333333-3333-4333-8333-333333333333';
const RENTAL = 'cccccccc-0000-4000-8000-000000000001';
const BUY = 'cccccccc-0000-4000-8000-000000000002';

const row = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  trip_id: 'trip-1',
  item_name: name,
  category: 'cook',
  quantity: 1,
  weight_grams: null,
  is_packed: false,
  is_vital: true,
  priority: 'vital',
  ownership: 'shared',
  owner_id: null,
  inventory_item_id: null,
  shop_product_id: null,
  condition: null,
  reason: null,
  purchase_state: 'needed',
  borrowed_from: null,
  ...extra,
});

const product = (id: string, extra: Record<string, unknown>) => ({
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
  rating: null,
  review_count: null,
  image: null,
  image_alt: null,
  transaction_type: 'achat',
  score_kdv: 1,
  is_active: true,
  deleted_at: null,
  ...extra,
});

function load(items: Array<Record<string, unknown>>) {
  h.db = memorySupabase({ user: () => ({ id: OWNER }) });
  h.db.rows('shop_products').push(
    product(RENTAL, { transaction_type: 'location', price_eur: null, price_per_day: 6, slug: 'jetboil-location' }),
    product(BUY, {})
  );
  h.trip = {
    id: 'trip-1',
    slug: 'islande',
    title: 'Islande',
    user_id: OWNER,
    destination_name: 'Reykjavik',
    destination_country_code: 'IS',
    start_date: '2027-02-10',
    end_date: '2027-02-12',
    primary_activity: 'hiking',
    party_size: 2,
    budget_currency: 'EUR',
    estimated_budget: null,
    metadata: null,
    steps: [],
    items,
    expenses: [],
    pois: [],
    collaborators: [],
    member_profiles: [],
    permissions: { canEdit: true },
  };
  return getCompasData();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCompasData : emprunt et location', () => {
  it('un objet emprunté (borrowed_from) est disponible : ni à trouver, ni vital manquant', async () => {
    const data = await load([row('stove', 'Réchaud', { owner_id: LEA, borrowed_from: LEA })]);
    const line = data?.model.kit.lines[0];
    expect(line).toMatchObject({ id: 'stove', status: 'owned', borrowedFrom: LEA });
    expect(data?.model.kit.toAcquire).toEqual([]);
    expect(data?.model.kit.vitalMissing).toEqual([]);
  });

  it('CONTRE-EXEMPLE — confié à Léa sans emprunt, l’objet manque toujours', async () => {
    const data = await load([row('stove', 'Réchaud', { owner_id: LEA })]);
    expect(data?.model.kit.lines[0]).toMatchObject({ status: 'missing', borrowedFrom: null });
    expect(data?.model.kit.vitalMissing).toHaveLength(1);
  });

  it('un vital « au panier » pour une LOCATION (ligne d’avant le verrou) reste à trouver, jamais « Commander »', async () => {
    const data = await load([row('stove', 'Réchaud', { shop_product_id: RENTAL, purchase_state: 'in_cart' })]);
    expect(data?.model.kit.lines[0].purchaseState).toBe('needed');
    expect(data?.model.kit.vitalMissing).toHaveLength(1);
    expect(data?.model.nextDecision?.label).toBe('Trouver : réchaud');
  });

  it('un vital réellement « au panier » pour un achat garde son état : « Commander »', async () => {
    const data = await load([row('stove', 'Réchaud', { shop_product_id: BUY, purchase_state: 'in_cart' })]);
    expect(data?.model.kit.lines[0].purchaseState).toBe('in_cart');
    expect(data?.model.nextDecision?.label).toBe('Commander : réchaud');
  });

  it('une location « en livraison » ou « à ajouter » est lue telle qu’écrite', async () => {
    const data = await load([
      row('a', 'Réchaud', { shop_product_id: RENTAL, purchase_state: 'shipping' }),
      row('b', 'Popote', { shop_product_id: RENTAL, purchase_state: 'needed' }),
    ]);
    expect(data?.model.kit.lines.map((l) => l.purchaseState)).toEqual(['shipping', 'needed']);
  });
});

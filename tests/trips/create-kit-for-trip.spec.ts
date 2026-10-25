/**
 * Fix « kit jamais manquant » — `createKitForTrip` (repli déterministe).
 *
 * Le repli de préparation sentier doit toujours produire un kit réel :
 *   1. catalogue `shop_products` réel via `selectKitProducts` (product_id,
 *      poids catalogue, priority) ;
 *   2. inventaire possédé prioritaire (poids réels, `needed` vs `missing`) ;
 *   3. sans catalogue → règles contextuelles déterministes (jamais un kit vide) ;
 *   4. toute erreur → `{ kitId: null, itemCount: 0 }`, jamais d'exception.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: vi.fn(() => null) }));
vi.mock('@/lib/events/eventBus', () => ({ emitEvent: vi.fn(async () => ({ success: true })) }));

import { createKitForTrip } from '@/features/trips/server/createKitForTrip';

const USER_ID = 'c1a00000-0000-4000-8000-000000000001';
const TRIP_ID = 'c1a00000-0000-4000-8000-000000000002';

const CATALOGUE_ROWS = [
  {
    id: 'prod-headlamp',
    slug: 'lampe-frontale-led-rechargeable-black-diamond-spot-400',
    name: 'Lampe Frontale LED Rechargeable Black Diamond Spot 400',
    category: 'Éclairage',
    essentiality: 'Indispensable',
    weight_g: 90,
    price_eur: 75,
  },
  {
    id: 'prod-first-aid',
    slug: 'trousse-de-premiers-secours-michelin-9531-44-pieces',
    name: 'Trousse de Premiers Secours Michelin 9531 – 44 Pièces',
    category: 'Sécurité / Urgence',
    essentiality: 'Indispensable',
    weight_g: 200,
    price_eur: 22,
  },
];

const TRAIL = { id: 375, name: 'Tour du Lac Blanc', distanceKm: 12.4 };
const META = { difficulty: 'hard', durationHours: 5.5, elevationGain: 850, terrainType: 'montagne' };

interface Captures {
  inserts: Array<{ table: string; values: unknown }>;
  updates: Array<{ table: string; values: unknown }>;
  deletes: string[];
}

function createClient(options: {
  owned?: Record<string, unknown>[];
  catalogue?: Record<string, unknown>[];
  kitInsert?: { data?: unknown; error?: { message: string } | null };
}): { client: unknown; captures: Captures } {
  const captures: Captures = { inserts: [], updates: [], deletes: [] };
  const client = {
    from(table: string) {
      let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
      const builder: Record<string, unknown> = {};
      const settle = () => {
        if (op === 'insert') {
          if (table === 'materiel_kits') {
            return options.kitInsert ?? { data: { id: 'kit-1' }, error: null };
          }
          return { data: null, error: null };
        }
        if (op === 'update') return { data: null, error: null };
        if (op === 'delete') return { data: null, error: null };
        if (table === 'product_ownership') return { data: options.owned ?? [], error: null };
        if (table === 'shop_products') return { data: options.catalogue ?? [], error: null };
        if (table === 'trips') return { data: { metadata: { route_id: 375 } }, error: null };
        return { data: null, error: null };
      };
      builder.select = () => builder;
      builder.insert = (values: unknown) => {
        op = 'insert';
        captures.inserts.push({ table, values });
        return builder;
      };
      builder.update = (values: unknown) => {
        op = 'update';
        captures.updates.push({ table, values });
        return builder;
      };
      builder.delete = () => {
        op = 'delete';
        captures.deletes.push(table);
        return builder;
      };
      builder.eq = () => builder;
      builder.limit = () => builder;
      builder.maybeSingle = async () => settle();
      builder.single = async () => settle();
      builder.then = (
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown
      ) => Promise.resolve(settle()).then(resolve, reject);
      return builder;
    },
  };
  return { client, captures };
}

function insertFor(captures: Captures, table: string) {
  return captures.inserts.find((entry) => entry.table === table);
}

describe('createKitForTrip — kit déterministe garanti', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('catalogue réel → 1 kit, 1 batch items (product_id + poids), 1 batch trip_items', async () => {
    const { client, captures } = createClient({ catalogue: CATALOGUE_ROWS });
    const result = await createKitForTrip({
      supabase: client as never,
      userId: USER_ID,
      tripId: TRIP_ID,
      trail: TRAIL,
      meta: META,
    });

    expect(result).toEqual({ kitId: 'kit-1', itemCount: 2 });

    const kitInsert = insertFor(captures, 'materiel_kits')?.values as Record<string, unknown>;
    expect(kitInsert.name).toBe('Kit — Tour du Lac Blanc');
    expect(kitInsert.user_id).toBe(USER_ID);
    expect(kitInsert.total_weight_g).toBe(290);

    const kitItems = insertFor(captures, 'materiel_kit_items')?.values as Array<
      Record<string, unknown>
    >;
    expect(kitItems).toHaveLength(2);
    expect(kitItems[0]).toMatchObject({
      kit_id: 'kit-1',
      user_id: USER_ID,
      product_id: 'prod-headlamp',
      weight_g: 90,
      quantity: 1,
      priority: 'vital',
      is_vital: true,
      ownership: 'personal',
    });
    expect(kitItems[0].name).toContain('Lampe Frontale');

    const tripItems = insertFor(captures, 'trip_items')?.values as Array<Record<string, unknown>>;
    expect(tripItems).toHaveLength(2);
    expect(tripItems[0]).toMatchObject({
      trip_id: TRIP_ID,
      shop_product_id: 'prod-headlamp',
      status: 'missing',
      source: 'contextual_kit',
      purchase_state: 'needed',
      inventory_item_id: null,
      ownership: 'personal',
    });

    const tripsUpdate = captures.updates.find((entry) => entry.table === 'trips')?.values as Record<
      string,
      unknown
    >;
    expect(tripsUpdate.kit_id).toBe('kit-1');
    expect((tripsUpdate.metadata as Record<string, unknown>).route_id).toBe(375);
    expect((tripsUpdate.metadata as Record<string, unknown>).kit_source).toBe('deterministic');
  });

  it('inventaire possédé prioritaire → poids réels, statut needed, source inventory', async () => {
    const { client, captures } = createClient({
      catalogue: CATALOGUE_ROWS,
      owned: [{ id: 'own-1', name: 'Lampe Frontale LED', weight_g: 95, condition: 'bon' }],
    });
    const result = await createKitForTrip({
      supabase: client as never,
      userId: USER_ID,
      tripId: TRIP_ID,
      trail: TRAIL,
      meta: META,
    });

    expect(result.itemCount).toBe(2);
    const kitItems = insertFor(captures, 'materiel_kit_items')?.values as Array<
      Record<string, unknown>
    >;
    const headlamp = kitItems.find((row) => String(row.product_id) === 'prod-headlamp');
    expect(headlamp).toMatchObject({ weight_g: 95, condition: 'bon' });

    const tripItems = insertFor(captures, 'trip_items')?.values as Array<Record<string, unknown>>;
    const tripHeadlamp = tripItems.find((row) => String(row.shop_product_id) === 'prod-headlamp');
    expect(tripHeadlamp).toMatchObject({
      status: 'needed',
      source: 'inventory',
      purchase_state: 'added',
      inventory_item_id: 'own-1',
      weight_grams: 95,
    });
  });

  it('catalogue indisponible → repli règles contextuelles (jamais un kit vide)', async () => {
    const { client, captures } = createClient({ catalogue: [] });
    const result = await createKitForTrip({
      supabase: client as never,
      userId: USER_ID,
      tripId: TRIP_ID,
      trail: TRAIL,
      meta: META,
    });

    expect(result.kitId).toBe('kit-1');
    expect(result.itemCount).toBeGreaterThan(0);
    const kitItems = insertFor(captures, 'materiel_kit_items')?.values as Array<
      Record<string, unknown>
    >;
    expect(kitItems.length).toBeGreaterThan(0);
    expect(kitItems.every((row) => row.product_id === null)).toBe(true);
    const names = kitItems.map((row) => String(row.name));
    expect(names).toContain('Trousse de premiers secours');
  });

  it('erreur d’insertion kit → { kitId: null, itemCount: 0 }, jamais d’exception', async () => {
    const { client, captures } = createClient({
      catalogue: CATALOGUE_ROWS,
      kitInsert: { data: null, error: { message: 'base indisponible' } },
    });

    await expect(
      createKitForTrip({
        supabase: client as never,
        userId: USER_ID,
        tripId: TRIP_ID,
        trail: TRAIL,
        meta: META,
      })
    ).resolves.toEqual({ kitId: null, itemCount: 0 });
    expect(insertFor(captures, 'materiel_kit_items')).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

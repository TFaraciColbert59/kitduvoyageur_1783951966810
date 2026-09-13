/**
 * Task 10 — `persistPreparation` en batch :
 *   1 insert `materiel_kits`, 1 insert batch `materiel_kit_items` (produits
 *   réels : `product_id` catalogue, poids, ownership), 1 insert batch
 *   `trip_items` (`shop_product_id`), et UN SEUL calcul de préparation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, serviceHolder } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  serviceHolder: { client: {} as unknown },
}));

const storeMock = vi.hoisted(() => ({
  findByKey: vi.fn(),
  hasActivePending: vi.fn(),
  countRecent: vi.fn(),
  createPending: vi.fn(),
  markDone: vi.fn(),
  markFailed: vi.fn(),
  requeue: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: vi.fn(() => serviceHolder.client),
}));
vi.mock('@/lib/queries-trips', () => ({ createTrip: vi.fn() }));
vi.mock('@/lib/events/eventBus', () => ({
  emitEvent: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/features/adventure-intelligence/server/generationRequests', () => ({
  createSupabaseGenerationRequestStore: vi.fn(() => storeMock),
}));
vi.mock('@/features/adventure-intelligence/server/generateAdventure', () => ({
  generateAdventure: vi.fn(),
  createSupabaseAdventurePersistence: vi.fn(() => ({ persistence: true })),
  createSupabaseAdventurePredictionPersistence: vi.fn(() => vi.fn()),
  createSupabaseRoutePredictionClient: vi.fn(() => ({ routePrediction: true })),
  getStoredPerformanceProfile: vi.fn(async () => null),
}));
vi.mock('@/features/adventure-intelligence/server/liveSources', () => ({
  createSupabaseLiveSourcesClient: vi.fn(() => ({ liveSources: true })),
}));
vi.mock('@/features/adventure-intelligence/server/adapters', () => ({
  createDefaultRegistry: vi.fn(() => ({ registry: true })),
}));
vi.mock('@/features/adventure-intelligence/server/featureFlags', () => ({
  currentAdventureFeatureFlags: vi.fn(async () => ({
    performance_profile_v2: false,
    route_prediction_v2: false,
    collective_intelligence: false,
    terrain_live: false,
  })),
}));
vi.mock('@/lib/entitlements/server', () => ({
  resolveUserEntitlements: vi.fn(async () => ({
    plan: 'free',
    activePasses: [],
    entitlements: [],
    source: 'default_free',
    configured: false,
  })),
  generationQuotaFor: vi.fn(() => 2),
}));
vi.mock('@/features/trips/engine/autogenPreparation', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/trips/engine/autogenPreparation')>();
  return { ...actual, buildAutogenPreparation: vi.fn(actual.buildAutogenPreparation) };
});

import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { createTrip } from '@/lib/queries-trips';
import { generateAdventure } from '@/features/adventure-intelligence/server/generateAdventure';
import { buildAutogenPreparation } from '@/features/trips/engine/autogenPreparation';
import { createTripFromAutogenIntent } from '@/features/trips/server/createTripFromAutogenIntent';
import { TripBriefSchema } from '@/features/trips/schemas/autoGen.schema';

const TEST_BRIEF = TripBriefSchema.parse({
  rawInput: 'Randonnée de 2 jours dans les Vosges avec bivouac',
  destinations: { value: [{ country: 'FR', region: 'Vosges' }], confidence: 'stated' },
  duration: { value: { days: 2, flexible: false }, confidence: 'stated' },
  window: { value: {}, confidence: 'defaulted' },
  party: { value: { adults: 2, minors: 0 }, confidence: 'defaulted' },
  budget: { value: { tier: 'moderate' }, confidence: 'inferred' },
  style: { value: ['bivouac'], confidence: 'stated' },
  intensity: {
    value: { dailyKmMax: 15, dailyGainMax: 800, restEvery: 3 },
    confidence: 'defaulted',
  },
  constraints: { value: [], confidence: 'defaulted' },
  mobility: {
    value: { modes: ['foot'], ownsVehicle: false, licence: false },
    confidence: 'defaulted',
  },
  departure: { value: {}, confidence: 'defaulted' },
  fromProfile: {},
});

const USER_ID = 'f2a80000-0000-4000-8000-000000000010';
const TRIP_ID = 'f2a80000-0000-4000-8000-000000000011';
const PLAN_ID = 'f2a80000-0000-4000-8000-000000000012';
const CORRELATION_ID = 'f2a80000-0000-4000-8000-000000000013';
const ROUTE_ID = 930000010;

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

interface Captures {
  inserts: Array<{ table: string; values: unknown }>;
  updates: Array<{ table: string; values: unknown }>;
  deletes: string[];
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
  order: string[];
}

function createSession(options: {
  user: { id: string } | null;
  reads?: Record<string, unknown>;
  insertResults?: Record<string, { data?: unknown; error?: { message: string } | null }>;
  rpcResults?: Record<string, { data: unknown; error: { message: string } | null }>;
}): { client: unknown; captures: Captures } {
  const captures: Captures = { inserts: [], updates: [], deletes: [], rpcCalls: [], order: [] };
  const client = {
    auth: { getUser: async () => ({ data: { user: options.user } }) },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      captures.rpcCalls.push({ fn, args });
      captures.order.push(`rpc:${fn}`);
      return options.rpcResults?.[fn] ?? { data: null, error: null };
    },
    from(table: string) {
      let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
      const builder: Record<string, unknown> = {};
      const settle = () => {
        if (op === 'insert') {
          return options.insertResults?.[table] ?? { data: null, error: null };
        }
        if (op === 'select') {
          return { data: options.reads?.[table] ?? null, error: null };
        }
        return { data: null, error: null };
      };
      builder.select = () => {
        captures.order.push(`select:${table}`);
        return builder;
      };
      builder.insert = (values: unknown) => {
        op = 'insert';
        captures.inserts.push({ table, values });
        captures.order.push(`insert:${table}`);
        return builder;
      };
      builder.update = (values: unknown) => {
        op = 'update';
        captures.updates.push({ table, values });
        captures.order.push(`update:${table}`);
        return builder;
      };
      builder.delete = () => {
        op = 'delete';
        captures.deletes.push(table);
        captures.order.push(`delete:${table}`);
        return builder;
      };
      builder.eq = () => builder;
      builder.order = () => builder;
      builder.limit = () => builder;
      builder.maybeSingle = async () => settle();
      builder.single = async () => settle();
      builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(settle()).then(resolve, reject);
      return builder;
    },
  };
  return { client, captures };
}

const ROUTE_ROW = {
  route_id: ROUTE_ID,
  name: 'E2E Task 10 — Parcours navigable',
  ref: 'PR-T10',
  region: 'Vosges',
  distance_km: 12.5,
  distance_m: 120,
  elevation_gain_m: 900,
  duration_hours: 5.5,
  difficulty: 'moderate',
  start_lat: 48.0,
  start_lng: 7.0,
};

const GEOM_LINE = {
  type: 'LineString',
  coordinates: [
    [7.0, 48.0],
    [7.1, 48.1],
  ],
};

const mockedCreateClient = vi.mocked(createClient);
const mockedCreateTrip = vi.mocked(createTrip);
const mockedGenerate = vi.mocked(generateAdventure);
const mockedBuildPreparation = vi.mocked(buildAutogenPreparation);

function validInput() {
  return {
    rawInput: 'Randonnée de 2 jours dans les Vosges avec bivouac',
    brief: TEST_BRIEF,
    correlationId: CORRELATION_ID,
    layers: {
      kit: {
        id: 'prop-kit',
        layer: 'kit',
        slotId: 'slot-kit',
        value: { targetWeightKg: 6.8, essentialCategories: ['drap_de_sac'] },
        provenance: { source: 'estimated' },
        confidence: 'low',
        rationale: 'Kit optimisé.',
      },
    },
  };
}

describe('Task 10 — création kit en batch (produits réels)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceHolder.client = {};
    vi.mocked(getServiceSupabase).mockReturnValue({} as never);
    storeMock.findByKey.mockResolvedValue(null);
    storeMock.hasActivePending.mockResolvedValue(false);
    storeMock.countRecent.mockResolvedValue(0);
    storeMock.createPending.mockResolvedValue({ id: 'req-t10' });
    storeMock.markDone.mockResolvedValue(undefined);
    storeMock.markFailed.mockResolvedValue(undefined);
    storeMock.requeue.mockResolvedValue(undefined);
    mockedCreateTrip.mockResolvedValue({
      id: TRIP_ID,
      slug: 'vosges-2-j',
      title: 'Vosges — 2 j',
    } as never);
    mockedGenerate.mockResolvedValue({ plan: { id: PLAN_ID } } as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('T10-KIT-01: 1 kit, 1 batch items, 1 batch trip_items, 1 seul calcul de préparation', async () => {
    const { client, captures } = createSession({
      user: { id: USER_ID },
      reads: { product_ownership: [], shop_products: CATALOGUE_ROWS },
      insertResults: { materiel_kits: { data: { id: 'kit-batch' }, error: null } },
      rpcResults: {
        phase3_search_navigable_routes: { data: [ROUTE_ROW], error: null },
        get_route_geojson: { data: GEOM_LINE, error: null },
        attach_adventure_plan_to_trip: {
          data: { plan_id: PLAN_ID, trip_id: TRIP_ID, correlation_id: CORRELATION_ID },
          error: null,
        },
        select_adventure_plan_route: {
          data: { plan_id: PLAN_ID, selected_route_id: ROUTE_ID },
          error: null,
        },
      },
    });
    mockedCreateClient.mockResolvedValue(client as never);

    const result = await createTripFromAutogenIntent(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Un seul calcul de préparation (le preview réutilisé).
    expect(mockedBuildPreparation).toHaveBeenCalledTimes(1);

    const insertTables = captures.inserts.map((entry) => entry.table);
    const count = (table: string) => insertTables.filter((entry) => entry === table).length;
    expect(count('materiel_kits')).toBe(1);
    expect(count('materiel_kit_items')).toBe(1);
    expect(count('trip_items')).toBe(1);

    // Catalogue lu UNE fois.
    expect(captures.order.filter((entry) => entry === 'select:shop_products')).toHaveLength(1);

    const kitItems = captures.inserts.find((entry) => entry.table === 'materiel_kit_items')
      ?.values as Array<Record<string, unknown>>;
    expect(Array.isArray(kitItems)).toBe(true);
    expect(kitItems).toHaveLength(2);
    expect(kitItems[0].product_id).toBe('prod-headlamp');
    expect(kitItems[0].weight_g).toBe(90);
    expect(kitItems[0].ownership).toBe('personal');
    expect(kitItems[0].priority).toBe('vital');
    expect(kitItems[0].is_vital).toBe(true);
    expect(kitItems[0].quantity).toBe(1);

    const tripItems = captures.inserts.find((entry) => entry.table === 'trip_items')
      ?.values as Array<Record<string, unknown>>;
    expect(Array.isArray(tripItems)).toBe(true);
    expect(tripItems).toHaveLength(2);
    expect(tripItems[0].shop_product_id).toBe('prod-headlamp');
    expect(tripItems[0].weight_grams).toBe(90);
    expect(tripItems[0].status).toBe('missing');

    // Le kit porte le poids réel du catalogue.
    const kitInsert = captures.inserts.find((entry) => entry.table === 'materiel_kits')
      ?.values as Record<string, unknown>;
    expect(kitInsert.total_weight_g).toBe(290);
  });

  it('T10-KIT-02: repli historique si le catalogue est indisponible (jamais de kit vide)', async () => {
    const { client, captures } = createSession({
      user: { id: USER_ID },
      reads: { product_ownership: [] },
      insertResults: { materiel_kits: { data: { id: 'kit-fallback' }, error: null } },
      rpcResults: {
        phase3_search_navigable_routes: { data: [], error: null },
        attach_adventure_plan_to_trip: {
          data: { plan_id: PLAN_ID, trip_id: TRIP_ID, correlation_id: CORRELATION_ID },
          error: null,
        },
      },
    });
    mockedCreateClient.mockResolvedValue(client as never);

    const result = await createTripFromAutogenIntent(validInput());

    expect(result.ok).toBe(true);
    const insertTables = captures.inserts.map((entry) => entry.table);
    expect(insertTables.filter((entry) => entry === 'materiel_kit_items')).toHaveLength(1);
    expect(insertTables.filter((entry) => entry === 'trip_items')).toHaveLength(1);
    const kitItems = captures.inserts.find((entry) => entry.table === 'materiel_kit_items')
      ?.values as Array<Record<string, unknown>>;
    expect(kitItems[0].product_id).toBeNull();
    expect(kitItems[0].name).toBe('Drap de sac');
  });
});

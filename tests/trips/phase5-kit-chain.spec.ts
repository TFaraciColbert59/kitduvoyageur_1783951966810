/**
 * Phase 5 — Chaîne kit complète via la commande Phase 3 :
 *   TEST-PHASE5-CHAIN-01 : le kit persisté porte ownership/reason/priority et la
 *     classification possédé (added) vs manquant (missing) depuis l'inventaire réel.
 *   TEST-PHASE5-CHAIN-02 : budget prévisionnel tracé (règle + raison) sans toucher
 *     aux dépenses réelles, et `estimated_budget` relié au voyage.
 *   TEST-PHASE5-CHAIN-03 : contrôles sécurité pays/activité présents dans la
 *     checklist existante (aucun écran parallèle).
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

import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { createTrip } from '@/lib/queries-trips';
import { generateAdventure } from '@/features/adventure-intelligence/server/generateAdventure';
import { createTripFromAutogenIntent } from '@/features/trips/server/createTripFromAutogenIntent';
import { TripBriefSchema } from '@/features/trips/schemas/autoGen.schema';

const TEST_BRIEF = TripBriefSchema.parse({
  rawInput: 'Bivouac de 3 jours dans les Vosges à deux avec tente',
  destinations: { value: [{ country: 'FR', region: 'Vosges' }], confidence: 'stated' },
  duration: { value: { days: 3, flexible: false }, confidence: 'stated' },
  window: { value: { start: '2026-07-01' }, confidence: 'inferred' },
  party: { value: { adults: 2, minors: 0 }, confidence: 'stated' },
  budget: { value: { tier: 'moderate' }, confidence: 'inferred' },
  style: { value: ['bivouac'], confidence: 'stated' },
  intensity: {
    value: { dailyKmMax: 15, dailyGainMax: 800, restEvery: 2 },
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

const USER_ID = 'f5b50000-0000-4000-8000-000000000001';
const TRIP_ID = 'f5b50000-0000-4000-8000-000000000002';
const PLAN_ID = 'f5b50000-0000-4000-8000-000000000003';
const CORRELATION_ID = 'f5b50000-0000-4000-8000-000000000004';
const ROUTE_ID = 950000001;

const mockedCreateClient = vi.mocked(createClient);
const mockedService = vi.mocked(getServiceSupabase);
const mockedCreateTrip = vi.mocked(createTrip);
const mockedGenerate = vi.mocked(generateAdventure);

interface Captures {
  inserts: Array<{ table: string; values: unknown }>;
  updates: Array<{ table: string; values: unknown }>;
  deletes: string[];
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
}

function createSession(options: {
  user: { id: string } | null;
  reads?: Record<string, unknown>;
  insertResults?: Record<string, { data?: unknown; error?: { message: string } | null }>;
  rpcResults?: Record<string, { data: unknown; error: { message: string } | null }>;
}): { client: unknown; captures: Captures } {
  const captures: Captures = { inserts: [], updates: [], deletes: [], rpcCalls: [] };
  const client = {
    auth: { getUser: async () => ({ data: { user: options.user } }) },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      captures.rpcCalls.push({ fn, args });
      return options.rpcResults?.[fn] ?? { data: null, error: null };
    },
    from(table: string) {
      let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
      const builder: Record<string, unknown> = {};
      const settle = () => {
        if (op === 'insert') return options.insertResults?.[table] ?? { data: null, error: null };
        if (op === 'select') return { data: options.reads?.[table] ?? null, error: null };
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
  name: 'Phase 5 — Boucle bivouac Vosges',
  ref: 'PR-P5',
  region: 'Vosges',
  distance_km: 32.4,
  distance_m: 80,
  elevation_gain_m: 1450,
  duration_hours: 12,
  difficulty: 'hard',
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

const OWNED_ITEM = {
  id: 'f5b50000-0000-4000-8000-0000000000e1',
  name: 'Trousse de premiers secours Michelin',
  weight_g: 250,
  condition: 'bon',
  quantity: 1,
};

function defaultRpcResults() {
  return {
    phase3_search_navigable_routes: { data: [ROUTE_ROW], error: null },
    attach_adventure_plan_to_trip: {
      data: { plan_id: PLAN_ID, trip_id: TRIP_ID, correlation_id: CORRELATION_ID },
      error: null,
    },
    select_adventure_plan_route: {
      data: {
        plan_id: PLAN_ID,
        selected_route_id: ROUTE_ID,
        correlation_id: CORRELATION_ID,
        trip_id: TRIP_ID,
      },
      error: null,
    },
  };
}

function validInput() {
  return {
    rawInput: 'Bivouac de 3 jours dans les Vosges à deux avec tente',
    brief: TEST_BRIEF,
    correlationId: CORRELATION_ID,
    layers: {
      kit: {
        id: 'prop-kit',
        layer: 'kit',
        slotId: 'slot-kit',
        value: { targetWeightKg: 7.5, essentialCategories: ['drap_de_sac'] },
        provenance: { source: 'estimated' },
        confidence: 'low',
        rationale: 'Kit optimisé.',
      },
      budget: {
        id: 'prop-budget',
        layer: 'budget',
        slotId: 'slot-budget',
        value: { totalPerPersonEur: 300, currency: 'EUR' },
        provenance: { source: 'estimated' },
        confidence: 'low',
        rationale: 'Budget estimé.',
      },
      safety: {
        id: 'prop-safety',
        layer: 'safety',
        slotId: 'slot-safety',
        value: { rescueUnit: 'PGHM', rescuePhone: '+33450531689' },
        provenance: { source: 'estimated' },
        confidence: 'low',
        rationale: 'Secours.',
      },
    },
  };
}

interface TripItemRow {
  item_name: string;
  ownership: string;
  owner_id: string | null;
  reason: string | null;
  priority: string;
  is_vital: boolean;
  status: string;
  purchase_state: string;
  weight_grams: number | null;
  inventory_item_id: string | null;
  source: string;
}

interface BudgetRow {
  amount: number;
  is_planned: boolean;
  metadata: Record<string, unknown>;
}

describe('Phase 5 — chaîne kit (TEST-PHASE5-CHAIN)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceHolder.client = {};
    mockedService.mockReturnValue({} as never);
    storeMock.findByKey.mockResolvedValue(null);
    storeMock.hasActivePending.mockResolvedValue(false);
    storeMock.countRecent.mockResolvedValue(0);
    storeMock.createPending.mockResolvedValue({ id: 'req-phase5' });
    storeMock.markDone.mockResolvedValue(undefined);
    storeMock.markFailed.mockResolvedValue(undefined);
    storeMock.requeue.mockResolvedValue(undefined);
    mockedCreateTrip.mockResolvedValue({
      id: TRIP_ID,
      slug: 'vosges-bivouac-3-j',
      title: 'Vosges — 3 j',
    } as never);
    mockedGenerate.mockResolvedValue({ plan: { id: PLAN_ID } } as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('TEST-PHASE5-CHAIN-01: kit possédé/manquant + raisons + partage', async () => {
    const { client, captures } = createSession({
      user: { id: USER_ID },
      reads: {
        hiking_routes: { id: ROUTE_ID, geom: GEOM_LINE },
        product_ownership: [OWNED_ITEM],
      },
      insertResults: { materiel_kits: { data: { id: 'kit-phase5' }, error: null } },
      rpcResults: defaultRpcResults(),
    });
    mockedCreateClient.mockResolvedValue(client as never);

    const result = await createTripFromAutogenIntent(validInput());
    expect(result.ok).toBe(true);

    const kitItemsInsert = captures.inserts.find((entry) => entry.table === 'materiel_kit_items');
    const kitItems = kitItemsInsert?.values as Array<{
      name: string;
      ownership: string;
      reason: string;
      priority: string;
      is_vital: boolean;
      weight_g: number;
      owner_id: string | null;
    }>;
    expect(kitItems.length).toBeGreaterThan(6);
    for (const item of kitItems) {
      expect(item.reason.trim().length).toBeGreaterThan(10);
      expect(['personal', 'shared']).toContain(item.ownership);
      expect(['vital', 'recommended', 'optional']).toContain(item.priority);
    }
    // Le matériel de groupe est partagé (2 voyageurs) et sans propriétaire inventé.
    const shelter = kitItems.find((item) => /abri|tente/i.test(item.name));
    expect(shelter?.ownership).toBe('shared');
    expect(shelter?.owner_id).toBeNull();

    const tripItemsInsert = captures.inserts.find((entry) => entry.table === 'trip_items');
    const tripItems = tripItemsInsert?.values as TripItemRow[];
    expect(tripItems.length).toBe(kitItems.length);

    // La trousse réellement possédée est reliée à l'inventaire + poids réel.
    const firstAid = tripItems.find((item) => /trousse/i.test(item.item_name));
    expect(firstAid?.inventory_item_id).toBe(OWNED_ITEM.id);
    expect(firstAid?.weight_grams).toBe(250);
    expect(firstAid?.status).toBe('needed');
    expect(firstAid?.purchase_state).toBe('added');
    expect(firstAid?.reason).toMatch(/premiers secours/i);

    // Le reste est explicitement manquant (jamais présenté comme possédé).
    const missing = tripItems.filter((item) => item.status === 'missing');
    expect(missing.length).toBeGreaterThan(0);
    for (const item of missing) {
      expect(item.purchase_state).toBe('needed');
      expect(item.inventory_item_id).toBeNull();
      expect(item.weight_grams).toBeNull();
    }

    // Le voyage porte le kit et le compteur d'items possédés.
    const tripUpdate = captures.updates.find(
      (entry) =>
        entry.table === 'trips' &&
        typeof entry.values === 'object' &&
        entry.values !== null &&
        'kit_id' in (entry.values as Record<string, unknown>)
    );
    expect(tripUpdate).toBeTruthy();
    const metadata = (tripUpdate?.values as { metadata?: Record<string, unknown> }).metadata;
    const autogen = metadata?.autogen as Record<string, unknown>;
    expect(autogen.kit_owned_items_count).toBeGreaterThan(0);
    expect(autogen.kit_recommendations_count).toBeGreaterThan(0);
  });

  it('TEST-PHASE5-CHAIN-02: budget prévisionnel tracé, dépenses réelles intactes', async () => {
    const { client, captures } = createSession({
      user: { id: USER_ID },
      reads: {
        hiking_routes: { id: ROUTE_ID, geom: GEOM_LINE },
        product_ownership: [],
      },
      insertResults: { materiel_kits: { data: { id: 'kit-phase5' }, error: null } },
      rpcResults: defaultRpcResults(),
    });
    mockedCreateClient.mockResolvedValue(client as never);

    const result = await createTripFromAutogenIntent(validInput());
    expect(result.ok).toBe(true);

    const budgetInsert = captures.inserts.find((entry) => entry.table === 'trip_expenses');
    const budgetRows = budgetInsert?.values as BudgetRow[];
    expect(budgetRows).toHaveLength(1);
    expect(budgetRows[0].amount).toBe(600); // 300 €/pers × 2 voyageurs
    expect(budgetRows[0].is_planned).toBe(true);
    expect(budgetRows[0].metadata.rule).toBe('total_per_person');
    expect(budgetRows[0].metadata.party_size).toBe(2);
    expect(String(budgetRows[0].metadata.reason)).toContain('300');
    expect(budgetRows[0].metadata.estimated).toBe(true);

    const tripUpdate = captures.updates.find(
      (entry) =>
        entry.table === 'trips' &&
        typeof entry.values === 'object' &&
        entry.values !== null &&
        'estimated_budget' in (entry.values as Record<string, unknown>)
    );
    expect((tripUpdate?.values as { estimated_budget?: number }).estimated_budget).toBe(600);
  });

  it('TEST-PHASE5-CHAIN-03: contrôles sécurité pays/activité dans la checklist', async () => {
    const { client, captures } = createSession({
      user: { id: USER_ID },
      reads: {
        hiking_routes: { id: ROUTE_ID, geom: GEOM_LINE },
        product_ownership: [],
      },
      insertResults: { materiel_kits: { data: { id: 'kit-phase5' }, error: null } },
      rpcResults: defaultRpcResults(),
    });
    mockedCreateClient.mockResolvedValue(client as never);

    const result = await createTripFromAutogenIntent(validInput());
    expect(result.ok).toBe(true);

    const checklistInsert = captures.inserts.find(
      (entry) => entry.table === 'trip_checklist_items'
    );
    const labels = (checklistInsert?.values as Array<{ label: string }>).map(
      (row) => row.label
    );
    // Activité bivouac réelle + pays FR réel ⇒ contrôles correspondants.
    expect(labels.some((label) => label.includes('Partager la trace GPX'))).toBe(true);
    expect(labels.some((label) => label.includes('pays FR'))).toBe(true);
    expect(labels.some((label) => label.includes('passages techniques'))).toBe(true);
    expect(labels.some((label) => label.includes('Vérifier le parcours retenu'))).toBe(true);
  });
});

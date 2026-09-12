/**
 * Phase 3 — Commande serveur `createTripFromAutogenIntent` :
 *   TEST-PHASE3-CMD-01 : session requise (401), service requis (503).
 *   TEST-PHASE3-CMD-02 : entrée invalide ⇒ 400, aucune génération.
 *   TEST-PHASE3-CMD-03 : chaîne complète — parcours réel, plan, attache, sélection,
 *                        kit, budget, checklist.
 *   TEST-PHASE3-CMD-04 : aucun parcours navigable ⇒ voyage créé sans navigation.
 *   TEST-PHASE3-CMD-05 : échec de génération ⇒ compensation (voyage supprimé), 500.
 *   TEST-PHASE3-CMD-06 : conflit 409 (génération active).
 *   TEST-PHASE3-CMD-07 : quota 429 avec Retry-After.
 *   TEST-PHASE3-CMD-08 : idempotence par correlation_id (rejeu sans regénération).
 *   TEST-PHASE3-CMD-09 : sélection refusée par la base ⇒ voyage ok, navigation off.
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
  rawInput: 'Randonnée de 2 jours dans les Vosges avec bivouac',
  destinations: { value: [{ country: 'FR', region: 'Vosges' }], confidence: 'stated' },
  duration: { value: { days: 2, flexible: false }, confidence: 'stated' },
  window: { value: {}, confidence: 'defaulted' },
  party: { value: { adults: 1, minors: 0 }, confidence: 'defaulted' },
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

const USER_ID = 'f2a80000-0000-4000-8000-000000000001';
const TRIP_ID = 'f2a80000-0000-4000-8000-000000000002';
const PLAN_ID = 'f2a80000-0000-4000-8000-000000000003';
const CORRELATION_ID = 'f2a80000-0000-4000-8000-000000000004';
const ROUTE_ID = 930000001;

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

interface SessionOptions {
  user: { id: string } | null;
  reads?: Record<string, unknown>;
  insertResults?: Record<string, { data?: unknown; error?: { message: string } | null }>;
  rpcResults?: Record<string, { data: unknown; error: { message: string } | null }>;
}

function createSession(options: SessionOptions): { client: unknown; captures: Captures } {
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
        if (op === 'insert') {
          return options.insertResults?.[table] ?? { data: null, error: null };
        }
        if (op === 'select') {
          return { data: options.reads?.[table] ?? null, error: null };
        }
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

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    rawInput: 'Randonnée de 2 jours dans les Vosges avec bivouac',
    brief: TEST_BRIEF,
    correlationId: CORRELATION_ID,
    layers: {},
    ...overrides,
  };
}

const ROUTE_ROW = {
  route_id: ROUTE_ID,
  name: 'E2E Phase 3 — Parcours navigable',
  ref: 'PR-TEST',
  region: 'Vosges',
  distance_km: 12.5,
  distance_m: 120,
  elevation_gain_m: 850,
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

describe('Phase 3 — commande createTripFromAutogenIntent (TEST-PHASE3-CMD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceHolder.client = {};
    mockedService.mockReturnValue({} as never);
    storeMock.findByKey.mockResolvedValue(null);
    storeMock.hasActivePending.mockResolvedValue(false);
    storeMock.countRecent.mockResolvedValue(0);
    storeMock.createPending.mockResolvedValue({ id: 'req-phase3' });
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

  it('TEST-PHASE3-CMD-01: session et service requis (401/503)', async () => {
    mockedCreateClient.mockResolvedValue(createSession({ user: null }).client as never);
    const unauthorized = await createTripFromAutogenIntent(validInput());
    expect(unauthorized).toEqual({
      ok: false,
      status: 401,
      error: 'Authentification requise.',
    });
    expect(mockedGenerate).not.toHaveBeenCalled();

    mockedCreateClient.mockResolvedValue(
      createSession({ user: { id: USER_ID } }).client as never
    );
    serviceHolder.client = null;
    mockedService.mockReturnValue(null as never);
    const unavailable = await createTripFromAutogenIntent(validInput());
    expect(unavailable.ok).toBe(false);
    if (!unavailable.ok) expect(unavailable.status).toBe(503);
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it('TEST-PHASE3-CMD-02: entrée invalide ⇒ 400 sans génération', async () => {
    mockedCreateClient.mockResolvedValue(
      createSession({ user: { id: USER_ID } }).client as never
    );

    const result = await createTripFromAutogenIntent(validInput({ rawInput: 'court' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain('rawInput');
    }
    expect(mockedGenerate).not.toHaveBeenCalled();
    expect(mockedCreateTrip).not.toHaveBeenCalled();
  });

  it('TEST-PHASE3-CMD-03: chaîne complète (parcours, plan, préparation)', async () => {
    const { client, captures } = createSession({
      user: { id: USER_ID },
      reads: { hiking_routes: { id: ROUTE_ID, geom: GEOM_LINE } },
      insertResults: { materiel_kits: { data: { id: 'kit-phase3' }, error: null } },
      rpcResults: defaultRpcResults(),
    });
    mockedCreateClient.mockResolvedValue(client as never);

    const result = await createTripFromAutogenIntent(
      validInput({
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
          budget: {
            id: 'prop-budget',
            layer: 'budget',
            slotId: 'slot-budget',
            value: { totalPerPersonEur: 300, currency: 'EUR' },
            provenance: { source: 'estimated' },
            confidence: 'low',
            rationale: 'Budget estimé.',
          },
        },
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tripId).toBe(TRIP_ID);
    expect(result.slug).toBe('vosges-2-j');
    expect(result.routeId).toBe(ROUTE_ID);
    expect(result.reused).toBe(false);
    expect(result.correlationId).toBe(CORRELATION_ID);

    // Génération corrélée avec l'ETA réelle du parcours retenu.
    expect(mockedGenerate).toHaveBeenCalledTimes(1);
    const [generationInput] = mockedGenerate.mock.calls[0];
    expect(generationInput.correlationId).toBe(CORRELATION_ID);
    expect(generationInput.coordinates).toEqual([
      { lat: 48.0, lng: 7.0 },
      { lat: 48.1, lng: 7.1 },
    ]);

    // Chaîne Phase 2 : attache puis sélection du parcours réel.
    const rpcNames = captures.rpcCalls.map((call) => call.fn);
    expect(rpcNames).toContain('attach_adventure_plan_to_trip');
    expect(rpcNames).toContain('select_adventure_plan_route');
    const selectCall = captures.rpcCalls.find((call) => call.fn === 'select_adventure_plan_route');
    expect(selectCall?.args.p_route_id).toBe(ROUTE_ID);
    expect(selectCall?.args.p_correlation_id).toBe(CORRELATION_ID);

    // Préparation créée : kit (+ items), budget, checklist.
    const insertTables = captures.inserts.map((entry) => entry.table);
    expect(insertTables).toContain('materiel_kits');
    expect(insertTables).toContain('materiel_kit_items');
    expect(insertTables).toContain('trip_items');
    expect(insertTables).toContain('trip_expenses');
    expect(insertTables).toContain('trip_checklist_items');

    const budgetInsert = captures.inserts.find((entry) => entry.table === 'trip_expenses');
    const budgetRows = budgetInsert?.values as Array<{ amount: number; is_planned: boolean }>;
    expect(budgetRows[0].amount).toBe(300);
    expect(budgetRows[0].is_planned).toBe(true);

    // Le voyage porte le kit et le budget prévisionnel.
    const tripUpdate = captures.updates.find(
      (entry) =>
        entry.table === 'trips' &&
        typeof entry.values === 'object' &&
        entry.values !== null &&
        'kit_id' in (entry.values as Record<string, unknown>)
    );
    expect(tripUpdate).toBeTruthy();
    expect(storeMock.markDone).toHaveBeenCalledWith('req-phase3', PLAN_ID);
    expect(captures.deletes).not.toContain('trips');
  });

  it('TEST-PHASE3-CMD-04: aucun parcours navigable ⇒ voyage sans navigation', async () => {
    const { client, captures } = createSession({
      user: { id: USER_ID },
      rpcResults: { phase3_search_navigable_routes: { data: [], error: null } },
    });
    mockedCreateClient.mockResolvedValue(client as never);

    const result = await createTripFromAutogenIntent(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.routeId).toBeNull();
    expect(result.warnings.some((warning) => warning.includes('Aucun parcours réel navigable'))).toBe(
      true
    );
    expect(captures.rpcCalls.map((call) => call.fn)).not.toContain('select_adventure_plan_route');
    // Aucune coordonnée inventée : la génération reste sans polyline.
    expect(mockedGenerate.mock.calls[0][0].coordinates).toBeUndefined();
  });

  it('TEST-PHASE3-CMD-05: échec de génération ⇒ compensation et 500', async () => {
    const { client, captures } = createSession({
      user: { id: USER_ID },
      reads: { hiking_routes: { id: ROUTE_ID, geom: GEOM_LINE } },
      rpcResults: defaultRpcResults(),
    });
    mockedCreateClient.mockResolvedValue(client as never);
    mockedGenerate.mockRejectedValue(new Error('pipeline down'));

    const result = await createTripFromAutogenIntent(validInput());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(500);
    expect(storeMock.markFailed).toHaveBeenCalledWith('req-phase3');
    expect(captures.deletes).toContain('trips');
    expect(captures.rpcCalls.map((call) => call.fn)).not.toContain(
      'attach_adventure_plan_to_trip'
    );
  });

  it('TEST-PHASE3-CMD-06: génération déjà en cours ⇒ 409', async () => {
    mockedCreateClient.mockResolvedValue(
      createSession({ user: { id: USER_ID } }).client as never
    );
    storeMock.createPending.mockResolvedValue(null);

    const result = await createTripFromAutogenIntent(validInput());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
    expect(mockedGenerate).not.toHaveBeenCalled();
    expect(mockedCreateTrip).not.toHaveBeenCalled();
  });

  it('TEST-PHASE3-CMD-07: quota atteint ⇒ 429 + retryAfterS', async () => {
    mockedCreateClient.mockResolvedValue(
      createSession({ user: { id: USER_ID } }).client as never
    );
    storeMock.countRecent.mockResolvedValue(10);

    const result = await createTripFromAutogenIntent(validInput());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.retryAfterS).toBe(3600);
    }
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it('TEST-PHASE3-CMD-08: rejeu par correlation_id ⇒ réponse réutilisée sans regénération', async () => {
    const { client } = createSession({
      user: { id: USER_ID },
      reads: {
        adventure_plans: { trip_id: TRIP_ID, selected_route_id: 77 },
        trips: { id: TRIP_ID, slug: 'voyage-existant', title: 'Voyage existant' },
      },
    });
    mockedCreateClient.mockResolvedValue(client as never);
    storeMock.findByKey.mockResolvedValue({
      id: 'req-done',
      status: 'done',
      planId: PLAN_ID,
    });

    const result = await createTripFromAutogenIntent(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reused).toBe(true);
    expect(result.slug).toBe('voyage-existant');
    expect(result.planId).toBe(PLAN_ID);
    expect(result.routeId).toBe(77);
    expect(mockedGenerate).not.toHaveBeenCalled();
    expect(mockedCreateTrip).not.toHaveBeenCalled();
  });

  it('TEST-PHASE3-CMD-09: sélection refusée par la base ⇒ voyage ok, navigation off', async () => {
    const { client } = createSession({
      user: { id: USER_ID },
      reads: { hiking_routes: { id: ROUTE_ID, geom: GEOM_LINE } },
      rpcResults: {
        phase3_search_navigable_routes: { data: [ROUTE_ROW], error: null },
        attach_adventure_plan_to_trip: {
          data: { plan_id: PLAN_ID, trip_id: TRIP_ID, correlation_id: CORRELATION_ID },
          error: null,
        },
        select_adventure_plan_route: {
          data: null,
          error: { message: 'route 42 sans géométrie navigable' },
        },
      },
    });
    mockedCreateClient.mockResolvedValue(client as never);

    const result = await createTripFromAutogenIntent(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.routeId).toBeNull();
    expect(result.warnings.some((warning) => warning.includes('sélection refusée'))).toBe(true);
  });
});

/**
 * Préparer un sentier → activité (Task 4) — commande serveur `prepareActivityFromTrail`.
 *
 *   (a) sentier absent / identifiant invalide → `unavailable/not_found`, aucune écriture ;
 *   (b) `metadata.route_id` existant pour l'utilisateur → `reused` (aucun insert/update) ;
 *   (c) sentier valide sans activité → `created`, `route_id` normalisé en nombre,
 *       dressage `trip_steps`/`trip_pois`/`trip_expenses` et enfilage `ai_jobs` ;
 *   (d) usine autogen en échec (exception ou non-ok) → `fallback_created` (trip minimal) ;
 *   (e) sentier sans géométrie → `unavailable/no_geometry` ;
 *   bonus : nom absent, non connecté, course sur l'index unique (23505 → reused),
 *   garantie `route_id` (retry + vérif + compensation `persist_failed`),
 *   erreur de select idempotence, garde source `next=` de reprise connexion.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const { mockGetUser, serviceHolder } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  serviceHolder: { client: {} as unknown },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
}));
vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: vi.fn(() => serviceHolder.client),
}));
vi.mock('@/lib/queries-trips', () => ({ createTrip: vi.fn() }));
vi.mock('@/features/trips/engine/autoGenPipeline', () => ({ runAutoGenPipeline: vi.fn() }));
vi.mock('@/features/trips/server/createTripFromAutogenIntent', () => ({
  createTripFromAutogenIntent: vi.fn(),
}));

import { createTrip } from '@/lib/queries-trips';
import { runAutoGenPipeline } from '@/features/trips/engine/autoGenPipeline';
import { createTripFromAutogenIntent } from '@/features/trips/server/createTripFromAutogenIntent';
import {
  PrepareActivityAuthError,
  prepareActivityFromTrail,
} from '@/features/trips/server/prepareActivityFromTrail';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TRIP = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'tour-du-lac-blanc',
  title: 'Tour du Lac Blanc',
};

const ROUTE_ID = 375;
const ROUTE = {
  id: ROUTE_ID,
  name: 'Tour du Lac Blanc',
  ref: 'GR5',
  network: 'GR',
  distance_km: 12.4,
};
const META = {
  difficulty: 'hard',
  duration_hours: 5.5,
  elevation_gain: 850,
  terrain_type: 'montagne',
};
const GEOJSON = {
  type: 'LineString',
  coordinates: [
    [2.0, 48.0],
    [2.1, 48.1],
  ],
};
const BUDGET_LAYERS = {
  budget: {
    id: 'layer-budget',
    layer: 'budget',
    slotId: 'budget',
    value: { totalPerPersonEur: 120, currency: 'EUR' },
    provenance: { source: 'estimated' },
    confidence: 'low',
    rationale: 'estimation de test',
    alternatives: [],
  },
};
const PIPELINE_OUTPUT = {
  brief: {
    rawInput: 'Randonnée : Tour du Lac Blanc.',
    party: { value: { adults: 1, minors: 0 }, confidence: 'defaulted' },
  },
  blueprintId: 'blueprint-test',
  layers: BUDGET_LAYERS,
  tradeoffsLog: [],
  executionTimeMs: 3,
};

const mocks = {
  createTrip: vi.mocked(createTrip),
  runAutoGenPipeline: vi.mocked(runAutoGenPipeline),
  createTripFromAutogenIntent: vi.mocked(createTripFromAutogenIntent),
};

interface Captures {
  inserts: Array<{ table: string; values: unknown }>;
  updates: Array<{ table: string; values: unknown }>;
  deletes: string[];
  filters: Array<{ table: string; column: string; operator: string; value: unknown }>;
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
}

interface ServiceError {
  message: string;
  code?: string;
}

interface ServiceOptions {
  route?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  geojson?: unknown;
  /** File des réponses `trips` select « id, slug, title » (consommée une par appel). */
  existingTrips?: Array<Record<string, unknown> | null>;
  /** File parallèle d'erreurs de select `trips` (entrée non nulle = erreur). */
  existingTripErrors?: Array<ServiceError | null>;
  tripMetadata?: Record<string, unknown> | null;
  /** File des erreurs d'update `trips` (entrée nulle = succès, mutation appliquée). */
  tripUpdateResults?: Array<ServiceError | null>;
  pois?: Record<string, unknown>[];
}

function createService(options: ServiceOptions): { client: unknown; captures: Captures } {
  const captures: Captures = { inserts: [], updates: [], deletes: [], filters: [], rpcCalls: [] };
  const existingQueue = [...(options.existingTrips ?? [])];
  const existingErrorQueue = [...(options.existingTripErrors ?? [])];
  const tripUpdateQueue = [...(options.tripUpdateResults ?? [])];
  let tripMetadataState: Record<string, unknown> | null = options.tripMetadata ?? null;

  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      captures.rpcCalls.push({ fn, args });
      if (fn === 'get_route_geojson') return { data: options.geojson ?? null, error: null };
      if (fn === 'get_trail_pois_bbox') return { data: options.pois ?? [], error: null };
      return { data: null, error: null };
    },
    from(table: string) {
      let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
      let columns = '';
      let pendingUpdateError: ServiceError | null = null;
      const builder: Record<string, unknown> = {};

      const settle = () => {
        if (op === 'insert') return { data: null, error: null };
        if (op === 'update') return { data: null, error: pendingUpdateError };
        if (op === 'delete') return { data: null, error: null };
        if (table === 'hiking_routes') return { data: options.route ?? null, error: null };
        if (table === 'trail_metadata') return { data: options.meta ?? null, error: null };
        if (table === 'trips') {
          // Seule la lecture exacte des métadonnées (writeTripPrepareMetadata)
          // sert l'état local ; la recherche idempotente sélectionne aussi la
          // colonne metadata et doit consommer la file existante.
          if (columns.trim() === 'metadata') {
            return { data: tripMetadataState, error: null };
          }
          const next = existingQueue.length > 0 ? existingQueue.shift() : null;
          const nextError = existingErrorQueue.length > 0 ? existingErrorQueue.shift() : null;
          if (nextError) return { data: null, error: nextError };
          return { data: next ?? null, error: null };
        }
        return { data: null, error: null };
      };

      builder.select = (selected?: string) => {
        columns = selected ?? '';
        return builder;
      };
      builder.insert = (values: unknown) => {
        op = 'insert';
        captures.inserts.push({ table, values });
        return builder;
      };
      builder.update = (values: unknown) => {
        op = 'update';
        captures.updates.push({ table, values });
        const nextError = tripUpdateQueue.length > 0 ? tripUpdateQueue.shift() : null;
        pendingUpdateError = nextError ?? null;
        const nextMetadata = (values as { metadata?: unknown }).metadata;
        if (!pendingUpdateError && table === 'trips' && nextMetadata && typeof nextMetadata === 'object') {
          tripMetadataState = { metadata: nextMetadata };
        }
        return builder;
      };
      builder.delete = () => {
        op = 'delete';
        captures.deletes.push(table);
        return builder;
      };
      builder.eq = () => builder;
      builder.filter = (column: string, operator: string, value: unknown) => {
        captures.filters.push({ table, column, operator, value });
        return builder;
      };
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

function insertFor(captures: Captures, table: string) {
  return captures.inserts.find((entry) => entry.table === table);
}

describe('prepareActivityFromTrail (Task 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceHolder.client = {};
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mocks.runAutoGenPipeline.mockResolvedValue(PIPELINE_OUTPUT as never);
    mocks.createTripFromAutogenIntent.mockResolvedValue({
      ok: true,
      tripId: TRIP.id,
      slug: TRIP.slug,
      title: TRIP.title,
      planId: 'plan-test',
      routeId: ROUTE_ID,
      routeCandidates: [],
      correlationId: 'corr-test',
      reused: false,
      warnings: [],
    } as never);
    mocks.createTrip.mockResolvedValue({
      id: TRIP.id,
      slug: TRIP.slug,
      title: TRIP.title,
    } as never);
  });

  it('(a) sentier absent → unavailable/not_found, aucune écriture', async () => {
    const { client, captures } = createService({ route: null });
    serviceHolder.client = client;

    const outcome = await prepareActivityFromTrail('999999');

    expect(outcome).toEqual({ status: 'unavailable', reason: 'not_found' });
    expect(captures.inserts).toHaveLength(0);
    expect(captures.updates).toHaveLength(0);
    expect(mocks.runAutoGenPipeline).not.toHaveBeenCalled();
    expect(mocks.createTrip).not.toHaveBeenCalled();
  });

  it('(a bis) identifiants invalides → not_found sans lecture service', async () => {
    serviceHolder.client = {};

    for (const raw of ['', '   ', 'abc', '0', '-5', '3.5']) {
      const outcome = await prepareActivityFromTrail(raw);
      expect(outcome).toEqual({ status: 'unavailable', reason: 'not_found' });
    }
    expect(mocks.runAutoGenPipeline).not.toHaveBeenCalled();
  });

  it('(b) activité existante non enrichie → reused + ré-enfilage IA (aucun socle)', async () => {
    const { client, captures } = createService({
      route: ROUTE,
      meta: META,
      geojson: GEOJSON,
      existingTrips: [{ id: TRIP.id, slug: TRIP.slug, title: 'Tour du Lac Blanc (réutilisée)' }],
    });
    serviceHolder.client = client;

    const outcome = await prepareActivityFromTrail(' 375 ');

    expect(outcome).toEqual({
      status: 'reused',
      tripId: TRIP.id,
      slug: TRIP.slug,
      title: 'Tour du Lac Blanc (réutilisée)',
    });
    // Fix round final — la réutilisation re-enfile le job (le service skippe
    // immédiatement si le voyage est déjà enrichi) : plus de cul-de-sac.
    expect(insertFor(captures, 'ai_jobs')?.values).toEqual({
      user_id: USER_ID,
      feature: 'activity-enrichment',
      payload: { tripId: TRIP.id },
    });
    expect(insertFor(captures, 'trip_steps')).toBeUndefined();
    expect(captures.updates).toHaveLength(0);
    expect(mocks.runAutoGenPipeline).not.toHaveBeenCalled();
    expect(mocks.createTrip).not.toHaveBeenCalled();
    expect(captures.filters).toContainEqual({
      table: 'trips',
      column: 'metadata->>route_id',
      operator: 'eq',
      value: '375',
    });
  });

  it('(b bis) activité déjà enrichie (enrichment_version) → reused sans ré-enfilage', async () => {
    const { client, captures } = createService({
      route: ROUTE,
      meta: META,
      geojson: GEOJSON,
      existingTrips: [
        {
          id: TRIP.id,
          slug: TRIP.slug,
          title: TRIP.title,
          metadata: { route_id: ROUTE_ID, enrichment_version: 'v1', enrichment_status: 'done' },
        },
      ],
    });
    serviceHolder.client = client;

    const outcome = await prepareActivityFromTrail(String(ROUTE_ID));

    expect(outcome.status).toBe('reused');
    expect(insertFor(captures, 'ai_jobs')).toBeUndefined();
    expect(captures.inserts).toHaveLength(0);
  });

  it('(c) sentier valide sans activité → created + route_id nombre + socle + job IA', async () => {
    const pois = [
      { id: 1, name: 'Refuge du Lac', category: 'refuge', lat: 48.05, lng: 2.05 },
      { id: 2, name: 'Sommet lointain', category: 'sommet', lat: 48.6, lng: 2.6 },
    ];
    const { client, captures } = createService({
      route: ROUTE,
      meta: META,
      geojson: GEOJSON,
      existingTrips: [null],
      tripMetadata: { metadata: { autogen: { plan_id: 'plan-test' } } },
      pois,
    });
    serviceHolder.client = client;

    const outcome = await prepareActivityFromTrail(' 375 ');

    expect(outcome).toEqual({
      status: 'created',
      tripId: TRIP.id,
      slug: TRIP.slug,
      title: TRIP.title,
    });

    const factoryArgs = mocks.createTripFromAutogenIntent.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(factoryArgs.rawInput).toContain('Tour du Lac Blanc');
    expect(factoryArgs.layers).toBe(BUDGET_LAYERS);
    expect(factoryArgs.title).toBe('Tour du Lac Blanc');
    expect(factoryArgs.autoSelectRoute).toBe(true);
    expect(factoryArgs.coordinates).toEqual([
      { lat: 48.0, lng: 2.0 },
      { lat: 48.1, lng: 2.1 },
    ]);

    const tripUpdate = captures.updates.find((entry) => entry.table === 'trips');
    expect(tripUpdate).toBeDefined();
    const metadata = (tripUpdate?.values as { metadata: Record<string, unknown> }).metadata;
    expect(metadata.route_id).toBe(375);
    expect(typeof metadata.route_id).toBe('number');
    expect(metadata.enrichment_status).toBe('pending');
    expect(metadata.source).toBe('prepare-trail');
    expect(metadata.autogen).toEqual({ plan_id: 'plan-test' });

    const stepsInsert = insertFor(captures, 'trip_steps');
    expect(stepsInsert).toBeDefined();
    expect((stepsInsert?.values as Record<string, unknown>[])[0]).toMatchObject({
      trip_id: TRIP.id,
      day_number: 1,
      title: 'Tour du Lac Blanc',
      start_time: '08:30',
      source: 'deterministic',
    });

    const poisInsert = insertFor(captures, 'trip_pois');
    expect(poisInsert).toBeDefined();
    const poiRows = poisInsert?.values as Record<string, unknown>[];
    expect(poiRows).toHaveLength(1);
    expect(poiRows[0]).toMatchObject({
      trip_id: TRIP.id,
      name: 'Refuge du Lac',
      category: 'refuge',
      source: 'deterministic',
    });

    const expensesInsert = insertFor(captures, 'trip_expenses');
    expect(expensesInsert).toBeDefined();
    const expenseRows = expensesInsert?.values as Record<string, unknown>[];
    expect(expenseRows.length).toBeGreaterThan(0);
    for (const row of expenseRows) {
      expect(row.trip_id).toBe(TRIP.id);
      expect(row.payer_id).toBe(USER_ID);
      expect(row.is_planned).toBe(true);
      expect(Number(row.amount)).toBeGreaterThan(0);
    }

    const jobInsert = insertFor(captures, 'ai_jobs');
    expect(jobInsert).toBeDefined();
    expect(jobInsert?.values).toEqual({
      user_id: USER_ID,
      feature: 'activity-enrichment',
      payload: { tripId: TRIP.id },
    });
  });

  it('(d) pipeline en exception → fallback_created (trip minimal réel) + job IA', async () => {
    const { client, captures } = createService({
      route: ROUTE,
      meta: META,
      geojson: GEOJSON,
      existingTrips: [null],
      tripMetadata: { metadata: {} },
    });
    serviceHolder.client = client;
    mocks.runAutoGenPipeline.mockRejectedValue(new Error('pipeline indisponible'));

    const outcome = await prepareActivityFromTrail(String(ROUTE_ID));

    expect(outcome).toEqual({
      status: 'fallback_created',
      tripId: TRIP.id,
      slug: TRIP.slug,
      title: TRIP.title,
    });

    const [input, userId] = mocks.createTrip.mock.calls[0];
    expect(userId).toBe(USER_ID);
    expect(input).toMatchObject({
      title: 'Tour du Lac Blanc',
      destination_name: 'Tour du Lac Blanc',
      difficulty: 'hard',
      primary_activity: 'hiking',
      status: 'draft',
      visibility: 'private',
    });
    expect((input.metadata as Record<string, unknown>).route_id).toBe(ROUTE_ID);

    expect(insertFor(captures, 'trip_steps')).toBeDefined();
    expect(insertFor(captures, 'trip_expenses')).toBeUndefined();
    expect(insertFor(captures, 'ai_jobs')).toBeDefined();
  });

  it('(d bis) usine autogen non-ok → fallback_created', async () => {
    const { client } = createService({
      route: ROUTE,
      meta: META,
      geojson: GEOJSON,
      existingTrips: [null],
      tripMetadata: { metadata: {} },
    });
    serviceHolder.client = client;
    mocks.createTripFromAutogenIntent.mockResolvedValue({
      ok: false,
      status: 500,
      error: 'usine en échec',
    } as never);

    const outcome = await prepareActivityFromTrail(String(ROUTE_ID));

    expect(outcome.status).toBe('fallback_created');
    expect(mocks.createTrip).toHaveBeenCalledTimes(1);
  });

  it('(e) sentier sans géométrie → unavailable/no_geometry, aucune écriture', async () => {
    const { client, captures } = createService({ route: ROUTE, meta: META, geojson: null });
    serviceHolder.client = client;

    const outcome = await prepareActivityFromTrail(String(ROUTE_ID));

    expect(outcome).toEqual({ status: 'unavailable', reason: 'no_geometry' });
    expect(captures.inserts).toHaveLength(0);
    expect(mocks.runAutoGenPipeline).not.toHaveBeenCalled();
  });

  it('(e bis) sentier sans nom → unavailable/no_name', async () => {
    const { client } = createService({
      route: { ...ROUTE, name: '   ' },
      meta: META,
      geojson: GEOJSON,
    });
    serviceHolder.client = client;

    const outcome = await prepareActivityFromTrail(String(ROUTE_ID));

    expect(outcome).toEqual({ status: 'unavailable', reason: 'no_name' });
    expect(mocks.runAutoGenPipeline).not.toHaveBeenCalled();
  });

  it('(f) course index unique (23505) → re-sélection et reused, aucune écriture', async () => {
    const { client, captures } = createService({
      route: ROUTE,
      meta: META,
      geojson: GEOJSON,
      existingTrips: [null, { id: TRIP.id, slug: TRIP.slug, title: TRIP.title }],
    });
    serviceHolder.client = client;
    mocks.runAutoGenPipeline.mockRejectedValue(new Error('pipeline indisponible'));
    mocks.createTrip.mockRejectedValue({
      code: '23505',
      message: 'duplicate key value violates unique constraint "uniq_trips_user_route"',
    });

    const outcome = await prepareActivityFromTrail(String(ROUTE_ID));

    expect(outcome).toEqual({
      status: 'reused',
      tripId: TRIP.id,
      slug: TRIP.slug,
      title: TRIP.title,
    });
    // Le perdant n'a rien écrit ; la réutilisation re-enfile le job.
    expect(insertFor(captures, 'trip_steps')).toBeUndefined();
    expect(insertFor(captures, 'ai_jobs')).toBeDefined();
  });

  it('sentier valide mais non connecté → PrepareActivityAuthError (aucune écriture)', async () => {
    const { client, captures } = createService({ route: ROUTE, meta: META, geojson: GEOJSON });
    serviceHolder.client = client;
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(prepareActivityFromTrail(String(ROUTE_ID))).rejects.toBeInstanceOf(
      PrepareActivityAuthError
    );
    expect(captures.inserts).toHaveLength(0);
    expect(mocks.runAutoGenPipeline).not.toHaveBeenCalled();
  });

  it('(g) route_id non persisté après retry → compensation delete + unavailable/persist_failed', async () => {
    const { client, captures } = createService({
      route: ROUTE,
      meta: META,
      geojson: GEOJSON,
      existingTrips: [null],
      tripMetadata: { metadata: {} },
      tripUpdateResults: [{ message: 'écriture impossible' }, { message: 'écriture impossible' }],
    });
    serviceHolder.client = client;

    const outcome = await prepareActivityFromTrail(String(ROUTE_ID));

    expect(outcome).toEqual({ status: 'unavailable', reason: 'persist_failed' });
    expect(captures.updates.filter((entry) => entry.table === 'trips')).toHaveLength(2);
    expect(captures.deletes).toContain('trips');
    expect(insertFor(captures, 'trip_steps')).toBeUndefined();
    expect(insertFor(captures, 'trip_expenses')).toBeUndefined();
    expect(insertFor(captures, 'ai_jobs')).toBeUndefined();
  });

  it('(g bis) retry metadata réussi → created + socle + job IA', async () => {
    const { client, captures } = createService({
      route: ROUTE,
      meta: META,
      geojson: GEOJSON,
      existingTrips: [null],
      tripMetadata: { metadata: {} },
      tripUpdateResults: [{ message: 'erreur transitoire' }, null],
    });
    serviceHolder.client = client;

    const outcome = await prepareActivityFromTrail(String(ROUTE_ID));

    expect(outcome.status).toBe('created');
    expect(captures.deletes).toHaveLength(0);
    expect(insertFor(captures, 'trip_steps')).toBeDefined();
    expect(insertFor(captures, 'ai_jobs')).toBeDefined();
  });

  it('(h) 23505 à l’écriture metadata.route_id → reused + suppression du perdant', async () => {
    const { client, captures } = createService({
      route: ROUTE,
      meta: META,
      geojson: GEOJSON,
      existingTrips: [null, { id: TRIP.id, slug: TRIP.slug, title: TRIP.title }],
      tripMetadata: { metadata: {} },
      tripUpdateResults: [
        {
          code: '23505',
          message: 'duplicate key value violates unique constraint "uniq_trips_user_route"',
        },
      ],
    });
    serviceHolder.client = client;

    const outcome = await prepareActivityFromTrail(String(ROUTE_ID));

    expect(outcome).toEqual({
      status: 'reused',
      tripId: TRIP.id,
      slug: TRIP.slug,
      title: TRIP.title,
    });
    // Le perdant de la course est supprimé (cascades) : jamais d'orphelin
    // sans route_id ; l'enrichissement du gagnant est ré-enfilé.
    expect(captures.deletes).toContain('trips');
    expect(insertFor(captures, 'ai_jobs')).toBeDefined();
  });

  it('(i) erreur de select idempotence → unavailable/persist_failed, aucune création', async () => {
    const { client, captures } = createService({
      route: ROUTE,
      meta: META,
      geojson: GEOJSON,
      existingTrips: [null],
      existingTripErrors: [{ message: 'base indisponible' }],
    });
    serviceHolder.client = client;

    const outcome = await prepareActivityFromTrail(String(ROUTE_ID));

    expect(outcome).toEqual({ status: 'unavailable', reason: 'persist_failed' });
    expect(mocks.runAutoGenPipeline).not.toHaveBeenCalled();
    expect(mocks.createTrip).not.toHaveBeenCalled();
    expect(captures.inserts).toHaveLength(0);
  });
});

describe('Reprise connexion — garde source (paramètre `next`)', () => {
  const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), 'utf8');

  it('page.tsx et activer/route.ts redirigent la connexion avec `next=` (jamais `redirect=`)', () => {
    for (const file of [
      'src/app/preparer-sentier/[id]/page.tsx',
      'src/app/preparer-sentier/[id]/activer/route.ts',
    ]) {
      const source = read(file);
      expect(source).toContain('/connexion?next=');
      expect(source).not.toContain('?redirect=');
    }
  });
});

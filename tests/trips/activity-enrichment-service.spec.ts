/**
 * Service d'enrichissement d'activité (Task 7) — `processActivityEnrichmentJob`.
 *
 *   (a) sortie LLM valide → inserts `trip_steps` (provenance `llm_suggestion`,
 *       `start_time`, `metadata{source,model,enrichmentVersion}`), `trip_pois`,
 *       `trip_items` (kit) et `trip_checklist_items` (position max+1) + metadata
 *       `enrichment_version='v1'` / `enrichment_status='done'` — zéro
 *       `trip_expenses` (ruling : le LLM n'écrit aucun montant) ;
 *   (b) étape hors corridor 3 km → filtrée par le sanitizer, jamais écrite ;
 *   (c) quota épuisé → `deferred`, zéro écriture, provider non appelé ;
 *   (d) JSON invalide → `failed`, zéro écriture, `enrichment_status='failed'` ;
 *   (e) tracé vide (`ActivityEnrichmentNoTraceError`) → `failed` tracé ;
 *   (f) `enrichment_version` déjà présent → `done` (skip), zéro écriture ;
 *   (g) registre : feature résolue + fallback bien formé.
 *
 * Provider, quota et client service sont mockés : aucun réseau, aucune BDD.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { askAIMock, consumeQuotaMock, serviceHolder } = vi.hoisted(() => ({
  askAIMock: vi.fn(),
  consumeQuotaMock: vi.fn(),
  serviceHolder: { client: {} as unknown },
}));

vi.mock('@/lib/ai/askAI', () => ({ askAI: askAIMock }));
vi.mock('@/lib/ai/quota', () => ({ consumeQuota: consumeQuotaMock }));
vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: vi.fn(() => serviceHolder.client),
}));

import { processActivityEnrichmentJob } from '@/features/trips/server/activityEnrichment/service';
import { ACTIVITY_ENRICHMENT_SPEC } from '@/lib/ai/features/activityEnrichment';
import { FEATURES, getFeature } from '@/lib/ai/features/registry';
import type { AIRequest } from '@/lib/ai/providers/types';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TRIP_ID = '22222222-2222-4222-8222-222222222222';
const JOB = {
  id: '33333333-3333-4333-8333-333333333333',
  user_id: USER_ID,
  payload: { tripId: TRIP_ID },
};

const ROUTE_ID = 375;
const ROUTE = {
  id: ROUTE_ID,
  name: 'Tour du Mont Blanc',
  ref: 'GR5',
  network: 'GR',
  distance_km: 14.3,
};
const META = {
  difficulty: 'hard',
  duration_hours: 6.5,
  elevation_gain: 870,
  terrain_type: 'montagne',
};
/** Tracé réel de test : ligne régulière autour de Chamonix. */
const POLYLINE = [
  { lat: 45.9, lng: 6.86 },
  { lat: 45.91, lng: 6.88 },
  { lat: 45.92, lng: 6.9 },
];
const GEOJSON = {
  type: 'LineString',
  coordinates: POLYLINE.map((point) => [point.lng, point.lat]),
};

const IN_STEP = {
  title: 'Départ du sentier',
  description: 'Montée régulière depuis le village.',
  startTime: '08:30',
  lat: 45.905,
  lng: 6.87,
  distanceKm: 12.5,
  transportMode: 'foot',
  accommodation: 'Refuge du Goûter',
};
/** ~4 km au nord du tracé : hors corridor 3 km. */
const OFF_STEP = {
  ...IN_STEP,
  title: 'Étape inventée trop loin',
  lat: 45.95,
  lng: 6.87,
};

const VALID_OUTPUT = {
  days: [
    {
      day: 1,
      title: 'Étape 1 — Chamonix → Refuge du Goûter',
      steps: [IN_STEP, OFF_STEP],
      moments: {
        matin: ['Réveil au village'],
        apresMidi: ['Montée au refuge'],
        soir: ['Dîner en refuge'],
      },
    },
  ],
  suggestions: [
    { category: 'hotel', label: 'Nuit près du départ', searchTerms: 'hôtel Chamonix centre' },
  ],
  kitAdditions: [{ name: 'Bâtons de marche', reason: 'Dénivelé soutenu', category: 'Randonnée' }],
  checklistAdditions: [{ label: 'Réserver le refuge', dueOffsetDays: 14 }],
};

const TRIP_METADATA = {
  route_id: ROUTE_ID,
  source: 'prepare-trail',
  enrichment_status: 'pending',
  autogen: {
    layers: {
      major_transport: { value: { mode: 'train', from: 'Paris Gare de Lyon' } },
      accommodations: { value: { name: 'Refuges du Parc National de la Vanoise' } },
    },
  },
};

const SERVICE_POIS = [
  { id: 1, name: 'Refuge du Goûter', category: 'refuge', lat: 45.905, lng: 6.87 },
  { id: 2, name: 'Sommet lointain', category: 'sommet', lat: 48.6, lng: 2.6 },
];

interface ServiceError {
  message: string;
}

interface ServiceOptions {
  trip?: { id: string; user_id: string; metadata: Record<string, unknown> } | null;
  tripError?: ServiceError | null;
  route?: Record<string, unknown> | null;
  routeError?: ServiceError | null;
  meta?: Record<string, unknown> | null;
  geojson?: unknown;
  pois?: Record<string, unknown>[];
  existingSteps?: { day_number: number; order_index: number }[];
  maxChecklistPosition?: number | null;
  insertErrors?: Record<string, ServiceError | null>;
  updateError?: ServiceError | null;
}

interface Captures {
  inserts: Array<{ table: string; values: unknown }>;
  updates: Array<{ table: string; values: unknown }>;
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
}

function createService(options: ServiceOptions): { client: unknown; captures: Captures } {
  const captures: Captures = { inserts: [], updates: [], rpcCalls: [] };
  let tripState = options.trip ?? null;

  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      captures.rpcCalls.push({ fn, args });
      if (fn === 'get_route_geojson') {
        return { data: options.geojson ?? null, error: null };
      }
      if (fn === 'get_trail_pois_bbox') {
        return { data: options.pois ?? [], error: null };
      }
      return { data: null, error: null };
    },
    from(table: string) {
      let op: 'select' | 'insert' | 'update' = 'select';
      let pendingUpdateValues: unknown = null;
      const builder: Record<string, unknown> = {};

      const settle = () => {
        if (op === 'insert') {
          return { data: null, error: options.insertErrors?.[table] ?? null };
        }
        if (op === 'update') {
          if (table === 'trips') {
            const values = pendingUpdateValues as { metadata?: unknown } | null;
            if (values && typeof values.metadata === 'object' && values.metadata !== null) {
              tripState = tripState
                ? { ...tripState, metadata: values.metadata as Record<string, unknown> }
                : null;
            }
          }
          return { data: null, error: options.updateError ?? null };
        }
        if (table === 'trips') {
          return options.tripError
            ? { data: null, error: options.tripError }
            : { data: tripState, error: null };
        }
        if (table === 'hiking_routes') {
          return options.routeError
            ? { data: null, error: options.routeError }
            : { data: options.route ?? null, error: null };
        }
        if (table === 'trail_metadata') return { data: options.meta ?? null, error: null };
        if (table === 'trip_steps') return { data: options.existingSteps ?? [], error: null };
        if (table === 'trip_checklist_items') {
          return {
            data:
              options.maxChecklistPosition === undefined || options.maxChecklistPosition === null
                ? null
                : { position: options.maxChecklistPosition },
            error: null,
          };
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
        pendingUpdateValues = values;
        captures.updates.push({ table, values });
        return builder;
      };
      builder.eq = () => builder;
      builder.order = () => builder;
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

function defaultService(overrides: ServiceOptions = {}) {
  return createService({
    trip: { id: TRIP_ID, user_id: USER_ID, metadata: { ...TRIP_METADATA } },
    route: ROUTE,
    meta: META,
    geojson: GEOJSON,
    pois: SERVICE_POIS,
    existingSteps: [{ day_number: 1, order_index: 0 }],
    maxChecklistPosition: 2,
    ...overrides,
  });
}

describe('processActivityEnrichmentJob (Task 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceHolder.client = {};
    consumeQuotaMock.mockResolvedValue(true);
    askAIMock.mockResolvedValue({
      text: JSON.stringify(VALID_OUTPUT),
      model: 'ultra-model-test',
      degraded: false,
      cached: false,
      provider: 'openrouter',
    });
  });

  it('(a) sortie valide → steps/pois/items/checklist avec provenance + metadata done, zéro dépense', async () => {
    const { client, captures } = defaultService();
    serviceHolder.client = client;

    const result = await processActivityEnrichmentJob(JOB);

    expect(result.outcome).toBe('done');

    // Contexte réel injecté au provider : sentier + POI réels.
    expect(askAIMock).toHaveBeenCalledTimes(1);
    const aiRequest = askAIMock.mock.calls[0][0] as Record<string, unknown>;
    expect(aiRequest.feature).toBe('activity-enrichment');
    expect(aiRequest.tier).toBe('heavy');
    expect(aiRequest.cacheTtlSeconds).toBe(0);
    expect(aiRequest.prompt).toContain('Tour du Mont Blanc');
    expect(aiRequest.prompt).toContain('GR5');
    expect(aiRequest.prompt).toContain('Refuge du Goûter');
    expect(String(aiRequest.prompt)).not.toContain('priceEur');

    // Quota : pattern trail-narrative (consommé ICI, sans userId pour askAI).
    expect(consumeQuotaMock).toHaveBeenCalledWith(
      USER_ID,
      ACTIVITY_ENRICHMENT_SPEC.tier,
      'activity-enrichment',
      ACTIVITY_ENRICHMENT_SPEC.maxPerUserPerDay
    );

    // Le LLM n'écrit JAMAIS de dépense (ruling T3/T7).
    expect(captures.inserts.some((entry) => entry.table === 'trip_expenses')).toBe(false);

    const stepsInsert = insertFor(captures, 'trip_steps');
    expect(stepsInsert).toBeDefined();
    const stepRows = stepsInsert?.values as Record<string, unknown>[];
    expect(stepRows).toHaveLength(1);
    expect(stepRows[0]).toMatchObject({
      trip_id: TRIP_ID,
      day_number: 1,
      order_index: 1,
      title: 'Départ du sentier',
      start_time: '08:30',
      source: 'llm_suggestion',
      metadata: {
        source: 'llm_suggestion',
        model: 'ultra-model-test',
        enrichmentVersion: 'v1',
      },
    });

    const poisInsert = insertFor(captures, 'trip_pois');
    expect(poisInsert).toBeDefined();
    const poiRows = poisInsert?.values as Record<string, unknown>[];
    expect(poiRows).toHaveLength(1);
    expect(poiRows[0]).toMatchObject({
      trip_id: TRIP_ID,
      name: 'Départ du sentier',
      source: 'llm_suggestion',
      metadata: {
        source: 'llm_suggestion',
        model: 'ultra-model-test',
        enrichmentVersion: 'v1',
      },
    });

    const itemsInsert = insertFor(captures, 'trip_items');
    expect(itemsInsert).toBeDefined();
    expect((itemsInsert?.values as Record<string, unknown>[])[0]).toMatchObject({
      trip_id: TRIP_ID,
      item_name: 'Bâtons de marche',
      category: 'Randonnée',
      source: 'llm_suggestion',
      notes: 'Dénivelé soutenu',
    });

    const checklistInsert = insertFor(captures, 'trip_checklist_items');
    expect(checklistInsert).toBeDefined();
    expect((checklistInsert?.values as Record<string, unknown>[])[0]).toMatchObject({
      trip_id: TRIP_ID,
      label: 'Réserver le refuge',
      due_offset_days: 14,
      done: false,
      position: 3,
    });

    const tripUpdate = captures.updates.find((entry) => entry.table === 'trips');
    expect(tripUpdate).toBeDefined();
    const metadata = (tripUpdate?.values as { metadata: Record<string, unknown> }).metadata;
    expect(metadata.enrichment_version).toBe('v1');
    expect(metadata.enrichment_status).toBe('done');
    expect(metadata.enrichment_model).toBe('ultra-model-test');
    expect(typeof metadata.enrichment_at).toBe('string');
    expect(metadata.route_id).toBe(ROUTE_ID);
  });

  it('(b) étape hors corridor 3 km → filtrée, ni step ni poi inventés', async () => {
    const { client, captures } = defaultService();
    serviceHolder.client = client;

    const result = await processActivityEnrichmentJob(JOB);

    expect(result.outcome).toBe('done');
    const stepTitles = (insertFor(captures, 'trip_steps')?.values as Record<string, unknown>[]).map(
      (row) => row.title
    );
    expect(stepTitles).toEqual(['Départ du sentier']);
    expect(stepTitles).not.toContain('Étape inventée trop loin');
    const poiNames = (insertFor(captures, 'trip_pois')?.values as Record<string, unknown>[]).map(
      (row) => row.name
    );
    expect(poiNames).not.toContain('Étape inventée trop loin');
  });

  it('(c) quota épuisé → deferred sans aucun write ni appel provider', async () => {
    const { client, captures } = defaultService();
    serviceHolder.client = client;
    consumeQuotaMock.mockResolvedValue(false);

    const result = await processActivityEnrichmentJob(JOB);

    expect(result).toEqual({ outcome: 'deferred', detail: 'quota' });
    expect(askAIMock).not.toHaveBeenCalled();
    expect(captures.inserts).toHaveLength(0);
    expect(captures.updates).toHaveLength(0);
  });

  it('(d) JSON invalide → failed, zéro écriture de contenu + trace enrichissement', async () => {
    const { client, captures } = defaultService();
    serviceHolder.client = client;
    askAIMock.mockResolvedValue({
      text: 'pas du json',
      model: 'ultra-model-test',
      degraded: false,
      cached: false,
      provider: 'openrouter',
    });

    const result = await processActivityEnrichmentJob(JOB);

    expect(result.outcome).toBe('failed');
    expect(captures.inserts).toHaveLength(0);
    expect(captures.updates).toHaveLength(1);
    const metadata = (captures.updates[0].values as { metadata: Record<string, unknown> }).metadata;
    expect(metadata.enrichment_status).toBe('failed');
    expect(metadata.enrichment_version).toBeUndefined();
    expect(typeof metadata.enrichment_error).toBe('string');
  });

  it('(e) tracé réel absent → ActivityEnrichmentNoTraceError catchée → failed tracé, zéro write', async () => {
    const { client, captures } = defaultService({ geojson: null });
    serviceHolder.client = client;

    const result = await processActivityEnrichmentJob(JOB);

    expect(result.outcome).toBe('failed');
    expect(result.detail).toMatch(/tracé/i);
    expect(askAIMock).not.toHaveBeenCalled();
    expect(captures.inserts).toHaveLength(0);
    const metadata = (captures.updates[0].values as { metadata: Record<string, unknown> }).metadata;
    expect(metadata.enrichment_status).toBe('failed');
  });

  it('(f) idempotence : enrichment_version déjà présent → done (skip), zéro write, zéro quota', async () => {
    const { client, captures } = defaultService({
      trip: {
        id: TRIP_ID,
        user_id: USER_ID,
        metadata: { ...TRIP_METADATA, enrichment_version: 'v1', enrichment_status: 'done' },
      },
    });
    serviceHolder.client = client;

    const result = await processActivityEnrichmentJob(JOB);

    expect(result.outcome).toBe('done');
    expect(captures.inserts).toHaveLength(0);
    expect(captures.updates).toHaveLength(0);
    expect(consumeQuotaMock).not.toHaveBeenCalled();
    expect(askAIMock).not.toHaveBeenCalled();
  });

  it('(g) registre : la feature activity-enrichment est résolue et le fallback est bien formé', async () => {
    expect(() => getFeature('activity-enrichment')).not.toThrow();
    const spec = FEATURES['activity-enrichment'];
    expect(spec).toBeDefined();
    expect(spec.tier).toBe(ACTIVITY_ENRICHMENT_SPEC.tier);
    expect(spec.maxReasoningBudget).toBe(ACTIVITY_ENRICHMENT_SPEC.maxReasoningBudget);
    expect(spec.cacheTtlSeconds).toBe(ACTIVITY_ENRICHMENT_SPEC.cacheTtlSeconds);
    expect(spec.maxPerUserPerDay).toBe(ACTIVITY_ENRICHMENT_SPEC.maxPerUserPerDay);

    const fallback = await spec.fallbackResponse({} as AIRequest);
    expect(fallback.degraded).toBe(true);
    expect(fallback.provider).toBe('fallback');
    expect(fallback.text.length).toBeGreaterThan(0);
    const parsed = JSON.parse(fallback.text) as Record<string, unknown>;
    for (const key of ['days', 'suggestions', 'kitAdditions', 'checklistAdditions']) {
      expect(Array.isArray(parsed[key])).toBe(true);
    }
  });
});

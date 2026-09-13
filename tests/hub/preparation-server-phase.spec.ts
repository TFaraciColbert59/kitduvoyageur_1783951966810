import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Fix round final — CRITICAL 1 : le rail doit se compléter.
 *
 *   (a) unité : `buildHubPreparationSummary` classe les lignes réelles
 *       (étape avec hébergement/transport → affiliation) et lit
 *       `metadata.enrichment_status` ;
 *   (b) intégration : une sortie de job d'enrichissement RÉELLE
 *       (steps + POIs + kit, zéro dépense) → résumé serveur → phase `done`.
 *
 * Le job est exécuté par `processActivityEnrichmentJob` avec provider, quota
 * et client service mockés : aucun réseau, aucune BDD.
 */
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
import { buildHubPreparationSummary } from '@/features/hub/server/preparationSummary';
import { preparationPhase } from '@/features/hub/components/live/preparationPhases';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TRIP_ID = '22222222-2222-4222-8222-222222222222';
const JOB = { id: 'job-1', user_id: USER_ID, payload: { tripId: TRIP_ID } };

const ROUTE_ID = 375;
const ROUTE = { id: ROUTE_ID, name: 'Tour du Mont Blanc', ref: 'GR5', network: 'GR', distance_km: 14.3 };
const META = { difficulty: 'hard', duration_hours: 6.5, elevation_gain: 870, terrain_type: 'montagne' };
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

const VALID_OUTPUT = {
  days: [
    {
      day: 1,
      title: 'Étape 1 — Chamonix → Refuge du Goûter',
      steps: [IN_STEP],
      moments: { matin: ['Réveil au village'], apresMidi: [], soir: ['Dîner en refuge'] },
    },
  ],
  suggestions: [
    { category: 'hotel', label: 'Nuit près du départ', searchTerms: 'hôtel Chamonix centre' },
  ],
  kitAdditions: [{ name: 'Bâtons de marche', reason: 'Dénivelé soutenu', category: 'Randonnée' }],
  checklistAdditions: [{ label: 'Réserver le refuge', dueOffsetDays: 14 }],
};

type Row = Record<string, unknown>;

interface Captures {
  inserts: Array<{ table: string; values: Row[] }>;
  updates: Array<{ table: string; values: Record<string, unknown> }>;
}

function createService(): { client: unknown; captures: Captures } {
  const captures: Captures = { inserts: [], updates: [] };
  let tripState = {
    id: TRIP_ID,
    user_id: USER_ID,
    metadata: { route_id: ROUTE_ID, source: 'prepare-trail', enrichment_status: 'pending' } as Row,
  };
  let idCounter = 0;

  const client = {
    rpc: async (fn: string) => {
      if (fn === 'get_route_geojson') return { data: GEOJSON, error: null };
      if (fn === 'get_trail_pois_bbox') return { data: [], error: null };
      return { data: null, error: null };
    },
    from(table: string) {
      let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
      let pendingValues: unknown = null;
      let returning = false;
      const builder: Record<string, unknown> = {};

      const settle = () => {
        if (op === 'insert') {
          const values = (Array.isArray(pendingValues) ? pendingValues : []) as Row[];
          captures.inserts.push({ table, values });
          const rows = values.map((row) => {
            idCounter += 1;
            return { id: `${table}-${idCounter}`, ...row };
          });
          return { data: returning ? rows.map((row) => ({ id: row.id })) : null, error: null };
        }
        if (op === 'update') {
          captures.updates.push({ table, values: pendingValues as Record<string, unknown> });
          if (table === 'trips') {
            const patch = (pendingValues as { metadata?: Row }).metadata;
            if (patch) tripState = { ...tripState, metadata: patch };
          }
          return { data: null, error: null };
        }
        if (op === 'delete') return { data: null, error: null };
        if (table === 'trips') return { data: tripState, error: null };
        if (table === 'hiking_routes') return { data: ROUTE, error: null };
        if (table === 'trail_metadata') return { data: META, error: null };
        if (table === 'trip_steps') return { data: [], error: null };
        if (table === 'trip_checklist_items') return { data: null, error: null };
        return { data: null, error: null };
      };

      builder.select = (columns?: string) => {
        if (op === 'insert' && columns) returning = true;
        return builder;
      };
      builder.insert = (values: unknown) => {
        op = 'insert';
        pendingValues = values;
        return builder;
      };
      builder.update = (values: unknown) => {
        op = 'update';
        pendingValues = values;
        return builder;
      };
      builder.delete = () => {
        op = 'delete';
        return builder;
      };
      builder.eq = () => builder;
      builder.filter = () => builder;
      builder.in = () => builder;
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

function insertRows(captures: Captures, table: string): Row[] {
  return captures.inserts.filter((entry) => entry.table === table).flatMap((entry) => entry.values);
}

describe('préparation serveur — compteurs réels et phase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumeQuotaMock.mockResolvedValue(true);
    askAIMock.mockResolvedValue({
      text: JSON.stringify(VALID_OUTPUT),
      model: 'ultra-model-test',
      degraded: false,
      cached: false,
      provider: 'openrouter',
    });
  });

  it('(a) buildHubPreparationSummary : étape hébergée → affiliation, statut lu', () => {
    const summary = buildHubPreparationSummary(
      {
        steps: [
          { accommodation_name: 'Refuge du Goûter', transport_mode: 'foot' },
          { accommodation_name: null, transport_mode: null },
        ],
        pois: [{ id: 'p1' }],
        items: [{ id: 'i1' }, { id: 'i2' }],
        expenses: [],
        metadata: { enrichment_status: 'done' },
      },
      1
    );

    expect(summary).toEqual({
      steps: 1,
      moments: 1,
      affiliation: 1,
      kit: 3,
      enrichmentStatus: 'done',
    });
  });

  it('(b) sortie réelle du job (steps+POIs+kit, zéro dépense) → phase done', async () => {
    const { client, captures } = createService();
    serviceHolder.client = client;

    const result = await processActivityEnrichmentJob(JOB);
    expect(result.outcome).toBe('done');

    const stepsRows = insertRows(captures, 'trip_steps');
    const poiRows = insertRows(captures, 'trip_pois');
    const itemRows = insertRows(captures, 'trip_items');
    const expenseRows = insertRows(captures, 'trip_expenses');

    // Le job n'écrit JAMAIS de dépense (anti-invention de montants).
    expect(expenseRows).toHaveLength(0);
    expect(stepsRows.length).toBeGreaterThan(0);
    expect(poiRows.length).toBeGreaterThan(0);
    expect(itemRows.length).toBeGreaterThan(0);

    const metadataUpdate = captures.updates.find(
      (entry) => entry.table === 'trips' && entry.values.metadata
    );
    const metadata = metadataUpdate?.values.metadata as Row;
    expect(metadata.enrichment_status).toBe('done');

    const checklistCount = insertRows(captures, 'trip_checklist_items').length;
    const summary = buildHubPreparationSummary(
      {
        steps: stepsRows,
        pois: poiRows,
        items: itemRows,
        expenses: expenseRows,
        metadata,
      },
      checklistCount
    );

    expect(summary.affiliation).toBeGreaterThan(0);
    expect(summary.moments).toBeGreaterThan(0);
    expect(summary.kit).toBeGreaterThan(0);
    expect(preparationPhase(summary, summary.enrichmentStatus)).toBe('done');
  });
});

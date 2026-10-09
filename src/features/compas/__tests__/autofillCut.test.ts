import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Plan 100, 2.12 : la coupure d'une préparation (2.6), de bout en bout sur
 * `compasAutofillAction` avec un client Supabase en mémoire (les services
 * tiers sont simulés, le garde réseau refuse le reste).
 *
 * - Coupure par la limite de la fonction juste après l'itinéraire : rien de
 *   final n'est écrit, l'attente reste ; une relance attend tant que la prise
 *   vit, puis reprend CET itinéraire (aucune étape en double) ; « Annuler »
 *   retrouve toutes les étapes ; l'attente est dite « coupée », plus « en cours ».
 * - « Arrêter » : avant l'itinéraire, rien n'est écrit ; pendant le reste, plus
 *   aucune écriture (nuits, kit, budget) hormis la trace, et la relance demande
 *   d'abord « Annuler ».
 */
const h = vi.hoisted(() => ({
  db: null as unknown as MemorySupabase,
  /** La fonction est coupée à l'altitude des étapes (première chose après l'itinéraire). */
  cut: false,
  reachedCut: null as null | (() => void),
  onQuery: null as null | ((q: QueryInfo) => void | Promise<void>),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));
vi.mock('../server/placeLookup', async (orig) => ({
  ...(await orig<typeof import('../server/placeLookup')>()),
  lookupDestination: vi.fn(async () => null),
  lookupLoose: vi.fn(async () => null),
  lookupNatural: vi.fn(async () => null),
  lookupMassif: vi.fn(async () => null),
  lookupReverse: vi.fn(async () => null),
  lookupRiver: vi.fn(async () => null),
  stageCandidates: vi.fn(async () => []),
  stageAliasCandidates: vi.fn(async () => []),
}));
vi.mock('../server/stagePoiLookup', () => ({
  lookupAreaPlaces: vi.fn(async () => null),
  lookupRiverLine: vi.fn(async () => null),
  lookupStagePois: vi.fn(async () => null),
}));
vi.mock('@/lib/geo/terrainElevation', async (orig) => ({
  ...(await orig<typeof import('@/lib/geo/terrainElevation')>()),
  terrainElevations: vi.fn((points: unknown[]) => {
    if (!h.cut) return Promise.resolve(points.map(() => null));
    h.reachedCut?.();
    // Jamais résolue : la fonction s'arrête ici (limite de 300 s), sans catch ni finally.
    return new Promise(() => undefined);
  }),
}));
vi.mock('@/features/adventure-prep/routingService', async (orig) => ({
  ...(await orig<typeof import('@/features/adventure-prep/routingService')>()),
  routeAttempt: vi.fn(async () => ({ legs: null, reason: 'provider_unavailable' })),
}));
vi.mock('../server/sharedCache', async (orig) => ({
  ...(await orig<typeof import('../server/sharedCache')>()),
  cached: vi.fn(async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  readShared: vi.fn(async () => undefined),
  writeShared: vi.fn(async () => undefined),
}));
vi.mock('../server/elevation', () => ({ routeAscentM: vi.fn(async () => null) }));
vi.mock('@/lib/ai/askAI', () => ({
  aiEnabled: () => false,
  askAI: vi.fn(async () => ({ text: '{}', model: 'x', degraded: true, cached: false, provider: 'fallback' })),
}));

import { reportServerError } from '@/lib/observability/appErrors';
import {
  compasAutofillAction,
  compasAutofillStopAction,
  compasRefreshAutofillAction,
  compasUndoAutofillAction,
} from '../server/autofillActions';
import { CLAIM_MS, readPending } from '../server/autofillState';
import { memorySupabase, type MemorySupabase, type QueryInfo, type Row } from './helpers/memorySupabase';

const TRIP = '33333333-3333-4333-8333-333333333333';
const T0 = Date.parse('2026-10-09T10:00:00.000Z');
const launch = () => compasAutofillAction({ tripId: TRIP, tripSlug: 'lyon', from: null, phase: 'all' });

const tripRow = () => h.db.rows('trips')[0] as Row & { metadata: Record<string, unknown> };
const compas = () => (tripRow().metadata.compas ?? {}) as Record<string, unknown>;
const stepIds = () => h.db.rows('trip_steps').map((s) => String(s.id));
const writesTo = (table: string, from = 0) => h.db.writes.slice(from).filter((w) => w.table === table);

/** Lance une préparation que la limite de la fonction coupe après l'itinéraire. */
async function launchAndCut(): Promise<void> {
  h.cut = true;
  const reached = new Promise<void>((resolve) => (h.reachedCut = resolve));
  void launch();
  await reached;
  h.cut = false;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  vi.clearAllMocks();
  h.cut = false;
  h.reachedCut = null;
  h.onQuery = null;
  h.db = memorySupabase({ user: () => ({ id: 'u1' }), onQuery: (q) => h.onQuery?.(q) });
  // Trois jours à Lyon : itinéraire depuis une base, sans carte ni IA.
  h.db.rows('trips').push({
    id: TRIP,
    user_id: 'u1',
    title: 'Séjour · Lyon',
    start_date: '2026-11-10',
    end_date: '2026-11-12',
    destination_name: 'Lyon',
    destination_country_code: 'FR',
    party_size: 1,
    budget_currency: 'EUR',
    primary_activity: 'citytrip',
    estimated_budget: null,
    metadata: {
      compas: { anchor: { name: 'Lyon', lat: 45.764, lon: 4.8357, countryCode: 'FR', country: 'France', kind: 'city' } },
    },
    updated_at: '2026-10-09T09:00:00.000000+00:00',
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('coupure par la limite de la fonction, juste après l’itinéraire', () => {
  it('l’itinéraire est inscrit en attente ; rien de final n’est écrit', async () => {
    await launchAndCut();
    expect(stepIds()).toHaveLength(3);
    const pending = readPending(tripRow().metadata);
    expect(pending).toMatchObject({ stepIds: stepIds(), restAt: T0 });
    expect(compas().autofill).toBeUndefined();
    expect(h.db.rows('trip_items')).toEqual([]);
    expect(h.db.rows('trip_expenses')).toEqual([]);
  });

  it('relancée pendant que la prise vit : elle attend, aucune étape en double ; l’attente est dite « en cours »', async () => {
    await launchAndCut();
    const before = h.db.writes.length;
    vi.setSystemTime(T0 + 60_000);
    expect(await launch()).toEqual({ success: true, pending: true, stepsCreated: 0 });
    expect(stepIds()).toHaveLength(3);
    expect(writesTo('trip_steps', before)).toEqual([]);
    expect(await compasRefreshAutofillAction({ tripId: TRIP, tripSlug: 'lyon' })).toEqual({
      success: false,
      error: 'Une préparation est déjà en cours.',
    });
  });

  it('relancée après expiration de la prise : reprend CET itinéraire, sans étape en double, et finit', async () => {
    await launchAndCut();
    const pending = readPending(tripRow().metadata)!;
    const ids = stepIds();
    vi.setSystemTime(T0 + CLAIM_MS + 1_000);
    // Plus rien ne la fait avancer : l'écran la dit coupée.
    expect(await compasRefreshAutofillAction({ tripId: TRIP, tripSlug: 'lyon' })).toEqual({
      success: false,
      error: 'Préparation coupée en cours de route : relance « Tout préparer » pour la finir, ou annule-la.',
    });

    const before = h.db.writes.length;
    const res = await launch();
    expect(res).toMatchObject({ success: true, summary: { stepsCreated: 3 } });
    expect(stepIds()).toEqual(ids);
    expect(writesTo('trip_steps', before).filter((w) => w.op !== 'update')).toEqual([]);
    // La trace finale reprend la préparation coupée : même identifiant, mêmes étapes.
    expect(compas().autofill).toMatchObject({ runId: pending.runId, stepIds: ids });
    expect(readPending(tripRow().metadata)).toBeNull();
    expect(compas().autofill_claim).toBeUndefined();
    expect(h.db.rows('trip_expenses').length).toBeGreaterThan(0);
    expect(h.db.rows('trip_expenses').every((e) => (e.metadata as { autofill?: string }).autofill === pending.runId)).toBe(true);
    // Une relance de plus ne double rien.
    expect(await launch()).toEqual({
      success: false,
      error: 'Le voyage est déjà prérempli : annule d’abord pour relancer.',
      already: true,
    });
    expect(stepIds()).toEqual(ids);
    expect(reportServerError).not.toHaveBeenCalled();
  });

  it('« Annuler » après la coupure retire toutes les étapes écrites ; la relance repart d’un voyage vide', async () => {
    await launchAndCut();
    expect(await compasUndoAutofillAction({ tripId: TRIP, tripSlug: 'lyon' })).toEqual({ success: true });
    expect(stepIds()).toEqual([]);
    expect(readPending(tripRow().metadata)).toBeNull();

    vi.setSystemTime(T0 + CLAIM_MS + 1_000);
    expect(await launch()).toMatchObject({ success: true, summary: { stepsCreated: 3 } });
    expect(stepIds()).toHaveLength(3);
  });
});

describe('« Arrêter » pendant la préparation', () => {
  it('avant l’itinéraire : rien n’est écrit, la place est rendue, une relance repart', async () => {
    let asked = false;
    h.onQuery = async (q) => {
      // Pendant la lecture des étapes (début de la préparation) : la personne arrête.
      if (asked || q.table !== 'trip_steps' || q.op !== 'select') return;
      asked = true;
      expect(await compasAutofillStopAction({ tripId: TRIP })).toEqual({ success: true });
    };
    expect(await launch()).toEqual({ success: false, error: 'Préparation arrêtée : rien n’a été écrit.' });
    expect(asked).toBe(true);
    for (const table of ['trip_steps', 'trip_items', 'trip_expenses']) expect(writesTo(table)).toEqual([]);
    expect(compas().autofill_claim).toBeUndefined();

    // Relancée plus tard : l'arrêt d'avant ne la concerne pas.
    vi.setSystemTime(T0 + 1_000);
    expect(await launch()).toMatchObject({ success: true, summary: { stepsCreated: 3 } });
    expect(stepIds()).toHaveLength(3);
  });

  it('pendant le reste : plus aucune écriture hormis la trace ; la relance demande « Annuler » ; « Annuler » retire l’itinéraire', async () => {
    let stopAt = -1;
    h.onQuery = async (q) => {
      // Pendant la recherche des refuges (après l'itinéraire) : la personne arrête.
      if (stopAt >= 0 || q.table !== 'map_refuges') return;
      expect(await compasAutofillStopAction({ tripId: TRIP })).toEqual({ success: true });
      stopAt = h.db.writes.length;
    };
    const res = await launch();
    expect(stopAt).toBeGreaterThan(0);
    const ids = stepIds();
    expect(ids).toHaveLength(3);
    // Après l'arrêt : ni nuits, ni kit, ni budget ; seule la trace du voyage.
    const after = h.db.writes.slice(stopAt);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((w) => w.table === 'trips')).toBe(true);
    expect(h.db.rows('trip_steps').every((s) => s.accommodation_name == null)).toBe(true);
    expect(h.db.rows('trip_items')).toEqual([]);
    expect(h.db.rows('trip_expenses')).toEqual([]);
    expect(res).toMatchObject({ success: true, summary: { budget: [], total: 0 } });
    expect(res.success && 'summary' in res ? res.summary.notes : []).toContain(
      'Préparation arrêtée à ta demande : l’itinéraire est gardé, nuits, kit et budget ne sont pas faits. « Annuler » retire tout.'
    );
    expect(compas().autofill).toMatchObject({ stopped: true, stepIds: ids, itemIds: [], expenseIds: [] });

    vi.setSystemTime(T0 + 1_000);
    const before = h.db.writes.length;
    expect(await launch()).toEqual({
      success: false,
      error: 'Préparation arrêtée en cours de route : « Annuler » retire ce qui est fait, puis relance.',
    });
    expect(h.db.writes.length).toBe(before);

    expect(await compasUndoAutofillAction({ tripId: TRIP, tripSlug: 'lyon' })).toEqual({ success: true });
    expect(stepIds()).toEqual([]);
    vi.setSystemTime(T0 + 2_000);
    expect(await launch()).toMatchObject({ success: true, summary: { stepsCreated: 3 } });
    expect(stepIds()).toHaveLength(3);
  });
});

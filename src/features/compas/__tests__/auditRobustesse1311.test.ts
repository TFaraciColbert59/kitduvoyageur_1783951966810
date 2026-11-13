import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Audit de robustesse du 13/11 (les points 3 et 4, écran de départ, sont dans
 * `auditRobustesse1311.test.tsx`).
 *
 * 1. Dates ou enveloppe saisies par la personne : « Annuler » et la réadaptation ne les effacent plus.
 * 2. « Annuler la préparation » lit chaque suppression : un échec garde la trace (ids) et le dit.
 * 5. Cartes en panne : « service indisponible », pas « lieu introuvable » ; une panne n'est pas gardée en cache.
 * 6. `listCompasTrips` : une erreur de base remonte (pas de liste vide) ; tri par dernière modification.
 * 7. Compteur de créations en panne (503) : « indisponible », pas « trop de créations ».
 * 8. Une ancre sans coordonnées (`null`) n'est pas posée en (0, 0).
 *
 * Base en mémoire (`helpers/memorySupabase.ts`) ; les services tiers sont simulés à leur frontière.
 */
const h = vi.hoisted(() => ({
  db: null as unknown as MemorySupabase,
  /** Client de remplacement (lecture de `listCompasTrips`) ; null : la base en mémoire. */
  client: null as unknown,
  /** Statut d'un refus du limiteur (429, 503) ; null : accepté. */
  limit: null as null | number,
  failQuery: null as null | ((q: QueryInfo) => { code: string; message: string } | undefined),
  /** Réponse de la carte (`fetch`) : rejet par défaut, aucun réseau réel. */
  fetch: (async () => {
    throw new Error('réseau interdit en test');
  }) as (url: string) => Promise<Response>,
  cacheWrites: [] as string[],
  trip: null as unknown,
  viatorAt: [] as unknown[],
}));

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.client ?? h.db.client }));
vi.mock('@/features/hub/context/activeAdventureServer', () => ({
  setActiveAdventureAction: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async () => (h.limit ? new Response(null, { status: h.limit }) : null)),
}));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));
vi.mock('@/lib/siteSlot', () => ({ photonSlot: vi.fn(async () => true) }));
vi.mock('@/lib/ai/askAI', () => ({
  aiEnabled: () => false,
  askAI: vi.fn(async () => ({ text: '{}', model: 'x', degraded: true, cached: false, provider: 'fallback' })),
}));
vi.mock('../server/sharedCache', async (orig) => ({
  ...(await orig<typeof import('../server/sharedCache')>()),
  // Comme le vrai `cached` : une valeur n'est gardée que si `keep` l'accepte (jamais une panne).
  cached: vi.fn(
    async (_kind: string, key: string, _ttl: number, fn: () => Promise<unknown>, keep: (v: unknown) => boolean = (v) => v != null) => {
      const value = await fn();
      if (keep(value)) h.cacheWrites.push(key);
      return value;
    }
  ),
  readShared: vi.fn(async () => undefined),
  writeShared: vi.fn(async () => undefined),
}));
vi.mock('../server/geoapify', async (orig) => ({
  ...(await orig<typeof import('../server/geoapify')>()),
  geoapifySearch: vi.fn(async () => null),
  geoapifyReverse: vi.fn(async () => null),
}));
vi.mock('../server/locationIq', async (orig) => ({
  ...(await orig<typeof import('../server/locationIq')>()),
  nominatimJson: vi.fn(async () => null),
}));
vi.mock('@/lib/queries-trips', async (orig) => ({
  ...(await orig<typeof import('@/lib/queries-trips')>()),
  getTripById: vi.fn(async () => h.trip),
}));
vi.mock('@/features/booking/server/bookingProvider', async (orig) => ({
  ...(await orig<typeof import('@/features/booking/server/bookingProvider')>()),
  createBookingProvider: () => ({ supports: () => true, search: async () => ({ offers: [] }) }),
}));
vi.mock('../server/viatorDestinations', async (orig) => ({
  ...(await orig<typeof import('../server/viatorDestinations')>()),
  viatorDestinationNear: vi.fn(async (at: unknown) => {
    h.viatorAt.push(at);
    return null;
  }),
}));

import {
  compasCreateTripAction,
  compasSetBudgetAction,
  compasSetDatesAction,
  compasSetDestinationAction,
  compasSetOriginAction,
} from '../server/compasActions';
import { compasAutofillAction, compasRefreshAutofillAction, compasUndoAutofillAction } from '../server/autofillActions';
import { withoutAutofillFlag } from '../server/autofillState';
import { tripBasis } from '../server/compasServer';
import { resolvePlaceOutcome } from '../server/placeSearch';
import { listCompasTrips } from '../server/myTrips';
import { compasNearbyActivitiesAction } from '../server/resaActions';
import { serverMessage } from '../server/serverText';
import { memorySupabase, type MemorySupabase, type QueryInfo, type Row } from './helpers/memorySupabase';

const TRIP = '33333333-3333-4333-8333-333333333333';
const SLUG = 'lyon';
const LYON = { name: 'Lyon', lat: 45.764, lon: 4.8357, countryCode: 'FR', country: 'France', kind: 'city' };

const tripRow = () => h.db.rows('trips')[0] as Row & { metadata: Record<string, unknown> };
const compas = () => (tripRow().metadata.compas ?? {}) as Record<string, unknown>;
const autofill = () => compas().autofill as Record<string, unknown> | undefined;

function seedTrip(over: Partial<Row> = {}, compasOver: Record<string, unknown> = {}) {
  h.db.rows('trips').push({
    id: TRIP,
    user_id: 'u1',
    title: 'Séjour · Lyon',
    start_date: null,
    end_date: null,
    destination_name: 'Lyon',
    destination_country_code: 'FR',
    party_size: 1,
    budget_currency: 'EUR',
    primary_activity: 'citytrip',
    estimated_budget: null,
    metadata: { compas: { anchor: LYON, ...compasOver } },
    updated_at: '2026-10-09T09:00:00.000000+00:00',
    ...over,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.client = null;
  h.limit = null;
  h.failQuery = null;
  h.cacheWrites = [];
  h.trip = null;
  h.viatorAt = [];
  h.fetch = async () => {
    throw new Error('réseau interdit en test');
  };
  vi.stubGlobal('fetch', (url: string) => h.fetch(String(url)));
  h.db = memorySupabase({ user: () => ({ id: 'u1' }), failQuery: (q) => h.failQuery?.(q) });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/* ------------------------------------------------------------------ 1 */

describe('1. dates et enveloppe saisies : plus effacées par « Annuler » ni par la réadaptation', () => {
  /** Ce que « Tout préparer » avait écrit : des dates (meilleure période) et une enveloppe. */
  const prepared = (extra: Record<string, unknown> = {}) => ({
    autofill: {
      runId: 'run-1',
      at: '2026-10-09T09:00:00.000Z',
      stepIds: [],
      routeSet: false,
      itemIds: [],
      expenseIds: [],
      stays: [],
      budgetSet: true,
      datesSet: true,
      notes: [],
      ...extra,
    },
  });

  /** Les réglages du voyage au moment du préremplissage (de quoi calculer l'empreinte `basis`). */
  const BASE = { start_date: '2026-12-01', end_date: '2026-12-04', party_size: 1, destination_name: 'Lyon', metadata: { compas: { anchor: LYON } } };

  it('withoutAutofillFlag : retire le drapeau de la préparation et de l’attente, rend le même objet sans rien à retirer', () => {
    const c = { autofill: { runId: 'r', datesSet: true, budgetSet: true }, autofill_pending: { runId: 'r', datesSet: true }, anchor: LYON };
    const noDates = withoutAutofillFlag(c, 'datesSet');
    expect(noDates.autofill).toEqual({ runId: 'r', budgetSet: true });
    expect(noDates.autofill_pending).toEqual({ runId: 'r' });
    expect(noDates.anchor).toBe(LYON);
    expect(c.autofill).toEqual({ runId: 'r', datesSet: true, budgetSet: true }); // pur
    const none = { anchor: LYON };
    expect(withoutAutofillFlag(none, 'budgetSet')).toBe(none);
  });

  it('dates choisies puis « Annuler » : les dates restent ; l’enveloppe du préremplissage, elle, est retirée', async () => {
    seedTrip({ start_date: '2026-12-01', end_date: '2026-12-04', estimated_budget: 900 }, prepared());
    expect(
      await compasSetDatesAction({ tripId: TRIP, tripSlug: SLUG, startDate: '2027-03-01', endDate: '2027-03-03', durationHours: null })
    ).toMatchObject({ success: true });
    expect(autofill()?.datesSet).toBeUndefined();
    expect(autofill()?.budgetSet).toBe(true);
    expect(await compasUndoAutofillAction({ tripId: TRIP, tripSlug: SLUG })).toEqual({ success: true });
    expect(tripRow().start_date).toBe('2027-03-01');
    expect(tripRow().end_date).toBe('2027-03-03');
    expect(tripRow().estimated_budget).toBeNull();
  });

  it('enveloppe saisie puis « Annuler » : l’enveloppe reste ; les dates du préremplissage sont retirées', async () => {
    seedTrip({ start_date: '2026-12-01', end_date: '2026-12-04', estimated_budget: 900 }, prepared());
    expect(await compasSetBudgetAction({ tripId: TRIP, tripSlug: SLUG, amount: 2500 })).toEqual({ success: true });
    expect(autofill()?.budgetSet).toBeUndefined();
    expect(autofill()?.datesSet).toBe(true);
    expect(await compasUndoAutofillAction({ tripId: TRIP, tripSlug: SLUG })).toEqual({ success: true });
    expect(tripRow().estimated_budget).toBe(2500);
    expect(tripRow().start_date).toBeNull();
  });

  it('enveloppe saisie puis changement de groupe (réadaptation) : l’enveloppe n’est pas recalculée', async () => {
    const { metadata: _m, ...fields } = BASE;
    void _m;
    seedTrip({ ...fields, estimated_budget: 900 }, prepared({ basis: tripBasis(BASE, 'citytrip') }));
    await compasSetBudgetAction({ tripId: TRIP, tripSlug: SLUG, amount: 2500 });
    tripRow().party_size = 3; // la personne change le groupe
    const res = await compasRefreshAutofillAction({ tripId: TRIP, tripSlug: SLUG });
    expect(res).toMatchObject({ success: true });
    expect((res as { parts: string[] }).parts).toContain('budget');
    expect(tripRow().estimated_budget).toBe(2500);
  });

  it('témoin : sans saisie de la personne, la réadaptation recalcule bien l’enveloppe du préremplissage', async () => {
    const { metadata: _m, ...fields } = BASE;
    void _m;
    seedTrip({ ...fields, estimated_budget: 900 }, prepared({ basis: tripBasis(BASE, 'citytrip') }));
    tripRow().party_size = 3;
    await compasRefreshAutofillAction({ tripId: TRIP, tripSlug: SLUG });
    expect(tripRow().estimated_budget).toBeNull();
  });
});

/* ------------------------------------------------------------------ 2 */

describe('2. « Annuler la préparation » : chaque suppression est lue', () => {
  const FAILED = 'L’annulation n’a pas pu être menée à son terme : rien n’est perdu, réessaie.';
  const run = () => ({
    autofill: {
      runId: 'run-1',
      at: '2026-10-09T09:00:00.000Z',
      stepIds: ['s1'],
      routeSet: false,
      itemIds: ['i1'],
      expenseIds: ['e1'],
      stays: [{ stepId: 's1', name: 'Hôtel du Parc' }],
      budgetSet: false,
      datesSet: false,
      notes: [],
    },
  });
  const rows = () => {
    h.db.rows('trip_steps').push({ id: 's1', trip_id: TRIP, accommodation_name: 'Hôtel du Parc' });
    h.db.rows('trip_items').push({ id: 'i1', trip_id: TRIP });
    h.db.rows('trip_expenses').push({ id: 'e1', trip_id: TRIP });
  };
  const undo = () => compasUndoAutofillAction({ tripId: TRIP, tripSlug: SLUG });

  it.each([
    ['trip_items', 'delete'],
    ['trip_expenses', 'delete'],
    ['trip_steps', 'update'],
    ['trip_steps', 'delete'],
  ] as const)('%s (%s) refusé : erreur dite, ids gardés, rien de « annulé » écrit ; relancée, elle aboutit', async (table, op) => {
    seedTrip({}, run());
    rows();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.failQuery = (q) => (q.table === table && q.op === op ? { code: '42501', message: 'refusé' } : undefined);
    expect(await undo()).toEqual({ success: false, error: FAILED });
    expect(autofill()).toMatchObject({ runId: 'run-1', stepIds: ['s1'], itemIds: ['i1'], expenseIds: ['e1'] });
    expect(autofill()?.undone).toBeUndefined();
    // La panne passée : la même trace permet de finir.
    h.failQuery = null;
    expect(await undo()).toEqual({ success: true });
    expect(autofill()).toEqual({ undone: true });
    expect(h.db.rows('trip_items')).toEqual([]);
    expect(h.db.rows('trip_expenses')).toEqual([]);
    expect(h.db.rows('trip_steps')).toEqual([]);
  });

  it('écriture de la trace refusée : erreur dite (plus de succès affiché), ids gardés', async () => {
    seedTrip({}, run());
    rows();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.failQuery = (q) => (q.table === 'trips' && q.op === 'update' ? { code: '57014', message: 'délai' } : undefined);
    expect(await undo()).toEqual({ success: false, error: FAILED });
    expect(autofill()).toMatchObject({ runId: 'run-1', itemIds: ['i1'] });
  });

  it('témoin : sans panne, tout est retiré et la trace devient « annulée »', async () => {
    seedTrip({}, run());
    rows();
    expect(await undo()).toEqual({ success: true });
    expect(autofill()).toEqual({ undone: true });
    expect(h.db.rows('trip_items')).toEqual([]);
  });
});

/* ------------------------------------------------------------------ 5 */

describe('5. cartes en panne : « indisponible », pas « introuvable »', () => {
  const UNAVAILABLE = serverMessage('fr', 'compas.server.placeSearch.unavailable');
  const NOT_FOUND = 'Quelquepartville';
  const emptyMap = () => new Response('{"features":[]}', { status: 200, headers: { 'content-type': 'application/json' } });
  // 404 : pas d'attente de réessai (les 429/5xx en ont une de 1,2 s) ; pour `search`, c'est la même panne.
  const downMap = () => new Response('indisponible', { status: 404 });

  it('tous les services muets : unavailable, et rien n’est gardé en cache', async () => {
    h.fetch = async () => downMap();
    expect(await resolvePlaceOutcome(NOT_FOUND)).toEqual({ place: null, unavailable: true });
    expect(h.cacheWrites).toEqual([]);
  });

  it('la carte répond sans résultat : introuvable, pas une panne', async () => {
    h.fetch = async () => emptyMap();
    expect(await resolvePlaceOutcome(NOT_FOUND)).toEqual({ place: null, unavailable: false });
  });

  it('destination : panne → texte « indisponible » ; réponse vide → « introuvable »', async () => {
    seedTrip();
    h.fetch = async () => downMap();
    expect(await compasSetDestinationAction({ tripId: TRIP, tripSlug: SLUG, place: NOT_FOUND })).toEqual({
      success: false,
      error: UNAVAILABLE,
    });
    h.fetch = async () => emptyMap();
    expect(await compasSetDestinationAction({ tripId: TRIP, tripSlug: SLUG, place: NOT_FOUND })).toEqual({
      success: false,
      error: `« ${NOT_FOUND} » introuvable sur la carte.`,
    });
  });

  it('départ : panne → « indisponible » ; réponse vide → « introuvable »', async () => {
    seedTrip();
    h.fetch = async () => downMap();
    expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: SLUG, place: NOT_FOUND })).toEqual({
      success: false,
      error: UNAVAILABLE,
    });
    h.fetch = async () => emptyMap();
    expect(await compasSetOriginAction({ tripId: TRIP, tripSlug: SLUG, place: NOT_FOUND })).toEqual({
      success: false,
      error: `« ${NOT_FOUND} » introuvable sur la carte.`,
    });
  });
});

/* ------------------------------------------------------------------ 6 */

describe('6. listCompasTrips : l’erreur remonte, tri par dernière modification', () => {
  type Res = { data: unknown; error: { message: string } | null };
  function listClient(owned: Res, shared: Res) {
    const orders: Array<[string, unknown]> = [];
    const from = (table: string) => {
      const res = table === 'trips' ? owned : shared;
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'limit']) q[m] = () => q;
      q.order = (col: string, opts: unknown) => {
        orders.push([col, opts]);
        return q;
      };
      q.then = (f: (v: Res) => unknown, r: (e: unknown) => unknown) => Promise.resolve(res).then(f, r);
      return q;
    };
    h.client = { from, auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } };
    return orders;
  }
  const row = (id: string) => ({ id, slug: `s-${id}`, title: `T ${id}`, start_date: null, end_date: null });

  it('erreur sur les voyages créés : rejet (error.tsx), pas une liste vide', async () => {
    listClient({ data: null, error: { message: 'connexion perdue' } }, { data: [], error: null });
    await expect(listCompasTrips()).rejects.toThrow(/connexion perdue/);
  });

  it('erreur sur les voyages partagés : rejet aussi', async () => {
    listClient({ data: [row('a')], error: null }, { data: null, error: { message: 'délai dépassé' } });
    await expect(listCompasTrips()).rejects.toThrow(/délai dépassé/);
  });

  it('tri sur updated_at décroissant (un brouillon sans date n’est plus relégué), jamais sur start_date', async () => {
    const orders = listClient({ data: [row('a'), row('b')], error: null }, { data: [{ trips: row('c') }], error: null });
    const list = await listCompasTrips();
    expect(orders).toEqual([['updated_at', { ascending: false }]]);
    expect(list.map((t) => [t.id, t.role])).toEqual([
      ['a', 'owner'],
      ['b', 'owner'],
      ['c', 'collaborator'],
    ]);
  });
});

/* ------------------------------------------------------------------ 7 */

describe('7. compteur de créations : 429 et 503 ne disent pas la même chose', () => {
  const create = () => compasCreateTripAction({ activity: 'hiking', say: 'Trois jours dans le Vercors' });

  it('429 : « trop de créations d’affilée »', async () => {
    h.limit = 429;
    expect(await create()).toEqual({ success: false, error: 'Trop de créations d’affilée : patiente une minute.' });
  });

  it('503 (limiteur en panne, failMode closed) : « indisponible », pas la faute de la personne', async () => {
    h.limit = 503;
    expect(await create()).toEqual({
      success: false,
      error: 'Création momentanément indisponible : réessaie dans quelques minutes.',
    });
    expect(h.db.rows('trips')).toEqual([]);
  });

  it.each(['en', 'de', 'es', 'it'] as const)('le nouveau texte existe en %s, distinct de « trop de créations »', (locale) => {
    const unavailable = serverMessage(locale, 'compas.server.create.unavailable');
    expect(unavailable).toBeTruthy();
    expect(unavailable).not.toBe(serverMessage(locale, 'compas.server.create.tooMany'));
    expect(serverMessage(locale, 'compas.server.autofill.undo.failed')).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ 8 */

describe('8. ancre sans coordonnées : jamais le point (0, 0)', () => {
  it('« Tout préparer » : une ancre { lat: null, lon: null } est comme pas d’ancre (« dis-moi où »)', async () => {
    seedTrip({ start_date: '2026-11-10', end_date: '2026-11-12' }, { anchor: { name: 'Lyon', lat: null, lon: null, kind: 'city' } });
    const res = await compasAutofillAction({ tripId: TRIP, tripSlug: SLUG, from: null, phase: 'all' });
    expect(res).toEqual({ success: false, error: serverMessage('fr', 'compas.server.autofill.needPlace') });
    expect(h.db.rows('trip_steps')).toEqual([]);
  });

  it('Résa : une ancre sans coordonnées ne cherche pas les activités autour de (0, 0)', async () => {
    h.trip = {
      user_id: 'u1',
      destination_name: 'Vercors',
      destination_country_code: 'FR',
      start_date: null,
      party_size: 2,
      steps: [],
      metadata: { compas: { anchor: { name: 'Vercors', lat: null, lon: null, kind: 'region' } } },
    };
    const res = await compasNearbyActivitiesAction({ tripId: TRIP });
    expect(res).toMatchObject({ success: true });
    expect(h.viatorAt).toEqual([null]);
  });

  it('témoin : une ancre réelle est bien transmise', async () => {
    h.trip = {
      user_id: 'u1',
      destination_name: 'Vercors',
      destination_country_code: 'FR',
      start_date: null,
      party_size: 2,
      steps: [],
      metadata: { compas: { anchor: { name: 'Vercors', lat: 45.07, lon: 5.55, kind: 'region' } } },
    };
    await compasNearbyActivitiesAction({ tripId: TRIP });
    expect(h.viatorAt).toEqual([{ lat: 45.07, lon: 5.55 }]);
  });
});

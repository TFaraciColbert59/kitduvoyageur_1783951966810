import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Plan 100, 2.12 : la limite de fréquence (2.2) ne se contourne pas depuis le
 * navigateur. Tout est réel sauf la base et les services tiers : session lue par
 * `requireEditor` (client Supabase en mémoire), `enforceRateLimit` et
 * `rateLimit` avec le compteur Postgres (`rate_limit_consume`, appelé en
 * PostgREST : `fetch` simulé ici, comme la base de production).
 *
 * - la clé est celle de la personne connectée (empreinte HMAC), jamais un champ
 *   envoyé : changer de voyage, de lieu, de texte ou de slug ne remet rien à zéro ;
 * - compteur en panne, en erreur ou muet : refus (`failMode: 'closed'`), jamais
 *   de passage ;
 * - une préparation demandée en phase « rest » sans itinéraire en attente compte
 *   comme un lancement (elle échappait à la limite des lancements).
 */
const h = vi.hoisted(() => ({
  caller: 'editor-2' as string | null,
  /** Compteur de la base : clé hachée → passages et fin de fenêtre. */
  counter: new Map<string, { hits: number; resetAt: number }>(),
  bodies: [] as Array<{ p_key: string; p_window_ms: number }>,
  mode: 'ok' as 'ok' | 'reseau' | 'http500' | 'illisible' | 'muet',
  db: null as unknown as MemorySupabase,
}));

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.db.client }));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));
vi.mock('../server/placeLookup', async (orig) => ({
  ...(await orig<typeof import('../server/placeLookup')>()),
  lookupDestination: vi.fn(async () => null),
  lookupBase: vi.fn(async () => null),
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
  terrainElevations: vi.fn(async () => null),
}));
vi.mock('@/lib/ai/askAI', () => ({
  aiEnabled: () => false,
  askAI: vi.fn(async () => ({ text: '{}', model: 'x', degraded: true, cached: false, provider: 'fallback' })),
}));
vi.mock('../server/rates', () => ({ getEurRate: vi.fn(async () => null) }));

import { askAI } from '@/lib/ai/askAI';
import { hashRateLimitKey } from '@/lib/rate-limit/postgresStore';
import { compasAutofillAction } from '../server/autofillActions';
import { compasInterpretAction, compasSetDestinationAction } from '../server/compasActions';
import { lookupDestination } from '../server/placeLookup';
import { memorySupabase, type MemorySupabase } from './helpers/memorySupabase';

const SERVICE_KEY = 'cle-service-test';
const TRIP_A = '11111111-1111-4111-8111-111111111111'; // à owner-1, editor-2 y est éditeur
const TRIP_B = '22222222-2222-4222-8222-222222222222'; // à editor-2
const SLOW = 'Recherche de lieux indisponible pour le moment : réessaie dans un instant.';
const TOO_MANY_PLACES = 'Trop de lieux cherchés d’affilée : patiente quelques minutes.';
const TOO_MANY_PHRASES = 'Trop de demandes d’affilée : patiente quelques minutes.';
const NO_INTERPRET = 'Compréhension indisponible pour le moment : réessaie dans un instant.';

const keyOf = (logical: string) => hashRateLimitKey(logical, SERVICE_KEY);

/** PostgREST de la base : `rate_limit_consume` (fenêtre fixe), ou la panne voulue. */
async function postgrest(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (url !== 'https://projet-test.supabase.co/rest/v1/rpc/rate_limit_consume')
    throw new Error(`Appel inattendu dans le test : ${url}`);
  const body = JSON.parse(String(init?.body)) as { p_key: string; p_window_ms: number };
  h.bodies.push(body);
  if (h.mode === 'reseau') throw new TypeError('fetch failed');
  if (h.mode === 'http500') return new Response('boom', { status: 500 });
  if (h.mode === 'illisible') return new Response(JSON.stringify({ rien: true }), { status: 200 });
  if (h.mode === 'muet')
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
  const now = Date.now();
  const prev = h.counter.get(body.p_key);
  const slot = prev && prev.resetAt > now ? { ...prev, hits: prev.hits + 1 } : { hits: 1, resetAt: now + body.p_window_ms };
  h.counter.set(body.p_key, slot);
  return new Response(JSON.stringify([{ current_hits: slot.hits, reset_at: new Date(slot.resetAt).toISOString() }]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function trip(id: string, owner: string, metadata: Record<string, unknown>) {
  return {
    id,
    user_id: owner,
    title: 'Trek · nouvelle aventure',
    start_date: null,
    end_date: null,
    destination_name: null,
    destination_country_code: null,
    party_size: 1,
    budget_currency: 'EUR',
    primary_activity: 'hiking',
    estimated_budget: null,
    metadata,
    updated_at: '2026-10-09T08:00:00.000000+00:00',
  };
}

beforeEach(() => {
  h.caller = 'editor-2';
  h.counter = new Map();
  h.bodies = [];
  h.mode = 'ok';
  h.db = memorySupabase({
    user: () => (h.caller ? { id: h.caller } : null),
    rpc: (fn, args) =>
      fn === 'can_edit_trip'
        ? {
            data:
              (args.p_trip_id === TRIP_A && ['owner-1', 'editor-2'].includes(String(h.caller))) ||
              (args.p_trip_id === TRIP_B && h.caller === 'editor-2'),
            error: null,
          }
        : undefined,
  });
  h.db.rows('trips').push(trip(TRIP_A, 'owner-1', {}), trip(TRIP_B, 'editor-2', { compas: { planned_days: 2 } }));
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projet-test.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY);
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  vi.stubGlobal('fetch', vi.fn(postgrest));
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('destination : la limite suit la session, pas les champs envoyés', () => {
  it('une seule clé, l’empreinte de « compas-destination:<session> », quels que soient voyage, lieu ou slug', async () => {
    await compasSetDestinationAction({ tripId: TRIP_A, tripSlug: 'a', place: 'Vercors' });
    await compasSetDestinationAction({ tripId: TRIP_B, tripSlug: 'autre-slug', place: 'Chartreuse' });
    // Un lieu qui ressemble à un identifiant ne change rien non plus.
    await compasSetDestinationAction({ tripId: TRIP_A, tripSlug: 'owner-1', place: 'owner-1' });

    const mine = await keyOf('compas-destination:editor-2');
    expect(h.bodies.map((b) => b.p_key)).toEqual([mine, mine, mine]);
    expect(h.bodies.every((b) => b.p_window_ms === 600_000)).toBe(true);
    // Ni l'id du propriétaire du voyage, ni le voyage : la personne connectée.
    expect(mine).not.toBe(await keyOf('compas-destination:owner-1'));
    expect(mine).not.toBe(await keyOf(`compas-destination:${TRIP_A}`));
    // Rien de lisible n'est envoyé à la base (HMAC avec la clé de service).
    expect(JSON.stringify(h.bodies)).not.toMatch(/editor-2|owner-1|Vercors/);
  });

  it('20 recherches, puis refus même en changeant de voyage, de lieu et de slug ; la carte n’est plus interrogée', async () => {
    for (let i = 0; i < 20; i += 1) {
      const res = await compasSetDestinationAction({
        tripId: i % 2 ? TRIP_A : TRIP_B,
        tripSlug: `slug-${i}`,
        place: `Lieu numéro ${i}`,
      });
      expect(res).toEqual({ success: false, error: `« Lieu numéro ${i} » introuvable sur la carte.` });
    }
    expect(lookupDestination).toHaveBeenCalledTimes(20);
    const aiCalls = vi.mocked(askAI).mock.calls.length;

    for (const [tripId, place] of [
      [TRIP_A, 'Mercantour'],
      [TRIP_B, 'Écrins'],
    ] as const) {
      expect(await compasSetDestinationAction({ tripId, tripSlug: 'neuf', place })).toEqual({ success: false, error: TOO_MANY_PLACES });
    }
    expect(lookupDestination).toHaveBeenCalledTimes(20);
    expect(vi.mocked(askAI).mock.calls.length).toBe(aiCalls);
  });

  it('une autre personne garde son propre compteur, sur le même voyage', async () => {
    h.counter.set(await keyOf('compas-destination:editor-2'), { hits: 20, resetAt: Date.now() + 600_000 });
    expect(await compasSetDestinationAction({ tripId: TRIP_A, tripSlug: 'a', place: 'Vercors' })).toEqual({
      success: false,
      error: TOO_MANY_PLACES,
    });
    h.caller = 'owner-1';
    expect(await compasSetDestinationAction({ tripId: TRIP_A, tripSlug: 'a', place: 'Vercors' })).toEqual({
      success: false,
      error: '« Vercors » introuvable sur la carte.',
    });
    expect(lookupDestination).toHaveBeenCalledTimes(1);
  });

  it('sans session : rien n’est compté, rien n’est cherché', async () => {
    h.caller = null;
    const res = await compasSetDestinationAction({ tripId: TRIP_A, tripSlug: 'a', place: 'Vercors' });
    expect(res).toEqual({ success: false, error: 'Connecte-toi pour modifier le voyage.' });
    expect(h.bodies).toEqual([]);
    expect(lookupDestination).not.toHaveBeenCalled();
  });
});

describe('phrase : la limite suit la session, pas le texte ni le voyage', () => {
  it('30 phrases différentes sur deux voyages, puis refus ; plus d’IA', async () => {
    for (let i = 0; i < 30; i += 1) {
      const res = await compasInterpretAction({ tripId: i % 2 ? TRIP_A : TRIP_B, text: `rando ${i + 1} jours dans le Vercors` });
      expect(res.success).toBe(true);
    }
    expect(askAI).toHaveBeenCalledTimes(30);
    const res = await compasInterpretAction({ tripId: TRIP_A, text: 'tout autre chose, ailleurs' });
    expect(res).toEqual({ success: false, error: TOO_MANY_PHRASES });
    expect(askAI).toHaveBeenCalledTimes(30);
    const mine = await keyOf('compas-interpret:editor-2');
    expect(new Set(h.bodies.map((b) => b.p_key))).toEqual(new Set([mine]));
  });
});

describe('compteur en panne : refus, jamais de passage (failMode closed)', () => {
  for (const mode of ['reseau', 'http500', 'illisible'] as const) {
    it(`base ${mode === 'reseau' ? 'injoignable' : mode === 'http500' ? 'en erreur (500)' : 'qui répond n’importe quoi'} : destination et phrase refusées, rien ne part`, async () => {
      h.mode = mode;
      expect(await compasSetDestinationAction({ tripId: TRIP_A, tripSlug: 'a', place: 'Vercors' })).toEqual({ success: false, error: SLOW });
      expect(await compasInterpretAction({ tripId: TRIP_A, text: 'rando 3 jours dans le Vercors' })).toEqual({
        success: false,
        error: NO_INTERPRET,
      });
      expect(lookupDestination).not.toHaveBeenCalled();
      expect(askAI).not.toHaveBeenCalled();
    });
  }

  it('base muette : refus au bout du délai, sans laisser passer', async () => {
    h.mode = 'muet';
    const started = Date.now();
    expect(await compasSetDestinationAction({ tripId: TRIP_A, tripSlug: 'a', place: 'Vercors' })).toEqual({ success: false, error: SLOW });
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(lookupDestination).not.toHaveBeenCalled();
  }, 10_000);

  it('préparation : base injoignable → refus dit, aucune étape écrite', async () => {
    h.mode = 'reseau';
    const res = await compasAutofillAction({ tripId: TRIP_B, tripSlug: 'b', from: null, phase: 'all' });
    expect(res).toEqual({ success: false, error: 'Préparation momentanément indisponible : réessaie dans quelques minutes.' });
    expect(h.db.rows('trip_steps')).toEqual([]);
  });
});

describe('préparation : la phase envoyée ne change pas de compteur', () => {
  it('six lancements comptés : une 7e demandée en phase « rest » sans itinéraire en attente est refusée', async () => {
    const start = await keyOf('compas-autofill:editor-2');
    h.counter.set(start, { hits: 6, resetAt: Date.now() + 600_000 });
    const res = await compasAutofillAction({ tripId: TRIP_B, tripSlug: 'b', from: null, phase: 'rest' });
    expect(res).toEqual({
      success: false,
      error: 'Beaucoup de préparations d’affilée : je reprends seul dans 10 min.',
      retryInS: 600,
    });
    expect(h.bodies.map((b) => b.p_key)).toEqual([start]);
    expect(h.db.writes).toEqual([]);
  });

  it('phase « steps » ou « all » : le même compteur de lancements, par personne puis pour le site', async () => {
    const start = await keyOf('compas-autofill:editor-2');
    h.counter.set(start, { hits: 6, resetAt: Date.now() + 600_000 });
    for (const phase of ['steps', 'all'] as const) {
      const res = await compasAutofillAction({ tripId: TRIP_B, tripSlug: 'b', from: null, phase });
      expect(res).toMatchObject({ success: false, retryInS: 600 });
    }
    expect(h.bodies.map((b) => b.p_key)).toEqual([start, start]);

    h.counter.clear();
    h.bodies = [];
    h.counter.set(await keyOf('compas-autofill-global:site'), { hits: 120, resetAt: Date.now() + 3_600_000 });
    const res = await compasAutofillAction({ tripId: TRIP_B, tripSlug: 'b', from: null, phase: 'rest' });
    expect(res).toMatchObject({ success: false, error: expect.stringMatching(/^Le Compas prépare beaucoup de voyages/) });
    expect(h.bodies.map((b) => b.p_key)).toEqual([start, await keyOf('compas-autofill-global:site')]);
  });

  it('phase « rest » sans attente pendant qu’une autre préparation écrit l’itinéraire : elle attend, rien en double', async () => {
    h.db.rows('trips')[1].metadata = { compas: { planned_days: 2, autofill_claim: { steps: Date.now() - 5_000 } } };
    const res = await compasAutofillAction({ tripId: TRIP_B, tripSlug: 'b', from: null, phase: 'rest' });
    expect(res).toEqual({ success: true, pending: true, stepsCreated: 0 });
    expect(h.db.writes.filter((w) => w.table !== 'trips')).toEqual([]);
  });

  it('une vraie reprise (itinéraire en attente) reste comptée comme reprise', async () => {
    const pending = { runId: 'run-x', stepIds: ['s1'], routeSet: false, notes: [] };
    h.db.rows('trips')[1].metadata = { compas: { planned_days: 2, autofill_pending: pending } };
    const resume = await keyOf('compas-autofill-resume:editor-2');
    h.counter.set(resume, { hits: 12, resetAt: Date.now() + 600_000 });
    const res = await compasAutofillAction({ tripId: TRIP_B, tripSlug: 'b', from: null, phase: 'rest' });
    expect(res).toMatchObject({ success: false, retryInS: 600 });
    expect(h.bodies.map((b) => b.p_key)).toEqual([resume]);
  });
});

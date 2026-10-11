import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PLAN-100 4.2, de bout en bout sur `compasAutofillAction` (client Supabase en mémoire,
 * services tiers simulés) : la ligne « Papiers » et le poste « Formalités » suivent la
 * table passeport × destination pour la nationalité du profil voyageur, et la
 * nationalité ne sort ni dans un journal ni dans la demande à l'IA.
 */
const h = vi.hoisted(() => ({ db: null as unknown as MemorySupabase, asked: [] as string[] }));

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
  terrainElevations: vi.fn((points: unknown[]) => Promise.resolve(points.map(() => null))),
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
vi.mock('../server/elevation', () => ({
  routeAscentM: vi.fn(async () => null),
  pointsMaxAltitudeM: vi.fn(async () => null),
}));
// Normales NASA POWER du kit (plan 4.8) : simulées à la frontière, aucun appel réseau.
vi.mock('../server/weather', async (orig) => ({
  ...(await orig<typeof import('../server/weather')>()),
  getClimateNormals: vi.fn(async () => null),
}));
vi.mock('@/lib/ai/askAI', () => ({
  aiEnabled: () => true,
  askAI: vi.fn(async (req: { system?: string; prompt?: string; messages?: unknown }) => {
    h.asked.push(JSON.stringify(req));
    return { text: '{}', model: 'x', degraded: false, cached: false, provider: 'fallback' };
  }),
}));

import { reportServerError } from '@/lib/observability/appErrors';
import { compasAutofillAction } from '../server/autofillActions';
import { memorySupabase, type MemorySupabase, type Row } from './helpers/memorySupabase';

const TRIP = '44444444-4444-4444-8444-444444444444';
const launch = () => compasAutofillAction({ tripId: TRIP, tripSlug: 'voyage', from: null, phase: 'all' });

/** Un séjour de trois jours dans une capitale, pour deux personnes. */
function trip(countryCode: string, country: string, city: string) {
  h.db.rows('trips').push({
    id: TRIP,
    user_id: 'u1',
    title: `Séjour · ${city}`,
    start_date: '2026-11-10',
    end_date: '2026-11-12',
    destination_name: city,
    destination_country_code: countryCode,
    party_size: 2,
    budget_currency: 'EUR',
    primary_activity: 'citytrip',
    estimated_budget: null,
    metadata: { compas: { anchor: { name: city, lat: 21.03, lon: 105.85, countryCode, country, kind: 'city' } } },
    updated_at: '2026-10-09T09:00:00.000000+00:00',
  });
}
const profile = (nationality: string | null): Row => ({
  user_id: 'u1',
  nationality,
  residence_country: null,
  currency: null,
  language: null,
  time_zone: null,
  home_name: null,
  home_lat: null,
  home_lon: null,
  home_country: null,
});
const expenses = () => h.db.rows('trip_expenses').map((e) => ({ title: String(e.title), amount: Number(e.amount), basis: String((e.metadata as { basis?: string }).basis) }));
const papersNotes = (res: Awaited<ReturnType<typeof launch>>) =>
  (res.success && 'summary' in res ? res.summary.notes : []).filter((n: string) => n.startsWith('Papiers'));

beforeEach(() => {
  vi.clearAllMocks();
  h.asked = [];
  h.db = memorySupabase({ user: () => ({ id: 'u1' }) });
});

describe('Vietnam, Français : l’exemption de 45 jours remplace l’ancien e-visa', () => {
  it('la ligne de la table avec sa date ; aucune ligne « Formalités »', async () => {
    trip('VN', 'Viêt Nam', 'Hanoï');
    h.db.rows('user_traveller').push(profile('FR'));
    const res = await launch();
    expect(res.success).toBe(true);
    expect(papersNotes(res)).toEqual([
      'Papiers : passeport valide, sans visa jusqu’à 45 jours (Viêt Nam) ; vérifié le 7 octobre 2026, à confirmer sur France Diplomatie avant de partir.',
    ]);
    expect(expenses().some((e) => /Formalités|visa/i.test(e.title))).toBe(false);
  });
});

describe('États-Unis, Français : l’ESTA à son tarif de 2026, avec la date de la table', () => {
  it('la ligne « Papiers » (autorisation électronique) et la ligne « Formalités » × 2 personnes', async () => {
    trip('US', 'États-Unis', 'New York');
    h.db.rows('user_traveller').push(profile('FR'));
    const res = await launch();
    expect(papersNotes(res)).toEqual([
      'Papiers : passeport valide, autorisation électronique (ETA/ESTA) à obtenir avant le départ, séjour jusqu’à 90 jours (États-Unis) ; vérifié le 3 octobre 2026, à confirmer sur France Diplomatie avant de partir.',
    ]);
    expect(expenses().find((e) => e.title.startsWith('Formalités'))).toEqual({
      title: 'Formalités : ESTA (40 $)',
      amount: 70,
      basis:
        'barème Compas 2026-10 · ressortissant français, tarif officiel connu, exigence vérifiée le 3 octobre 2026 (TravelRequirements.info), à vérifier avant de partir',
    });
  });
});

describe('une autre nationalité connue : la table, jamais le barème français', () => {
  it('Allemand au Népal : visa à l’arrivée, le service officiel de son pays, aucune ligne « Formalités »', async () => {
    trip('NP', 'Népal', 'Katmandou');
    h.db.rows('user_traveller').push(profile('DE'));
    const res = await launch();
    expect(papersNotes(res)).toEqual([
      'Papiers : passeport valide, visa à l’arrivée (Népal) ; vérifié le 3 octobre 2026, à confirmer auprès du service officiel de ton pays avant de partir.',
    ]);
    expect(expenses().some((e) => /Formalités/.test(e.title))).toBe(false);
  });
});

describe('sans profil : rien d’affirmé', () => {
  it('une seule ligne qui renvoie au service officiel, aucun frais de formalités', async () => {
    trip('VN', 'Viêt Nam', 'Hanoï');
    const res = await launch();
    expect(papersNotes(res)).toEqual([
      'Papiers : conditions d’entrée (Viêt Nam) à vérifier auprès du service officiel de ton pays avant de partir.',
    ]);
    expect(expenses().some((e) => /Formalités/.test(e.title))).toBe(false);
  });
});

describe('la nationalité reste privée', () => {
  it('ni dans la demande à l’IA, ni dans une erreur journalisée, ni dans ce qui est rangé sur le voyage', async () => {
    trip('NP', 'Népal', 'Katmandou');
    h.db.rows('user_traveller').push(profile('DE'));
    await launch();
    expect(h.asked.length).toBeGreaterThan(0);
    for (const raw of h.asked) {
      const request = JSON.parse(raw) as { system: string; prompt: string };
      // Les faits donnés à l'IA : ni la nationalité, ni ce que la table en déduit (papiers, visa).
      expect(request.prompt).not.toMatch(/nationalit|allemand|germany|visa|papiers|passeport/i);
      expect(request.prompt).not.toMatch(/\bDE\b/);
      expect(request.system).not.toMatch(/nationalite francaise|part de France/);
    }
    expect(reportServerError).not.toHaveBeenCalled();
    expect(JSON.stringify(h.db.rows('trips'))).not.toMatch(/"nationality"|allemand/i);
  });
});

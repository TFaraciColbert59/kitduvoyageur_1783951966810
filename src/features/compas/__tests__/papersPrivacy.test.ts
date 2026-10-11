import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * VERROU DE VIE PRIVÉE (relecture du 11 octobre, lot P) : la ligne « Papiers » tirée de la
 * table passeport × destination dépend de la NATIONALITÉ du profil voyageur. Rangée sur le
 * voyage (`trips.metadata`), elle serait lisible par tous les collaborateurs et, pour un
 * voyage public, par n'importe qui (policy `trips_select_policy`) : le groupe de passeports
 * de la table ne contient parfois qu'une nationalité (GB → Maroc : « visa-free, 90 jours »
 * n'est écrit que pour {GB}).
 *
 * Deux gestes, éprouvés de bout en bout (client Supabase en mémoire, services tiers simulés) :
 *  1. ÉCRITURE — la préparation (`compasAutofillAction`) ne range que la ligne sans
 *     nationalité : ni `autofill.notes`, ni l'issue (`autofill_result.summary.notes`, qui est
 *     le résultat rendu ici) ne portent ce que la table dit pour le passeport du lanceur ;
 *  2. LECTURE — `getCompasData` rend, pour CHAQUE lecteur, la ligne de SON passeport (son
 *     propre profil, jamais celui du propriétaire) ; sans profil (anonyme, collaborateur
 *     sans nationalité), la ligne neutre.
 */
const h = vi.hoisted(() => ({
  db: null as unknown as MemorySupabase,
  viewer: null as { id: string; is_anonymous?: boolean } | null,
  canEdit: true,
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
  pointsAltitudeRange: vi.fn(async () => null),
  getRouteElevation: vi.fn(async () => null),
}));
vi.mock('../server/weather', async (orig) => ({
  ...(await orig<typeof import('../server/weather')>()),
  getClimateNormals: vi.fn(async () => null),
  getCompasWeather: vi.fn(async () => null),
}));
vi.mock('@/lib/ai/askAI', () => ({
  aiEnabled: () => true,
  askAI: vi.fn(async () => ({ text: '{}', model: 'x', degraded: false, cached: false, provider: 'fallback' })),
}));
// Lecture : le hub rend le voyage tel que la base l'a rangé, avec le droit du lecteur.
vi.mock('@/features/hub/server/getHubAdventureData', () => ({
  getHubAdventureData: vi.fn(async () => {
    const row = h.db.rows('trips')[0];
    return {
      trip: {
        ...row,
        steps: h.db.rows('trip_steps'),
        items: [],
        expenses: [],
        pois: [],
        collaborators: [],
        member_profiles: [],
        permissions: { canEdit: h.canEdit },
      },
      group: null,
      hiking: null,
      affiliateLinks: [],
    };
  }),
}));
vi.mock('@/features/booking/server/providerCredentials', () => ({
  getActiveProviderMode: () => ({ routestack: 'disabled', viator: 'disabled' }),
}));
vi.mock('../server/officialAlerts', () => ({
  getOfficialAlerts: vi.fn(async () => ({ status: 'hors_france', alerts: [], area: null })),
}));
vi.mock('../server/rates', () => ({
  getEurRate: vi.fn(async () => null),
  getBudgetFx: vi.fn(async () => null),
}));

import { compasAutofillAction } from '../server/autofillActions';
import { getCompasData } from '../server/getCompasData';
import { memorySupabase, type MemorySupabase, type Row } from './helpers/memorySupabase';

const TRIP = '55555555-5555-4555-8555-555555555555';
const launch = () => compasAutofillAction({ tripId: TRIP, tripSlug: 'voyage', from: null, phase: 'all' });

/** Un séjour de trois jours dans une capitale, pour deux personnes, publié (lisible par tous). */
function publicTrip(countryCode: string, country: string, city: string) {
  h.db.rows('trips').push({
    id: TRIP,
    slug: 'voyage',
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
    visibility: 'public',
    metadata: { compas: { anchor: { name: city, lat: 34.02, lon: -6.83, countryCode, country, kind: 'city' } } },
    updated_at: '2026-10-09T09:00:00.000000+00:00',
  });
}
const profile = (userId: string, nationality: string | null): Row => ({
  user_id: userId,
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

const NEUTRAL = (where: string) =>
  `Papiers : conditions d’entrée (${where}) à vérifier auprès du service officiel de ton pays avant de partir.`;
const papersOf = (notes: string[]) => notes.filter((n) => n.startsWith('Papiers'));
const storedMeta = () => h.db.rows('trips')[0].metadata as { compas: { autofill: { notes: string[] } } };
/** Tout ce que la table dit d'un passeport : une de ces marques sur le voyage trahit la nationalité. */
const TABLE_TRACES = /vérifié le|sans visa|visa à l’arrivée|ETA\/ESTA|e-visa|libre circulation|carte d’identité|France Diplomatie/;

beforeEach(() => {
  vi.clearAllMocks();
  h.viewer = { id: 'u1' };
  h.canEdit = true;
  h.db = memorySupabase({ user: () => h.viewer });
});

describe('écriture : la nationalité du lanceur ne va jamais sur le voyage', () => {
  it.each([
    ['GB', 'MA', 'Maroc', 'Rabat'], // le cas de la relecture : {GB} est seul dans son groupe
    ['FR', 'VN', 'Viêt Nam', 'Hanoï'],
    ['FR', 'US', 'États-Unis', 'New York'],
    ['DE', 'NP', 'Népal', 'Katmandou'],
    ['FR', 'PT', 'Portugal', 'Lisbonne'], // la carte d'identité : une liste de Français
  ])('%s → %s : seule la ligne sans nationalité est rangée (notes du voyage et issue)', async (nationality, cc, country, city) => {
    publicTrip(cc, country, city);
    h.db.rows('user_traveller').push(profile('u1', nationality));
    const res = await launch();
    expect(res.success).toBe(true);
    const issue = res.success && 'summary' in res ? res.summary.notes : [];
    expect(papersOf(issue)).toEqual([NEUTRAL(country)]);
    expect(papersOf(storedMeta().compas.autofill.notes)).toEqual([NEUTRAL(country)]);
    // Rien de ce que la table dit du passeport, nulle part dans les notes rangées ni dans l'issue.
    expect(JSON.stringify(storedMeta().compas.autofill.notes)).not.toMatch(TABLE_TRACES);
    expect(JSON.stringify(issue)).not.toMatch(TABLE_TRACES);
    expect(JSON.stringify(h.db.rows('trips')[0].metadata)).not.toMatch(/"nationality"/);
  });

  it('un départ déjà dans le pays (aucune frontière) : aucune ligne « Papiers », pour personne', async () => {
    publicTrip('MA', 'Maroc', 'Rabat');
    h.db.rows('user_traveller').push({ ...profile('u1', 'GB'), home_name: 'Rabat', home_lat: 34.02, home_lon: -6.83, home_country: 'MA' });
    const res = await launch();
    expect(res.success).toBe(true);
    expect(papersOf(res.success && 'summary' in res ? res.summary.notes : [])).toEqual([]);
    expect(papersOf(storedMeta().compas.autofill.notes)).toEqual([]);
  });
});

describe('lecture : chaque lecteur voit la ligne de SON passeport, un anonyme la ligne neutre', () => {
  const GB_LINE =
    'Papiers : passeport valide, sans visa jusqu’à 90 jours (Maroc) ; vérifié le 3 octobre 2026, à confirmer auprès du service officiel de ton pays avant de partir.';
  const DE_LINE =
    'Papiers : passeport valide, sans visa (Maroc) ; vérifié le 3 octobre 2026, à confirmer auprès du service officiel de ton pays avant de partir.';
  const FR_LINE =
    'Papiers : passeport valide, sans visa (Maroc) ; vérifié le 3 octobre 2026, à confirmer sur France Diplomatie avant de partir.';

  const readAs = async (viewer: { id: string; is_anonymous?: boolean } | null, canEdit = false) => {
    h.viewer = viewer;
    h.canEdit = canEdit;
    return (await getCompasData())?.autofillNotes ?? [];
  };

  beforeEach(async () => {
    // Une Britannique prépare un voyage public au Maroc.
    publicTrip('MA', 'Maroc', 'Rabat');
    h.db.rows('user_traveller').push(profile('u1', 'GB'), profile('u2', 'FR'), profile('u3', 'DE'), profile('u4', null));
    expect((await launch()).success).toBe(true);
  });

  it('la propriétaire retrouve la ligne de son passeport (GB), lue par son propre profil', async () => {
    expect(papersOf(await readAs({ id: 'u1' }, true))).toEqual([GB_LINE]);
  });

  it('deux collaborateurs de nationalités différentes : chacun la ligne de son passeport, jamais celle de la propriétaire', async () => {
    const fr = await readAs({ id: 'u2' }, true);
    const de = await readAs({ id: 'u3' }, true);
    expect(papersOf(fr)).toEqual([FR_LINE]);
    expect(papersOf(de)).toEqual([DE_LINE]);
    expect(fr.join(' ')).not.toContain('jusqu’à 90 jours');
    expect(de.join(' ')).not.toContain('jusqu’à 90 jours');
  });

  it('un lecteur anonyme, un compte sans profil ou sans nationalité : la ligne neutre, rien de la table', async () => {
    for (const viewer of [null, { id: 'anon-1', is_anonymous: true }, { id: 'u4' }, { id: 'u5' }]) {
      const notes = await readAs(viewer);
      expect(papersOf(notes)).toEqual([NEUTRAL('Maroc')]);
      expect(JSON.stringify(notes)).not.toMatch(TABLE_TRACES);
    }
  });

  it('les autres notes du voyage ne bougent pas, à leur place', async () => {
    const stored = storedMeta().compas.autofill.notes;
    for (const viewer of [{ id: 'u2' }, null]) {
      const notes = await readAs(viewer);
      expect(notes.filter((n) => !n.startsWith('Papiers'))).toEqual(stored.filter((n) => !n.startsWith('Papiers')));
      expect(notes.findIndex((n) => n.startsWith('Papiers'))).toBe(stored.findIndex((n) => n.startsWith('Papiers')));
    }
  });

  it('un voyage rangé avant ce correctif (ligne de la table dans les notes, sans le pays rangé) : jamais rendue telle quelle', async () => {
    const meta = storedMeta();
    const legacy = meta.compas.autofill.notes.map((n) => (n.startsWith('Papiers') ? GB_LINE : n));
    const { papers: _papers, ...autofill } = meta.compas.autofill as Record<string, unknown>;
    void _papers;
    h.db.rows('trips')[0].metadata = { compas: { ...meta.compas, autofill: { ...autofill, notes: legacy } } };
    expect(papersOf(await readAs({ id: 'u2' }))).toEqual([FR_LINE]);
    expect(papersOf(await readAs(null))).toEqual([NEUTRAL('Maroc')]);
  });
});

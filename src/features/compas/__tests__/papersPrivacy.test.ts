import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  /** Ce que répond l'IA simulée, et ce qu'on lui a demandé. */
  aiText: '{}',
  asked: [] as string[],
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
  askAI: vi.fn(async (req: unknown) => {
    h.asked.push(JSON.stringify(req));
    return { text: h.aiText, model: 'x', degraded: false, cached: false, provider: 'nvidia' };
  }),
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
        expenses: h.db.rows('trip_expenses'),
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

import { travellerPrivacyViolations } from '../../../../scripts/verify/traveller_privacy.mjs';
import { buildCompasAutofillSystem } from '@/lib/ai/features/compasAutofill';
import type { PapersFacts } from '../engine/papers';
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

/** Un profil complet : tout inconnu sauf ce qu'on dit. */
const profileOf = (userId: string, over: Partial<Row>): Row => ({ ...profile(userId, null), ...over });

const NEUTRAL = (where: string) =>
  `Papiers : conditions d’entrée (${where}) à vérifier auprès du service officiel de ton pays avant de partir.`;
const papersOf = (notes: string[]) => notes.filter((n) => n.startsWith('Papiers'));
const storedMeta = () =>
  h.db.rows('trips')[0].metadata as { compas: { autofill: { notes: string[]; papers?: PapersFacts } } };
/** Tout ce que la table dit d'un passeport : une de ces marques sur le voyage trahit la nationalité. */
const TABLE_TRACES = /vérifié le|sans visa|visa à l’arrivée|ETA\/ESTA|e-visa|libre circulation|carte d’identité|France Diplomatie/;

beforeEach(() => {
  vi.clearAllMocks();
  h.aiText = '{}';
  h.asked = [];
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
    // Les faits du pays se rangent tout de même : la ligne « Prises » de chaque lecteur s'en rend.
    expect(storedMeta().compas.autofill.papers).toEqual({ countryCode: 'MA', country: 'Maroc', abroad: false });
  });
});

const NEUTRAL_G = 'Prises de type G (Royaume-Uni) : vérifie que tes chargeurs s’y branchent.';
const ADAPTER_G = 'Prises de type G : adaptateur à prévoir.';
const pluggedOf = (notes: string[]) => notes.filter((n) => n.startsWith('Prises'));

describe('écriture : les appareils du lanceur ne vont jamais sur le voyage (ligne « Prises »)', () => {
  it.each([
    ['sans profil', {}],
    ['appareils de France (résidence FR)', { residence_country: 'FR' }],
    ['passeport français sans résidence dite', { nationality: 'FR' }],
    ['résidente aux États-Unis', { nationality: 'US', residence_country: 'US' }],
    ['Française résidant au Royaume-Uni', { nationality: 'FR', residence_country: 'GB' }],
  ])('%s : la même ligne neutre, notes du voyage et issue, jamais « adaptateur »', async (_who, over) => {
    publicTrip('GB', 'Royaume-Uni', 'Londres');
    h.db.rows('user_traveller').push(profileOf('u1', over));
    const res = await launch();
    expect(res.success).toBe(true);
    const issue = res.success && 'summary' in res ? res.summary.notes : [];
    expect(pluggedOf(issue)).toEqual([NEUTRAL_G]);
    expect(pluggedOf(storedMeta().compas.autofill.notes)).toEqual([NEUTRAL_G]);
    expect(JSON.stringify(h.db.rows('trips')[0].metadata)).not.toMatch(/adaptateur/);
    expect(JSON.stringify(issue)).not.toMatch(/adaptateur/);
  });
});

describe('lecture : chaque lecteur voit la ligne « Prises » de SES appareils', () => {
  const readAs = async (viewer: { id: string; is_anonymous?: boolean } | null) => {
    h.viewer = viewer;
    h.canEdit = false;
    return pluggedOf((await getCompasData())?.autofillNotes ?? []);
  };

  beforeEach(async () => {
    // Un résident des États-Unis prépare un voyage public à Londres.
    publicTrip('GB', 'Royaume-Uni', 'Londres');
    h.db.rows('user_traveller').push(
      profileOf('u1', { nationality: 'US', residence_country: 'US' }),
      profileOf('u2', { residence_country: 'FR' }),
      profileOf('u3', { nationality: 'FR' }),
      profileOf('u4', { nationality: 'DE', residence_country: 'DE' })
    );
    expect((await launch()).success).toBe(true);
  });

  it('appareils de France (résidence, ou passeport français sans résidence) : l’adaptateur', async () => {
    expect(await readAs({ id: 'u2' })).toEqual([ADAPTER_G]);
    expect(await readAs({ id: 'u3' })).toEqual([ADAPTER_G]);
  });

  it('les autres, un anonyme, un compte sans profil : le fait du pays, jamais l’adaptateur', async () => {
    for (const viewer of [{ id: 'u1' }, { id: 'u4' }, { id: 'u9' }, { id: 'anon-1', is_anonymous: true }, null])
      expect(await readAs(viewer), JSON.stringify(viewer)).toEqual([NEUTRAL_G]);
  });

  it('un voyage rangé avant ce correctif (adaptateur dans les notes) : jamais rendu tel quel à un autre lecteur', async () => {
    const meta = storedMeta();
    const legacy = meta.compas.autofill.notes.map((n) => (n.startsWith('Prises') ? ADAPTER_G : n));
    h.db.rows('trips')[0].metadata = { compas: { ...meta.compas, autofill: { ...meta.compas.autofill, notes: legacy } } };
    expect(await readAs({ id: 'u4' })).toEqual([NEUTRAL_G]);
    expect(await readAs(null)).toEqual([NEUTRAL_G]);
    expect(await readAs({ id: 'u2' })).toEqual([ADAPTER_G]);
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

/**
 * Conseils de l'IA (lot Z1) : filtrés avec les règles SANS profil, donc leur présence ne dit rien de la
 * devise (change) ni de la résidence (prises) du lanceur ; et la demande à l'IA est la même pour tous,
 * sans nationalité (un tiers).
 */
describe('écriture : les conseils de l’IA rangés et la demande à l’IA ne dépendent pas du profil', () => {
  const MONEY = 'Passe au bureau de change avant le départ : tes francs suisses n’ont pas cours au Portugal.';
  const MONEY_LOCAL = 'Retire de la monnaie locale avant de quitter l’aéroport, les distributeurs sont rares.';
  const PLUG = 'Prévois un adaptateur de prise pour tes chargeurs.';
  const TIP = 'Réserve tes nuits de juillet à l’avance : la côte est très fréquentée.';
  const PROFILES: Array<[string, Partial<Row>]> = [
    ['sans profil', {}],
    ['résident suisse, francs', { nationality: 'CH', residence_country: 'CH', currency: 'CHF' }],
    ['résident allemand, euro', { nationality: 'DE', residence_country: 'DE', currency: 'EUR' }],
    ['Français, appareils de France', { nationality: 'FR', residence_country: 'FR', currency: 'EUR' }],
    ['Américaine, dollars', { nationality: 'US', residence_country: 'US', currency: 'USD' }],
  ];

  // L'IA ne rend que trois conseils (`sanitizeAdvice`) : l'ordre garde ici le conseil juste en dernier.
  const prepare = async (over: Partial<Row>, advice: string[], where: [string, string, string] = ['PT', 'Portugal', 'Lisbonne']) => {
    h.db = memorySupabase({ user: () => h.viewer });
    h.asked = [];
    h.aiText = JSON.stringify({ notes: advice });
    publicTrip(...where);
    h.db.rows('user_traveller').push(profileOf('u1', over));
    const res = await launch();
    expect(res.success).toBe(true);
    return {
      notes: storedMeta().compas.autofill.notes,
      issue: res.success && 'summary' in res ? res.summary.notes : [],
      request: h.asked.map((raw) => JSON.parse(raw) as { system: string; prompt: string }),
    };
  };
  const aiOf = (notes: string[]) => notes.filter((n) => n.startsWith('Suggestion de l’IA'));

  it('zone euro : le même ensemble de conseils pour cinq profils, ni change ni prises, seulement le conseil juste', async () => {
    const runs = [];
    for (const [, over] of PROFILES) runs.push(await prepare(over, [MONEY, PLUG, TIP]));
    for (const run of runs) {
      expect(run.notes).toEqual(runs[0].notes);
      expect(run.issue).toEqual(runs[0].issue);
    }
    expect(aiOf(runs[0].notes)).toHaveLength(1);
    expect(aiOf(runs[0].notes)[0]).toContain('réserve tes nuits de juillet');
    expect(JSON.stringify(runs[0].notes)).not.toMatch(/bureau de change|adaptateur/);
  });

  it('hors zone euro : le conseil de change est gardé, le même pour tous', async () => {
    const runs = [];
    for (const [, over] of PROFILES) runs.push(await prepare(over, [MONEY_LOCAL, PLUG, TIP], ['MA', 'Maroc', 'Rabat']));
    for (const run of runs) expect(run.notes).toEqual(runs[0].notes);
    expect(aiOf(runs[0].notes).map((n) => n.replace(/^Suggestion de l’IA \(facultatif\) : /, ''))).toEqual([
      'retire de la monnaie locale avant de quitter l’aéroport, les distributeurs sont rares.',
      'réserve tes nuits de juillet à l’avance : la côte est très fréquentée.',
    ]);
  });

  it('la demande à l’IA est la même pour tous, et ne contient ni nationalité, ni résidence, ni devise', async () => {
    const requests = [];
    for (const [, over] of PROFILES) requests.push((await prepare(over, [TIP])).request);
    for (const request of requests) {
      expect(request.length).toBeGreaterThan(0);
      expect(request.map((r) => r.system)).toEqual(requests[0].map((r) => r.system));
      expect(request.map((r) => r.prompt)).toEqual(requests[0].map((r) => r.prompt));
      for (const r of request) {
        expect(r.system).toBe(buildCompasAutofillSystem());
        expect(r.system).not.toMatch(/nationalite francaise|part de France/);
        expect(r.prompt).not.toMatch(/nationalit|francs suisses|\bCHF\b|\bUSD\b|suisse|allemand|americain/i);
      }
    }
  });
});

/**
 * « Formalités » (lot Z1) : la dépense (visa, ESTA) dépend de la nationalité ; rangée dans
 * `trip_expenses` et recopiée dans `autofill_result.summary.budget`, sa présence et sa base
 * « ressortissant français » la diraient à tout lecteur du voyage. Elle ne se range plus : chaque
 * lecteur calcule la sienne à la lecture, à part du budget.
 */
const DESTINATIONS: Array<[string, string, string]> = [
  ['US', 'États-Unis', 'New York'], // ESTA : autorisation électronique
  ['NP', 'Népal', 'Katmandou'], // visa à l'arrivée
  ['VN', 'Viêt Nam', 'Hanoï'], // exemption pour un Français
];

describe('écriture : la nationalité du lanceur ne va jamais dans le budget rangé', () => {
  const snapshot = async (where: [string, string, string], over: Partial<Row>) => {
    h.db = memorySupabase({ user: () => h.viewer });
    publicTrip(...where);
    h.db.rows('user_traveller').push(profileOf('u1', over));
    const res = await launch();
    expect(res.success).toBe(true);
    const summary = res.success && 'summary' in res ? res.summary : null;
    return {
      expenses: h.db.rows('trip_expenses').map((e) => ({ title: e.title, amount: e.amount, basis: (e.metadata as { basis?: string }).basis })),
      budget: summary?.budget,
      total: summary?.total,
      estimated: h.db.rows('trips')[0].estimated_budget,
      raw: JSON.stringify({ trips: h.db.rows('trips'), expenses: h.db.rows('trip_expenses'), summary }),
    };
  };

  it.each(DESTINATIONS)('%s : les mêmes dépenses, le même total, la même enveloppe pour un Français, un Allemand et personne', async (...where) => {
    const runs = [];
    for (const over of [{ nationality: 'FR' }, { nationality: 'DE', residence_country: 'DE' }, {}]) runs.push(await snapshot(where, over));
    for (const run of runs) {
      expect(run.expenses).toEqual(runs[0].expenses);
      expect(run.budget).toEqual(runs[0].budget);
      expect(run.total).toBe(runs[0].total);
      expect(run.estimated).toBe(runs[0].estimated);
      expect(/Formalités|ressortissant français/.test(run.raw)).toBe(false);
    }
    expect(runs[0].expenses.length).toBeGreaterThan(0);
  });
});

describe('lecture : chaque lecteur calcule SA ligne « Formalités », à part du budget', () => {
  const U = (id: string, over: Partial<Row>) => profileOf(id, over);
  const dataAs = async (viewer: { id: string; is_anonymous?: boolean } | null) => {
    h.viewer = viewer;
    h.canEdit = false;
    const data = await getCompasData();
    expect(data).not.toBeNull();
    return data!;
  };

  beforeEach(async () => {
    // Un Français prépare un voyage public aux États-Unis, à deux (ESTA).
    publicTrip('US', 'États-Unis', 'New York');
    h.db.rows('user_traveller').push(
      U('u1', { nationality: 'FR' }),
      U('u2', { nationality: 'FR' }),
      U('u3', { nationality: 'DE', residence_country: 'DE' }),
      U('u4', {})
    );
    expect((await launch()).success).toBe(true);
  });

  it('un Français (le lanceur ou un collaborateur) lit l’ESTA × 2 personnes, avec sa base', async () => {
    for (const id of ['u1', 'u2']) {
      const f = (await dataAs({ id })).formalities;
      expect(f, id).toMatchObject({ title: 'Formalités : ESTA (40 $)', perPerson: 35, party: 2, amount: 70, currency: 'EUR' });
      expect(f?.basis).toContain('ressortissant français');
      expect(f?.basis).toContain('non compté dans le total du voyage');
    }
  });

  it('un Allemand, un compte sans nationalité, un compte inconnu, un anonyme : aucune ligne, et nulle trace de la ligne du lanceur', async () => {
    for (const viewer of [{ id: 'u3' }, { id: 'u4' }, { id: 'u9' }, { id: 'anon-1', is_anonymous: true }, null]) {
      const data = await dataAs(viewer);
      expect(data.formalities ?? null, JSON.stringify(viewer)).toBeNull();
      expect(JSON.stringify(data)).not.toMatch(/Formalités|ressortissant français/);
    }
  });

  it('le budget affiché est le même pour tous : la ligne n’entre ni dans le prévu, ni dans l’enveloppe, ni dans les catégories', async () => {
    const fr = await dataAs({ id: 'u2' });
    const de = await dataAs({ id: 'u3' });
    expect(fr.model.budget).toEqual(de.model.budget);
    expect(fr.model.budget.planned).toBeGreaterThan(0);
  });

  it('une préparation annulée ne laisse aucune ligne « Formalités »', async () => {
    const meta = storedMeta();
    h.db.rows('trips')[0].metadata = { compas: { ...meta.compas, autofill: { undone: true } } };
    expect((await dataAs({ id: 'u2' })).formalities ?? null).toBeNull();
  });

  it('un voyage préparé avant ce correctif : la dépense rangée est retirée de l’affichage, la ligne du lecteur la remplace', async () => {
    const planned = async (id: string) => (await dataAs({ id })).model.budget.planned;
    const before = await planned('u3');
    h.db.rows('trip_expenses').push(
      {
        id: 'legacy-1',
        trip_id: TRIP,
        payer_id: 'u1',
        title: 'Formalités : ESTA (40 $)',
        amount: 70,
        category: 'divers',
        is_planned: true,
        split_type: 'equal',
        metadata: { autofill: 'run-0', source: 'estimation', basis: 'barème Compas 2026-10 · ressortissant français, tarif officiel connu' },
      },
      // Une dépense saisie à la main reste, même nommée ainsi.
      { id: 'manual-1', trip_id: TRIP, payer_id: 'u1', title: 'Formalités : visa étudiant', amount: 12, category: 'divers', is_planned: true, split_type: 'equal', metadata: null }
    );
    // Pour un Allemand comme pour un Français : les 70 € de la préparation d'avant ne comptent plus, les 12 € saisis oui.
    expect(await planned('u3')).toBe(before + 12);
    expect(await planned('u2')).toBe(before + 12);
    expect((await dataAs({ id: 'u3' })).formalities ?? null).toBeNull();
    expect((await dataAs({ id: 'u2' })).formalities).toMatchObject({ title: 'Formalités : ESTA (40 $)', amount: 70 });
  });
});

/**
 * CONTRÔLE PAR MUTATION (lot Z1) : le verrou `scripts/verify/traveller_privacy.mjs` lit le VRAI code
 * de la préparation et de la lecture (copié dans un dossier temporaire) ; réintroduire une fuite
 * (formalités chiffrées par le profil, filtre de l'IA avec les règles du lanceur, nationalité dans
 * la consigne, lecture de la nationalité à l'écriture) le fait casser. Le code intact, lui, passe.
 */
describe('verrou : chaque fuite réintroduite dans le vrai code est refusée', () => {
  const FILES = [
    'src/features/compas/engine/papers.ts',
    'src/features/compas/engine/formalities.ts',
    'src/features/compas/engine/travel.ts',
    'src/features/compas/engine/costs.ts',
    'src/features/compas/engine/traveller.ts',
    'src/features/compas/server/autofillActions.ts',
    'src/features/compas/server/getCompasData.ts',
    'src/lib/ai/features/compasAutofill.ts',
  ];
  const WRITE = 'src/features/compas/server/autofillActions.ts';
  const READ = 'src/features/compas/server/getCompasData.ts';
  const AI = 'src/lib/ai/features/compasAutofill.ts';
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  /** Le vrai code dans un dossier temporaire, avec les remplacements demandés (chacun doit exister). */
  function mutated(changes: Record<string, Array<[string, string]>> = {}): string[] {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lkdv-mutation-'));
    roots.push(root);
    for (const rel of FILES) {
      let text = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      for (const [from, to] of changes[rel] ?? []) {
        expect(text, `${rel} ne contient plus « ${from} » : mettre le test à jour`).toContain(from);
        text = text.replace(from, to);
      }
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    }
    return travellerPrivacyViolations(root);
  }
  const named = (name: string, file: string) => `calcul dépendant du profil (${name}) nommé hors de son moteur et de la lecture : ${file}`;

  it('le code intact passe', () => {
    expect(mutated()).toEqual([]);
  });

  it('formalités chiffrées par le profil du lanceur (abroadCosts) : refusé', () => {
    const v = mutated({ [WRITE]: [['const insured = abroad === true;', 'const insured = abroadCosts(abroad, traveller, null).insurance;']] });
    expect(v).toContain(named('abroadCosts', WRITE));
    expect(v).toContain(`profil voyageur passé tel quel dans l'écriture du voyage : ${WRITE}`);
  });

  it('la ligne « Formalités » et sa base « ressortissant français » rangées de nouveau (entryFees, formalitiesBasis) : refusé', () => {
    const v = mutated({
      [WRITE]: [['const insured = abroad === true;', "const insured = abroad === true; const fee = entryFees(anchor.countryCode); const basis = formalitiesBasis(null);"]],
    });
    expect(v).toContain(named('entryFees', WRITE));
    expect(v).toContain(named('formalitiesBasis', WRITE));
  });

  it('les appareils du lanceur (frenchDevices) ou ses règles complètes (travelPapers) à l’écriture : refusé', () => {
    const v = mutated({
      [WRITE]: [['const insured = abroad === true;', "const insured = frenchDevices(x) || travelPapers('PT', 'Portugal', x).euro;"]],
    });
    expect(v).toContain(named('frenchDevices', WRITE));
    expect(v).toContain(named('travelPapers', WRITE));
  });

  it('conseils de l’IA filtrés avec les règles du lanceur (keepAiNote) : refusé', () => {
    const v = mutated({
      [WRITE]: [['const aiRules = sharedRules(anchor.countryCode, anchor.country, abroad);', "const aiRules = rulesOf(anchor);"]],
    });
    expect(v).toEqual([`aiRules ne vient pas de sharedRules dans ${WRITE}`]);
    const w = mutated({ [WRITE]: [['keepAiNote(n, aiRules)', 'keepAiNote(n, rules)']] });
    expect(w).toEqual([`conseil de l'IA filtré avec d'autres règles que celles sans profil (sharedRules) dans ${WRITE}`]);
  });

  it('la nationalité dans la consigne de l’IA : refusé, côté appelant comme côté consigne', () => {
    const v = mutated({
      [WRITE]: [['buildCompasAutofillSystem()', "buildCompasAutofillSystem(traveller.nationality === 'FR')"]],
      [AI]: [['export function buildCompasAutofillSystem()', 'export function buildCompasAutofillSystem(frenchNational = false)']],
    });
    expect(v).toContain(`consigne de l'IA réglée par un argument (la nationalité ne part pas à un tiers) : ${WRITE}`);
    expect(v).toContain(`consigne de l'IA réglée par un argument (la nationalité ne part pas à un tiers) : ${AI}`);
    expect(v).toContain(`valeur du profil (traveller.nationality) lue dans l'écriture du voyage : ${WRITE}`);
  });

  it('une valeur du profil (nationalité, résidence, devise) lue pour ce qui se range : refusé', () => {
    for (const field of ['nationality', 'residenceCountry', 'currency']) {
      const v = mutated({ [WRITE]: [['const insured = abroad === true;', `const insured = abroad === true && traveller.${field} != null;`]] });
      expect(v, field).toEqual([`valeur du profil (traveller.${field}) lue dans l'écriture du voyage : ${WRITE}`]);
    }
  });

  it('la lecture ne contourne pas le moteur : abroadCosts nommé directement dans getCompasData est refusé', () => {
    const v = mutated({ [READ]: [['readerFormalities({', 'abroadCosts(null, reader, null); readerFormalities({']] });
    expect(v).toEqual([named('abroadCosts', READ)]);
  });
});

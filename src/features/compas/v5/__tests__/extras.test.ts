import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  pois: [] as unknown[],
  poisPartial: false,
  poisError: false,
  poisHang: false,
  cachedPois: [] as unknown[],
  /** Photos par clé « lat,lon » arrondie ; absent = Commons répond « aucune photo ». */
  photos: {} as Record<string, unknown>,
  cachedKeys: new Set<string>(),
  commonsFail: false,
  networkCalls: 0,
}));

vi.mock('server-only', () => ({}));
vi.mock('../../server/stagePoiLookup', () => ({
  lookupStagePois: vi.fn(() => {
    if (h.poisHang) return new Promise(() => undefined);
    if (h.poisError) return Promise.reject(new Error('Overpass'));
    return Promise.resolve({ pois: h.pois, partial: h.poisPartial });
  }),
  readCachedStagePois: vi.fn(async () => ({ pois: h.cachedPois, complete: false })),
}));
vi.mock('../server/commons', () => ({
  lookupCommonsPhoto: vi.fn(async (p: { lat: number; lon: number }, o: { allowNetwork: boolean }) => {
    const key = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
    if (h.cachedKeys.has(key)) return { state: 'cached', photo: (h.photos[key] as unknown) ?? null };
    if (!o.allowNetwork) return { state: 'skipped', photo: null };
    h.networkCalls += 1;
    if (h.commonsFail) return { state: 'failed', photo: null };
    return { state: 'fetched', photo: (h.photos[key] as unknown) ?? null };
  }),
}));

import { EXTRAS_BUDGET_MS, COMMONS_CALLS_MAX, loadV5Extras, type V5ExtrasSource } from '../server/extras';
import { makeData, TRIP } from './fixtures';
import type { RoutePoi } from '../../engine/routePois';
import type { CompasTripRow } from '../../server/compasServer';

/** Fixture : Vercors, 3 jours, étapes à (45.0, 5.4), (45.07, 5.52), (45.1, 5.4). */
const data = makeData() as unknown as V5ExtrasSource;

const trip = (metadata: Record<string, unknown> = {}): CompasTripRow => ({
  id: TRIP,
  user_id: 'u1',
  title: 'Randonnée · Vercors',
  start_date: '2026-11-03',
  end_date: '2026-11-05',
  destination_name: 'Vercors',
  destination_country_code: 'FR',
  party_size: 4,
  budget_currency: 'EUR',
  metadata,
});

interface FakeDb {
  expenses?: Array<{ title: string; amount: number; metadata?: unknown }> | 'error';
  steps?: Array<{ day_number: number; order_index: number; metadata: unknown }>;
}

/** Client minimal : `from(table).select().eq()…` rend les lignes de la table. */
function fakeSupabase(db: FakeDb = {}) {
  return {
    from(table: string) {
      const result =
        table === 'trip_expenses'
          ? db.expenses === 'error'
            ? { data: null, error: { message: 'x' } }
            : { data: db.expenses ?? [], error: null }
          : { data: db.steps ?? [], error: null };
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
      return chain;
    },
  } as never;
}

let nextId = 1;
const poi = (lat: number, lon: number, category: RoutePoi['category'], name: string | null): RoutePoi => ({
  id: nextId++,
  name,
  category,
  lat,
  lon,
  distanceM: 0,
  elevationM: null,
});
const at = (base: { lat: number; lon: number }, metres: number) => ({ lat: base.lat + metres / 111_195, lon: base.lon });
const DAY1 = { lat: 45.0, lon: 5.4 };
const DAY2 = { lat: 45.07, lon: 5.52 };

const photo = (name: string) => ({
  url: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${name}.jpg/480px-${name}.jpg`,
  credit: 'Marie Martin',
  license: 'CC BY-SA 4.0',
  pageUrl: `https://commons.wikimedia.org/wiki/File:${name}.jpg`,
});
const key = (p: { lat: number; lon: number }) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;

beforeEach(() => {
  nextId = 1;
  h.pois = [];
  h.poisPartial = false;
  h.poisError = false;
  h.poisHang = false;
  h.cachedPois = [];
  h.photos = {};
  h.cachedKeys = new Set();
  h.commonsFail = false;
  h.networkCalls = 0;
});

describe('loadV5Extras', () => {
  it('nuits pour chaque jour sauf le dernier, photos des arrivées, trajet et choix', async () => {
    const gite = poi(...Object.values(at(DAY1, 300)) as [number, number], 'hebergement', 'Chambres d’hôtes du Pré');
    const refuge = poi(...Object.values(at(DAY2, 600)) as [number, number], 'refuge', 'Refuge de la Coche');
    h.pois = [gite, refuge];
    h.photos[key(DAY1)] = photo('Rencurel');
    h.photos[key(DAY2)] = photo('Correncon');
    const extras = await loadV5Extras({
      supabase: fakeSupabase({
        expenses: [{ title: 'Train aller-retour × 4', amount: 240, metadata: { basis: 'barème Compas 2026-10 · train' } }],
        steps: [{ day_number: 2, order_index: 0, metadata: { compas: { stay: { id: `osm:${refuge.id}` } } } }],
      }),
      trip: trip({ compas: { origin: { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR' } } }),
      data,
    });

    expect(Object.keys(extras.nights).map(Number)).toEqual([1, 2]);
    // Jour 1 : la nuit notée dans la fixture (« Gîte du Royans ») passe devant le lieu d'OpenStreetMap.
    expect(extras.nights[1].map((o) => o.name)).toEqual(['Gîte du Royans', 'Chambres d’hôtes du Pré']);
    expect(extras.nights[2][0]).toMatchObject({ id: `osm:${refuge.id}`, kind: 'refuge' });
    expect(Object.keys(extras.dayPhotos).map(Number)).toEqual([1, 2, 3]);
    expect(extras.dayPhotos[1]).toMatchObject({ license: 'CC BY-SA 4.0' });
    expect(extras.dayPhotos[3]).toBeNull();
    expect(extras.transport.map((t) => t.id)).toEqual(['train', 'carpool', 'foot']);
    expect(extras.transport[0]).toMatchObject({ amountEur: 60, perPerson: true });
    expect(extras.transport[0].detail).toContain('Lyon');
    expect(extras.choices).toEqual({ transport: null, stays: { 2: `osm:${refuge.id}` } });
    expect(extras.unavailable).toEqual([]);
    expect(extras.partial).toBe(false);
    expect(Date.parse(extras.fetchedAt)).not.toBeNaN();
  });

  it('une nuit notée sans lieu retrouvé garde l’illustration : jamais la photo de l’arrivée', async () => {
    h.photos[key(DAY1)] = photo('Rencurel');
    const extras = await loadV5Extras({ supabase: fakeSupabase(), trip: trip(), data });
    const noted = extras.nights[1][0];
    expect(noted.id).toBe('noted:Gîte du Royans');
    expect(noted.photo).toBeNull();
    expect(extras.dayPhotos[1]).not.toBeNull();
  });

  it('la même vue n’est pas répétée sur plusieurs options du jour', async () => {
    const a = poi(...Object.values(at(DAY1, 200)) as [number, number], 'hebergement', 'Hôtel A');
    const b = poi(...Object.values(at(DAY1, 900)) as [number, number], 'hebergement', 'Hôtel B');
    const c = poi(...Object.values(at(DAY1, 1800)) as [number, number], 'hebergement', 'Hôtel C');
    h.pois = [a, b, c];
    h.photos[key(a)] = photo('Village');
    h.photos[key(b)] = photo('Village');
    h.photos[key(c)] = photo('Autre');
    const extras = await loadV5Extras({ supabase: fakeSupabase(), trip: trip(), data });
    const byName = Object.fromEntries(extras.nights[1].map((o) => [o.name, o.photo?.url ?? null]));
    expect(byName['Hôtel A']).toContain('Village');
    expect(byName['Hôtel B']).toBeNull();
    expect(byName['Hôtel C']).toContain('Autre');
  });

  it(`au plus ${COMMONS_CALLS_MAX} requêtes à Commons par lecture, le reste vient du cache`, async () => {
    h.pois = [
      ...Array.from({ length: 5 }, (_, i) => poi(...Object.values(at(DAY1, 300 * (i + 1))) as [number, number], 'hebergement', `Gîte ${i}`)),
      ...Array.from({ length: 3 }, (_, i) => poi(...Object.values(at(DAY2, 300 * (i + 1))) as [number, number], 'hebergement', `Auberge ${i}`)),
    ];
    // Les photos du jour 2 sont déjà en cache : aucune requête pour elles.
    h.cachedKeys.add(key(DAY2));
    h.photos[key(DAY2)] = photo('Correncon');
    const extras = await loadV5Extras({ supabase: fakeSupabase(), trip: trip(), data });
    expect(h.networkCalls).toBeLessThanOrEqual(COMMONS_CALLS_MAX);
    expect(h.networkCalls).toBe(COMMONS_CALLS_MAX);
    expect(extras.partial).toBe(true);
    expect(extras.dayPhotos[2]).toMatchObject({ credit: 'Marie Martin' });
    // Dépassement de quota : ce n'est pas une panne.
    expect(extras.unavailable).not.toContain('photos');
  });

  it('Commons en panne : photos indisponibles, jamais une photo comblée', async () => {
    h.commonsFail = true;
    const extras = await loadV5Extras({ supabase: fakeSupabase(), trip: trip(), data });
    expect(extras.unavailable).toContain('photos');
    expect(Object.values(extras.dayPhotos).every((p) => p === null)).toBe(true);
  });

  it('points autour en erreur : nuits indisponibles, le reste est rendu', async () => {
    h.poisError = true;
    const extras = await loadV5Extras({ supabase: fakeSupabase(), trip: trip(), data });
    expect(extras.unavailable).toContain('lodging');
    expect(extras.nights).toEqual({});
    expect(extras.transport.map((t) => t.id)).toEqual(['carpool', 'foot']);
  });

  it('points autour trop lents : on garde le cache partagé, la lecture respecte son budget', async () => {
    h.poisHang = true;
    h.cachedPois = [poi(...Object.values(at(DAY1, 300)) as [number, number], 'hebergement', 'Hôtel en cache')];
    const t0 = Date.now();
    const extras = await loadV5Extras({ supabase: fakeSupabase(), trip: trip(), data, budgetMs: 2000 });
    expect(Date.now() - t0).toBeLessThan(2600);
    expect(extras.partial).toBe(true);
    expect(extras.nights[1].map((o) => o.name)).toContain('Hôtel en cache');
    expect(extras.unavailable).not.toContain('lodging');
  });

  it('points autour partiels et vides : indisponibles', async () => {
    h.poisPartial = true;
    const extras = await loadV5Extras({ supabase: fakeSupabase(), trip: trip(), data });
    expect(extras.partial).toBe(true);
    expect(extras.unavailable).toContain('lodging');
  });

  it('budget illisible : trajets indisponibles', async () => {
    const extras = await loadV5Extras({ supabase: fakeSupabase({ expenses: 'error' }), trip: trip(), data });
    expect(extras.unavailable).toContain('transport');
    expect(extras.transport).toEqual([]);
  });

  it('sans voiture, la voiture n’est jamais proposée ; un choix déjà fait est rendu', async () => {
    const extras = await loadV5Extras({
      supabase: fakeSupabase({ expenses: [{ title: 'Carburant aller-retour (300 km)', amount: 70 }] }),
      trip: trip({ compas: { prefs: { carFree: true }, transport: { id: 'carpool', amountEur: null, perPerson: false, source: 'x' } } }),
      data,
    });
    expect(extras.transport.map((t) => t.id)).not.toContain('car');
    expect(extras.choices.transport).toEqual({ id: 'carpool', amountEur: null, perPerson: false, source: 'x' });
  });

  it('préférence de nuits du voyage : refuge devant hôtel à distances proches', async () => {
    h.pois = [
      poi(...Object.values(at(DAY2, 300)) as [number, number], 'hebergement', 'Hôtel'),
      poi(...Object.values(at(DAY2, 900)) as [number, number], 'refuge', 'Refuge'),
    ];
    const extras = await loadV5Extras({ supabase: fakeSupabase(), trip: trip({ compas: { prefs: { nights: 'refuge' } } }), data });
    expect(extras.nights[2].map((o) => o.name)).toEqual(['Refuge', 'Hôtel']);
  });

  it('voyage d’un seul jour : aucune nuit à chercher', async () => {
    const one = {
      ...data,
      itinerary: [data.itinerary[0]],
      points: [data.points[0]],
    } as V5ExtrasSource;
    const extras = await loadV5Extras({ supabase: fakeSupabase(), trip: trip(), data: one });
    expect(extras.nights).toEqual({});
    expect(Object.keys(extras.dayPhotos)).toEqual(['1']);
  });

  it('le budget par défaut est de 8 secondes', () => {
    expect(EXTRAS_BUDGET_MS).toBe(8000);
  });
});

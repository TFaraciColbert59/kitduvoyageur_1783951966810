/**
 * Plan 4.8 : altitudes de secours sans liste de pays. Quand aucune altitude n'est
 * mesurée, les règles ne devinent plus une altitude « par pays » : elles lisent
 * le relief au lieu du voyage (Terrain Tiles), et à défaut parlent avec
 * prudence. Un conseil de sécurité (froid, altitude, eau) ne disparaît jamais
 * faute de donnée.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fixtures from './fixtures/power-climatology.json';
import { adviseKit, type KitContext } from '../engine/kitRules';
import { essentialAdvice, type AdviceInput } from '../engine/advice';
import { kitAltitude } from '../engine/kitContext';
import { powerClimateNormals } from '../engine/metno';
import type { CompasDayPlan } from '../engine/compasModel';
import { climateWindow } from '@/features/trips/engine/climate';
import { generateTripContextualKit, type ContextualKitInput } from '@/features/trips/engine/contextualKitEngine';
import { getTripElevationProfile } from '@/features/trips/lib/elevation';
import type { TripFull } from '@/features/trips/types/trip.types';

const h = vi.hoisted(() => ({ elevations: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/geo/terrainElevation', () => ({
  terrainElevations: h.elevations,
  TERRAIN_SOURCE: 'Terrain Tiles (test)',
}));

import { pointsMaxAltitudeM } from '../server/elevation';

const COUNTRIES = ['NP', 'PE', 'MA', 'IS', 'FR'] as const;

describe('moteur de kit : plus d’altitude par pays', () => {
  const keysOf = (a: ReturnType<typeof generateTripContextualKit>) =>
    [...a.vitalGaps, ...a.recommendedGaps].map((g) => g.key);

  it('sans altitude ni code pays lu : le résultat est le même pour tous les pays, altitude 0 et dite inconnue', () => {
    const base = { activity: 'hiking', durationDays: 5, seasonMonth: 7, latitude: 46.5 };
    const reference = generateTripContextualKit({ ...base, countryCode: 'ZZ' });
    for (const country of COUNTRIES)
      expect(JSON.stringify(generateTripContextualKit({ ...base, countryCode: country })), country).toBe(
        JSON.stringify(reference)
      );
    expect(reference.maxAltitudeM).toBe(0);
    expect(reference.altitudeKnown).toBe(false);
  });

  it('le Népal sans étape n’est plus 3 500 m : ni crampons ni doudoune inventés pour une randonnée', () => {
    const a = generateTripContextualKit({ countryCode: 'NP', activity: 'hiking', durationDays: 5, seasonMonth: 7, latitude: 28 });
    expect(keysOf(a)).not.toContain('crampons');
    expect(keysOf(a)).not.toContain('cold-down-jacket');
    expect(a.climateWarnings.join(' ')).not.toMatch(/mal aigu/);
  });

  it('altitude mesurée (profil, étape) : connue, et les règles d’altitude jouent', () => {
    const a = generateTripContextualKit({ activity: 'hiking', durationDays: 5, seasonMonth: 10, latitude: 46, elevationProfile: { maxM: 2600 } as never });
    expect(a.altitudeKnown).toBe(true);
    expect(keysOf(a)).toEqual(expect.arrayContaining(['water-filter', 'survival-blanket', 'cold-down-jacket']));
  });

  describe('altitude inconnue : formulation prudente, jamais le silence', () => {
    const kit = (activity: string, over: Partial<ContextualKitInput> = {}) =>
      generateTripContextualKit({ activity, durationDays: 5, seasonMonth: 7, latitude: 46, ...over });
    const gap = (a: ReturnType<typeof kit>, key: string) => [...a.vitalGaps, ...a.recommendedGaps].find((g) => g.key === key);

    it.each(['trekking', 'mountaineering', 'ski', 'climbing'])('%s : couverture de survie et traitement de l’eau, recommandés, avec la raison', (activity) => {
      const a = kit(activity);
      expect(gap(a, 'survival-blanket')).toMatchObject({ priority: 'recommended' });
      expect(gap(a, 'survival-blanket')?.reason).toMatch(/non mesurée/);
      expect(gap(a, 'water-filter')).toMatchObject({ priority: 'recommended' });
      expect(gap(a, 'water-filter')?.reason).toMatch(/non mesurée/);
      expect(a.climateWarnings.join(' ')).toMatch(/Altitude du parcours non mesurée/);
    });

    it('une randonnée ou une ville : rien de plus (l’altitude n’y est pas le sujet)', () => {
      for (const activity of ['hiking', 'citytrip', 'cycling', 'beach']) {
        const a = kit(activity);
        expect(gap(a, 'survival-blanket'), activity).toBeUndefined();
        expect(a.climateWarnings, activity).toEqual([]);
      }
    });

    it('altitude connue et basse : pas de prudence inutile ; haute : la règle d’origine', () => {
      expect(gap(kit('trekking', { elevationProfile: { maxM: 900 } as never }), 'survival-blanket')).toBeUndefined();
      // Trois règles vitales au-dessus de 3 000 m, deux au plus gardées (plafond D7) : celle-ci reste dite, en recommandé au besoin.
      expect(gap(kit('trekking', { elevationProfile: { maxM: 3000 } as never }), 'survival-blanket')).toBeDefined();
    });
  });
});

describe('profil d’altitude du module Voyages : plus de table de pays', () => {
  const trip = (code: string | null) =>
    ({
      id: 't',
      slug: 's',
      title: 'Voyage sans donnée',
      destination_name: null,
      destination_country_code: code,
      steps: [],
      metadata: null,
    }) as unknown as TripFull;

  it('sans donnée, tous les pays disent la même chose : 0, confiance faible', () => {
    for (const code of [...COUNTRIES, null]) {
      const p = getTripElevationProfile(trip(code));
      expect(p, String(code)).toMatchObject({ maxM: 0, minM: 0, confidence: 'low' });
    }
  });
});

describe('conseils de kit : froid et altitude', () => {
  const plan = (): CompasDayPlan => ({
    day: 1,
    date: '2027-08-12',
    title: 'J1',
    distanceKm: 12,
    gainM: 600,
    lossM: 400,
    lat: 45,
    lon: 6,
    stay: null,
    walkMin: null,
  });
  const run = (context: KitContext) =>
    adviseKit({
      lines: [],
      forecasts: [{ day: 1, date: '2027-08-12', forecast: null }],
      dayPlans: [plan()],
      waterPointsCount: null,
      context,
    });
  const by = (a: ReturnType<typeof run>, need: string) => a.find((x) => x.need === need);
  const ctx = (over: Partial<KitContext> = {}): KitContext => ({ lat: 45, maxAltitudeM: null, climate: null, activity: 'hiking', ...over });

  it('altitude mesurée à 2 000 m ou plus : couche chaude (6,5 °C de moins par 1 000 m), même si le mois est doux', () => {
    const paris = climateWindow(powerClimateNormals(fixtures.paris.payload), ['2027-08-10']);
    const a = run(ctx({ maxAltitudeM: 2400, climate: paris }));
    expect(by(a, 'froid')?.reason).toMatch(/2 400 m/);
    expect(by(a, 'froid')?.reason).toMatch(/6,5 °C/);
    expect(by(a, 'froid')?.source).toMatch(/altitude mesurée/);
    expect(by(a, 'extremites')).toBeUndefined();
    expect(by(run(ctx({ maxAltitudeM: 1900 })), 'froid')).toBeUndefined();
  });

  it('à 3 000 m ou plus : gants et bonnet aussi', () => {
    expect(by(run(ctx({ maxAltitudeM: 3200 })), 'extremites')?.reason).toMatch(/3 200 m/);
    expect(by(run(ctx({ maxAltitudeM: 2900 })), 'extremites')).toBeUndefined();
  });

  it('les normales du mois gardent la priorité sur l’altitude', () => {
    const reykjavik = climateWindow(powerClimateNormals(fixtures.reykjavik.payload), ['2027-02-10']);
    expect(by(run(ctx({ maxAltitudeM: 2600, climate: reykjavik })), 'froid')?.source).toMatch(/NASA POWER/);
  });

  it('altitude non mesurée en trek, alpinisme, ski ou escalade : couche chaude par précaution, dite', () => {
    for (const activity of ['trekking', 'mountaineering', 'ski', 'climbing']) {
      const f = by(run(ctx({ activity })), 'froid');
      expect(f?.reason, activity).toMatch(/non mesurée/);
      expect(f?.reason, activity).toMatch(/6,5 °C/);
      expect(f?.source, activity).toMatch(/non mesurée/);
    }
    for (const activity of ['hiking', 'citytrip', null]) expect(by(run(ctx({ activity })), 'froid'), String(activity)).toBeUndefined();
  });

  it('altitude basse mesurée : aucune prudence', () => {
    expect(by(run(ctx({ activity: 'trekking', maxAltitudeM: 600 })), 'froid')).toBeUndefined();
  });

  describe('altitude des seuls lieux (plancher) : haute elle prouve, basse elle ne prouve rien', () => {
    const lieux = (over: Partial<KitContext> = {}) => ctx({ altitudeFrom: 'lieux', ...over });

    it('haute : les règles fermes jouent, et le conseil dit que ce sont les lieux, pas le parcours', () => {
      const a = run(lieux({ activity: 'trekking', maxAltitudeM: 3200 }));
      expect(by(a, 'froid')?.reason).toMatch(/^Lieux du voyage jusqu’à 3 200 m \(le parcours peut monter plus haut\)/);
      expect(by(a, 'froid')?.source).toMatch(/altitude des lieux/);
      expect(by(a, 'extremites')?.reason).toMatch(/^Lieux du voyage jusqu’à 3 200 m/);
      expect(by(a, 'filtre')?.reason).toMatch(/Lieux du voyage jusqu’à 3 200 m/);
      expect(by(a, 'filtre')?.source).toMatch(/altitude des lieux/);
    });

    it('basse en trek, alpinisme, ski, escalade : la prudence reste dite (jamais le silence)', () => {
      for (const activity of ['trekking', 'mountaineering', 'ski', 'climbing']) {
        const f = by(run(lieux({ activity, maxAltitudeM: 800 })), 'froid');
        expect(f?.reason, activity).toMatch(/non mesurée/);
        expect(f?.source, activity).toMatch(/non mesurée/);
      }
    });

    it('basse en randonnée ou en ville : rien de plus', () => {
      for (const activity of ['hiking', 'citytrip'])
        expect(by(run(lieux({ activity, maxAltitudeM: 800 })), 'froid'), activity).toBeUndefined();
    });
  });
});

describe('moustiques : le point le plus bas du tracé décide, pas le plus haut', () => {
  const run = (context: KitContext) =>
    adviseKit({ lines: [], forecasts: [], dayPlans: [], waterPointsCount: null, context });
  const tropic = (over: Partial<KitContext> = {}): KitContext => ({
    lat: -13.5,
    maxAltitudeM: null,
    climate: null,
    activity: 'hiking',
    ...over,
  });
  const has = (c: KitContext) => run(c).some((x) => x.need === 'moustiques');

  it('tracé de 3 400 m à 2 040 m : la forêt basse a des moustiques, le conseil reste', () => {
    expect(has(tropic({ maxAltitudeM: 3400, minAltitudeM: 2040 }))).toBe(true);
  });
  it('tracé tout entier au-dessus de 2 500 m : pas de moustiques', () => {
    expect(has(tropic({ maxAltitudeM: 3400, minAltitudeM: 2900 }))).toBe(false);
  });
  it('sans point bas lu : le point le plus haut mesuré décide, comme avant', () => {
    expect(has(tropic({ maxAltitudeM: 2600 }))).toBe(false);
    expect(has(tropic({ maxAltitudeM: 2400 }))).toBe(true);
  });
  it('des lieux hauts seuls (plancher) ne retirent pas le conseil', () => {
    expect(has(tropic({ maxAltitudeM: 3400, altitudeFrom: 'lieux' }))).toBe(true);
  });
});

describe('kitAltitude : le tracé d’abord, puis le relief des lieux, sinon inconnue', () => {
  it('profil du tracé lu : point le plus haut et le plus bas, source « trace »', () => {
    expect(kitAltitude({ route: { maxM: 3100, minM: 120 }, placesMaxM: 400 })).toEqual({
      maxAltitudeM: 3100,
      minAltitudeM: 120,
      altitudeFrom: 'trace',
    });
  });
  it('sans tracé : le relief des lieux, retenu comme un plancher', () => {
    expect(kitAltitude({ route: null, placesMaxM: 2310 })).toEqual({
      maxAltitudeM: 2310,
      minAltitudeM: null,
      altitudeFrom: 'lieux',
    });
  });
  it('ni tracé ni relief : inconnue, jamais devinée', () => {
    for (const placesMaxM of [null, 0])
      expect(kitAltitude({ route: null, placesMaxM }).maxAltitudeM, String(placesMaxM)).toBeNull();
  });
});

describe('conseil essentiel : altitude non mesurée', () => {
  const base: AdviceInput = {
    activity: 'trekking',
    nights: [],
    maxAltitudeM: null,
    party: 3,
    startDate: '2027-10-17',
    lat: 45.6,
    countryCode: 'FR',
  };

  it('trek, alpinisme, ski, escalade : la règle des 2 500 m est dite par précaution', () => {
    for (const activity of ['trekking', 'mountaineering', 'ski', 'climbing']) {
      const notes = essentialAdvice({ ...base, activity });
      expect(notes[0], activity).toMatch(/Altitude du parcours non mesurée/);
      expect(notes[0], activity).toMatch(/2 500 m/);
      expect(notes[0], activity).toMatch(/redescends/);
    }
  });

  it('altitude des seuls lieux (étapes, refuges) basse : un plancher, la prudence reste dite', () => {
    for (const activity of ['trekking', 'mountaineering', 'ski', 'climbing']) {
      const notes = essentialAdvice({ ...base, activity, maxAltitudeM: 800, altitudeFrom: 'lieux' });
      expect(notes[0], activity).toMatch(/Altitude du parcours non mesurée/);
    }
    // Randonnée : une rando peut être n'importe où, rien de plus.
    expect(essentialAdvice({ ...base, activity: 'hiking', maxAltitudeM: 800, altitudeFrom: 'lieux' })).toEqual([]);
    // Des lieux hauts prouvent que le parcours monte : la règle ferme.
    expect(essentialAdvice({ ...base, maxAltitudeM: 3200, altitudeFrom: 'lieux' })[0]).toMatch(/^Au-dessus de 2 500 m/);
  });

  it('randonnée, ville, altitude mesurée basse : rien à dire', () => {
    expect(essentialAdvice({ ...base, activity: 'hiking' })).toEqual([]);
    expect(essentialAdvice({ ...base, activity: 'citytrip' })).toEqual([]);
    expect(essentialAdvice({ ...base, maxAltitudeM: 800 })).toEqual([]);
  });

  it('altitude mesurée au-dessus de 2 500 m : la règle ferme, pas la prudente', () => {
    const notes = essentialAdvice({ ...base, maxAltitudeM: 3200 });
    expect(notes[0]).toMatch(/^Au-dessus de 2 500 m/);
    expect(notes.join(' ')).not.toMatch(/non mesurée/);
  });
});

describe('pointsMaxAltitudeM : altitude de secours lue sur le relief', () => {
  beforeEach(() => h.elevations.mockReset());

  it('le point le plus haut des lieux, lu sur le relief, jamais une valeur par pays', async () => {
    h.elevations.mockResolvedValue([1200, 2310, null]);
    expect(
      await pointsMaxAltitudeM([
        { lat: 28.2, lon: 83.9 },
        { lat: 28.3, lon: 84.0 },
        { lat: 28.4, lon: 84.1 },
      ])
    ).toBe(2310);
    // [lon, lat], dans l'ordre.
    expect(h.elevations).toHaveBeenCalledWith([
      [83.9, 28.2],
      [84.0, 28.3],
      [84.1, 28.4],
    ]);
  });

  it('lieux voisins (moins de 0,01°) comptés une fois, 12 lieux au plus', async () => {
    h.elevations.mockResolvedValue([100]);
    await pointsMaxAltitudeM([
      { lat: 10.001, lon: 20.001 },
      { lat: 10.002, lon: 20.002 },
    ]);
    expect(h.elevations.mock.calls[0][0]).toHaveLength(1);
    h.elevations.mockClear();
    h.elevations.mockResolvedValue([100]);
    await pointsMaxAltitudeM(Array.from({ length: 30 }, (_, i) => ({ lat: i, lon: i })));
    expect(h.elevations.mock.calls[0][0]).toHaveLength(12);
  });

  it('relief injoignable, mer (0 m) ou aucun lieu : null, rien n’est supposé', async () => {
    h.elevations.mockResolvedValue(null);
    expect(await pointsMaxAltitudeM([{ lat: 1, lon: 1 }])).toBeNull();
    h.elevations.mockRejectedValue(new Error('réseau coupé'));
    expect(await pointsMaxAltitudeM([{ lat: 1, lon: 1 }])).toBeNull();
    h.elevations.mockResolvedValue([0]);
    expect(await pointsMaxAltitudeM([{ lat: 1, lon: 1 }])).toBeNull();
    expect(await pointsMaxAltitudeM([])).toBeNull();
    expect(await pointsMaxAltitudeM([{ lat: Number.NaN, lon: 1 }])).toBeNull();
  });
});

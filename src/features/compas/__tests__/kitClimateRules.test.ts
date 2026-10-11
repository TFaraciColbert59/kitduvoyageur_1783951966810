/**
 * Plan 4.8 : les règles d'équipement du kit lisent le climat du lieu (normales
 * NASA POWER), plus des listes de pays (Islande, Népal, Maroc, Pérou, France).
 *
 * Normales : `fixtures/power-climatology.json`, de vraies réponses de NASA
 * POWER (voir `climateNormals.test.ts`).
 */
import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/power-climatology.json';
import { powerClimateNormals } from '../engine/metno';
import { climateWindow } from '@/features/trips/engine/climate';
import {
  generateTripContextualKit,
  type ContextualKitInput,
} from '@/features/trips/engine/contextualKitEngine';

type Place = keyof typeof fixtures;

const kit = (place: Place, month: number, over: Partial<ContextualKitInput> = {}) =>
  generateTripContextualKit({
    activity: 'hiking',
    durationDays: 4,
    seasonMonth: month,
    latitude: fixtures[place].lat,
    climate: climateWindow(powerClimateNormals(fixtures[place].payload), [
      `2027-${String(month).padStart(2, '0')}-10`,
    ]),
    ...over,
  });

const gaps = (a: ReturnType<typeof kit>) => [...a.vitalGaps, ...a.recommendedGaps];
const gap = (a: ReturnType<typeof kit>, key: string) => gaps(a).find((g) => g.key === key);
const keys = (a: ReturnType<typeof kit>) => gaps(a).map((g) => g.key);

describe('pluie : d’après les précipitations du mois', () => {
  it('Reykjavik en septembre : poncho vital (pluie froide), la donnée dans la raison', () => {
    const a = kit('reykjavik', 9);
    const poncho = gap(a, 'rain-poncho');
    expect(poncho?.priority).toBe('vital');
    expect(poncho?.reason).toContain('septembre');
    expect(poncho?.reason).toContain('6 mm par jour');
    expect(a.climateWarnings.join(' ')).toMatch(/Pluie froide en septembre/);
  });

  it('Bali en janvier : poncho recommandé (pluie chaude) et sac étanche pour la saison des pluies', () => {
    const a = kit('ubud', 1);
    expect(gap(a, 'rain-poncho')?.priority).toBe('recommended');
    expect(gap(a, 'dry-bag')?.reason).toContain('janvier');
    expect(a.climateWarnings.join(' ')).toMatch(/mousson ou saison des pluies/);
  });

  it('Paris en octobre, Marrakech en juin : pas de poncho', () => {
    expect(keys(kit('paris', 10))).not.toContain('rain-poncho');
    expect(keys(kit('marrakech', 6))).not.toContain('rain-poncho');
    expect(keys(kit('paris', 10))).not.toContain('dry-bag');
  });

  it('climat illisible : un coupe-pluie par précaution seulement pour plusieurs jours, dit comme tel', () => {
    const none = { climate: null, latitude: null, seasonMonth: undefined };
    expect(keys(kit('paris', 10, { ...none, durationDays: 1 }))).not.toContain('rain-poncho');
    const prudent = gap(kit('paris', 10, { ...none, durationDays: 4 }), 'rain-poncho');
    expect(prudent?.priority).toBe('recommended');
    expect(prudent?.reason).toMatch(/pas lues|par précaution/);
  });
});

describe('froid sans altitude : gants, doudoune, crampons, chauffe-mains', () => {
  it('Reykjavik en février, aucune altitude : crampons, gants, doudoune, chauffe-mains', () => {
    const a = kit('reykjavik', 2);
    expect(a.maxAltitudeM).toBe(0);
    expect(keys(a)).toEqual(expect.arrayContaining(['crampons', 'cold-gloves', 'cold-down-jacket', 'hand-warmers']));
    expect(gap(a, 'crampons')?.reason).toContain('février');
    expect(gap(a, 'cold-down-jacket')?.reason).toContain('février');
  });

  it('Torres del Paine en juillet (hiver austral) : même résultat, sans lire le pays', () => {
    expect(keys(kit('torres', 7))).toEqual(expect.arrayContaining(['crampons', 'cold-gloves', 'cold-down-jacket']));
  });

  it('Paris en janvier : gants (hiver) mais ni crampons ni doudoune grand froid', () => {
    const a = keys(kit('paris', 1));
    expect(a).toContain('cold-gloves');
    expect(a).not.toContain('crampons');
    expect(a).not.toContain('cold-down-jacket');
  });

  it('Paris en juin, Bali en août : aucun équipement de froid', () => {
    for (const k of [kit('paris', 6), kit('ubud', 8)])
      for (const key of ['crampons', 'cold-gloves', 'cold-down-jacket', 'hand-warmers'])
        expect(keys(k)).not.toContain(key);
  });
});

describe('soleil et chaleur : d’après la latitude, l’altitude et les normales', () => {
  it('Marrakech en juillet (sec et chaud) : crème et lunettes vitales, avertissement de chaleur', () => {
    const a = kit('marrakech', 7);
    expect(gap(a, 'sunscreen')?.priority).toBe('vital');
    expect(gap(a, 'sunscreen')?.reason).toContain('juillet');
    expect(gap(a, 'sunglasses')).toBeDefined();
    expect(a.climateWarnings.join(' ')).toMatch(/Chaleur en juillet/);
  });

  it('Bali : la latitude seule rend le soleil vital, toute l’année', () => {
    const a = kit('ubud', 8);
    expect(gap(a, 'sunscreen')?.priority).toBe('vital');
    expect(gap(a, 'sunscreen')?.reason).toMatch(/tropical/);
    // Les mêmes normales sans latitude : plus de preuve d'un soleil tropical.
    expect(gap(kit('ubud', 8, { latitude: null }), 'sunscreen')?.priority).toBe('recommended');
  });

  it('Paris en juillet : crème recommandée, pas vitale', () => {
    const a = kit('paris', 7);
    expect(gap(a, 'sunscreen')?.priority).toBe('recommended');
    expect(keys(a)).not.toContain('sunglasses');
    expect(a.climateWarnings.join(' ')).not.toMatch(/Chaleur/);
  });
});

describe('plus aucune liste de pays dans les règles du kit', () => {
  const same = (over: Partial<ContextualKitInput>) => {
    const base = { activity: 'hiking', durationDays: 6, seasonMonth: 7, latitude: 46.5 };
    const strip = (a: ReturnType<typeof generateTripContextualKit>) => JSON.stringify(a);
    for (const country of ['IS', 'NP', 'MA', 'PE', 'FR']) {
      expect(strip(generateTripContextualKit({ ...base, ...over, countryCode: country }))).toBe(
        strip(generateTripContextualKit({ ...base, ...over, countryCode: 'ZZ' }))
      );
    }
  };

  it('le code pays ne change ni les objets, ni les raisons, ni les avertissements', () => {
    same({
      climate: climateWindow(powerClimateNormals(fixtures.reykjavik.payload), ['2027-07-10']),
      elevationProfile: { maxM: 800 } as never,
    });
    same({ elevationProfile: { maxM: 3100 } as never });
  });
});

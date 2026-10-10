import { describe, expect, it } from 'vitest';
import { nearestAirportIn, type AirportRow } from '../engine/airports';
import {
  HOME_ORIGIN_NOTE,
  homeForLeg,
  originFact,
  planTravelLeg,
  travelDigest,
  travelOrigin,
  type CarRouteResult,
  type TravelDeps,
  type TravelLegInput,
} from '../engine/travel';

/**
 * Domicile du profil voyageur (PLAN-100 4.3, lot P) : départ après le départ dit,
 * avant la position ; « ton domicile » dans ce qui est rangé sur le voyage, jamais
 * le nom ; rien pour l'IA.
 */
const ROWS: AirportRow[] = [
  ['CAG', 'Cagliari Elmas Airport', 39.251, 9.054, 'IT', 'L'],
  ['LYS', 'Lyon Saint-Exupéry Airport', 45.726, 5.09, 'FR', 'L'],
  ['OLB', 'Olbia Costa Smeralda Airport', 40.899, 9.518, 'IT', 'L'],
];
/** Un domicile au nom distinct de tout aéroport, pour vérifier qu'il ne sort jamais. */
const HOME = { name: 'Villeurbanne', lat: 45.76, lon: 4.84, countryCode: 'FR' };
const SAID = { name: 'Grenoble', lat: 45.19, lon: 5.72, countryCode: 'FR' };
const GPS = { lat: 48.86, lon: 2.35, name: 'Paris', country: 'France', countryCode: 'FR' };
const VERCORS = { lat: 45.07, lon: 5.55 };
const SARDAIGNE = { lat: 40.08, lon: 9.03 };

const deps = (car: CarRouteResult): TravelDeps => ({
  carRoute: async () => car,
  walkKm: async () => 0,
  airport: (p, country) => nearestAirportIn(ROWS, p.lat, p.lon, { country }),
});
const input = (over: Partial<TravelLegInput>): TravelLegInput => ({
  origin: travelOrigin(null, GPS, HOME),
  target: VERCORS,
  destination: { name: 'Vercors', countryCode: 'FR' },
  days: 3,
  party: 2,
  transport: true,
  ...over,
});
const leaks = (value: unknown) => JSON.stringify(value).includes('Villeurbanne');

describe('d’où l’on part : dit, puis domicile, puis position', () => {
  it('le départ dit passe avant le domicile, le domicile avant la position', () => {
    expect(travelOrigin(SAID, GPS, HOME)).toMatchObject({ name: 'Grenoble', source: 'dit' });
    expect(travelOrigin(null, GPS, HOME)).toEqual({
      name: 'Villeurbanne',
      country: null,
      countryCode: 'FR',
      lat: 45.76,
      lon: 4.84,
      source: 'domicile',
    });
    expect(travelOrigin(null, GPS, null)).toMatchObject({ name: 'Paris', source: 'gps' });
    expect(travelOrigin(null, GPS)).toMatchObject({ source: 'gps' });
    expect(travelOrigin(null, null, null)).toBeNull();
  });

  it('pour l’IA, le domicile n’a pas de nom', () => {
    const fact = originFact(travelOrigin(null, null, HOME));
    expect(fact).toBe('domicile de la personne (ville non transmise)');
    expect(fact).not.toContain('Villeurbanne');
  });
});

describe('le domicile et la position partagée', () => {
  const HOME = { name: 'Lyon', lat: 45.76, lon: 4.83, countryCode: 'FR' };

  it('le domicile ne sert que sans départ dit et sans ancre sur la position', () => {
    expect(homeForLeg(null, false, HOME)).toBe(HOME);
    expect(homeForLeg({ name: 'Genève' }, false, HOME)).toBeNull();
    // « Préparé près de chez toi » : la personne y est déjà, le trajet ne part pas de Lyon.
    expect(homeForLeg(null, true, HOME)).toBeNull();
    expect(homeForLeg(null, false, null)).toBeNull();
  });
});

describe('le trajet depuis le domicile', () => {
  it('route : « (depuis ton domicile) », une note, jamais le nom', async () => {
    const leg = await planTravelLeg(input({}), deps({ km: 110, minutes: 95, end: VERCORS }));
    expect(leg.transport).toMatchObject({ mode: 'voiture', km: 110, departure: 'ton domicile' });
    expect(leg.abroad).toBe(false);
    expect(leg.notes).toEqual([HOME_ORIGIN_NOTE]);
    expect(travelDigest(leg.transport)).toBe('110 km de route (depuis ton domicile)');
    expect(leaks([leg.transport, leg.notes, leg.flight])).toBe(false);
  });

  it('avion : d’aéroport à aéroport depuis « ton domicile », à l’étranger', async () => {
    const leg = await planTravelLeg(
      input({ target: SARDAIGNE, destination: { name: 'Sardaigne', countryCode: 'IT' } }),
      deps({ km: 1100, minutes: 840, end: null })
    );
    expect(leg.abroad).toBe(true);
    expect(leg.transport).toMatchObject({ mode: 'avion', route: 'LYS → CAG', departure: 'ton domicile' });
    expect(leg.transport?.basis).toBe(
      'vol aller-retour depuis ton domicile, LYS → CAG (Lyon Saint-Exupéry Airport → Cagliari Elmas Airport), environ 790 km'
    );
    expect(travelDigest(leg.transport)).toBe('vol LYS → CAG à prévoir (depuis ton domicile)');
    expect(leaks([leg.transport, leg.notes, leg.flight])).toBe(false);
  });

  it('un départ dit l’emporte : ni note de domicile, ni « ton domicile »', async () => {
    const leg = await planTravelLeg(
      input({ origin: travelOrigin(SAID, GPS, HOME) }),
      deps({ km: 60, minutes: 55, end: VERCORS })
    );
    expect(leg.transport).toMatchObject({ departure: 'Grenoble' });
    expect(leg.notes).not.toContain(HOME_ORIGIN_NOTE);
  });

  it('rien de chiffré (sortie de quelques heures) : pas de note de domicile', async () => {
    const leg = await planTravelLeg(input({ transport: false, days: 1 }), deps({ km: 110, minutes: 95, end: VERCORS }));
    expect(leg.transport).toBeNull();
    expect(leg.notes).not.toContain(HOME_ORIGIN_NOTE);
  });
});

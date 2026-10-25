import { describe, expect, it } from 'vitest';
import { FLIGHT_THRESHOLD_KM } from '../engine/autofill';
import { distanceKm } from '../engine/places';
import {
  DAY_TRIP_MAX_MINUTES,
  dayTripNote,
  estimatedDriveMinutes,
  planTravelLeg,
  travelOrigin,
  type CarRouteResult,
  type TravelDeps,
  type TravelLegInput,
} from '../engine/travel';

const ANNECY = { name: 'Annecy', lat: 45.9, lon: 6.13, countryCode: 'FR' };
const MERCANTOUR = { lat: 44.15, lon: 7.1 };
const deps = (car: CarRouteResult): TravelDeps => ({
  carRoute: async () => car,
  walkKm: async () => 0,
  airport: () => null,
});
const input = (over: Partial<TravelLegInput>): TravelLegInput => ({
  origin: travelOrigin(ANNECY, null),
  target: MERCANTOUR,
  destination: { name: 'Mercantour', countryCode: 'FR' },
  days: 1,
  party: 2,
  transport: true,
  ...over,
});

describe('une journée à plus de 3 h de trajet aller est signalée', () => {
  it('le texte, à la minute', () => {
    expect(DAY_TRIP_MAX_MINUTES).toBe(180);
    expect(dayTripNote(1, 200)).toBe(
      '3 h 20 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.'
    );
    expect(dayTripNote(1, 185)).toBe(
      '3 h 05 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.'
    );
  });

  it('CONTRE-EXEMPLES : 3 h pile, deux jours, temps inconnu', () => {
    expect(dayTripNote(1, 180)).toBeNull();
    expect(dayTripNote(2, 300)).toBeNull();
    expect(dayTripNote(1, null)).toBeNull();
  });

  it('la minute qui suit les 3 h est dite ; un temps non entier se lit arrondi, jamais « 3 h 00 »', () => {
    expect(dayTripNote(1, 181)).toBe(
      '3 h 01 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.'
    );
    expect(dayTripNote(1, 180.4)).toBeNull();
    expect(dayTripNote(1, Number.NaN)).toBeNull();
  });

  it('Mercantour depuis Annecy, une journée, 200 min de route mesurée : la note, la route chiffrée', async () => {
    const leg = await planTravelLeg(input({}), deps({ km: 260, minutes: 200, end: null }));
    expect(leg.transport).toMatchObject({ mode: 'voiture', km: 260, minutes: 200 });
    expect(leg.notes).toEqual([
      '3 h 20 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.',
    ]);
  });

  it('le même trajet sur deux jours : rien à dire', async () => {
    const leg = await planTravelLeg(input({ days: 2 }), deps({ km: 260, minutes: 200, end: null }));
    expect(leg.notes).toEqual([]);
  });

  it('3 h pile de route mesurée : rien à dire', async () => {
    const leg = await planTravelLeg(input({}), deps({ km: 240, minutes: 180, end: null }));
    expect(leg.transport).toMatchObject({ mode: 'voiture', minutes: 180 });
    expect(leg.notes).toEqual([]);
  });

  it('route non calculée mais à portée : le temps estimé décide, la note de l’estimation reste', async () => {
    // 209 km à vol d'oiseau : route estimée 272 km, 204 min.
    const leg = await planTravelLeg(input({}), deps({ failure: 'provider_unavailable' }));
    expect(leg.transport).toMatchObject({ mode: 'voiture', km: 272, minutes: 204 });
    expect(leg.notes).toHaveLength(2);
    expect(leg.notes[0]).toMatch(/^Trajet en voiture estimé \(itinéraire routier non calculé/);
    expect(leg.notes[1]).toBe(
      '3 h 24 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.'
    );
  });

  it('en train aussi (Lyon → Paris, route de 5 h 01 : train de 4 h 58)', async () => {
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin({ name: 'Lyon', lat: 45.76, lon: 4.84, countryCode: 'FR' }, null),
        target: { lat: 48.86, lon: 2.35 },
        destination: { name: 'Paris', countryCode: 'FR' },
      }),
      deps({ km: 465, minutes: 301, end: null })
    );
    expect(leg.transport).toMatchObject({ mode: 'train', km: 491, minutes: 298 });
    expect(leg.notes).toEqual([
      '4 h 58 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.',
    ]);
  });

  it('sortie de quelques heures (aucun trajet chiffré) : le temps estimé décide, rien n’est chiffré', async () => {
    // 209 km à vol d'oiseau × 1,3 à 80 km/h = 204 min.
    expect(estimatedDriveMinutes(209)).toBe(204);
    const leg = await planTravelLeg(input({ transport: false }), deps({ km: 260, minutes: 200, end: null }));
    expect(leg).toMatchObject({ transport: null, carFuel: null, train: null, flight: null });
    expect(leg.notes).toEqual([
      '3 h 24 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.',
    ]);
    // Sans départ connu, ni chiffre ni note.
    expect((await planTravelLeg(input({ transport: false, origin: null }), deps({ failure: null }))).notes).toEqual([]);
  });

  it('sortie : aucun calcul de route, de marche ni d’aéroport, pas de départ inconnu, rien de chiffré', async () => {
    const calls: string[] = [];
    const spy: TravelDeps = {
      carRoute: async () => {
        calls.push('route');
        return { km: 260, minutes: 200, end: null };
      },
      walkKm: async () => {
        calls.push('marche');
        return 0;
      },
      airport: () => {
        calls.push('aéroport');
        return null;
      },
    };
    const leg = await planTravelLeg(input({ transport: false }), spy);
    expect(calls).toEqual([]);
    expect(leg).toMatchObject({ transport: null, carFuel: null, train: null, flight: null, originUnknown: false });
  });

  it('sortie près de chez soi, ou partie de loin mais sur place : aucune note', async () => {
    // Annecy → un point à 20 km : 34 min estimées.
    const near = await planTravelLeg(
      input({ transport: false, target: { lat: 45.9, lon: 6.4 } }),
      deps({ failure: null })
    );
    expect(near.notes).toEqual([]);
    const onSite = await planTravelLeg(
      input({ transport: false, target: { lat: ANNECY.lat, lon: ANNECY.lon } }),
      deps({ failure: null })
    );
    expect(onSite.notes).toEqual([]);
  });

  describe('sortie au-delà de la portée d’une route : ni note ni chiffre', () => {
    const PARIS = { name: 'Paris', lat: 48.86, lon: 2.35, countryCode: 'FR' };
    const NEW_YORK = { lat: 40.71, lon: -74.0 };
    // Un point plein sud d'Annecy, à `km` kilomètres à vol d'oiseau.
    const southOfAnnecy = (km: number) => ({ lat: ANNECY.lat - (km / 6371) * (180 / Math.PI), lon: ANNECY.lon });
    const nothingPriced = { transport: null, carFuel: null, train: null, flight: null, originUnknown: false };

    it('Paris → New York, sortie : aucune note (jamais « 94 h … »), rien de chiffré, aucun calcul', async () => {
      const calls: string[] = [];
      const spy: TravelDeps = {
        carRoute: async () => {
          calls.push('route');
          return { failure: null };
        },
        walkKm: async () => {
          calls.push('marche');
          return 0;
        },
        airport: () => {
          calls.push('aéroport');
          return null;
        },
      };
      const leg = await planTravelLeg(
        input({
          transport: false,
          origin: travelOrigin(PARIS, null),
          target: NEW_YORK,
          destination: { name: 'New York', countryCode: 'US' },
        }),
        spy
      );
      expect(leg).toMatchObject(nothingPriced);
      expect(leg.notes).toEqual([]);
      expect(calls).toEqual([]);
    });

    it('la limite est celle de la route estimée : 900 km à vol d’oiseau et pas un de plus', async () => {
      const under = southOfAnnecy(FLIGHT_THRESHOLD_KM - 0.01);
      const over = southOfAnnecy(FLIGHT_THRESHOLD_KM + 0.01);
      // Les deux points tombent bien de part et d'autre du seuil de `approachMode` (> 900 = avion).
      expect(distanceKm(ANNECY, under)).toBeLessThanOrEqual(FLIGHT_THRESHOLD_KM);
      expect(distanceKm(ANNECY, over)).toBeGreaterThan(FLIGHT_THRESHOLD_KM);
      const near = await planTravelLeg(input({ transport: false, target: under }), deps({ failure: null }));
      expect(near).toMatchObject(nothingPriced);
      // 900 km × 1,3 à 80 km/h : 14 h 38.
      expect(near.notes).toEqual([
        '14 h 38 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.',
      ]);
      const far = await planTravelLeg(input({ transport: false, target: over }), deps({ failure: null }));
      expect(far).toMatchObject(nothingPriced);
      expect(far.notes).toEqual([]);
    });

  });

  it('un vol n’a pas de durée connue : pas de note', async () => {
    const leg = await planTravelLeg(
      input({ target: { lat: 40.08, lon: 9.03 }, destination: { name: 'Sardaigne', countryCode: 'IT' } }),
      deps({ km: 1100, minutes: 840, end: null })
    );
    expect(leg.transport?.mode).toBe('avion');
    expect(leg.notes).toEqual([]);
  });
});

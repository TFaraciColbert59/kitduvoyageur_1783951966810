import { describe, expect, it } from 'vitest';
import { nearestAirportIn, type AirportRow } from '../engine/airports';
import {
  HOME_ORIGIN_NOTE,
  dayTripNote,
  homeForLeg,
  isHomeOrigin,
  originFact,
  planTravelLeg,
  travelDigest,
  travelFactsForAi,
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
    // L'aéroport le plus proche du domicile le désigne autant que son nom : il n'est pas rangé,
    // seul l'aéroport d'arrivée (la destination du voyage) l'est.
    expect(leg.transport).toMatchObject({ mode: 'avion', departure: 'ton domicile' });
    expect(leg.transport).not.toHaveProperty('route');
    // Aucune distance dans le texte rangé : « environ 790 km » (de l'aéroport le plus proche du domicile
    // à CAG) en déduirait la commune.
    expect(leg.transport?.basis).toBe('vol aller-retour depuis ton domicile vers CAG (Cagliari Elmas Airport)');
    expect(leg.transport?.basis).not.toMatch(/\bkm\b/);
    expect(travelDigest(leg.transport)).toBe('vol à prévoir (depuis ton domicile)');
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

/**
 * Rien de ce qui est rangé sur le voyage (trip_expenses.metadata.basis, autofill_result.summary,
 * lisibles par les collaborateurs et, pour un voyage public, par tous) ne désigne le domicile :
 * ni son nom, ni son pays, ni l'aéroport ou le corridor de rail qui le dessert.
 */
describe('rien de rangé ne désigne le domicile', () => {
  const LIEGE = { name: 'Liège', lat: 50.63, lon: 5.57, countryCode: 'BE' };
  const ANNECY = { lat: 45.9, lon: 6.13 };
  const TORONTO = { name: 'Toronto', lat: 43.65, lon: -79.38, countryCode: 'CA' };
  const NEW_YORK = { lat: 40.71, lon: -74.0 };
  const stored = (leg: Awaited<ReturnType<typeof planTravelLeg>>) =>
    JSON.stringify([leg.transport, leg.notes, leg.carFuel?.basis, leg.train]);

  it('carburant : le prix moyen des pays du trajet, sans nommer le pays du domicile', async () => {
    const from = (origin: TravelLegInput['origin']) =>
      planTravelLeg(
        input({ origin, target: ANNECY, destination: { name: 'Annecy', countryCode: 'FR' }, days: 5 }),
        deps({ km: 700, minutes: 420, end: ANNECY })
      );
    const home = await from(travelOrigin(null, null, LIEGE));
    expect(home.transport?.mode).toBe('voiture');
    expect(home.carFuel?.fuelSource).toBe('bulletin');
    expect(home.carFuel?.basis).toContain('moyenne des pays du trajet');
    expect(stored(home)).not.toMatch(/\bBE\b/);
    // Le prix reste celui des deux pays : seule la mention du pays de départ disparaît.
    const said = await from(travelOrigin({ name: 'Liège', lat: 50.63, lon: 5.57, countryCode: 'BE' }, null));
    expect(said.carFuel?.basis).toMatch(/BE 1,96 €\/L, FR 2,21 €\/L/);
    expect(home.carFuel?.fuelEur).toBe(said.carFuel?.fuelEur);
  });

  it('vol : ni l’IATA ni le nom de l’aéroport du domicile, mais celui de la destination', async () => {
    const leg = await planTravelLeg(
      input({ target: SARDAIGNE, destination: { name: 'Sardaigne', countryCode: 'IT' } }),
      deps({ km: 1100, minutes: 840, end: null })
    );
    expect(leg.transport?.mode).toBe('avion');
    // (La note de domicile cite « depuis Lyon » en exemple de demande : ce n'est pas le domicile.)
    expect(stored(leg)).not.toMatch(/LYS|Saint-Exup|Villeurbanne/);
    expect(stored(leg)).toContain('CAG');
    // Un départ dit reste nommé : c'est la personne qui l'a écrit dans sa demande.
    const said = await planTravelLeg(
      input({ origin: travelOrigin(HOME, null), target: SARDAIGNE, destination: { name: 'Sardaigne', countryCode: 'IT' } }),
      deps({ km: 1100, minutes: 840, end: null })
    );
    expect(said.transport).toMatchObject({ route: 'LYS → CAG' });
  });

  it('rail d’Amérique du Nord : le corridor qui dessert le domicile n’est pas nommé', async () => {
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin(null, null, TORONTO),
        target: NEW_YORK,
        destination: { name: 'New York', countryCode: 'US' },
        days: 4,
        carFree: true,
      }),
      deps({ km: 800, minutes: 540, end: NEW_YORK })
    );
    expect(leg.train).not.toBeNull();
    expect(leg.train?.notice).toContain('corridors');
    expect(stored(leg)).not.toMatch(/Empire|Maple|Amtrak|VIA|Toronto|\bCA\b/);
    // Départ dit : le corridor est dit comme avant.
    const said = await planTravelLeg(
      input({
        origin: travelOrigin(TORONTO, null),
        target: NEW_YORK,
        destination: { name: 'New York', countryCode: 'US' },
        days: 4,
        carFree: true,
      }),
      deps({ km: 800, minutes: 540, end: NEW_YORK })
    );
    expect(said.train?.notice).toContain('corridor Empire et Maple Leaf, Amtrak');
  });
});

/**
 * Ce qui se range sur le voyage (titres, bases, notes : lisibles par les collaborateurs et, pour un voyage
 * public, par tous) ne dit ni km ni durée exacte d'un trajet qui PART du domicile : la distance au lieu
 * du voyage, avec le pays, désigne la commune. Un départ dit (« depuis Lyon ») garde ses mesures : la
 * personne les a écrites elle-même dans sa demande.
 */
describe('rien de rangé ne chiffre la distance depuis le domicile (titres, bases, notes)', () => {
  const MEASURE = /\d[\d\s.,]*\s*km\b|\bkm de voie\b|\d+ h \d{2}/;
  const MERCANTOUR = { lat: 44.15, lon: 7.1 };
  const NEW_YORK = { lat: 40.71, lon: -74.0 };
  const TORONTO = { name: 'Toronto', lat: 43.65, lon: -79.38, countryCode: 'CA' };

  it('train : la base rangée ne dit ni les km de voie ni la durée ; d’un départ dit, elle les dit', async () => {
    const run = (origin: TravelLegInput['origin']) =>
      planTravelLeg(
        input({ origin, target: NEW_YORK, destination: { name: 'New York', countryCode: 'US' }, days: 4, carFree: true }),
        deps({ km: 800, minutes: 540, end: NEW_YORK })
      );
    const home = await run(travelOrigin(null, null, TORONTO));
    expect(home.train).not.toBeNull();
    expect(home.train?.basis).not.toMatch(MEASURE);
    expect(home.train?.basis).not.toMatch(/environ/);
    expect(home.transport?.basis).toBe(home.train?.basis);
    // Le prix, lui, reste calculé sur la vraie distance.
    expect(home.train?.eurRoundTrip).toBeGreaterThan(0);
    const said = await run(travelOrigin(TORONTO, null));
    expect(said.train?.basis).toMatch(/environ \d+ km de voie et [\d,]+ h/);
    expect(said.train?.eurRoundTrip).toBe(home.train?.eurRoundTrip);
  });

  it('sans voiture, trajet non chiffré : la note ne dit pas « environ N km à vol d’oiseau » du domicile', async () => {
    const run = (origin: TravelLegInput['origin']) =>
      planTravelLeg(
        input({ origin, target: VERCORS, destination: { name: 'Vercors', countryCode: 'FR' }, days: 3, carFree: true }),
        deps({ km: 30, minutes: 40, end: VERCORS })
      );
    const home = await run(travelOrigin(null, null, HOME));
    const note = home.notes.find((n) => n.startsWith('Sans voiture :'));
    expect(note).toBeDefined();
    expect(note).not.toMatch(MEASURE);
    expect(note).toContain('le trajet d’approche n’est pas chiffré');
    const said = await run(travelOrigin(SAID, null));
    expect(said.notes.find((n) => n.startsWith('Sans voiture :'))).toMatch(/environ \d+ km à vol d’oiseau/);
  });

  it('une seule journée à plus de 3 h : « plus de 3 h » depuis le domicile, la durée exacte d’un départ dit', async () => {
    expect(dayTripNote(1, 200)).toBe('3 h 20 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.');
    expect(dayTripNote(1, 200, false)).toBe('Plus de 3 h de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.');
    expect(dayTripNote(1, 170, false)).toBeNull();
    expect(dayTripNote(2, 200, false)).toBeNull();
    // De bout en bout : sortie de quelques heures partie de loin (temps estimé) puis route mesurée.
    for (const transport of [false, true]) {
      const run = (origin: TravelLegInput['origin']) =>
        planTravelLeg(
          input({ origin, target: MERCANTOUR, destination: { name: 'Mercantour', countryCode: 'FR' }, days: 1, transport }),
          deps({ km: 330, minutes: 200, end: MERCANTOUR })
        );
      const home = await run(travelOrigin(null, null, HOME));
      const homeNote = home.notes.find((n) => n.includes('de trajet aller pour une seule journée'));
      expect(homeNote, `transport ${transport}`).toMatch(/^Plus de 3 h de trajet aller/);
      expect(homeNote).not.toMatch(MEASURE);
      // Même point de départ, mais DIT dans la demande : la durée exacte reste.
      const said = await run(travelOrigin(HOME, null));
      expect(said.notes.find((n) => n.includes('de trajet aller pour une seule journée')), `transport ${transport}`).toMatch(
        /^\d+ h \d{2} de trajet aller/
      );
    }
  });

  it('le texte du vol sans aéroport connu ne dit pas non plus la distance du domicile', async () => {
    const leg = await planTravelLeg(
      input({ origin: travelOrigin(null, null, HOME), target: { lat: -33.9, lon: 151.2 }, destination: { name: 'Sydney', countryCode: 'AU' } }),
      { carRoute: async () => ({ failure: null }), walkKm: async () => 0, airport: () => null }
    );
    expect(leg.transport?.mode).toBe('avion');
    expect(leg.transport?.basis).toBe('vol aller-retour depuis ton domicile vers Sydney');
    expect(leaks([leg.transport, leg.notes])).toBe(false);
  });
});

/**
 * Pour l'IA (un tiers) : un départ du domicile n'envoie ni km, ni minutes, ni km de voie, ni « voyage à
 * l'étranger », ni vol/train/location qui s'en déduisent. La politique de confidentialité dit que rien de
 * ce profil ne lui est envoyé (`privacyPolicy.test.tsx` relit cette phrase contre ce code).
 */
describe('faits envoyés à l’IA : rien de déduit du domicile', () => {
  const FAR = { lat: 40.08, lon: 9.03 };
  const legFrom = (origin: TravelLegInput['origin'], over: Partial<TravelLegInput> = {}, car: CarRouteResult = { km: 110, minutes: 95, end: VERCORS }) =>
    planTravelLeg(input({ origin, ...over }), deps(car));
  /** Tout ce que les faits d'approche peuvent dire de mesuré ou de déduit. */
  const DERIVED = /\d|\bkm\b|\bmin\b|voie|Vol à prévoir|Train à prévoir|Voyage à l’étranger : (oui|non)|mesuré|louer|location/;

  it('route depuis le domicile : « inconnu » et « non communiqué », aucun chiffre', async () => {
    const leg = await legFrom(travelOrigin(null, null, HOME));
    expect(isHomeOrigin(leg.origin)).toBe(true);
    expect(leg.transport).toMatchObject({ mode: 'voiture', km: 110 });
    const facts = travelFactsForAi(leg);
    expect(facts).toEqual({ abroad: 'Voyage à l’étranger : inconnu.', approach: 'Trajet d’approche : non communiqué.', rental: false });
    expect(`${facts.abroad} ${facts.approach}`).not.toMatch(DERIVED);
  });

  it('vol et train depuis le domicile : pareil, ni « vol à prévoir » ni « train à prévoir » ni km de voie', async () => {
    const flight = await legFrom(
      travelOrigin(null, null, HOME),
      { target: FAR, destination: { name: 'Sardaigne', countryCode: 'IT' } },
      { km: 1100, minutes: 840, end: null }
    );
    expect(flight.flight).not.toBeNull();
    expect(flight.abroad).toBe(true);
    const train = await legFrom(
      travelOrigin(null, null, TORONTO_HOME),
      { target: { lat: 40.71, lon: -74.0 }, destination: { name: 'New York', countryCode: 'US' }, days: 4, carFree: true },
      { km: 800, minutes: 540, end: { lat: 40.71, lon: -74.0 } }
    );
    expect(train.train).not.toBeNull();
    for (const leg of [flight, train]) {
      const facts = travelFactsForAi(leg);
      expect(`${facts.abroad} ${facts.approach}`).not.toMatch(DERIVED);
      expect(facts.rental).toBe(false);
    }
  });

  it('un départ dit ou la position de l’appareil gardent leurs faits chiffrés (ils ne viennent pas du profil)', async () => {
    const said = await legFrom(travelOrigin(SAID, null));
    expect(travelFactsForAi(said)).toEqual({
      abroad: 'Voyage à l’étranger : non.',
      approach: 'Trajet d’approche mesuré : 110 km en voiture (95 min) puis 0 km à pied.',
      rental: true,
    });
    const gps = await legFrom(travelOrigin(null, GPS, null), { target: FAR, destination: { name: 'Sardaigne', countryCode: 'IT' } }, { km: 1100, minutes: 840, end: null });
    expect(travelFactsForAi(gps)).toEqual({
      abroad: 'Voyage à l’étranger : oui.',
      approach: 'Vol à prévoir : oui (aller-retour).',
      rental: true,
    });
    expect(travelFactsForAi({ origin: null, abroad: null, transport: null, train: null, flight: null })).toMatchObject({
      abroad: 'Voyage à l’étranger : inconnu.',
      approach: 'Trajet d’approche : non mesuré.',
    });
  });
});
const TORONTO_HOME = { name: 'Toronto', lat: 43.65, lon: -79.38, countryCode: 'CA' };

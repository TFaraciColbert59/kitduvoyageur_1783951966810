import { describe, expect, it, vi } from 'vitest';
import { nearestAirportIn, type AirportPick, type AirportRow } from '../engine/airports';
import { approachMode } from '../engine/autofill';
import { trainTrip } from '../engine/rail';
import { anchorFromOrigin } from '../engine/tripContext';
import {
  ON_SITE_NOTE,
  SAME_AIRPORT_NOTE,
  UNKNOWN_ORIGIN_LINE,
  UNKNOWN_ORIGIN_NOTE,
  abroadCosts,
  abroadOf,
  originFact,
  planTravelLeg,
  travelDigest,
  travelOrigin,
  type CarRouteResult,
  type TravelDeps,
  type TravelLegInput,
  type TravelPoint,
} from '../engine/travel';

/** Lignes réelles d'OurAirports (fichier du 9 oct. 2026). */
const ROWS: AirportRow[] = [
  ['AHO', 'Alghero-Fertilia Airport', 40.632, 8.291, 'IT', 'M'],
  ['AJA', 'Ajaccio Napoléon Bonaparte airport', 41.924, 8.803, 'FR', 'M'],
  ['BRU', 'Brussels Airport', 50.901, 4.484, 'BE', 'L'],
  ['CAG', 'Cagliari Elmas Airport', 39.251, 9.054, 'IT', 'L'],
  ['GVA', 'Geneva International Airport', 46.238, 6.109, 'CH', 'L'],
  ['LYS', 'Lyon Saint-Exupéry Airport', 45.726, 5.09, 'FR', 'L'],
  ['OLB', 'Olbia Costa Smeralda Airport', 40.899, 9.518, 'IT', 'L'],
  ['OST', 'Ostend-Bruges International Airport', 51.2, 2.875, 'BE', 'L'],
];
const LYON = { name: 'Lyon', lat: 45.76, lon: 4.84, countryCode: 'FR' };
const PARIS_GPS = { lat: 48.86, lon: 2.35, name: 'Paris', country: 'France', countryCode: 'FR' };
const VERCORS = { lat: 45.07, lon: 5.55 };
const SARDAIGNE = { lat: 40.08, lon: 9.03 };

type AirportCall = { at: TravelPoint; country: string | null | undefined };

/**
 * Faux routeur et vraie sélection d'aéroports (avec l'indice de pays reçu) sur
 * les lignes ci-dessus ; garde les appels de route et d'aéroport.
 */
function deps(
  car: CarRouteResult | ((from: TravelPoint) => CarRouteResult),
  airport?: TravelDeps['airport'],
  walk: number | ((end: TravelPoint, to: TravelPoint) => number) = 0
) {
  const calls: TravelPoint[][] = [];
  const walkCalls: TravelPoint[][] = [];
  const airportCalls: AirportCall[] = [];
  const d: TravelDeps = {
    carRoute: async (from, to) => {
      calls.push([from, to]);
      return typeof car === 'function' ? car(from) : car;
    },
    walkKm: async (end, to) => {
      walkCalls.push([end, to]);
      return typeof walk === 'function' ? walk(end, to) : walk;
    },
    airport: (p, country) => {
      airportCalls.push({ at: p, country });
      return airport ? airport(p, country) : nearestAirportIn(ROWS, p.lat, p.lon, { country });
    },
  };
  return { d, calls, walkCalls, airportCalls };
}
const input = (over: Partial<TravelLegInput>): TravelLegInput => ({
  origin: travelOrigin(LYON, null),
  target: VERCORS,
  destination: { name: 'Vercors', countryCode: 'FR' },
  days: 3,
  party: 2,
  transport: true,
  ...over,
});

describe('d’où l’on part', () => {
  it('le départ dit passe avant la position ; la position seule ; sinon personne', () => {
    expect(travelOrigin(LYON, PARIS_GPS)).toEqual({ ...LYON, country: null, source: 'dit' });
    expect(travelOrigin(null, PARIS_GPS)).toEqual({ ...PARIS_GPS, source: 'gps' });
    expect(travelOrigin(null, null)).toBeNull();
  });

  it('à l’étranger : oui, non, ou inconnu sans pays de départ', () => {
    expect(abroadOf(travelOrigin(LYON, null), 'IT')).toBe(true);
    expect(abroadOf(travelOrigin(LYON, null), 'FR')).toBe(false);
    expect(abroadOf(null, 'IT')).toBeNull();
    expect(abroadOf(travelOrigin(null, { ...PARIS_GPS, countryCode: null }), 'IT')).toBeNull();
    expect(abroadOf(null, null)).toBe(false);
  });

  it('les codes pays se comparent sans tenir compte de la casse', () => {
    const it = (countryCode: string | null) => travelOrigin({ name: 'Turin', lat: 45.07, lon: 7.69, countryCode }, null);
    expect(abroadOf(it('it'), 'IT')).toBe(false);
    expect(abroadOf(it('IT'), 'it')).toBe(false);
    expect(abroadOf(it(' fr'), 'FR')).toBe(false);
    expect(abroadOf(it('it'), 'FR')).toBe(true);
    expect(abroadOf(it(null), 'IT')).toBeNull();
    expect(abroadOf(it('it'), null)).toBe(false);
  });

  it('dit au spécialiste : jamais un pays supposé', () => {
    expect(`Départ de la personne : ${originFact(null)}.`).toBe('Départ de la personne : inconnu.');
    expect(originFact(travelOrigin(null, PARIS_GPS))).toBe('Paris, France');
    expect(originFact(travelOrigin(null, { ...PARIS_GPS, name: null }))).toBe('position partagée, commune inconnue');
    expect(originFact(travelOrigin(LYON, null))).toBe('Lyon');
  });
});

describe('sans point de départ : rien n’est chiffré', () => {
  it('ni route, ni vol, ni train ; une seule note, exacte ; aucun calcul lancé', async () => {
    for (const where of [
      { target: VERCORS, destination: { name: 'Vercors', countryCode: 'FR' } },
      // Avant : vol « depuis la France », distance depuis Paris.
      { target: SARDAIGNE, destination: { name: 'Sardaigne', countryCode: 'IT' } },
    ]) {
      const { d, calls, airportCalls } = deps({ km: 120, minutes: 95, end: null });
      const leg = await planTravelLeg(input({ origin: null, ...where }), d);
      expect(leg).toMatchObject({ transport: null, carFuel: null, train: null, flight: null, originUnknown: true });
      expect(leg.notes).toEqual([
        'Point de départ inconnu : écris « depuis Lyon » dans ta demande ou partage ta position pour chiffrer le trajet.',
      ]);
      expect(leg.notes).toEqual([UNKNOWN_ORIGIN_NOTE]);
      expect(calls).toEqual([]);
      expect(airportCalls).toEqual([]);
    }
  });

  it('l’écran le dit', () => {
    expect(travelDigest(null, true)).toBe('Trajet non chiffré : point de départ inconnu');
    expect(UNKNOWN_ORIGIN_LINE).toBe('Trajet non chiffré : point de départ inconnu');
    expect(travelDigest(null, false)).toBeNull();
  });

  it('une sortie de quelques heures (pas de module trajet) ne dit rien', async () => {
    const { d, calls } = deps({ km: 120, minutes: 95, end: null });
    const leg = await planTravelLeg(input({ origin: null, transport: false }), d);
    expect(leg).toMatchObject({ transport: null, originUnknown: false, notes: [] });
    expect(calls).toEqual([]);
  });
});

describe('le départ dit passe avant la position', () => {
  it('« depuis Lyon » avec une position à Paris : la route part de Lyon', async () => {
    const { d, calls } = deps({ km: 120, minutes: 95, end: VERCORS });
    const leg = await planTravelLeg(input({ origin: travelOrigin(LYON, PARIS_GPS) }), d);
    expect(calls).toEqual([[{ ...LYON, country: null, source: 'dit' }, VERCORS]]);
    expect(leg.transport).toMatchObject({ mode: 'voiture', km: 120, minutes: 95, departure: 'Lyon' });
    expect(leg.carFuel?.fuelEur).toBeGreaterThan(0);
    expect(leg.notes).toEqual([]);
  });

  it('départ dit absent (lieu non retrouvé) et position partagée : la route part de la position, et le dit', async () => {
    const { d, calls } = deps({ km: 120, minutes: 95, end: VERCORS });
    const leg = await planTravelLeg(input({ origin: travelOrigin(null, PARIS_GPS) }), d);
    expect(calls).toEqual([[{ ...PARIS_GPS, source: 'gps' }, VERCORS]]);
    expect(leg.origin?.source).toBe('gps');
    expect(leg.transport).toMatchObject({ mode: 'voiture', departure: 'ta position' });
    expect(travelDigest(leg.transport)).toBe('120 km de route (depuis ta position)');
  });

  it('aventure préparée autour du départ dit (aucun lieu dit) : sur place, rien d’absurde n’est chiffré', async () => {
    const said = { ...LYON, source: 'dit' as const };
    const { anchor } = anchorFromOrigin(said, 'sejour');
    const { d, calls, airportCalls } = deps({ km: 1, minutes: 1, end: null });
    const leg = await planTravelLeg(
      input({ origin: travelOrigin(said, null), target: anchor, destination: { name: anchor.name, countryCode: anchor.countryCode } }),
      d
    );
    expect(leg).toMatchObject({ transport: null, carFuel: null, train: null, flight: null, abroad: false, originUnknown: false });
    expect(leg.notes).toEqual([ON_SITE_NOTE]);
    expect([calls, airportCalls]).toEqual([[], []]);
  });

  it('déjà sur place : rien à prévoir', async () => {
    const { d } = deps({ km: 1, minutes: 1, end: null });
    const leg = await planTravelLeg(input({ target: { lat: 45.76, lon: 4.84 } }), d);
    expect(leg.transport).toBeNull();
    expect(leg.notes).toEqual([ON_SITE_NOTE]);
  });
});

describe('l’avion d’aéroport à aéroport (OurAirports)', () => {
  it('Lyon → Sardaigne, 3 jours : LYS → CAG, distance entre les deux aéroports', async () => {
    const { d, calls } = deps({ km: 1100, minutes: 840, end: null });
    const leg = await planTravelLeg(
      input({ target: SARDAIGNE, destination: { name: 'Sardaigne', countryCode: 'IT' }, days: 3 }),
      d
    );
    expect(leg.flight).toMatchObject({ from: { iata: 'LYS' }, to: { iata: 'CAG' }, km: 790 });
    expect(leg.transport).toEqual({
      mode: 'avion',
      km: 790,
      minutes: 0,
      walkKm: 0,
      fuelEur: 0,
      basis:
        'vol aller-retour depuis Lyon, LYS → CAG (Lyon Saint-Exupéry Airport → Cagliari Elmas Airport), environ 790 km',
      route: 'LYS → CAG',
      departure: 'Lyon',
    });
    expect(travelDigest(leg.transport)).toBe('vol LYS → CAG à prévoir (depuis Lyon)');
    expect(leg.abroad).toBe(true);
    // Grande île : ni train ni route mesurée.
    expect(calls).toEqual([]);
  });

  it('chaque aéroport est cherché avec le pays de SON lieu : le départ avec le sien, l’arrivée avec le sien', async () => {
    const { d, airportCalls } = deps({ km: 1100, minutes: 840, end: null });
    await planTravelLeg(input({ target: SARDAIGNE, destination: { name: 'Sardaigne', countryCode: 'IT' } }), d);
    expect(airportCalls).toEqual([
      { at: { ...LYON, country: null, source: 'dit' }, country: 'FR' },
      { at: SARDAIGNE, country: 'IT' },
    ]);
  });

  it('pays inconnu : null, jamais un pays supposé', async () => {
    const { d, airportCalls } = deps({ km: 1100, minutes: 840, end: null });
    await planTravelLeg(
      input({
        origin: travelOrigin(null, { lat: 45.76, lon: 4.84, name: null, country: null, countryCode: null }),
        target: SARDAIGNE,
        destination: { name: 'Sardaigne', countryCode: null },
      }),
      d
    );
    expect(airportCalls.map((c) => c.country)).toEqual([null, null]);
  });

  it('l’indice de pays est doux : un lieu français garde l’aéroport suisse tout proche (vraie sélection)', async () => {
    // Cagliari (IT) → Morzine (FR), une journée : avion. Le vrai sélecteur reçoit l'indice « FR » pour
    // Morzine : Genève (CH, à 46 km, ×1,25) passe encore devant Lyon (à 135 km). Le pays de l'aéroport
    // n'est jamais supposé égal à celui du lieu, et « à l'étranger » ne vient que des pays des lieux.
    const { d, airportCalls } = deps({ km: 1100, minutes: 840, end: null });
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin({ name: 'Cagliari', lat: 39.22, lon: 9.12, countryCode: 'IT' }, null),
        target: { lat: 46.18, lon: 6.71 },
        destination: { name: 'Morzine', countryCode: 'FR' },
        days: 1,
      }),
      d
    );
    expect(airportCalls.map((c) => c.country)).toEqual(['IT', 'FR']);
    expect(leg.flight?.from).toMatchObject({ iata: 'CAG', country: 'IT' });
    expect(leg.flight?.to).toMatchObject({ iata: 'GVA', country: 'CH' });
    expect(leg.transport?.route).toBe('CAG → GVA');
    expect(leg.abroad).toBe(true);
  });

  it('sans aéroport connu à un bout : distance du départ au lieu, dite', async () => {
    const { d } = deps({ km: 1100, minutes: 840, end: null }, () => null);
    const leg = await planTravelLeg(
      input({ target: SARDAIGNE, destination: { name: 'Sardaigne', countryCode: 'IT' }, days: 3 }),
      d
    );
    expect(leg.flight).toEqual({ from: null, to: null, km: 718 });
    expect(leg.transport?.basis).toBe('vol aller-retour depuis Lyon vers Sardaigne, environ 718 km');
    expect(leg.transport?.route).toBeUndefined();
    expect(travelDigest(leg.transport)).toBe('vol à prévoir (depuis Lyon)');
  });

  it('route trop longue pour la durée, rail hors de portée : vol, la raison dite', async () => {
    // Départ à 156 km de la cible (la route mesurée en fait 600, soit 6 h 40), sans pays connu
    // (pas de train), une journée : trop de route pour la durée, l'avion prend le relais.
    const { d } = deps({ km: 600, minutes: 400, end: null }, (p) =>
      p.lat > 44.5 ? (nearestAirportIn(ROWS, 45.76, 4.84) as AirportPick) : (nearestAirportIn(ROWS, 40.08, 9.03) as AirportPick)
    );
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin(null, { lat: 45, lon: 5, name: 'Ici', country: null, countryCode: null }),
        target: { lat: 43.6, lon: 5 },
        days: 1,
      }),
      d
    );
    expect(leg.transport?.mode).toBe('avion');
    expect(leg.transport?.basis).toMatch(/^7 h de route à l’aller pour 1 jour : vol aller-retour depuis ta position, LYS → CAG/);
    expect(travelDigest(leg.transport)).toBe('vol LYS → CAG à prévoir (depuis ta position)');
  });

  it('même aéroport aux deux bouts : pas de vol, la route', async () => {
    const same: AirportPick = { iata: 'XXX', name: 'Milieu', km: 250, country: 'FR', lat: 42.75, lon: 5 };
    const { d } = deps({ km: 600, minutes: 400, end: null }, () => same);
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin(null, { lat: 45, lon: 5, name: 'Nord', country: null, countryCode: null }),
        target: { lat: 40.5, lon: 5 },
        destination: { name: 'Sud', countryCode: null },
        days: 1,
      }),
      d
    );
    expect(leg.flight).toBeNull();
    expect(leg.transport).toMatchObject({ mode: 'voiture', km: 600, minutes: 400 });
    // 6 h 40 de route pour une journée (5 h au plus) et pas de vol possible : dit, pas caché ;
    // et c'est une journée à plus de 3 h de trajet aller : signalée aussi, en dernier.
    expect(leg.notes).toEqual([
      SAME_AIRPORT_NOTE,
      '6 h 40 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.',
    ]);
  });

  describe('même aéroport aux deux bouts', () => {
    const same: AirportPick = { iata: 'XXX', name: 'Milieu', km: 250, country: 'FR', lat: 42.75, lon: 5 };
    const nord = travelOrigin(null, { lat: 45, lon: 5, name: 'Nord', country: null, countryCode: null });
    const to = (lat: number) => ({ target: { lat, lon: 5 }, destination: { name: 'Sud', countryCode: null } });

    it('la note exacte, en français', () => {
      expect(SAME_AIRPORT_NOTE).toBe(
        'Trajet d’approche à vérifier : aéroport identique au départ et à l’arrivée, route longue ou non calculée.'
      );
    });

    it('route qui tient dans la durée du voyage : pas de note d’aéroport (la journée longue est signalée à part)', async () => {
      const { d } = deps({ km: 560, minutes: 280, end: null }, () => same);
      const leg = await planTravelLeg(input({ origin: nord, ...to(40.5), days: 1 }), d);
      expect(leg.flight).toBeNull();
      expect(leg.transport).toMatchObject({ mode: 'voiture', km: 560, minutes: 280 });
      expect(leg.notes).not.toContain(SAME_AIRPORT_NOTE);
      expect(leg.notes).toEqual([
        '4 h 40 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.',
      ]);
      // Deux jours : la même route ne dit plus rien du tout.
      const two = await planTravelLeg(input({ origin: nord, ...to(40.5), days: 2 }), d);
      expect(two.transport).toMatchObject({ mode: 'voiture', km: 560, minutes: 280 });
      expect(two.notes).toEqual([]);
    });

    it('route non calculée, estimée plus longue que la durée du voyage : la route estimée, et la note', async () => {
      const { d } = deps({ failure: 'provider_unavailable' }, () => same);
      const leg = await planTravelLeg(input({ origin: nord, ...to(40.5), days: 1 }), d);
      expect(leg.transport).toMatchObject({ mode: 'voiture', km: 650, minutes: 488 });
      expect(leg.notes).toEqual([
        'Trajet en voiture estimé (itinéraire routier non calculé : service de calcul injoignable) : à vérifier, traversée en ferry éventuelle non comptée.',
        SAME_AIRPORT_NOTE,
        '8 h 08 de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.',
      ]);
    });

    it('ni route ni vol possibles : rien n’est chiffré, et la note le dit', async () => {
      const { d } = deps({ failure: 'off_network' }, () => same);
      const leg = await planTravelLeg(input({ origin: nord, ...to(35), days: 10 }), d);
      expect(leg).toMatchObject({ transport: null, carFuel: null, train: null, flight: null, originUnknown: false });
      expect(leg.notes).toEqual([SAME_AIRPORT_NOTE]);
    });
  });

  it('position sans nom de commune, autre continent : aucun lieu inventé, la position est dite', async () => {
    const { d, calls } = deps({ failure: 'off_network' }, () => null);
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin(null, { lat: 45.76, lon: 4.84, name: null, country: null, countryCode: null }),
        target: { lat: 35.68, lon: 139.69 },
        destination: { name: 'Tokyo', countryCode: 'JP' },
        days: 10,
      }),
      d
    );
    expect(leg.transport?.basis).toBe('vol aller-retour depuis ta position vers Tokyo, environ 9892 km');
    expect(leg.flight?.km).toBe(9892);
    expect(leg.abroad).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('route et train (inchangés, depuis le départ retenu)', () => {
  it('route non calculée mais à portée : estimée, dite', async () => {
    const { d } = deps({ failure: 'provider_unavailable' });
    const leg = await planTravelLeg(input({}), d);
    expect(leg.transport).toMatchObject({ mode: 'voiture', km: 123, minutes: 92 });
    expect(leg.notes).toEqual([
      'Trajet en voiture estimé (itinéraire routier non calculé : service de calcul injoignable) : à vérifier, traversée en ferry éventuelle non comptée.',
    ]);
  });

  it('Lyon → Bruxelles en 3 jours, 7 h 10 de route : le train', async () => {
    const { d } = deps({ km: 680, minutes: 430, end: null });
    const leg = await planTravelLeg(
      input({ target: { lat: 50.85, lon: 4.35 }, destination: { name: 'Bruxelles', countryCode: 'BE' }, days: 3 }),
      d
    );
    expect(leg.transport).toMatchObject({ mode: 'train', km: 709, minutes: 417, departure: 'Lyon' });
    expect(leg.train?.railKm).toBe(709);
    expect(travelDigest(leg.transport)).toBe('train, environ 7 h (depuis Lyon)');
  });
});

describe('verrouillé par sonde (le tronc « 5. Venir » n’a pas de banc d’essai)', () => {
  it('Annecy → Bruges, 2 jours : 628 km, le train serait trop long pour le séjour, donc l’avion sans mesurer la route', async () => {
    const { d, calls } = deps({ km: 800, minutes: 480, end: null });
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin({ name: 'Annecy', lat: 45.9, lon: 6.12, countryCode: 'FR' }, null),
        target: { lat: 51.21, lon: 3.22 },
        destination: { name: 'Bruges', countryCode: 'BE' },
        days: 2,
      }),
      d
    );
    expect(leg.train).toBeNull();
    expect(leg.transport).toMatchObject({ mode: 'avion', route: 'GVA → OST', departure: 'Annecy' });
    expect(leg.transport?.basis).toMatch(
      /^vol aller-retour depuis Annecy, GVA → OST \(Geneva International Airport → Ostend-Bruges International Airport\), environ \d+ km$/
    );
    expect(calls).toEqual([]);
  });

  it('le train de l’« avion d’abord » (route mesurée pour écarter une île) est aujourd’hui hors d’atteinte', async () => {
    // `mode === 'avion'` suppose plus de 450 km (2 jours), 600 (3), 900 (4 et plus) à vol d'oiseau ;
    // le rail n'est retenu que si le trajet tient (330, 420, 600 min) : jamais les deux à la fois
    // aujourd'hui (0 cas de 0 à 30 jours, de 150 à 1 200 km). Si ce test casse, un seuil a bougé :
    // l'embranchement est vivant, remplacer cette boucle par une épingle concrète (Annecy → Bruges).
    const reachable: string[] = [];
    for (const days of [0, 1, 2, 3, 4, 5, 6, 10, 30])
      for (let km = 150; km <= 1200; km++) {
        const bruges = { lat: 51.21, lon: 3.22 };
        if (approachMode({ straightKm: km, days }) !== 'avion') continue;
        if (trainTrip({ fromCountry: 'FR', toCountry: 'BE', straightKm: km, roadKm: km, days, to: bruges }))
          reachable.push(`${days} j, ${km} km`);
      }
    expect(reachable).toEqual([]);
  });

  it('Annecy → Ajaccio, 3 jours, 14 h de route avec le ferry : le train est écarté (île), le vol dit pourquoi', async () => {
    const { d, calls } = deps({ km: 700, minutes: 840, end: null });
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin({ name: 'Annecy', lat: 45.9, lon: 6.12, countryCode: 'FR' }, null),
        target: { lat: 41.92, lon: 8.74 },
        destination: { name: 'Ajaccio', countryCode: 'FR' },
        days: 3,
      }),
      d
    );
    expect(calls).toHaveLength(1);
    expect(leg.train).toBeNull();
    expect(leg.transport).toMatchObject({ mode: 'avion', route: 'GVA → AJA' });
    expect(leg.transport?.basis).toMatch(/^14 h de route à l’aller pour 3 jours : vol aller-retour depuis Annecy, GVA → AJA/);
  });

  describe('la marche du bout de la route jusqu’au lieu', () => {
    const end = { lat: 45.1, lon: 5.6 };

    it('la route s’arrête avant le lieu : la marche vient du routeur piéton, arrondie au dixième', async () => {
      const { d, walkCalls } = deps({ km: 120, minutes: 95, end }, undefined, 1.26);
      const leg = await planTravelLeg(input({}), d);
      expect(walkCalls).toEqual([[end, VERCORS]]);
      expect(leg.transport).toMatchObject({ mode: 'voiture', km: 120, minutes: 95, walkKm: 1.3 });
    });

    it('la route arrive au lieu (le routeur rend 0, tolérance d’arrivée) : aucune marche', async () => {
      const { d, walkCalls } = deps({ km: 120, minutes: 95, end }, undefined, 0);
      const leg = await planTravelLeg(input({}), d);
      expect(walkCalls).toEqual([[end, VERCORS]]);
      expect(leg.transport?.walkKm).toBe(0);
    });

    it('pas de dernier point de tracé : on ne demande aucune marche', async () => {
      const { d, walkCalls } = deps({ km: 120, minutes: 95, end: null }, undefined, 5);
      const leg = await planTravelLeg(input({}), d);
      expect(walkCalls).toEqual([]);
      expect(leg.transport?.walkKm).toBe(0);
    });
  });

  describe('un routeur qui plante ne fait pas planter la préparation', () => {
    const boom = (sync: boolean): TravelDeps => {
      const fail = () => new Error('routage injoignable (45.76,4.84 → 45.07,5.55)');
      return {
        carRoute: sync
          ? () => {
              throw fail();
            }
          : async () => {
              throw fail();
            },
        walkKm: async () => 0,
        airport: (p, country) => nearestAirportIn(ROWS, p.lat, p.lon, { country }),
      };
    };

    it.each([
      ['promesse rejetée', false],
      ['exception avant la promesse', true],
    ])('%s : trajet estimé à portée de route, dit, avec une trace sans coordonnées', async (_name, sync) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const leg = await planTravelLeg(input({}), boom(sync));
        expect(leg.transport).toMatchObject({ mode: 'voiture', km: 123, minutes: 92, departure: 'Lyon' });
        expect(leg.notes).toEqual([
          'Trajet en voiture estimé (itinéraire routier non calculé : raison inconnue) : à vérifier, traversée en ferry éventuelle non comptée.',
        ]);
        expect(warn).toHaveBeenCalledTimes(1);
        const text = warn.mock.calls[0].join(' ');
        expect(text).toContain('[compas] trajet d’approche : routage en erreur');
        expect(text).toContain('routage injoignable');
        expect(text).not.toMatch(/45\.76|4\.84|45\.07|5\.55/);
      } finally {
        warn.mockRestore();
      }
    });
  });

  it('module « trajet » absent (sortie de quelques heures) avec un départ connu : rien de chiffré, aucun calcul, pas de note de départ inconnu', async () => {
    const { d, calls, walkCalls, airportCalls } = deps({ km: 120, minutes: 95, end: VERCORS });
    const origin = travelOrigin(LYON, null);
    const leg = await planTravelLeg(input({ origin, transport: false }), d);
    expect(leg).toMatchObject({
      origin,
      transport: null,
      carFuel: null,
      train: null,
      flight: null,
      originUnknown: false,
    });
    expect(leg.notes).not.toContain(UNKNOWN_ORIGIN_NOTE);
    expect([calls, walkCalls, airportCalls]).toEqual([[], [], []]);
  });

  describe('départ dit sans pays connu', () => {
    const sansPays = () => travelOrigin({ name: 'Lyon', lat: 45.76, lon: 4.84, countryCode: null }, null);

    it('« à l’étranger » reste inconnu et le train n’est jamais supposé (pas de pays de départ)', async () => {
      const { d } = deps({ km: 680, minutes: 430, end: null });
      const leg = await planTravelLeg(
        input({ origin: sansPays(), target: { lat: 50.85, lon: 4.35 }, destination: { name: 'Bruxelles', countryCode: 'BE' }, days: 3 }),
        d
      );
      expect(leg.abroad).toBeNull();
      expect(leg.train).toBeNull();
      // Même trajet que « Lyon → Bruxelles en 3 jours » mais sans pays de départ : le vol, pas le train.
      expect(leg.transport).toMatchObject({ mode: 'avion', route: 'LYS → BRU', departure: 'Lyon' });
      expect(leg.transport?.basis).toMatch(/^7 h de route à l’aller pour 3 jours : vol aller-retour depuis Lyon, LYS → BRU/);
    });

    it('le budget : formalités gardées tant qu’on ne sait pas, assurance voyage seulement si on le sait', () => {
      expect(abroadCosts(null)).toEqual({ formalities: true, insurance: false });
      expect(abroadCosts(true)).toEqual({ formalities: true, insurance: true });
      expect(abroadCosts(false)).toEqual({ formalities: false, insurance: false });
    });
  });
});

describe('le trajet en une ligne', () => {
  it('sans départ nommé (résumé d’avant), la ligne reste celle d’avant', () => {
    const t = { mode: 'voiture' as const, km: 412.3, minutes: 250, walkKm: 0.8, fuelEur: 97, basis: '' };
    expect(travelDigest(t)).toBe('412 km de route');
    expect(travelDigest({ ...t, mode: 'avion' })).toBe('vol à prévoir');
  });
});

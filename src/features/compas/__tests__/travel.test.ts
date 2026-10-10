import { describe, expect, it } from 'vitest';
import { nearestAirportIn, type AirportPick, type AirportRow } from '../engine/airports';
import {
  ON_SITE_NOTE,
  UNKNOWN_ORIGIN_LINE,
  UNKNOWN_ORIGIN_NOTE,
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
  ['CAG', 'Cagliari Elmas Airport', 39.251, 9.054, 'IT', 'L'],
  ['GVA', 'Geneva Cointrin International Airport', 46.238, 6.109, 'CH', 'L'],
  ['LYS', 'Lyon Saint-Exupéry Airport', 45.726, 5.09, 'FR', 'L'],
  ['OLB', 'Olbia Costa Smeralda Airport', 40.899, 9.518, 'IT', 'L'],
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
function deps(car: CarRouteResult | ((from: TravelPoint) => CarRouteResult), airport?: TravelDeps['airport']) {
  const calls: TravelPoint[][] = [];
  const airportCalls: AirportCall[] = [];
  const d: TravelDeps = {
    carRoute: async (from, to) => {
      calls.push([from, to]);
      return typeof car === 'function' ? car(from) : car;
    },
    walkKm: async () => 0,
    airport: (p, country) => {
      airportCalls.push({ at: p, country });
      return airport ? airport(p, country) : nearestAirportIn(ROWS, p.lat, p.lon, { country });
    },
  };
  return { d, calls, airportCalls };
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

  it('l’aéroport retenu n’est pas forcé dans le pays du lieu : un aéroport voisin reste celui du lieu', async () => {
    // Un lieu français dont l'aéroport le plus proche est suisse (Genève) : on n'invente pas de pays.
    const { d } = deps({ km: 1100, minutes: 840, end: null }, (p) =>
      p.lat > 46 ? nearestAirportIn(ROWS, 46.2, 6.1) : nearestAirportIn(ROWS, 40.08, 9.03)
    );
    const leg = await planTravelLeg(
      input({
        origin: travelOrigin(null, { lat: 40.1, lon: 9, name: null, country: null, countryCode: null }),
        target: { lat: 46.2, lon: 6.8 },
        destination: { name: 'Morzine', countryCode: 'FR' },
        days: 1,
      }),
      d
    );
    expect(leg.flight?.to).toMatchObject({ iata: 'GVA', country: 'CH' });
    expect(leg.abroad).toBeNull();
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
    // Départ à 500 km de la cible, sans pays connu (pas de train), une journée.
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

describe('le trajet en une ligne', () => {
  it('sans départ nommé (résumé d’avant), la ligne reste celle d’avant', () => {
    const t = { mode: 'voiture' as const, km: 412.3, minutes: 250, walkKm: 0.8, fuelEur: 97, basis: '' };
    expect(travelDigest(t)).toBe('412 km de route');
    expect(travelDigest({ ...t, mode: 'avion' })).toBe('vol à prévoir');
  });
});

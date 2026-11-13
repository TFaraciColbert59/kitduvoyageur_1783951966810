import { describe, expect, it } from 'vitest';
import AIRPORTS from '../data/airports.json';
import { nearestAirportIn, type AirportRow } from '../engine/airports';
import { parseIntentRules } from '../engine/intent';
import { planTravelLeg, travelOrigin, type TravelDeps } from '../engine/travel';

const ROWS = AIRPORTS as unknown as readonly AirportRow[];
const read = (text: string) => parseIntentRules(text, '2026-11-13');
const types = (text: string) => read(text).map((a) => a.type);
const activityOf = (text: string) => {
  const a = read(text).find((x) => x.type === 'set_activity');
  return a && a.type === 'set_activity' ? a.activity : null;
};
const modeOf = (text: string) => {
  const a = read(text).find((x) => x.type === 'set_transport_mode');
  return a && a.type === 'set_transport_mode' ? a.mode : null;
};

describe('audit 13/11 : l’activité avec un tiret', () => {
  it('city-trip, city trip, citytrip', () => {
    expect(activityOf('city-trip Lisbonne en train')).toBe('citytrip');
    expect(activityOf('city trip Lisbonne')).toBe('citytrip');
    expect(activityOf('citytrip Lisbonne')).toBe('citytrip');
  });
  it('road-trip, road trip, roadtrip', () => {
    expect(activityOf('road-trip Islande 10 jours')).toBe('roadtrip');
    expect(activityOf('road trip Islande 10 jours')).toBe('roadtrip');
    expect(activityOf('roadtrip Islande 10 jours')).toBe('roadtrip');
    expect(read('road-trip Islande 10 jours')).toContainEqual({ type: 'set_destination', place: 'Islande' });
  });
  it('week-end et weekend', () => {
    expect(activityOf('week-end ski Chamonix')).toBe('ski');
    expect(activityOf('weekend ski Chamonix')).toBe('ski');
    expect(types('week-end ski Chamonix')).toContain('set_duration');
    expect(types('weekend ski Chamonix')).toContain('set_duration');
  });
  it('trek au Népal : activité, durée, destination', () => {
    const t = types('trek Népal 3 semaines en avion');
    expect(t).toEqual(expect.arrayContaining(['set_activity', 'set_duration', 'set_destination']));
  });
});

describe('audit 13/11 : le moyen de venir dit est lu', () => {
  it('train, avion, voiture', () => {
    expect(modeOf('city-trip Lisbonne en train')).toBe('train');
    expect(modeOf('trek Népal 3 semaines en avion')).toBe('flight');
    expect(modeOf('Lisbonne by train')).toBe('train');
    expect(modeOf('Rome by plane')).toBe('flight');
    expect(modeOf('Annecy 3 jours en voiture')).toBe('car');
    expect(modeOf('vol Paris Lisbonne')).toBe('flight');
  });
  it('« en bus » = sans voiture (aucun barème bus)', () => {
    const a = read('Porto 4 jours en bus');
    expect(a).toContainEqual({ type: 'set_car_free' });
    expect(modeOf('Porto 4 jours en bus')).toBeNull();
  });
  it('pas « en train de », pas de négation, pas de choix deviné', () => {
    expect(modeOf('je suis en train de planifier Lisbonne')).toBeNull();
    expect(modeOf('Lisbonne pas en avion')).toBeNull();
    expect(modeOf('Lisbonne sans avion')).toBeNull();
    expect(modeOf('Lisbonne en train ou en avion')).toBeNull();
    expect(modeOf('Lisbonne sans voiture')).toBeNull();
  });
});

describe('audit 13/11 : l’aéroport international passe avant le domestique', () => {
  const pick = (lat: number, lon: number, country: string, preferLarge = true) =>
    nearestAirportIn(ROWS, lat, lon, { country, preferLarge })?.iata;
  it('Islande : KEF, pas RKV', () => {
    expect(pick(64.15, -21.9, 'IS', false)).toBe('RKV');
    expect(pick(64.15, -21.9, 'IS')).toBe('KEF');
  });
  it('Stockholm : ARN, pas BMA', () => {
    expect(pick(59.33, 18.07, 'SE', false)).toBe('BMA');
    expect(pick(59.33, 18.07, 'SE')).toBe('ARN');
  });
  it('Katmandou et Népal (Pokhara) : KTM', () => {
    expect(pick(27.71, 85.32, 'NP')).toBe('KTM');
    expect(pick(28.21, 83.99, 'NP')).toBe('KTM');
  });
  it('Tatras : KRK, pas TAT', () => {
    expect(pick(49.17, 20.1, 'PL', false)).toBe('TAT');
    expect(pick(49.17, 20.1, 'PL')).toBe('KRK');
  });
  it('sans grand aéroport à 150 km, le plus proche reste (île de Pâques)', () => {
    const near = nearestAirportIn(ROWS, -27.16, -109.43, { country: 'CL' });
    expect(near?.iata).toBeTruthy();
    expect(nearestAirportIn(ROWS, -27.16, -109.43, { country: 'CL', preferLarge: true })?.iata).toBe(near?.iata);
  });
  it('sans l’option, rien ne change (comportement d’avant)', () => {
    expect(nearestAirportIn(ROWS, 64.15, -21.9, { country: 'IS' })?.iata).toBe('RKV');
  });
});

describe('audit 13/11 : « en train » retenu par planTravelLeg', () => {
  const PARIS = { name: 'Paris', lat: 48.86, lon: 2.35, countryCode: 'FR' };
  const LISBONNE = { lat: 38.72, lon: -9.14 };
  const deps = (): TravelDeps => ({
    carRoute: async () => ({ failure: 'off_network' }),
    walkKm: async () => 0,
    airport: (p, country) => nearestAirportIn(ROWS, p.lat, p.lon, { country, preferLarge: true }),
  });
  const base = {
    origin: travelOrigin(PARIS, null),
    target: LISBONNE,
    destination: { name: 'Lisbonne', countryCode: 'PT' },
    days: 4,
    party: 2,
    transport: true,
  };
  it('sans préférence : l’avion (habituel)', async () => {
    const leg = await planTravelLeg(base, deps());
    expect(leg.transport?.mode).toBe('avion');
  });
  it('« en train » : le train si réalisable, sinon le repli est annoncé', async () => {
    const leg = await planTravelLeg({ ...base, preferredMode: 'train' }, deps());
    if (leg.transport?.mode === 'train') expect(leg.train).not.toBeNull();
    else expect(leg.notes.join(' ')).toMatch(/Train demandé|ferroviaire|train/i);
  });
  it('« en avion » depuis un trajet proche : l’avion est retenu', async () => {
    const leg = await planTravelLeg(
      { ...base, target: { lat: 45.76, lon: 4.84 }, destination: { name: 'Lyon', countryCode: 'FR' }, preferredMode: 'flight' },
      deps()
    );
    expect(leg.transport?.mode).toBe('avion');
  });
});

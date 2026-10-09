import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// MET Norway passe par son point d'accès unique (limites, cache en base) : remplacé ici, sans réseau.
vi.mock('@/lib/weather/metnoRequest', () => ({
  metnoForecastUrl: (lat: number, lon: number) => `https://api.met.no/test?lat=${lat}&lon=${lon}`,
  metnoGet: vi.fn(async () => null),
}));

import { destinationZone, getCompasWeather, localToday } from '../server/weather';

/** 9 oct. 13 h UTC : déjà le 10 à Auckland, encore le 9 à Paris et à Los Angeles. */
const NOW = new Date('2026-10-09T13:00:00Z');
const TONGARIRO = { lat: -39.2, lon: 175.58 };
const YOSEMITE = { lat: 37.75, lon: -119.59 };

describe('météo du Compas : « aujourd’hui » de la destination', () => {
  afterEach(() => vi.restoreAllMocks());

  it('destinationZone : le fuseau du lieu, sinon le repli', () => {
    expect(destinationZone(TONGARIRO, 'Europe/Paris')).toBe('Pacific/Auckland');
    expect(destinationZone(YOSEMITE, 'Europe/Paris')).toBe('America/Los_Angeles');
    expect(destinationZone(null, 'Europe/Paris')).toBe('Europe/Paris');
  });

  it('localToday reste importable depuis le serveur météo', () => {
    expect(localToday('Pacific/Auckland', NOW)).toBe('2026-10-10');
  });

  it('calendrier daté au fuseau du départ, pas de Paris', async () => {
    // NASA POWER : réponse vide (tendance inconnue), aucun appel réseau réel.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 200 }));
    const nz = await getCompasWeather({ origin: TONGARIRO, tripDays: [], timeZone: 'Europe/Paris', now: NOW });
    expect(nz?.calendar[0]?.date).toBe('2026-10-10');
    expect(nz?.horizon).toBe('2026-10-19');
    // 10 oct. 3 h UTC : 20 h le 9 en Californie, alors que Paris est déjà au 10.
    const us = await getCompasWeather({
      origin: YOSEMITE,
      tripDays: [],
      timeZone: 'Europe/Paris',
      now: new Date('2026-10-10T03:00:00Z'),
    });
    expect(us?.calendar[0]?.date).toBe('2026-10-09');
  });

  it('le premier jour du voyage donne le fuseau, avant le point de départ', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 200 }));
    // Départ en Californie (encore le 9), voyage en Nouvelle-Zélande (déjà le 10) : le voyage l'emporte.
    const w = await getCompasWeather({
      origin: YOSEMITE,
      tripDays: [{ day: 1, date: '2026-10-10', ...TONGARIRO }],
      timeZone: 'Europe/Paris',
      now: NOW,
    });
    expect(w?.horizon).toBe('2026-10-19');
  });
});

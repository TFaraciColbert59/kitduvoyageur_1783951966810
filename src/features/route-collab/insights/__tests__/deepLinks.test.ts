import { describe, expect, it } from 'vitest';
import { buildItineraryHref, parseItineraryDeepLink } from '../deepLinks';

describe('deepLinks', () => {
  it('lit trip, jour, point, troncon', () => {
    expect(parseItineraryDeepLink(new URLSearchParams('trip=abc-1&jour=3&point=p_9&troncon=s.2'))).toEqual({
      tripId: 'abc-1',
      day: 3,
      pointId: 'p_9',
      sectionId: 's.2',
    });
  });
  it('accepte un objet de paramètres Next (valeurs tableau) et une chaîne', () => {
    expect(parseItineraryDeepLink({ trip: ['x1', 'x2'], jour: '2' })).toEqual({ tripId: 'x1', day: 2 });
    expect(parseItineraryDeepLink('?jour=4')).toEqual({ day: 4 });
  });
  it('valeurs invalides ignorées, jamais corrigées', () => {
    expect(parseItineraryDeepLink('jour=0&trip=<script>&point=&troncon=a b')).toEqual({});
    expect(parseItineraryDeepLink('jour=2.5')).toEqual({});
    expect(parseItineraryDeepLink({})).toEqual({});
  });
  it('construit un lien stable et reste lisible à l’aller-retour', () => {
    const link = { tripId: 't1', day: 2, pointId: 'p1', sectionId: 's1' };
    const href = buildItineraryHref(link);
    expect(href).toBe('/compas/itineraire?trip=t1&jour=2&point=p1&troncon=s1');
    expect(parseItineraryDeepLink(href.split('?')[1])).toEqual(link);
    expect(buildItineraryHref()).toBe('/compas/itineraire');
    expect(buildItineraryHref({ day: 0, tripId: 'bad id' })).toBe('/compas/itineraire');
  });
});

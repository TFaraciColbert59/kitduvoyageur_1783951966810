import { describe, it, expect, vi } from 'vitest';
import {
  buildReverseGeocodeUrl,
  parseReverseGeocode,
  myPositionToPlace,
  withDefaultOrigin,
} from '../myPosition';

const GPS = { latitude: 45.9237, longitude: 6.8694 };

describe('la position reelle nommee', () => {
  it('M1: interroge la route controlee avec la position mesuree', () => {
    expect(buildReverseGeocodeUrl(GPS)).toBe('/api/geocode?lat=45.9237&lon=6.8694');
  });

  it('M2: lit la commune du fournisseur, et rien d invente', () => {
    const parsed = parseReverseGeocode({
      status: 'ok',
      matches: [
        { id: 'a', name: 'Chamonix-Mont-Blanc', context: 'Haute-Savoie', country: 'France', lat: 45.9237, lon: 6.8694, provider: 'photon', precision: 'commune' },
      ],
    });
    expect(parsed).toEqual({ name: 'Chamonix-Mont-Blanc', country: 'France' });
  });

  it('M3: une panne reseau ne donne pas de nom, ne donne pas d erreur non plus', () => {
    expect(parseReverseGeocode({ status: 'unavailable', matches: [] })).toBeNull();
    expect(parseReverseGeocode({ status: 'no_result', matches: [] })).toBeNull();
    expect(parseReverseGeocode(null)).toBeNull();
    expect(parseReverseGeocode({ status: 'ok', matches: [] })).toBeNull();
  });

  it('M4: n accepte pas un resultat mal forme', () => {
    expect(parseReverseGeocode({ status: 'ok', matches: [{ name: '', country: 'France' }] })).toBeNull();
  });

  it('M5: garde la position mesuree et la nomme par la commune', () => {
    const place = myPositionToPlace(GPS, { name: 'Chamonix-Mont-Blanc', country: 'France' });
    expect(place).toEqual({
      id: 'here-45.92370-6.86940',
      name: 'Chamonix-Mont-Blanc',
      country: 'France',
      lat: 45.9237,
      lon: 6.8694,
    });
  });

  it('M6: sans commune resolue, la position garde un nom honnete', () => {
    const place = myPositionToPlace(GPS, null);
    expect(place.name).toBe('Ma position');
    expect(place.country).toBe('');
    expect(place.lat).toBe(45.9237);
  });

  it('M7: le pays n est ecrit que si le fournisseur l a dit', () => {
    expect(myPositionToPlace(GPS, { name: 'Chamonix-Mont-Blanc', country: '' }).country).toBe('');
  });
});

describe('le depart par defaut', () => {
  const route = { origin: null, destination: null, shape: 'aller_simple' } as const;

  it('M8: remplit un depart vide avec la position mesuree', () => {
    const place = myPositionToPlace(GPS, { name: 'Chamonix-Mont-Blanc', country: 'France' });
    expect(withDefaultOrigin(route, place).origin).toEqual(place);
  });

  it('M9: n ecrase jamais un depart choisi a la main', () => {
    const chosen = { id: 'x', name: 'Gare de Lyon', country: 'France', lat: 48.84, lon: 2.37 };
    expect(withDefaultOrigin({ ...route, origin: chosen }, myPositionToPlace(GPS, null)).origin).toBe(chosen);
  });

  it('M10: sans position lue, le depart reste ce qu il est', () => {
    expect(withDefaultOrigin(route, null)).toBe(route);
  });

  it('M11: n invente jamais l arrivee', () => {
    const place = myPositionToPlace(GPS, { name: 'Chamonix-Mont-Blanc', country: 'France' });
    // Partir et revenir a sa position n est pas un voyage : l arrivee reste
    // un choix de la personne, sinon le trajet affiche 0 km.
    expect(withDefaultOrigin(route, place).destination).toBeNull();
  });

  it('M12: la regle ne modifie pas le brouillon d origine', () => {
    const place = myPositionToPlace(GPS, null);
    const before = JSON.stringify(route);
    withDefaultOrigin(route, place);
    expect(JSON.stringify(route)).toBe(before);
  });
});

import { describe, expect, it } from 'vitest';
import {
  parseGeoPoint,
  routeTraceFromMapPoints,
  shouldFetchWeather,
  weatherLabel,
} from '../communityDetails';

/** Construit l'EWKB hexadécimal d'un point, tel que PostgREST le renvoie. */
function ewkbPoint(
  lng: number,
  lat: number,
  options: { little?: boolean; srid?: number | null } = {},
): string {
  const little = options.little ?? true;
  const srid = options.srid === undefined ? 4326 : options.srid;
  const bytes: number[] = [little ? 1 : 0];
  const header = new DataView(new ArrayBuffer(4));
  header.setUint32(0, 1 | (srid != null ? 0x20000000 : 0), little);
  for (let index = 0; index < 4; index += 1) bytes.push(header.getUint8(index));
  if (srid != null) {
    header.setUint32(0, srid, little);
    for (let index = 0; index < 4; index += 1) bytes.push(header.getUint8(index));
  }
  const coords = new DataView(new ArrayBuffer(16));
  coords.setFloat64(0, lng, little);
  coords.setFloat64(8, lat, little);
  for (let index = 0; index < 16; index += 1) bytes.push(coords.getUint8(index));
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('parseGeoPoint', () => {
  it('décode un EWKB little endian avec SRID 4326', () => {
    expect(parseGeoPoint(ewkbPoint(6.8694, 45.9192))).toEqual({ lat: 45.9192, lng: 6.8694 });
  });

  it('décode un EWKB big endian sans SRID', () => {
    expect(parseGeoPoint(ewkbPoint(2.3522, 48.8566, { little: false, srid: null }))).toEqual({
      lat: 48.8566,
      lng: 2.3522,
    });
  });

  it('accepte le préfixe `\\x` de psql et un GeoJSON Point', () => {
    expect(parseGeoPoint(`\\x${ewkbPoint(6.87, 45.92)}`)).toEqual({ lat: 45.92, lng: 6.87 });
    expect(parseGeoPoint({ type: 'Point', coordinates: [6.87, 45.92] })).toEqual({ lat: 45.92, lng: 6.87 });
  });

  it('renvoie null pour une valeur absente, invalide ou hors bornes', () => {
    expect(parseGeoPoint(null)).toBeNull();
    expect(parseGeoPoint('')).toBeNull();
    expect(parseGeoPoint('pas un point')).toBeNull();
    expect(parseGeoPoint(ewkbPoint(6.87, 95))).toBeNull();
    expect(parseGeoPoint({ type: 'LineString', coordinates: [] })).toBeNull();
    // Un point sans les 16 octets de coordonnées (en-tête seul) est refusé.
    expect(parseGeoPoint('0101000020e6100000')).toBeNull();
  });
});

describe('routeTraceFromMapPoints', () => {
  it('lit la clé `trace` de l’objet map_points', () => {
    const trace = [
      [6.1, 45.1],
      [6.2, 45.2],
    ];
    expect(routeTraceFromMapPoints({ trace, days: [] })).toBe(trace);
  });

  it('accepte un tableau brut et renvoie null sinon', () => {
    expect(routeTraceFromMapPoints([[6, 45]])).toEqual([[6, 45]]);
    expect(routeTraceFromMapPoints({ days: [] })).toBeNull();
    expect(routeTraceFromMapPoints(null)).toBeNull();
  });
});

describe('météo du jour J', () => {
  const NOW = new Date('2026-11-08T10:00:00+01:00');

  it('ne demande la météo que dans la fenêtre J-7 → aujourd’hui', () => {
    expect(shouldFetchWeather('2026-11-08', NOW)).toBe(true);
    expect(shouldFetchWeather('2026-11-15', NOW)).toBe(true);
    expect(shouldFetchWeather('2026-11-16', NOW)).toBe(false);
    expect(shouldFetchWeather('2026-11-01', NOW)).toBe(false);
    expect(shouldFetchWeather('date inconnue', NOW)).toBe(false);
  });

  it('traduit les symboles MET Norway en libellés français', () => {
    expect(weatherLabel('clearsky_day')).toBe('Ensoleillé');
    expect(weatherLabel('partlycloudy_night')).toBe('Éclaircies');
    expect(weatherLabel('cloudy')).toBe('Nuageux');
    expect(weatherLabel('lightrain')).toBe('Averses');
    expect(weatherLabel('heavysnow')).toBe('Forte neige');
    expect(weatherLabel('thunderstorm')).toBe('Orage');
    expect(weatherLabel(null)).toBe('Météo');
  });
});

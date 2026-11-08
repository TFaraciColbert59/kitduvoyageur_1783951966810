import { describe, expect, it } from 'vitest';
import { slugifyClubName, isValidClubSlug } from '../club/slug';
import { parseGeoJsonTrace, parseGpxTrace } from '../carnet/gpx';
import { HAS_CARNET_NIGHTS } from '../carnet/capabilities';

describe('slug de club (Club#5)', () => {
  it('normalise comme le SQL : accents, casse, tirets', () => {
    expect(slugifyClubName('La Cordée du Vercors')).toBe('la-cordee-du-vercors');
    expect(slugifyClubName('  Écrins !! 2026 ')).toBe('ecrins-2026');
    expect(slugifyClubName('---')).toBe('');
    expect(slugifyClubName('a'.repeat(80))).toHaveLength(60);
  });

  it('valide la forme d’une adresse', () => {
    expect(isValidClubSlug('la-cordee-du-vercors')).toBe(true);
    expect(isValidClubSlug('c')).toBe(false);
    expect(isValidClubSlug('-debut')).toBe(false);
    expect(isValidClubSlug('majuscules')).toBe(true);
    expect(isValidClubSlug('a b')).toBe(false);
  });
});

describe('import de trace (Carnet#6)', () => {
  it('lit les trkpt d’un GPX et ignore les points hors bornes', () => {
    const gpx = `<?xml version="1.0"?><gpx><trk><trkseg>
      <trkpt lat="45.92" lon="6.87"></trkpt>
      <trkpt lat="45.93" lon="6.88"></trkpt>
      <trkpt lat="999" lon="6.89"></trkpt>
      <trkpt lat="45.94" lon="6.89"></trkpt>
    </trkseg></trk></gpx>`;
    expect(parseGpxTrace(gpx)).toEqual([
      [6.87, 45.92],
      [6.88, 45.93],
      [6.89, 45.94],
    ]);
  });

  it('lit un GeoJSON LineString (sortie enregistrée)', () => {
    const geojson = JSON.stringify({
      type: 'LineString',
      coordinates: [
        [6.87, 45.92],
        [6.88, 45.93],
        [6.88, 45.93],
      ],
    });
    expect(parseGeoJsonTrace(geojson)).toEqual([
      [6.87, 45.92],
      [6.88, 45.93],
    ]);
  });

  it('lit une FeatureCollection de lignes', () => {
    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'LineString', coordinates: [[6.1, 44.1], [6.2, 44.2]] } },
        { type: 'Feature', geometry: { type: 'LineString', coordinates: [[6.3, 44.3], [6.4, 44.4]] } },
      ],
    });
    expect(parseGeoJsonTrace(geojson)).toHaveLength(4);
  });

  it('retourne un tableau vide pour un format inconnu', () => {
    expect(parseGeoJsonTrace('{"type":"Point","coordinates":[6,45]}')).toEqual([]);
    expect(parseGpxTrace('<gpx></gpx>')).toEqual([]);
    expect(parseGeoJsonTrace(null)).toEqual([]);
  });

  it('les nuits du carnet sont masquées tant que carnet_nights n’existe pas en prod', () => {
    expect(HAS_CARNET_NIGHTS).toBe(false);
  });
});

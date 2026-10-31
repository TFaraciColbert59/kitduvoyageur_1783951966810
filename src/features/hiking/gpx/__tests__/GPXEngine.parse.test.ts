// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { GPXEngine } from '../GPXEngine';
import type { GPSPosition, Waypoint } from '../../types';

/**
 * Contrat de parsing/export GPX (hors zones protégées HUB/Compas).
 *
 * Le parseur historique interrogeait le DOM point par point
 * (`querySelector('ele')`/`('time')` sur chaque `<trkpt>`), ce qui coûte cher
 * sur une trace de plusieurs milliers de points. Ces tests verrouillent le
 * comportement attendu avant optimisation : mêmes champs, mêmes valeurs, mêmes
 * erreurs — la performance est mesurée séparément par `npm run perf:gpx`.
 */

const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Tour du Lac</name>
    <desc>Boucle facile</desc>
  </metadata>
  <wpt lat="45.284" lon="5.8675">
    <name>Refuge du Habert</name>
    <ele>1240.4</ele>
  </wpt>
  <trk>
    <name>Trace principale</name>
    <trkseg>
      <trkpt lat="45.2833" lon="5.8667">
        <ele>1200.2</ele>
        <time>2026-08-09T08:00:00Z</time>
      </trkpt>
      <trkpt lat="45.284" lon="5.8675">
        <ele>1240.9</ele>
        <time>2026-08-09T08:05:00Z</time>
      </trkpt>
      <trkpt lat="45.285" lon="5.868">
        <time>2026-08-09T08:10:00Z</time>
      </trkpt>
      <trkpt lat="bad" lon="5.869" />
      <trkpt lon="5.87" />
    </trkseg>
  </trk>
</gpx>`;

describe('GPXEngine · parseGPX', () => {
  it('extrait titre, description, points valides et waypoints', () => {
    const parsed = GPXEngine.parseGPX(GPX);
    expect(parsed.title).toBe('Tour du Lac');
    expect(parsed.description).toBe('Boucle facile');
    expect(parsed.positions).toHaveLength(3);
    expect(parsed.positions[0]).toMatchObject({
      latitude: 45.2833,
      longitude: 5.8667,
      altitude: 1200.2,
    });
    expect(parsed.positions[0].timestamp).toBe(Date.parse('2026-08-09T08:00:00Z'));
    expect(parsed.positions[2].altitude).toBeUndefined();
    expect(parsed.waypoints).toEqual([
      { id: 'wpt-1', name: 'Refuge du Habert', lat: 45.284, lon: 5.8675, elevationM: 1240.4 },
    ]);
  });

  it('refuse un XML corrompu avec un message explicite', () => {
    expect(() => GPXEngine.parseGPX('<gpx><trk>')).toThrow(/invalide|corrompu/i);
  });

  it('tolère un GPX sans nom ni point', () => {
    const parsed = GPXEngine.parseGPX('<gpx version="1.1"><trk><trkseg></trkseg></trk></gpx>');
    expect(parsed.title).toBe('Tracé GPX Importé');
    expect(parsed.positions).toEqual([]);
    expect(parsed.waypoints).toEqual([]);
  });

  it('parse 10 000 points sans perdre de coordonnée', () => {
    const points = Array.from(
      { length: 10_000 },
      (_, index) => `<trkpt lat="${45 + index * 1e-4}" lon="${6 + index * 1e-4}"><ele>${1000 + index}</ele></trkpt>`,
    ).join('');
    const parsed = GPXEngine.parseGPX(`<gpx version="1.1"><trk><trkseg>${points}</trkseg></trk></gpx>`);
    expect(parsed.positions).toHaveLength(10_000);
    expect(parsed.positions[0].latitude).toBeCloseTo(45, 6);
    expect(parsed.positions[9_999].altitude).toBe(10_999);
  });
});

describe('GPXEngine · exportGPX', () => {
  const positions: GPSPosition[] = [
    { latitude: 45.2833, longitude: 5.8667, altitude: 1200, timestamp: 1723190400000 },
    { latitude: 45.284, longitude: 5.8675, altitude: 1240, timestamp: 1723190700000 },
  ];
  const waypoints: Waypoint[] = [
    { id: 'w1', name: 'Refuge <du> Habert & Cie', lat: 45.284, lon: 5.8675, elevationM: 1240 },
  ];

  it('produit un GPX 1.1 lisible et échappe le XML', () => {
    const xml = GPXEngine.exportGPX(positions, waypoints, 'Randonnée <test> & co');
    expect(xml).toContain('<gpx version="1.1"');
    expect(xml).toContain('<name>Randonnée &lt;test&gt; &amp; co</name>');
    expect(xml).toContain('<name>Refuge &lt;du&gt; Habert &amp; Cie</name>');
    expect(xml).toContain('<trkpt lat="45.2833" lon="5.8667">');
  });

  it('fait un aller-retour export → parse sans perte', () => {
    const xml = GPXEngine.exportGPX(positions, waypoints, 'Aller-retour');
    const parsed = GPXEngine.parseGPX(xml);
    expect(parsed.positions).toHaveLength(positions.length);
    expect(parsed.positions[0].latitude).toBeCloseTo(positions[0].latitude, 6);
    expect(parsed.positions[1].altitude).toBeCloseTo(1240, 1);
    expect(parsed.waypoints[0]).toMatchObject({ lat: 45.284, lon: 5.8675, elevationM: 1240 });
  });
});

describe('GPXEngine · extractCoordinates', () => {
  it('lit trkpt, rtept et wpt dans l’ordre du document, en [lng, lat]', () => {
    const xml = `<gpx>
      <wpt lat="45.1" lon="6.1"/>
      <rte><rtept lat="45.2" lon="6.2"/></rte>
      <trk><trkseg><trkpt lat="45.3" lon="6.3"/></trkseg></trk>
    </gpx>`;
    expect(GPXEngine.extractCoordinates(xml)).toEqual([
      [6.1, 45.1],
      [6.2, 45.2],
      [6.3, 45.3],
    ]);
  });

  it('ignore les attributs manquants ou non numériques', () => {
    const xml = '<gpx><trkpt lat="abc" lon="6.1"/><trkpt lat="45.2"/><trkpt lat="45.3" lon="6.3"/></gpx>';
    expect(GPXEngine.extractCoordinates(xml)).toEqual([[6.3, 45.3]]);
  });
});

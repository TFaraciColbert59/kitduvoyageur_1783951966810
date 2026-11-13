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
  it('lit les trkpt dans l’ordre du document, en [lng, lat]', () => {
    const xml = `<gpx><trk><trkseg>
      <trkpt lat="45.3" lon="6.3"/>
      <trkpt lat="45.4" lon="6.4"><ele>1200</ele></trkpt>
    </trkseg></trk></gpx>`;
    expect(GPXEngine.extractCoordinates(xml)).toEqual([
      [6.3, 45.3],
      [6.4, 45.4],
    ]);
  });

  it('lit lon avant lat (ordre des attributs libre)', () => {
    const xml = '<gpx><trk><trkseg><trkpt lon="6.3" lat="45.3"/><trkpt lon="6.4" lat="45.4"/></trkseg></trk></gpx>';
    expect(GPXEngine.extractCoordinates(xml)).toEqual([
      [6.3, 45.3],
      [6.4, 45.4],
    ]);
  });

  it('accepte les guillemets simples, les espaces autour du = et un autre attribut entre les deux', () => {
    const xml = "<gpx><trkpt lon = '6.3' fix='3d' lat='-45.3'/><trkpt  lat = \"45.4\"\n  lon=\"-6.4\" /></gpx>";
    expect(GPXEngine.extractCoordinates(xml)).toEqual([
      [6.3, -45.3],
      [-6.4, 45.4],
    ]);
  });

  it('accepte les exposants, les signes + et un préfixe d’espace de noms', () => {
    const xml = '<g:gpx><g:trkpt lat="4.5e1" lon="+6.5"/></g:gpx>';
    expect(GPXEngine.extractCoordinates(xml)).toEqual([[6.5, 45]]);
  });

  it('ne mêle jamais les wpt (points d’intérêt) au tracé quand une trace existe', () => {
    const xml = `<gpx>
      <wpt lat="45.9237" lon="6.8694"><name>Aiguille du Midi</name></wpt>
      <trk><trkseg><trkpt lat="45.97" lon="6.89"/><trkpt lat="45.98" lon="6.9"/></trkseg></trk>
      <wpt lat="45.8326" lon="6.8652"/>
    </gpx>`;
    expect(GPXEngine.extractCoordinates(xml)).toEqual([
      [6.89, 45.97],
      [6.9, 45.98],
    ]);
  });

  it('retombe sur les rtept sans trkpt, sans les wpt', () => {
    const xml = `<gpx><wpt lat="45.1" lon="6.1"/>
      <rte><rtept lat="45.2" lon="6.2"/><rtept lat="45.3" lon="6.3"/></rte></gpx>`;
    expect(GPXEngine.extractCoordinates(xml)).toEqual([
      [6.2, 45.2],
      [6.3, 45.3],
    ]);
    expect(GPXEngine.extractTrack(xml).kind).toBe('route');
  });

  it('rend un tableau vide pour un fichier sans trace (wpt seuls, vide, texte)', () => {
    expect(GPXEngine.extractCoordinates('<gpx><wpt lat="45.1" lon="6.1"/></gpx>')).toEqual([]);
    expect(GPXEngine.extractCoordinates('<gpx></gpx>')).toEqual([]);
    expect(GPXEngine.extractCoordinates('')).toEqual([]);
    expect(GPXEngine.extractCoordinates('pas du XML')).toEqual([]);
    expect(GPXEngine.extractTrack('<gpx/>').kind).toBeNull();
  });

  it('n’invente aucun point : attribut absent, vide, non numérique ou hors bornes', () => {
    const xml = `<gpx>
      <trkpt lat="abc" lon="6.1"/>
      <trkpt lat="45.2"/>
      <trkpt lon="6.2"/>
      <trkpt lat="" lon=""/>
      <trkpt lat="95" lon="6.1"/>
      <trkpt lat="45.1" lon="190"/>
      <trkpt lat="45.3" lon="6.3"/>
    </gpx>`;
    expect(GPXEngine.extractCoordinates(xml)).toEqual([[6.3, 45.3]]);
  });

  it('respecte la limite de points', () => {
    const xml = `<gpx>${Array.from({ length: 10 }, (_, i) => `<trkpt lat="45.${i}" lon="6.${i}"/>`).join('')}</gpx>`;
    expect(GPXEngine.extractCoordinates(xml, 4)).toHaveLength(4);
    expect(GPXEngine.extractCoordinates(xml, 0)).toEqual([]);
  });
});

describe('GPXEngine · extractTrack et dénivelé', () => {
  it('aligne les altitudes sur les points (null quand absente)', () => {
    const xml = `<gpx><trk><trkseg>
      <trkpt lat="45.1" lon="6.1"><ele>1000.5</ele></trkpt>
      <trkpt lat="45.2" lon="6.2"/>
      <trkpt lat="45.3" lon="6.3"><time>2026-01-01T00:00:00Z</time></trkpt>
      <trkpt lon="6.4" lat="45.4"><ele>1100</ele></trkpt>
    </trkseg></trk></gpx>`;
    const track = GPXEngine.extractTrack(xml);
    expect(track.kind).toBe('track');
    expect(track.coordinates).toHaveLength(4);
    expect(track.elevations).toEqual([1000.5, null, null, 1100]);
  });

  it('ne lit pas l’altitude du point suivant pour un trkpt auto-fermant', () => {
    const xml = '<gpx><trkpt lat="45.1" lon="6.1"/><trkpt lat="45.2" lon="6.2"><ele>900</ele></trkpt></gpx>';
    expect(GPXEngine.extractTrack(xml).elevations).toEqual([null, 900]);
  });

  it('cumule le dénivelé positif en ignorant le bruit sous le seuil', () => {
    expect(GPXEngine.elevationGain([1000, 1001, 1000, 1002, 1100, 1090, 1150])).toBe(160);
    expect(GPXEngine.elevationGain([1000, null])).toBeNull();
    expect(GPXEngine.elevationGain([])).toBeNull();
  });
});

describe('GPXEngine · segments (plusieurs trkseg / trk)', () => {
  const xml = `<gpx>
    <trk><trkseg>
      <trkpt lat="45.00" lon="6.00"><ele>1000</ele></trkpt>
      <trkpt lat="45.00" lon="6.02"><ele>1100</ele></trkpt>
    </trkseg><trkseg>
      <trkpt lat="45.00" lon="6.60"><ele>2000</ele></trkpt>
      <trkpt lat="45.00" lon="6.62"><ele>2150</ele></trkpt>
    </trkseg></trk>
    <trk><trkseg>
      <trkpt lat="46.00" lon="7.00"/><trkpt lat="46.00" lon="7.02"/>
    </trkseg></trk>
  </gpx>`;

  it('expose un segment par trkseg et par trk, sans les relier', () => {
    const track = GPXEngine.extractTrack(xml);
    expect(track.segments).toHaveLength(3);
    expect(track.segments.map((s) => s.coordinates.length)).toEqual([2, 2, 2]);
    expect(track.segments[1].coordinates[0]).toEqual([6.6, 45]);
    expect(track.coordinates).toHaveLength(6);
  });

  it('somme le dénivelé segment par segment (pas de saut d’altitude entre segments)', () => {
    const track = GPXEngine.extractTrack(xml);
    // 1000→1100 (+100) et 2000→2150 (+150) ; le saut 1100→2000 n'existe pas.
    expect(GPXEngine.segmentsElevationGain(track.segments)).toBe(250);
    expect(GPXEngine.elevationGain(track.elevations)).toBeGreaterThan(250);
    expect(GPXEngine.segmentsElevationGain([{ coordinates: [[6, 45]], elevations: [null] }])).toBeNull();
  });

  it('sépare aussi les rte', () => {
    const route = '<gpx><rte><rtept lat="45" lon="6"/><rtept lat="45" lon="6.1"/></rte><rte><rtept lat="46" lon="7"/><rtept lat="46" lon="7.1"/></rte></gpx>';
    const track = GPXEngine.extractTrack(route);
    expect(track.kind).toBe('route');
    expect(track.segments).toHaveLength(2);
  });

  it('fromCoordinates produit un GPX relu à l’identique', () => {
    const coords: Array<[number, number]> = [[6.1, 45.1], [6.2, 45.2], [6.3, 45.3]];
    expect(GPXEngine.extractCoordinates(GPXEngine.fromCoordinates(coords, 'A & B'))).toEqual(coords);
  });
});

describe('GPXEngine · entrées pathologiques en coût linéaire (< 200 ms)', () => {
  const timed = (fn: () => unknown): number => {
    const t0 = performance.now();
    fn();
    return performance.now() - t0;
  };

  it('0,4 Mo de <trkpt  sans > termine vite et ne rend aucun point', () => {
    const xml = '<gpx>' + '<trkpt '.repeat(Math.floor(400_000 / 8));
    let out: unknown;
    const ms = timed(() => {
      out = GPXEngine.extractCoordinates(xml);
    });
    expect(out).toEqual([]);
    expect(ms).toBeLessThan(200);
  });

  it('20 000 trkpt sans </trkpt termine vite et lit les 20 000 points', () => {
    const xml = '<gpx>' + Array.from({ length: 20_000 }, (_, i) => `<trkpt lat="45.${i % 1000}" lon="6.${i % 1000}">`).join('') + '</gpx>';
    let out: Array<[number, number]> = [];
    const ms = timed(() => {
      out = GPXEngine.extractCoordinates(xml);
    });
    expect(out).toHaveLength(20_000);
    expect(ms).toBeLessThan(200);
  });

  it('des attributs géants sans > ne sont pas balayés jusqu’à la fin', () => {
    const xml = '<gpx>' + `<trkpt lat="45" ${'x'.repeat(2000)} `.repeat(150) + '</gpx>';
    let out: unknown;
    const ms = timed(() => {
      out = GPXEngine.extractCoordinates(xml);
    });
    expect(out).toEqual([]);
    expect(ms).toBeLessThan(200);
  });

  it('un gros fichier valide (50 000 points) reste correct', () => {
    const xml = '<gpx><trk><trkseg>' + Array.from({ length: 50_000 }, (_, i) => `<trkpt lat="45.${String(i).padStart(5, '0')}" lon="6.5"><ele>${1000 + (i % 10)}</ele></trkpt>`).join('\n') + '</trkseg></trk></gpx>';
    let track = GPXEngine.extractTrack(xml, 100_000);
    const ms = timed(() => {
      track = GPXEngine.extractTrack(xml, 100_000);
    });
    expect(track.coordinates).toHaveLength(50_000);
    expect(track.elevations[3]).toBe(1003);
    expect(track.segments).toHaveLength(1);
    expect(ms).toBeLessThan(500);
  });
});

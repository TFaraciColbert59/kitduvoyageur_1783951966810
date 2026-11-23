import { describe, expect, it } from 'vitest';
import { parseTrackFile, validateGpx11 } from '../formats';

const GPX = `<?xml version="1.0"?>
<gpx version="1.1" creator="t" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Tour test</name></metadata>
  <wpt lat="45.1" lon="6.1"><name>Refuge &amp; Co</name><ele>2100</ele></wpt>
  <trk><name>Autre nom</name><trkseg>
    <trkpt lat="45.0" lon="6.0"><ele>1000.5</ele><time>2026-07-10T06:00:00Z</time></trkpt>
    <trkpt lat="45.01" lon="6.01"/>
    <trkpt lat="abc" lon="6.02"/>
    <trkpt lat="95" lon="6.02"/>
  </trkseg></trk>
</gpx>`;

describe('parseTrackFile', () => {
  it('GPX : points, ele, time, waypoints, nom, points écartés comptés', () => {
    const r = parseTrackFile(GPX, 'a.gpx');
    if (!r.ok) throw new Error('attendu ok');
    expect(r.format).toBe('gpx');
    expect(r.name).toBe('Tour test');
    expect(r.points).toEqual([
      { lat: 45.0, lon: 6.0, ele: 1000.5, time: '2026-07-10T06:00:00Z' },
      { lat: 45.01, lon: 6.01 },
    ]);
    expect(r.waypoints).toEqual([{ lat: 45.1, lon: 6.1, name: 'Refuge & Co', ele: 2100 }]);
    expect(r.skippedPoints).toBe(2);
  });
  it('KML', () => {
    const kml = `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>K</name><Placemark><name>L</name><LineString><coordinates>6.0,45.0,100 6.1,45.1,200</coordinates></LineString></Placemark><Placemark><name>Col</name><Point><coordinates>6.05,45.05</coordinates></Point></Placemark></Document></kml>`;
    const r = parseTrackFile(kml, 'a.kml');
    if (!r.ok) throw new Error('attendu ok');
    expect(r.format).toBe('kml');
    expect(r.name).toBe('K');
    expect(r.points[1]).toEqual({ lat: 45.1, lon: 6.1, ele: 200 });
    expect(r.waypoints[0]).toMatchObject({ name: 'Col', lat: 45.05, lon: 6.05 });
  });
  it('TCX', () => {
    const tcx = `<TrainingCenterDatabase><Activities><Activity Sport="Hiking"><Id>2026-07-10T06:00:00Z</Id><Lap><Track>
      <Trackpoint><Time>2026-07-10T06:00:00Z</Time><Position><LatitudeDegrees>45.0</LatitudeDegrees><LongitudeDegrees>6.0</LongitudeDegrees></Position><AltitudeMeters>900</AltitudeMeters></Trackpoint>
      <Trackpoint><Time>2026-07-10T06:01:00Z</Time></Trackpoint>
    </Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const r = parseTrackFile(tcx, 'a.tcx');
    if (!r.ok) throw new Error('attendu ok');
    expect(r.format).toBe('tcx');
    expect(r.points).toEqual([{ lat: 45.0, lon: 6.0, ele: 900, time: '2026-07-10T06:00:00Z' }]);
  });
  it('GeoJSON : FeatureCollection avec ligne et point', () => {
    const gj = JSON.stringify({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { name: 'Boucle' }, geometry: { type: 'LineString', coordinates: [[6, 45, 1000], [6.1, 45.1]] } },
      { type: 'Feature', properties: { name: 'Source' }, geometry: { type: 'Point', coordinates: [6.05, 45.05] } },
    ] });
    const r = parseTrackFile(gj, 'a.geojson');
    if (!r.ok) throw new Error('attendu ok');
    expect(r.format).toBe('geojson');
    expect(r.name).toBe('Boucle');
    expect(r.points).toEqual([{ lat: 45, lon: 6, ele: 1000 }, { lat: 45.1, lon: 6.1 }]);
    expect(r.waypoints).toEqual([{ lat: 45.05, lon: 6.05, name: 'Source' }]);
  });
  it('FIT lu en texte : refusé, il doit être lu en binaire (5.9)', () => {
    const r = parseTrackFile('\x0e\x10\x00\x00\x00\x00\x00\x00.FIT', 'sortie.fit');
    expect(r).toMatchObject({ ok: false, error: { code: 'unsupported_format' } });
    if (!r.ok) expect(r.error.message).toContain('binaire');
  });
  it('fichier vide, XML mal formé, format inconnu, sans point', () => {
    expect(parseTrackFile('  ', 'a.gpx')).toMatchObject({ ok: false, error: { code: 'empty_file' } });
    expect(parseTrackFile('<gpx><trk>', 'a.gpx')).toMatchObject({ ok: false, error: { code: 'invalid_content' } });
    expect(parseTrackFile('<html></html>', 'a.xml')).toMatchObject({ ok: false, error: { code: 'unrecognized_format' } });
    expect(parseTrackFile('hello', 'a.txt')).toMatchObject({ ok: false, error: { code: 'unrecognized_format' } });
    expect(parseTrackFile('<gpx version="1.1"></gpx>', 'a.gpx')).toMatchObject({ ok: false, error: { code: 'no_points' } });
  });
  it('un DOCTYPE avec entité n’est pas développé', () => {
    const evil = `<!DOCTYPE gpx [<!ENTITY x "BOOM">]><gpx><trk><name>&x;</name><trkseg><trkpt lat="1" lon="2"/></trkseg></trk></gpx>`;
    const r = parseTrackFile(evil, 'a.gpx');
    if (!r.ok) throw new Error('attendu ok');
    expect(r.name).toBe('&x;');
  });
});

describe('validateGpx11', () => {
  it('accepte un GPX 1.1 conforme', () => {
    expect(validateGpx11(GPX.replace('lat="abc"', 'lat="45.02"').replace('lat="95"', 'lat="45.03"'))).toEqual({ valid: true, errors: [] });
  });
  it('signale version, namespace, creator, trk manquants', () => {
    const v = validateGpx11('<gpx version="1.0"></gpx>');
    expect(v.valid).toBe(false);
    expect(v.errors.map((e) => e.code)).toEqual(['version', 'namespace', 'creator', 'no_trk']);
  });
  it('signale les coordonnées non numériques ou hors bornes', () => {
    const v = validateGpx11(GPX);
    expect(v.valid).toBe(false);
    expect(v.errors.filter((e) => e.code === 'coordinates')).toHaveLength(2);
  });
  it('racine non gpx et XML cassé', () => {
    expect(validateGpx11('<kml/>').errors[0].code).toBe('root_not_gpx');
    expect(validateGpx11('<gpx>').errors[0].code).toBe('xml_malformed');
  });
});

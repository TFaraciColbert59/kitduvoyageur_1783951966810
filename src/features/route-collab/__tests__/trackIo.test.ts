import { describe, expect, it } from 'vitest';
import { applyWorkspaceOperation } from '../engine';
import { buildValidatedGpx, planTrackImport, rejectByFileName } from '../trackIo';
import { validateGpx11 } from '../insights/formats';
import { baseWorkspace, pt, section, stage } from '../insights/__tests__/fixtures';
import type { RouteWorkspaceState } from '../types';

const NOW = '2026-11-22T10:00:00.000Z';

function ws(): RouteWorkspaceState {
  const a = pt('a', 'a', 45.9, 6.0);
  const b = pt('b', 'b', 45.9, 6.13);
  return {
    ...baseWorkspace({ sport: 'marche', points: [a, b], sections: [section('s1', a, b)], stages: [stage('g1', 1, 'a', 'b')] }),
    members: [{ userId: 'alice', displayName: 'Alice', role: 'owner' }],
  };
}

const GPX = `<?xml version="1.0"?><gpx version="1.1" creator="t" xmlns="http://www.topografix.com/GPX/1/1"><wpt lat="45.1" lon="5.1"><name>Source</name></wpt><trk><name>Sortie du dimanche</name><trkseg>
<trkpt lat="45.1" lon="5.1"><ele>1000</ele></trkpt><trkpt lat="45.11" lon="5.11"><ele>1100</ele></trkpt><trkpt lat="45.12" lon="5.12"><ele>1050</ele></trkpt></trkseg></trk></gpx>`;

const KML = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Boucle</name><LineString><coordinates>5.1,45.1,100 5.2,45.2,150 5.3,45.1,120</coordinates></LineString></Placemark></Document></kml>`;

const TCX = `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="Running"><Lap><Track>
<Trackpoint><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>5.1</LongitudeDegrees></Position><AltitudeMeters>100</AltitudeMeters></Trackpoint>
<Trackpoint><Position><LatitudeDegrees>45.2</LatitudeDegrees><LongitudeDegrees>5.2</LongitudeDegrees></Position><AltitudeMeters>150</AltitudeMeters></Trackpoint>
</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;

const GEOJSON = JSON.stringify({ type: 'Feature', properties: { name: 'Trace' }, geometry: { type: 'LineString', coordinates: [[5.1, 45.1], [5.2, 45.2], [5.3, 45.15]] } });

describe('5.9 import GPX / KML / TCX / GeoJSON', () => {
  it.each([
    ['sortie.gpx', GPX, 'gpx'],
    ['boucle.kml', KML, 'kml'],
    ['course.tcx', TCX, 'tcx'],
    ['trace.geojson', GEOJSON, 'geojson'],
  ])('%s se lit et devient une opération import_track acceptée par le moteur', (name, text, format) => {
    const plan = planTrackImport(ws(), { name, text }, NOW);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.format).toBe(format);
    expect(plan.operation.sections[0].mode).toBe('imported_preserved');
    expect(plan.operation.sourceOrigin.kind).toBe('gpx_import');
    const res = applyWorkspaceOperation(
      ws(),
      [],
      { opId: `imp-${name}`, baseSeq: 1, actorId: 'alice', actorName: 'Alice', operation: plan.operation },
      NOW,
    ).result;
    expect(res.status).toBe('accepted');
    if (res.status === 'accepted') {
      expect(res.workspace.sections.length).toBe(1);
      expect(res.workspace.sections[0].geometry.coordinates.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('GPX : garde l’original, les altitudes et dit les repères non repris', () => {
    const plan = planTrackImport(ws(), { name: 'sortie.gpx', text: GPX }, NOW);
    if (!plan.ok) throw new Error('refusé');
    expect(plan.title).toBe('Sortie du dimanche');
    expect(plan.hasElevation).toBe(true);
    expect(plan.operation.sourceOrigin.originalGpxXml).toContain('<gpx');
    expect(plan.waypointsIgnored).toBe(1);
    expect(plan.message).toMatch(/1 repère du fichier non repris/);
  });

  it('une trace sans altitude dit que D+ et D− restent inconnus (jamais 0)', () => {
    const plan = planTrackImport(ws(), { name: 'trace.geojson', text: GEOJSON }, NOW);
    if (!plan.ok) throw new Error('refusé');
    expect(plan.hasElevation).toBe(false);
    expect(plan.operation.sections[0].ascentM).toBeNull();
    expect(plan.message).toMatch(/D\+ et D− restent inconnus/);
  });

  it('FIT est refusé avec un message qui dit quoi faire, avant toute lecture', () => {
    expect(rejectByFileName('montre.fit')).toMatch(/FIT \(binaire\) n’est pas pris en charge/);
    const plan = planTrackImport(ws(), { name: 'montre.FIT', text: '\u0000binaire' }, NOW);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toMatch(/GPX, TCX ou GeoJSON/);
  });

  it('refuse les fichiers vides, illisibles, inconnus ou trop lourds', () => {
    expect(planTrackImport(ws(), { name: 'a.gpx', text: '' }, NOW).ok).toBe(false);
    expect(planTrackImport(ws(), { name: 'a.json', text: '{oups' }, NOW).ok).toBe(false);
    expect(planTrackImport(ws(), { name: 'a.xml', text: '<html/>' }, NOW).ok).toBe(false);
    const big = planTrackImport(ws(), { name: 'a.gpx', text: GPX, size: 30 * 1024 * 1024 }, NOW);
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.error).toMatch(/25 Mo/);
  });

  it('un DOCTYPE avec entité personnalisée n’est jamais développé', () => {
    const evil = `<?xml version="1.0"?><!DOCTYPE gpx [<!ENTITY x "999">]><gpx version="1.1" creator="t" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>&x;</name><trkseg><trkpt lat="45" lon="5"/><trkpt lat="45.1" lon="5.1"/></trkseg></trk></gpx>`;
    const plan = planTrackImport(ws(), { name: 'e.gpx', text: evil }, NOW);
    if (plan.ok) expect(plan.title).not.toBe('999');
  });
});

describe('5.9 export GPX 1.1 validé', () => {
  it('complet : valide, nom de fichier propre', () => {
    const out = buildValidatedGpx({ ...ws(), title: 'Tour du Mont-Blanc été' });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.filename).toBe('tour-du-mont-blanc-ete.gpx');
    expect(validateGpx11(out.xml).valid).toBe(true);
    expect(out.trackpoints).toBeGreaterThan(1);
  });

  it('par étape : seul le tracé de la journée sort', () => {
    const a = pt('a', 'a', 45.9, 6.0);
    const b = pt('b', 'b', 45.9, 6.13);
    const c = pt('c', 'c', 45.9, 6.26);
    const w = baseWorkspace({ sport: 'marche', points: [a, b, c], sections: [section('s1', a, b), section('s2', b, c)], stages: [stage('g1', 1, 'a', 'b'), stage('g2', 2, 'b', 'c')] });
    const day2 = buildValidatedGpx(w, 'g2');
    const all = buildValidatedGpx(w);
    expect(day2.ok && all.ok).toBe(true);
    if (day2.ok && all.ok) {
      expect(day2.scope).toBe('stage');
      expect(day2.filename).toMatch(/-jour-2\.gpx$/);
      expect(day2.trackpoints).toBeLessThan(all.trackpoints);
    }
  });

  it('refuse une journée de repos, une étape incohérente et un tracé vide', () => {
    const a = pt('a', 'a', 45.9, 6.0);
    const b = pt('b', 'b', 45.9, 6.13);
    const w = baseWorkspace({ sport: 'marche', points: [a, b], sections: [section('s1', a, b)], stages: [stage('g1', 1, 'a', 'b'), stage('r', 2, 'b', 'b', { kind: 'rest' }), stage('bad', 3, 'b', 'a')] });
    const rest = buildValidatedGpx(w, 'r');
    expect(rest.ok).toBe(false);
    if (!rest.ok) expect(rest.reason).toMatch(/repos/);
    expect(buildValidatedGpx(w, 'bad').ok).toBe(false);
    expect(buildValidatedGpx({ ...w, points: [a], sections: [] }).ok).toBe(false);
  });
});

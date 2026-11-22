import { describe, expect, it } from 'vitest';
import { parseTrackFile } from '../insights/formats';
import { adoptGuestWorkspace, GUEST_USER_ID } from '../guestDraft';
import { baseWorkspace } from '../insights/__tests__/fixtures';
import { buildTripEntry } from '../entry';
import {
  limitTrackPoints,
  readExplorerImport,
  startBlank,
  startFromCatalogTrack,
  startFromParsedTrack,
  startFromPlace,
  type StartContext,
} from '../startBuilders';
import { provenanceOf } from '../entry';

const NOW = '2026-11-22T10:00:00.000Z';
const UUID = '6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f';

const GPX = `<?xml version="1.0"?><gpx version="1.1" creator="t" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Tour du lac</name><trkseg>
<trkpt lat="45.90" lon="6.10"><ele>450</ele></trkpt><trkpt lat="45.91" lon="6.11"><ele>470</ele></trkpt><trkpt lat="45.92" lon="6.12"><ele>455</ele></trkpt></trkseg></trk></gpx>`;

function ctx(over: Partial<StartContext> = {}): StartContext {
  return { trip: null, userId: 'u', userName: 'Moi', nowIso: NOW, idSeed: 'abc', ...over };
}

const trip = buildTripEntry({
  id: UUID, title: 'Annecy en vélo', start_date: null, end_date: null, destination_name: 'Annecy',
  destination_country_code: 'FR', party_size: 1, metadata: {}, primary_activity: 'cycling',
});

describe('startBuilders · les cinq départs (1.3)', () => {
  it('carte vide : aucun point, voyage et profil hérités (1.1, 1.6)', () => {
    const ws = startBlank(ctx({ trip }));
    expect(ws.points).toHaveLength(0);
    expect(ws.tripId).toBe(UUID);
    expect(ws.id).toBe(`ws-trip-${UUID}`);
    expect(ws.sport).toBe('route');
    expect(ws.title).toBe('Annecy en vélo');
  });

  it('sans voyage : atelier local non rattaché', () => {
    const ws = startBlank(ctx());
    expect(ws.id).toBe('ws-local-abc');
    expect(ws.sport).toBe('marche');
  });

  it('lieu confirmé : un seul point, au lieu retenu, sans tronçon inventé', () => {
    const ws = startFromPlace(ctx(), { name: 'Annecy', lat: 45.9, lon: 6.12, country: 'France' }, { sport: 'marche', shapeMode: 'loop' });
    expect(ws.points).toHaveLength(1);
    expect(ws.points[0]).toMatchObject({ lat: 45.9, lon: 6.12, kind: 'start' });
    expect(ws.sections).toHaveLength(0);
    expect(ws.shapeMode).toBe('loop');
  });

  it('GPX : géométrie gardée, altitudes lues, badge « Mon GPX »', () => {
    const parsed = parseTrackFile(GPX, 'tour.gpx');
    if (!parsed.ok) throw new Error('GPX de test illisible');
    const r = startFromParsedTrack(ctx(), parsed, { name: 'tour.gpx', text: GPX });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = r.workspace.sections[0];
    expect(s.mode).toBe('imported_preserved');
    expect(s.geometry.coordinates).toHaveLength(3);
    expect(s.ascentM).toBe(20);
    expect(s.descentM).toBe(15);
    expect(r.workspace.title).toBe('Tour du lac');
    expect(r.workspace.sourceOrigin.originalGpxXml).toContain('<gpx');
    expect(provenanceOf(r.workspace).label).toBe('Mon GPX');
  });

  it('GPX sans altitude : D+ et D− inconnus (null), avertissement dit', () => {
    const noEle = GPX.replace(/<ele>\d+<\/ele>/g, '');
    const parsed = parseTrackFile(noEle, 'x.gpx');
    if (!parsed.ok) throw new Error('GPX de test illisible');
    const r = startFromParsedTrack(ctx(), parsed, { name: 'x.gpx' });
    if (!r.ok) throw new Error('import refusé');
    expect(r.workspace.sections[0].ascentM).toBeNull();
    expect(r.workspace.sections[0].warnings[0]).toMatch(/Altitude absente/);
  });

  it('GeoJSON lu par le même chemin', () => {
    const geo = JSON.stringify({ type: 'LineString', coordinates: [[6, 45], [6.1, 45.1]] });
    const parsed = parseTrackFile(geo, 'a.geojson');
    if (!parsed.ok) throw new Error('GeoJSON illisible');
    expect(startFromParsedTrack(ctx(), parsed, { name: 'a.geojson' }).ok).toBe(true);
  });

  it('tracé Explorer et sortie passée : provenance distincte, géométrie gardée', () => {
    const track = { id: '12', kind: 'randonnee', title: 'GR 5', coordinates: [[6, 45], [6.1, 45.1], [6.2, 45.1]] as Array<[number, number]> };
    const ex = startFromCatalogTrack(ctx(), track, 'explorer');
    const past = startFromCatalogTrack(ctx(), { ...track, kind: 'sortie' }, 'activity');
    if (!ex.ok || !past.ok) throw new Error('import refusé');
    expect(provenanceOf(ex.workspace).label).toBe('Trace Explorer');
    expect(provenanceOf(past.workspace).label).toBe('Sortie passée');
    expect(ex.workspace.sections[0].mode).toBe('imported_preserved');
    expect(startFromCatalogTrack(ctx(), { ...track, coordinates: [[6, 45]] }, 'explorer').ok).toBe(false);
  });

  it('limite un tracé trop long en gardant les extrémités', () => {
    const many = Array.from({ length: 50 }, (_, i) => i);
    const r = limitTrackPoints(many, 10);
    expect(r.reduced).toBe(true);
    expect(r.items).toHaveLength(10);
    expect(r.items[0]).toBe(0);
    expect(r.items[9]).toBe(49);
    expect(limitTrackPoints(many, 100).reduced).toBe(false);
  });

  it('relit le tracé laissé par l’Explorer, ou l’ignore s’il est illisible', () => {
    const raw = JSON.stringify({ routeId: 7, title: 'Tour', geojson: { coordinates: [[6, 45], [6.1, 45.1]] } });
    expect(readExplorerImport(raw)).toMatchObject({ id: '7', title: 'Tour' });
    expect(readExplorerImport('pas du json')).toBeNull();
    expect(readExplorerImport(JSON.stringify({ geojson: { coordinates: [[6, 45]] } }))).toBeNull();
    expect(readExplorerImport(null)).toBeNull();
  });
});

describe('guestDraft · reprise après connexion', () => {
  it('le brouillon devient celui de la personne connectée et se rattache au voyage', () => {
    const guest = baseWorkspace({ sport: 'marche', members: [{ userId: GUEST_USER_ID, displayName: 'Voyageur', role: 'owner' }] });
    const mine = adoptGuestWorkspace(guest, { userId: 'real', userName: 'Alice', tripId: UUID });
    expect(mine.members).toEqual([{ userId: 'real', displayName: 'Alice', role: 'owner' }]);
    expect(mine.tripId).toBe(UUID);
  });
  it('ajoute la personne comme propriétaire si le brouillon n’avait pas de membre invité', () => {
    const mine = adoptGuestWorkspace(baseWorkspace({ sport: 'marche', members: [] }), { userId: 'real', userName: 'Alice' });
    expect(mine.members[0]).toMatchObject({ userId: 'real', role: 'owner' });
  });
});

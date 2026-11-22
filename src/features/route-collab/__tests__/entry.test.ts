import { describe, expect, it } from 'vitest';
import { buildTripEntry, parseEntryParams, provenanceOf, resolveDeepLinkTarget } from '../entry';
import { baseWorkspace } from '../insights/__tests__/fixtures';
import { createBlankWorkspace, workspaceWithTrack } from '../startWorkspace';

const UUID = '6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const NOW = '2026-11-22T10:00:00.000Z';

describe('entry · paramètres d’URL (1.1, 1.9)', () => {
  it('valide ?trip= comme un uuid et lit jour, point, tronçon', () => {
    const p = parseEntryParams({ trip: UUID, jour: '2', point: 'pt-9', troncon: 'sec-3' });
    expect(p).toEqual({ tripId: UUID, tripInvalid: false, deepLink: { day: 2, pointId: 'pt-9', sectionId: 'sec-3' } });
  });

  it('un ?trip= qui n’est pas un uuid est ignoré mais annoncé', () => {
    const p = parseEntryParams({ trip: 'pas-un-uuid' });
    expect(p.tripId).toBeUndefined();
    expect(p.tripInvalid).toBe(true);
  });

  it('sans paramètre : rien, et aucune erreur', () => {
    expect(parseEntryParams({})).toEqual({ tripId: undefined, tripInvalid: false, deepLink: {} });
  });

  it('ignore un jour hors bornes ou un identifiant mal formé', () => {
    expect(parseEntryParams({ jour: '0', point: '<script>' }).deepLink).toEqual({});
  });
});

describe('entry · contexte du voyage (1.6)', () => {
  const row = {
    id: UUID, title: 'Tour du Queyras', start_date: '2027-07-10', end_date: '2027-07-12',
    destination_name: 'Queyras', destination_country_code: 'FR', party_size: 2,
    metadata: { compas: { anchor: { name: 'Ceillac', lat: 44.66, lon: 6.78 } } },
  };

  it('hérite le profil de l’activité du voyage (vélo → route, sinon marche)', () => {
    expect(buildTripEntry({ ...row, primary_activity: 'cycling' }).sport).toBe('route');
    expect(buildTripEntry({ ...row, primary_activity: 'hiking' }).sport).toBe('marche');
    expect(buildTripEntry({ ...row, primary_activity: null }).sportFrom).toBe('default');
  });

  it('lit les jours du voyage, l’ancre et le pays', () => {
    const e = buildTripEntry({ ...row, primary_activity: 'hiking' });
    expect(e.days).toBe(3);
    expect(e.countryCode).toBe('FR');
    expect(e.anchor).toMatchObject({ lat: 44.66, lon: 6.78 });
    expect(e.routeDraft).toBeNull();
  });

  it('le tracé du Compas prime : son profil de routage est repris', () => {
    const draft = {
      id: 'd', version: 1, sport: 'gravel', savedAt: NOW,
      points: [{ id: 'a', lat: 44.6, lon: 6.7, kind: 'start' }, { id: 'b', lat: 44.7, lon: 6.8, kind: 'end' }],
      geometry: { type: 'LineString', coordinates: [[6.7, 44.6], [6.8, 44.7]] },
      distanceKm: 14, durationMin: null, provider: null, warnings: [],
    };
    const e = buildTripEntry({ ...row, primary_activity: 'hiking', metadata: { compas: { routeDraft: draft } } });
    expect(e.routeDraft?.id).toBe('d');
    expect(e.sport).toBe('gravel');
    expect(e.sportFrom).toBe('draft');
  });
});

describe('entry · liens profonds (1.9)', () => {
  const ws = baseWorkspace();
  it('?jour= ouvre l’étape du jour', () => {
    expect(resolveDeepLinkTarget(ws, { day: 2 }).target).toEqual({ kind: 'stage', stageId: 'g2', day: 2 });
  });
  it('?point= prime et retrouve l’étape qui le contient', () => {
    const r = resolveDeepLinkTarget(ws, { day: 1, pointId: 'c' });
    expect(r.target).toEqual({ kind: 'point', pointId: 'c', stageId: 'g2' });
  });
  it('?troncon= ouvre le tronçon', () => {
    expect(resolveDeepLinkTarget(ws, { sectionId: 's2' }).target).toMatchObject({ kind: 'section', sectionId: 's2', stageId: 'g2' });
  });
  it('un élément absent est annoncé, jamais remplacé par un autre', () => {
    const r = resolveDeepLinkTarget(ws, { day: 9, pointId: 'zz', sectionId: 'nope' });
    expect(r.target).toBeNull();
    expect(r.missing).toEqual(['point', 'troncon', 'jour']);
  });
});

describe('entry · provenance (1.8)', () => {
  const blank = createBlankWorkspace({ id: 'w', tripId: 't', userId: 'u', userName: 'U', nowIso: NOW });
  const coords: Array<[number, number]> = [[6.0, 45.9], [6.1, 45.91], [6.2, 45.9]];

  it('carte vide, puis dessiné', () => {
    expect(provenanceOf(blank).kind).toBe('empty');
    expect(provenanceOf(baseWorkspace()).label).toBe('Dessiné');
  });

  it('un GPX garde sa géométrie par défaut et porte « Mon GPX »', () => {
    const ws = workspaceWithTrack(blank, {
      coords, title: 'Sortie', origin: { kind: 'gpx_import', importedAt: NOW }, provider: 'import-gpx', keepGeometry: true,
    }, NOW)!;
    expect(ws.sections[0].mode).toBe('imported_preserved');
    expect(ws.sections[0].geometry.coordinates).toEqual(coords);
    expect(provenanceOf(ws)).toEqual({ kind: 'gpx', label: 'Mon GPX', edited: false });
  });

  it('trace Explorer et sortie passée', () => {
    const ex = workspaceWithTrack(blank, { coords, title: 'x', origin: { kind: 'explorer_route', sourceId: '12', importedAt: NOW }, provider: 'explorer-catalog', keepGeometry: true }, NOW)!;
    expect(provenanceOf(ex).label).toBe('Trace Explorer');
    const past = workspaceWithTrack(blank, { coords, title: 'x', origin: { kind: 'activity_replay', importedAt: NOW }, provider: 'import-sortie', keepGeometry: true }, NOW)!;
    expect(provenanceOf(past).label).toBe('Sortie passée');
  });

  it('retrouve la provenance d’un import sans sourceOrigin (via le fournisseur du tronçon)', () => {
    const ws = workspaceWithTrack(blank, { coords, title: 'x', origin: { kind: 'blank', importedAt: NOW }, provider: 'import-gpx', keepGeometry: true }, NOW)!;
    expect(provenanceOf(ws).label).toBe('Mon GPX');
  });

  it('dit « retouché » quand un tronçon importé a été recalculé', () => {
    const ws = workspaceWithTrack(blank, { coords, title: 'x', origin: { kind: 'gpx_import', importedAt: NOW }, provider: 'import-gpx', keepGeometry: true }, NOW)!;
    const edited = { ...ws, sections: ws.sections.map((s) => ({ ...s, mode: 'routed' as const })) };
    expect(provenanceOf(edited).edited).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { readRouteDraft } from '@/features/adventure-prep/routeRevision';
import { buildWorkspaceFromRouteDraft, routeDraftToEntities, splitGeometryByPoints } from '../compasDraft';
import { activePointsOf } from '../pointOrder';
import { provenanceOf } from '../entry';

const NOW = '2026-11-22T10:00:00.000Z';

function rawDraft(over: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    version: 3,
    sport: 'vtt',
    engine: 'lkdv-route-editor/2',
    savedAt: '2026-11-20T08:00:00.000Z',
    points: [
      { id: 'p0', lat: 45.9, lon: 6.0, kind: 'start', name: 'Annecy' },
      { id: 'p1', lat: 45.9, lon: 6.13, kind: 'via', name: 'Col' },
      { id: 'p2', lat: 45.9, lon: 6.26, kind: 'end' },
    ],
    geometry: { type: 'LineString', coordinates: [[6.0, 45.9], [6.13, 45.9], [6.26, 45.9]] },
    sections: [
      {
        id: 'leg-1', mode: 'routed', fromIndex: 0, toIndex: 1,
        geometry: { type: 'LineString', coordinates: [[6.0, 45.9], [6.06, 45.901], [6.13, 45.9]] },
        distanceKm: 10.2, durationMin: 80, provider: 'valhalla',
      },
      {
        id: 'manual-2', mode: 'manual', fromIndex: 1, toIndex: 2,
        geometry: { type: 'LineString', coordinates: [[6.13, 45.9], [6.26, 45.9]] },
        distanceKm: 10.1, durationMin: null, provider: null,
      },
    ],
    distanceKm: 20.3,
    durationMin: null,
    provider: 'valhalla',
    warnings: [],
    ...over,
  };
}

function draft(over: Record<string, unknown> = {}) {
  const d = readRouteDraft({ compas: { routeDraft: rawDraft(over) } });
  if (!d) throw new Error('brouillon de test illisible');
  return d;
}

describe('compasDraft · RouteRevision → atelier (1.2)', () => {
  it('garde les points, leur ordre et leurs noms', () => {
    const { points } = routeDraftToEntities(draft(), 'ws');
    expect(points.map((p) => [p.id, p.kind, p.name])).toEqual([
      ['p0', 'start', 'Annecy'],
      ['p1', 'via', 'Col'],
      ['p2', 'finish', null],
    ]);
    expect(activePointsOf({ points }).map((p) => p.id)).toEqual(['p0', 'p1', 'p2']);
  });

  it('garde un tronçon calculé calculé et un tronçon manuel manuel, géométrie intacte', () => {
    const { sections } = routeDraftToEntities(draft(), 'ws');
    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({ mode: 'routed', fromPointId: 'p0', toPointId: 'p1', distanceKm: 10.2, durationMin: 80 });
    expect(sections[0].geometry.coordinates).toHaveLength(3);
    expect(sections[0].provenance.provider).toBe('valhalla');
    expect(sections[0].routingInputHash).not.toBeNull();
    expect(sections[1]).toMatchObject({ mode: 'manual', durationMin: null, routingInputHash: null });
    expect(sections[1].provenance.provider).toBeNull();
    expect(sections[1].warnings[0]).toMatch(/non vérifié/);
  });

  it('ne fabrique ni altitude, ni dénivelé, ni surface : tout reste inconnu', () => {
    const { sections } = routeDraftToEntities(draft(), 'ws');
    for (const s of sections) {
      expect(s.ascentM).toBeNull();
      expect(s.descentM).toBeNull();
      expect(s.surfaceSegments).toEqual([{ fromRatio: 0, toRatio: 1, surface: 'unknown', source: null }]);
    }
  });

  it('un ancien brouillon sans tronçons est coupé aux points, sans perdre un seul sommet', () => {
    const legacy = draft({ sections: undefined, geometry: { type: 'LineString', coordinates: [[6.0, 45.9], [6.05, 45.9], [6.13, 45.9], [6.2, 45.9], [6.26, 45.9]] } });
    expect(legacy.sections).toHaveLength(0);
    const { sections } = routeDraftToEntities(legacy, 'ws');
    expect(sections).toHaveLength(2);
    const all = [...sections[0].geometry.coordinates, ...sections[1].geometry.coordinates.slice(1)];
    expect(all).toHaveLength(5);
    expect(sections[0].durationMin).toBeNull();
  });

  it('splitGeometryByPoints avance toujours', () => {
    const cuts = splitGeometryByPoints(
      [[6.0, 45.9], [6.1, 45.9], [6.2, 45.9], [6.3, 45.9]],
      [{ lat: 45.9, lon: 6.0 }, { lat: 45.9, lon: 6.2 }, { lat: 45.9, lon: 6.1 }, { lat: 45.9, lon: 6.3 }],
    );
    expect(cuts).toHaveLength(3);
    expect(cuts.every((c) => c.length >= 2)).toBe(true);
  });

  it('construit un atelier complet : profil, provenance « Tracé du Compas », étapes sur les jours du voyage', () => {
    const ws = buildWorkspaceFromRouteDraft({
      draft: draft(), workspaceId: 'ws-trip-1', tripId: 'trip-1', title: 'Tour du lac',
      userId: 'u', userName: 'Moi', nowIso: NOW, days: 2,
    });
    expect(ws.sport).toBe('vtt');
    expect(ws.title).toBe('Tour du lac');
    expect(ws.tripId).toBe('trip-1');
    expect(ws.stages).toHaveLength(2);
    expect(ws.stages[0].endPointId).toBe(ws.stages[1].startPointId);
    expect(ws.members[0]).toMatchObject({ userId: 'u', role: 'owner' });
    expect(provenanceOf(ws)).toMatchObject({ kind: 'compas', label: 'Tracé du Compas' });
  });

  it('jours inconnus : une seule étape, pas de découpage supposé', () => {
    const ws = buildWorkspaceFromRouteDraft({
      draft: draft(), workspaceId: 'w', tripId: 't', title: null, userId: 'u', userName: 'Moi', nowIso: NOW, days: null,
    });
    expect(ws.stages).toHaveLength(1);
    expect(ws.stages[0]).toMatchObject({ startPointId: 'p0', endPointId: 'p2' });
  });
});

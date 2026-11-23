import { describe, expect, it } from 'vitest';
import { readRouteDraft } from '@/features/adventure-prep/routeRevision';
import { buildExplorerRouteDraft } from '../prepareWithTrackDraft';

const line = {
  type: 'LineString',
  coordinates: [[6.0, 45.0], [6.01, 45.01], [6.02, 45.015], [6.03, 45.03]],
};

describe('Préparer avec ce tracé (10.4)', () => {
  it('transforme le tracé réel en routeDraft relisible par le Compas, géométrie intacte', () => {
    const built = buildExplorerRouteDraft({ routeId: 42, name: 'GR 5 Bauges', geojson: line, distanceKm: 4.2 });
    expect(built).not.toBeNull();
    const draft = readRouteDraft({ compas: { routeDraft: built!.draft } });
    expect(draft?.geometry.coordinates).toEqual(line.coordinates);
    expect(draft?.distanceKm).toBe(4.2);
    expect(draft?.points[0].kind).toBe('start');
    expect(draft?.points.at(-1)?.kind).toBe('end');
    expect(draft?.provider).toBe('explorer-catalog');
  });

  it('accepte une MultiLineString et garde au plus 12 points de contrôle', () => {
    const many = Array.from({ length: 200 }, (_, i) => [6 + i * 0.001, 45 + i * 0.0005]);
    const built = buildExplorerRouteDraft({
      routeId: 7,
      name: null,
      geojson: { type: 'MultiLineString', coordinates: [many] },
      distanceKm: null,
    });
    expect(built?.name).toBe('Itinéraire 7');
    expect(built!.draft.points.length).toBeLessThanOrEqual(12);
    expect(built!.draft.distanceKm).toBeGreaterThan(0);
  });

  it('refuse une géométrie absente ou invalide : aucun tracé inventé', () => {
    expect(buildExplorerRouteDraft({ routeId: 1, name: 'x', geojson: null, distanceKm: null })).toBeNull();
    expect(buildExplorerRouteDraft({ routeId: 1, name: 'x', geojson: { type: 'Point', coordinates: [1, 2] }, distanceKm: null })).toBeNull();
  });
});

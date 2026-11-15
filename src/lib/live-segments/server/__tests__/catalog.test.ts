import { describe, expect, it } from 'vitest';
import {
  createPublicPrivacy,
  getDemoCatalog,
  getLiveSegment,
  listLiveSegments,
  listLiveSegmentsByIds,
} from '../catalog';

describe('S03-UI — catalogue Live Segments', () => {
  it('produit des traces finies, ordonnées et un objectif cohérent', () => {
    const catalog = getDemoCatalog();
    expect(catalog).toHaveLength(5);

    for (const entry of catalog) {
      const { definition } = entry;
      expect(definition.points.length).toBeGreaterThan(10);
      expect(definition.totalDistanceM).toBeGreaterThan(1_000);
      expect(definition.elevationGainM).toBeGreaterThan(0);

      let previous = -1;
      for (const point of definition.points) {
        expect(Number.isFinite(point.lat)).toBe(true);
        expect(Number.isFinite(point.lon)).toBe(true);
        expect(Number.isFinite(point.cumulativeDistanceM)).toBe(true);
        expect(point.cumulativeDistanceM).toBeGreaterThanOrEqual(previous);
        previous = point.cumulativeDistanceM;
      }

      const last = definition.points[definition.points.length - 1];
      expect(last.cumulativeDistanceM).toBeCloseTo(definition.totalDistanceM, 1);

      const ghost = definition.ghostProfiles[0];
      expect(ghost.kind).toBe('target');
      expect(ghost.totalTimeMs).toBeGreaterThan(0);
      expect(ghost.checkpoints).toHaveLength(4);
      expect(ghost.checkpoints[3].distanceM).toBeCloseTo(definition.totalDistanceM, 1);
      expect(ghost.checkpoints[3].elapsedMs).toBe(ghost.totalTimeMs);
    }
  });

  it('trie par distance quand une position est fournie', () => {
    const semnoz = getDemoCatalog()[0].definition;
    const start = semnoz.points[0];
    const result = listLiveSegments({
      lat: start.lat,
      lon: start.lon,
      radiusM: 10_000,
      limit: 10,
    });
    expect(result.items[0].id).toBe(semnoz.id);
    expect(result.items[0].distanceFromViewerM).toBeLessThan(10);
    expect(result.dataSource).toBe('demo_catalog');
  });

  it('ne renvoie rien quand le lecteur est hors du rayon', () => {
    const result = listLiveSegments({ lat: 0, lon: 0, radiusM: 100 });
    expect(result.items).toEqual([]);
  });

  it('respecte le refus P01 sans exposer de segment', () => {
    const privacy = createPublicPrivacy('anonymous', false);
    expect(privacy.optedInLiveSegments).toBe(false);
    const result = listLiveSegments({ optedIn: false });
    expect(result.items).toEqual([]);
    expect(getLiveSegment('demo-semnoz', { optedIn: false })).toBeNull();
    expect(listLiveSegmentsByIds(['demo-semnoz'], { optedIn: false })).toEqual([]);
  });
});

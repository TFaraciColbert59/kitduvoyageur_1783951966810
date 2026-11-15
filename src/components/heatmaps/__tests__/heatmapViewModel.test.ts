import { describe, expect, it } from 'vitest';
import type { PersonalHeatmapCell, PublicHeatmapCell } from '@/features/heatmaps/types';
import {
  MAP_VIEWBOX,
  bandLabel,
  computeMapBounds,
  formatIsoDate,
  projectCells,
  summarizeCommunity,
  summarizeComparison,
  summarizePersonal,
} from '@/components/heatmaps/heatmapViewModel';

const PUBLIC_CELL: PublicHeatmapCell = {
  cellId: 'g1000:100:100',
  cellCenterLat: 45.8325,
  cellCenterLng: 6.8655,
  cellBounds: [6.865, 45.832, 6.866, 45.833],
  distinctContributorCount: 7,
  passageCount: 12,
  intensity: 0.8,
  band: 'peak',
};

const PERSONAL_CELL: PersonalHeatmapCell = {
  cellId: 'g1000:100:100',
  cellCenterLat: 45.8325,
  cellCenterLng: 6.8655,
  cellBounds: [6.865, 45.832, 6.866, 45.833],
  activityCount: 3,
  pointCount: 42,
  intensity: 0.6,
  band: 'high',
  sports: ['rando', 'trail'],
  lastVisitedAt: '2026-06-10T09:20:00.000Z',
};

describe('computeMapBounds', () => {
  it('ajoute une marge autour des cellules', () => {
    const bounds = computeMapBounds([PUBLIC_CELL]);
    expect(bounds.minLat).toBeLessThan(45.832);
    expect(bounds.maxLat).toBeGreaterThan(45.833);
    expect(bounds.minLng).toBeLessThan(6.865);
    expect(bounds.maxLng).toBeGreaterThan(6.866);
  });

  it('retombe sur un cadrage monde sans données', () => {
    const bounds = computeMapBounds([]);
    expect(bounds.maxLat).toBeGreaterThan(bounds.minLat);
    expect(bounds.maxLng).toBeGreaterThan(bounds.minLng);
  });
});

describe('projectCells', () => {
  it('projette chaque cellule dans le viewBox sans coordonnée brute', () => {
    const bounds = computeMapBounds([PUBLIC_CELL]);
    const [rect] = projectCells([PUBLIC_CELL], bounds);
    expect(rect.cellId).toBe(PUBLIC_CELL.cellId);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(MAP_VIEWBOX.width + 0.001);
    expect(rect.y + rect.height).toBeLessThanOrEqual(MAP_VIEWBOX.height + 0.001);
    expect(rect.title).toContain('7 contributeurs');
  });

  it('donne un titre personnel sans identifiant', () => {
    const bounds = computeMapBounds([PERSONAL_CELL]);
    const [rect] = projectCells([PERSONAL_CELL], bounds);
    expect(rect.title).toContain('3 sorties');
    expect(rect.title).not.toContain('user');
  });
});

describe('summaries', () => {
  it('résume la couche communautaire et son top 5', () => {
    const summary = summarizeCommunity({
      kind: 'community',
      processorVersion: 'v1',
      sport: 'all',
      timeWindow: 'global',
      gridResolutionDeg: 0.001,
      minContributors: 5,
      computedAt: '2026-06-15T12:00:00.000Z',
      cells: [PUBLIC_CELL],
      suppressedCellCount: 2,
      eligibleActivityCount: 3,
      excludedActivityCount: 4,
      maskedPointCount: 5,
      geojson: { type: 'FeatureCollection', features: [] },
    });
    expect(summary).toMatchObject({
      cellCount: 1,
      maxPassages: 12,
      maxContributors: 7,
      suppressedCellCount: 2,
      maskedPointCount: 5,
    });
    expect(summary.topCells[0].cellId).toBe(PUBLIC_CELL.cellId);
  });

  it('résume la couche personnelle et la comparaison', () => {
    const summary = summarizePersonal({
      kind: 'personal',
      ownerUserId: 'user-1',
      sports: 'all',
      period: { kind: 'all_time' },
      includePrivateActivities: true,
      gridResolutionDeg: 0.001,
      computedAt: '2026-06-15T12:00:00.000Z',
      cells: [PERSONAL_CELL],
      activityCount: 3,
      geojson: { type: 'FeatureCollection', features: [] },
    });
    expect(summary).toMatchObject({ cellCount: 1, activityCount: 3, sportCount: 2 });
    expect(summary.lastVisitedAt).toBe('2026-06-10T09:20:00.000Z');

    const comparison = summarizeComparison({
      ownerUserId: 'user-1',
      newlyExploredCells: [PERSONAL_CELL],
      recurringCells: [
        {
          cellId: 'a',
          cellCenterLat: 45,
          cellCenterLng: 6,
          baselineActivityCount: 1,
          targetActivityCount: 4,
          activityDelta: 3,
          intensityDelta: 0.2,
        },
      ],
      unvisitedBaselineCells: [],
    });
    expect(comparison).toEqual({ newlyExplored: 1, recurring: 1, unvisited: 0, totalDelta: 3 });
  });

  it('formate les bandes et les dates sans planter sur une valeur absente', () => {
    expect(bandLabel('peak')).toBe('Très fréquenté');
    expect(formatIsoDate(null)).toBe('—');
    expect(formatIsoDate('pas-une-date')).toBe('—');
  });
});

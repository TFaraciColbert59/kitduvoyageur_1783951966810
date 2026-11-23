import { describe, expect, it } from 'vitest';
import { boundsOf, focusOffsetPx, framePadding, framingTarget, stageCoords } from '../mapFraming';
import { createBlankWorkspace, stagesForPoints } from '../startWorkspace';
import type { CollaborativeRoutePoint, CollaborativeRouteSection, RouteWorkspaceState } from '../types';

function pt(id: string, lon: number, lat: number, orderKey: string): CollaborativeRoutePoint {
  return { id, workspaceId: 'w', kind: 'via', orderKey, lat, lon, entityVersion: 1 };
}
function sec(id: string, a: CollaborativeRoutePoint, b: CollaborativeRoutePoint): CollaborativeRouteSection {
  return {
    id,
    workspaceId: 'w',
    fromPointId: a.id,
    toPointId: b.id,
    mode: 'routed',
    geometry: { type: 'LineString', coordinates: [[a.lon, a.lat], [b.lon, b.lat]] },
    distanceKm: 1,
    durationMin: 10,
    ascentM: null,
    descentM: null,
    surfaceSegments: [],
    routingInputHash: null,
    provenance: { provider: null, calculatedAt: null, profile: 'marche', confidence: 'estimated' },
    warnings: [],
    entityVersion: 1,
  };
}

function twoDays(): RouteWorkspaceState {
  const a = pt('a', 6, 45, 'A');
  const b = pt('b', 6.1, 45.1, 'M');
  const c = pt('c', 6.2, 45.2, 'Z');
  const base = createBlankWorkspace({ id: 'w', tripId: 't', userId: 'u', userName: 'U', nowIso: '2026-11-22T00:00:00Z' });
  return { ...base, points: [a, b, c], sections: [sec('s1', a, b), sec('s2', b, c)], stages: stagesForPoints('w', [a, b, c], 2) };
}

describe('mapFraming · cadrage qui suit le tiroir (2.8)', () => {
  it('la marge basse suit la hauteur du tiroir, bornée à 75 % de la carte', () => {
    expect(framePadding(800, 0).bottom).toBe(24);
    expect(framePadding(800, 400).bottom).toBeGreaterThan(framePadding(800, 190).bottom);
    expect(framePadding(800, 900).bottom).toBe(600 + 24);
    expect(framePadding(0, Number.NaN).bottom).toBe(24);
    // Écran très bas : haut + bas restent sous 90 % de la carte.
    const tiny = framePadding(300, 250);
    expect(tiny.top + tiny.bottom).toBeLessThanOrEqual(270);
  });

  it('le centre est ramené au milieu de la partie visible', () => {
    expect(focusOffsetPx(400, 800)).toEqual([0, -200]);
    expect(focusOffsetPx(0, 800)).toEqual([0, 0]);
    expect(focusOffsetPx(900, 800)[1]).toBe(-300);
  });

  it('emprise : ignore les coordonnées invalides, null s’il n’y en a aucune', () => {
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([[1, 2], [Number.NaN, 3], [5, 0]])).toEqual({ minLon: 1, minLat: 0, maxLon: 5, maxLat: 2 });
  });

  it('le jour ouvert est cadré seul ; sans jour ouvert (ou un seul jour), tout le tracé', () => {
    const ws = twoDays();
    const day2 = framingTarget(ws, 'stage-2');
    expect(day2.kind).toBe('day');
    expect(boundsOf(day2.coords)).toEqual({ minLon: 6.1, minLat: 45.1, maxLon: 6.2, maxLat: 45.2 });
    expect(framingTarget(ws, null).kind).toBe('all');
    expect(framingTarget({ ...ws, stages: ws.stages.slice(0, 1) }, 'stage-1').kind).toBe('all');
    expect(framingTarget(ws, 'stage-inconnu').kind).toBe('all');
    expect(stageCoords(ws, 'stage-inconnu')).toBeNull();
  });
});

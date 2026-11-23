import { describe, expect, it } from 'vitest';
import { buildCarnetComparisonView, toClubRouteRevisionSnapshot } from '../integrations';
import { baseWorkspace, kit } from '../insights/__tests__/fixtures';
import type { CarnetReturnRecord } from '../offlinePackStore';
import { computeTechnicalTerrainStats } from '../routeAnalysis';
import type { RouteRevisionSnapshot, RouteWorkspaceState } from '../types';

/** 4.5 : l'inconnu n'est jamais converti en 0 (D+, durée, poids, niveau d'effort). */
function withSections(over: Array<Partial<RouteWorkspaceState['sections'][number]>>): RouteWorkspaceState {
  const ws = baseWorkspace({ sport: 'marche' });
  return { ...ws, sections: ws.sections.map((s, i) => ({ ...s, ...over[i] })) };
}

describe('4.5 · routeAnalysis : D+ et durées inconnus', () => {
  it('D+ inconnu partout : ni durée, ni IBP, ni calories, ni « Facile » par défaut', () => {
    const s = computeTechnicalTerrainStats(withSections([{ ascentM: null, descentM: null, durationMin: null }, { ascentM: null, descentM: null, durationMin: null }]));
    expect(s.ascentM).toBeNull();
    expect(s.estimatedDurationMin).toBeNull();
    expect(s.avgSpeedKmh).toBeNull();
    expect(s.ibpEstimate).toBeNull();
    expect(s.estimatedCaloriesKcal).toBeNull();
    expect(s.effortLevel).toBeNull();
    expect(s.distanceKnown).toBe(true);
  });

  it('D+ connu sur un seul tronçon : pas de total (l’inconnu ne vaut pas 0)', () => {
    const s = computeTechnicalTerrainStats(withSections([{ ascentM: 500, descentM: 100 }, { ascentM: null, descentM: null }]));
    expect(s.ascentM).toBeNull();
    expect(s.descentM).toBeNull();
    expect(s.ibpEstimate).toBeNull();
  });

  it('une durée de tronçon manquante n’est pas comptée pour 0 min : durée estimée (Naismith) ou inconnue', () => {
    const known = computeTechnicalTerrainStats(withSections([{ ascentM: 300, durationMin: 100 }, { ascentM: 300, durationMin: 100 }]));
    expect(known.estimatedDurationMin).toBe(200);
    const partial = computeTechnicalTerrainStats(withSections([{ ascentM: 300, durationMin: 100 }, { ascentM: 300, durationMin: null }]));
    expect(partial.estimatedDurationMin).not.toBe(100);
    expect(partial.estimatedDurationMin).toBeGreaterThan(200);
  });

  it('tout connu : valeurs calculées comme avant', () => {
    const s = computeTechnicalTerrainStats(withSections([{ ascentM: 300, descentM: 100 }, { ascentM: 300, descentM: 100 }]));
    expect(s.ascentM).toBe(600);
    expect(s.ibpEstimate).not.toBeNull();
    expect(s.effortLevel).not.toBeNull();
  });

  it('sans tronçon : distance inconnue, pas 0 km', () => {
    const s = computeTechnicalTerrainStats({ ...baseWorkspace(), sections: [] });
    expect(s.distanceKnown).toBe(false);
  });
});

function revision(ascents: Array<number | null>): RouteRevisionSnapshot {
  const ws = baseWorkspace();
  return {
    id: 'r1', workspaceId: 'w', revisionNo: 1, parentRevisionId: null, basedOnSeq: 0, createdBy: 'u', createdByName: 'U', createdAt: '2026-07-01T00:00:00Z',
    kind: 'published', summary: '', points: ws.points, sections: ws.sections.map((s, i) => ({ ...s, ascentM: ascents[i] })), stages: ws.stages, kitSnapshot: [], acknowledgedUnknowns: [],
  };
}

describe('4.5 · integrations : pont Clubs et Carnet', () => {
  it('D+ inconnu sur un tronçon : elevationGainM vaut null, pas la somme des autres', () => {
    expect(toClubRouteRevisionSnapshot(revision([400, null]), 'ev', 'sum').elevationGainM).toBeNull();
    expect(toClubRouteRevisionSnapshot(revision([400, 250]), 'ev', 'sum').elevationGainM).toBe(650);
  });

  it('poids du sac inconnu : total null et objets sans poids comptés', () => {
    const record = {
      plannedRevisionId: 'none', plannedRevisionNo: 1, recordedDistanceKm: 10,
      kitSnapshot: [kit('k1', { weightGrams: 500, quantity: 2 }), kit('k2', { weightGrams: null, quantity: 1 })],
    } as unknown as CarnetReturnRecord;
    const view = buildCarnetComparisonView(record, baseWorkspace());
    expect(view.kitTotalWeightGrams).toBeNull();
    expect(view.kitUnweightedCount).toBe(1);
    expect(view.plannedDistanceKm).toBeNull();
    const all = buildCarnetComparisonView({ ...record, kitSnapshot: [kit('k1', { weightGrams: 500, quantity: 2 })] } as CarnetReturnRecord, baseWorkspace());
    expect(all.kitTotalWeightGrams).toBe(1000);
  });
});

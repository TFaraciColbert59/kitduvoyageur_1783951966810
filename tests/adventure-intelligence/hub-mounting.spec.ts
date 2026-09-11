import { describe, it, expect } from 'vitest';
import {
  buildHubCockpitInput,
  decisionInputsFromRows,
  gateHubTerrainReports,
  HUB_TERRAIN_REPORT_LIMIT,
  parsePlanConfidence,
  planInputFromRow,
  predictionInputFromRow,
  type HubDecisionRow,
  type HubPlanRow,
  type HubPredictionRow,
  type HubTerrainReportInput,
} from '@/features/adventure-intelligence/domain/cockpitMounting';
import { buildCockpitView } from '@/features/adventure-intelligence/domain/cockpit';

/**
 * A10 (10.11) — Montage hub : projection pure des lignes réelles vers le
 * cockpit et gating `terrain_live`. Aucune valeur inventée, aucun DOM requis
 * (pas de testing-library dans le dépôt) — les composants sont des vues pures.
 */

function planRow(overrides: Partial<HubPlanRow> = {}): HubPlanRow {
  return {
    id: 'plan-1',
    title: 'Tour du Queyras',
    status: 'active',
    confidence: { score: 0.8, level: 'high', sampleCount: 12, method: 'test' },
    updatedAt: '2026-09-11T10:00:00.000Z',
    ...overrides,
  };
}

function predictionRow(overrides: Partial<HubPredictionRow> = {}): HubPredictionRow {
  return {
    strategy: 'recommended',
    etaP50: '2026-09-11T15:00:00.000Z',
    etaP90: '2026-09-11T16:00:00.000Z',
    paceP25: 4.5,
    paceP50: 5,
    paceP75: 5.5,
    turnaroundTime: '2026-09-11T17:00:00.000Z',
    personalDifficulty: 82,
    ...overrides,
  };
}

function report(
  id: string,
  severity: HubTerrainReportInput['severity'],
  distanceM: number
): HubTerrainReportInput {
  return { id, category: 'mud', severity, distanceM };
}

describe('A10 (10.11) — montage hub Adventure Intelligence', () => {
  it('TEST-A10-HUB-01: terrain_live inactif ⇒ aucun signalement monté ; actif ⇒ plafonné sans mutation', () => {
    const reports = Array.from({ length: 12 }, (_, index) =>
      report(`r${index}`, 'warning', index * 10)
    );

    expect(gateHubTerrainReports(false, reports)).toEqual([]);

    const capped = gateHubTerrainReports(true, reports);
    expect(capped).toHaveLength(HUB_TERRAIN_REPORT_LIMIT);
    expect(reports).toHaveLength(12);

    const gated = buildHubCockpitInput({
      plan: null,
      prediction: null,
      decisions: [],
      terrainEnabled: false,
      terrainReports: reports,
    });
    expect(gated.liveReports).toEqual([]);

    const active = buildHubCockpitInput({
      plan: null,
      prediction: null,
      decisions: [],
      terrainEnabled: true,
      terrainReports: reports,
    });
    expect(active.liveReports).toHaveLength(HUB_TERRAIN_REPORT_LIMIT);
  });

  it('TEST-A10-HUB-02: plan réel mappé sans invention ; confiance invalide ⇒ froide', () => {
    const plan = planInputFromRow(planRow(), null);

    expect(plan).toMatchObject({
      id: 'plan-1',
      title: 'Tour du Queyras',
      status: 'active',
      personalDifficulty: null,
      etaP50: null,
      etaP90: null,
    });
    expect(plan?.confidence.level).toBe('high');
    expect(plan?.confidence.score).toBe(0.8);

    const cold = parsePlanConfidence({});
    expect(cold.score).toBe(0);
    expect(cold.level).toBe('low');
    expect(cold.method).toBe('cold');

    expect(planInputFromRow(null, predictionRow())).toBeNull();
  });

  it('TEST-A10-HUB-03: prédiction réelle → fourchette d’allure ; stratégie inconnue ou allure absente ⇒ null', () => {
    expect(predictionInputFromRow(predictionRow())).toEqual({
      strategy: 'recommended',
      paceRangeMinPerKm: [4.5, 5.5],
      turnaroundTime: '2026-09-11T17:00:00.000Z',
      nextCriticalSegment: null,
      aheadBehindMinutes: null,
    });

    expect(predictionInputFromRow(predictionRow({ strategy: 'turbo' }))).toBeNull();
    expect(
      predictionInputFromRow(predictionRow({ paceP25: null, paceP50: null, paceP75: null }))
    ).toBeNull();
    expect(predictionInputFromRow(null)).toBeNull();

    const inverted = predictionInputFromRow(predictionRow({ paceP25: 6, paceP75: 4 }));
    expect(inverted?.paceRangeMinPerKm).toEqual([4, 6]);
  });

  it('TEST-A10-HUB-04: décisions proposées réelles — propositions vides écartées', () => {
    const rows: HubDecisionRow[] = [
      { id: 'd1', proposal: 'Valider le refuge', requiresConfirmation: true },
      { id: 'd2', proposal: '   ', requiresConfirmation: false },
    ];

    expect(decisionInputsFromRows(rows)).toEqual([
      { id: 'd1', label: 'Valider le refuge', requiresConfirmation: true },
    ]);
    expect(decisionInputsFromRows([])).toEqual([]);
  });

  it('TEST-A10-HUB-05: aucune donnée ⇒ état vide gracieux, zéro valeur inventée', () => {
    const input = buildHubCockpitInput({
      plan: null,
      prediction: null,
      decisions: [],
      terrainEnabled: false,
      terrainReports: [],
    });
    const view = buildCockpitView({ ...input, offline: false });

    expect(view.hero).toEqual({
      title: 'Aventure',
      subtitle: 'Aucune aventure active',
      status: 'Aucune aventure',
    });
    expect(view.indicators).toEqual([]);
    expect(view.priorityActions).toEqual([]);
    expect(view.alerts).toEqual([]);
    expect(view.eta).toEqual({ p50: null, p90: null, aheadBehindMinutes: null });
    expect(view.confidence).toBeNull();
  });

  it('TEST-A10-HUB-06: données réelles complètes → héro, ETA P50/P90, décision prioritaire et alertes triées', () => {
    const input = buildHubCockpitInput({
      plan: planRow(),
      prediction: predictionRow(),
      decisions: [
        { id: 'd1', proposal: 'Confirmer la réservation', requiresConfirmation: true },
      ],
      terrainEnabled: true,
      terrainReports: [report('r1', 'critical', 120), report('r2', 'warning', 300)],
    });
    const view = buildCockpitView({ ...input, offline: false });

    expect(view.hero.title).toBe('Tour du Queyras');
    expect(view.hero.status).toBe('En cours');
    expect(view.eta.p50).toBe('2026-09-11T15:00:00.000Z');
    expect(view.eta.p90).toBe('2026-09-11T16:00:00.000Z');
    expect(view.difficulty).toEqual({ value: 82, label: 'Difficile' });
    expect(view.priorityActions[0]).toEqual({
      id: 'd1',
      label: 'Confirmer la réservation',
      kind: 'decide',
    });
    expect(view.alerts.map((alert) => alert.id)).toEqual(['r1', 'r2']);
    expect(view.indicators.length).toBeLessThanOrEqual(3);
  });
});

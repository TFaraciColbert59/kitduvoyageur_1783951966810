import { describe, it, expect } from 'vitest';
import {
  buildCockpitView,
  type CockpitInput,
} from '@/features/adventure-intelligence/domain/cockpit';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';

const NOW = '2026-09-11T12:00:00.000Z';

function confidence(score = 0.8) {
  return makeConfidence({ score, sampleCount: 10, method: 'test' });
}

function input(overrides: Partial<CockpitInput> = {}): CockpitInput {
  return {
    plan: null,
    prediction: null,
    liveReports: [],
    decisionsRequired: [],
    recalcReasons: [],
    offline: false,
    ...overrides,
  };
}

function plan(overrides: Partial<NonNullable<CockpitInput['plan']>> = {}) {
  return {
    id: 'plan-1',
    title: 'Tour du Queyras',
    status: 'active',
    confidence: confidence(0.9),
    personalDifficulty: 82,
    etaP50: '2026-09-11T15:00:00.000Z',
    etaP90: '2026-09-11T16:00:00.000Z',
    ...overrides,
  };
}

describe('Cockpit — vue bornée (TEST-A7-COCK)', () => {
  it('TEST-A7-COCK-01: caps stricts — 3 indicateurs et 3 actions au plus, décisions avant signaler/naviguer', () => {
    const view = buildCockpitView(
      input({
        plan: plan(),
        prediction: {
          strategy: 'recommended',
          paceRangeMinPerKm: [4.5, 5.5],
          turnaroundTime: '2026-09-11T17:00:00.000Z',
          nextCriticalSegment: { id: 7, label: 'Col de la Moutière', difficulty: 88 },
        },
        liveReports: [
          { id: 'r1', category: 'mud', severity: 'warning', distanceM: 400 },
          { id: 'r2', category: 'closure', severity: 'critical', distanceM: 900 },
        ],
        decisionsRequired: [
          { id: 'd1', label: 'Valider le refuge', requiresConfirmation: true },
          { id: 'd2', label: 'Partager la position', requiresConfirmation: true },
          { id: 'd3', label: 'Annuler le bus', requiresConfirmation: false },
        ],
        batteryLevel: 15,
      })
    );

    expect(view.indicators).toHaveLength(3);
    expect(view.priorityActions).toHaveLength(3);
    expect(view.priorityActions.map((action) => action.kind)).toEqual([
      'decide',
      'decide',
      'decide',
    ]);

    const lean = buildCockpitView(
      input({
        plan: plan(),
        prediction: {
          strategy: 'fast',
          paceRangeMinPerKm: [4, 5],
          turnaroundTime: null,
          nextCriticalSegment: { id: 3, label: 'Crête sud', difficulty: 70 },
        },
      })
    );
    expect(lean.priorityActions.map((action) => action.kind)).toEqual(['report', 'navigate']);
    expect(lean.indicators.length).toBeLessThanOrEqual(3);
  });

  it('TEST-A7-COCK-02: alertes triées par gravité puis distance, libellés lisibles', () => {
    const view = buildCockpitView(
      input({
        liveReports: [
          { id: 'a', category: 'mud', severity: 'warning', distanceM: 500 },
          { id: 'b', category: 'closure', severity: 'critical', distanceM: 900 },
          { id: 'c', category: 'danger', severity: 'critical', distanceM: 120 },
          { id: 'd', category: 'water', severity: 'info', distanceM: 50 },
        ],
      })
    );

    expect(view.alerts.map((alert) => alert.id)).toEqual(['c', 'b', 'a', 'd']);
    expect(view.alerts[0].label).toContain('Danger');
    expect(view.alerts[0].label).toContain('120');
    expect(view.alerts[2].label).toContain('Boue');
  });

  it('TEST-A7-COCK-03: ton des indicateurs dérivé — difficulté > 75 warning, > 90 critical, batterie ≤ 20 warning', () => {
    const difficultyTone = (value: number) =>
      buildCockpitView(input({ plan: plan({ personalDifficulty: value }) })).indicators.find(
        (indicator) => indicator.id === 'difficulty'
      )?.tone;

    expect(difficultyTone(95)).toBe('critical');
    expect(difficultyTone(82)).toBe('warning');
    expect(difficultyTone(60)).toBe('neutral');
    expect(difficultyTone(30)).toBe('positive');

    const batteryIndicator = (level: number) =>
      buildCockpitView(input({ batteryLevel: level })).indicators.find(
        (indicator) => indicator.id === 'battery'
      );

    expect(batteryIndicator(15)?.tone).toBe('warning');
    expect(batteryIndicator(8)?.tone).toBe('critical');
    expect(batteryIndicator(55)?.tone).toBe('neutral');
  });

  it('TEST-A7-COCK-04: ETA en fourchette P50–P90, jamais de fausse précision', () => {
    const view = buildCockpitView(input({ plan: plan() }));
    expect(view.eta).toEqual({
      p50: '2026-09-11T15:00:00.000Z',
      p90: '2026-09-11T16:00:00.000Z',
      aheadBehindMinutes: null,
    });

    const inverted = buildCockpitView(
      input({
        plan: plan({
          etaP50: '2026-09-11T16:00:00.000Z',
          etaP90: '2026-09-11T15:00:00.000Z',
        }),
      })
    );
    expect(Date.parse(inverted.eta.p90 as string)).toBeGreaterThanOrEqual(
      Date.parse(inverted.eta.p50 as string)
    );

    const partial = buildCockpitView(input({ plan: plan({ etaP90: null }) }));
    expect(partial.eta.p50).toBe('2026-09-11T15:00:00.000Z');
    expect(partial.eta.p90).toBeNull();

    const delta = buildCockpitView(
      input({
        prediction: {
          strategy: 'comfort',
          paceRangeMinPerKm: [5, 6],
          turnaroundTime: null,
          nextCriticalSegment: null,
          aheadBehindMinutes: -12,
        },
      })
    );
    expect(delta.eta.aheadBehindMinutes).toBe(-12);
  });

  it('TEST-A7-COCK-05: offline, confiance, allure et raisons propagés au héros', () => {
    const view = buildCockpitView(
      input({
        plan: plan(),
        prediction: {
          strategy: 'recommended',
          paceRangeMinPerKm: [4.5, 5.5],
          turnaroundTime: '2026-09-11T17:00:00.000Z',
          nextCriticalSegment: null,
        },
        recalcReasons: ['allure_ecart_15pct', 'signalements_modifies'],
        offline: true,
      })
    );

    expect(view.offline).toBe(true);
    expect(view.hero.title).toBe('Tour du Queyras');
    expect(view.hero.status).toBe('En cours');
    expect(view.hero.subtitle).toBe('Mode hors-ligne — données locales');
    expect(view.paceStrategy).toEqual({ id: 'recommended', label: 'Recommandée' });
    expect(view.turnaroundTime).toBe('2026-09-11T17:00:00.000Z');
    expect(view.confidence?.score).toBe(0.9);
    expect(view.recalcReasons).toEqual(['allure_ecart_15pct', 'signalements_modifies']);
    expect(view.difficulty).toEqual({ value: 82, label: 'Difficile' });
  });

  it('TEST-A7-COCK-06: entrée vide — aucune exception, vue calme et nulle', () => {
    const view = buildCockpitView(input());

    expect(view.hero.title).toBe('Aventure');
    expect(view.hero.status).toBe('Aucune aventure');
    expect(view.indicators).toEqual([]);
    expect(view.priorityActions).toEqual([]);
    expect(view.alerts).toEqual([]);
    expect(view.eta).toEqual({ p50: null, p90: null, aheadBehindMinutes: null });
    expect(view.difficulty).toEqual({ value: null, label: 'Inconnue' });
    expect(view.paceStrategy).toBeNull();
    expect(view.turnaroundTime).toBeNull();
    expect(view.confidence).toBeNull();
    expect(view.recalcReasons).toEqual([]);
    expect(view.offline).toBe(false);
  });
});

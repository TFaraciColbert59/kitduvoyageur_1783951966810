import { describe, expect, it } from 'vitest';
import { computeCockpitReadiness } from '@/features/hub/cockpit/cockpitReadiness';
import { cockpitFixture } from '@/features/hub/cockpit/fixture';

describe('cockpitReadiness engine (Hub 2100)', () => {
  it('computes score, phase label and max 2 prioritized signals for a real trip', () => {
    const report = computeCockpitReadiness(cockpitFixture, {
      day: 3,
      activeDateIso: '2026-09-20',
      forecastDay: cockpitFixture.weather?.days[0],
      completedStepCount: 1,
      totalDaySteps: 5,
    });

    expect(report.score).toBeGreaterThanOrEqual(60);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.phaseLabel).toBe('Jour 3/7');
    expect(report.signals.length).toBeLessThanOrEqual(2);
    expect(report.signals.some((s) => s.id === 'pending-res')).toBe(true);
  });

  it('surfaces countdown phase J-X before trip start', () => {
    const report = computeCockpitReadiness(cockpitFixture, {
      day: 1,
      activeDateIso: '2026-09-14',
      forecastDay: cockpitFixture.weather?.days[0],
    });
    expect(report.phaseLabel).toBe('J-4');
  });

  it('flags expired documents and vital unpacked items with bad tone', () => {
    const report = computeCockpitReadiness(
      {
        ...cockpitFixture,
        documents: [{ id: 'd1', title: 'Passeport', category: 'passport', expiration: '2025-01-01' }],
        kit: [{ id: 'k1', title: 'Trousse secours', amount: 1, packed: false, vital: true }],
      },
      {
        day: 3,
        activeDateIso: '2026-09-20',
      },
    );

    expect(report.tone).toBe('bad');
    expect(report.signals[0]?.id).toBe('expired-docs');
    expect(report.signals[1]?.id).toBe('vital-kit');
  });
});

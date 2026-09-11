import { describe, it, expect } from 'vitest';
import {
  simulateMultiDayTrek,
  type TrekDayInput,
} from '@/features/adventure-intelligence/domain/multiDayTrek';

function day(dayNumber: number, overrides: Partial<TrekDayInput> = {}): TrekDayInput {
  return {
    dayNumber,
    distanceM: 20000,
    gainM: 1200,
    lossM: 1200,
    packWeightKg: 12,
    ...overrides,
  };
}

describe('A8 — trek multi-jours (TEST-A8-TREK)', () => {
  it('TEST-A8-TREK-01: la capacité cumulée décroît sous des journées lourdes répétées', () => {
    const result = simulateMultiDayTrek(
      [day(1), day(2), day(3), day(4)],
      { recoveryPerNight: 5 }
    );

    expect(result.daily).toHaveLength(4);
    expect(result.daily[0].capacityPct).toBe(100);

    for (let index = 1; index < result.daily.length; index += 1) {
      expect(result.daily[index].capacityPct).toBeLessThan(result.daily[index - 1].capacityPct);
      expect(result.daily[index].capacityPct).toBeGreaterThanOrEqual(0);
    }

    expect(result.daily[3].difficulty).toBeGreaterThan(result.daily[0].difficulty);
    expect(result.totalDriftRisk).toBeGreaterThan(0);
  });

  it('TEST-A8-TREK-02: une récupération nocturne plus élevée préserve la capacité', () => {
    const days = [day(1), day(2), day(3)];
    const lowRecovery = simulateMultiDayTrek(days, { recoveryPerNight: 5 });
    const highRecovery = simulateMultiDayTrek(days, { recoveryPerNight: 35 });

    expect(highRecovery.daily[1].capacityPct).toBeGreaterThan(lowRecovery.daily[1].capacityPct);
    expect(highRecovery.daily[2].capacityPct).toBeGreaterThan(lowRecovery.daily[2].capacityPct);

    for (const entry of highRecovery.daily) {
      expect(entry.capacityPct).toBeLessThanOrEqual(100);
      expect(entry.capacityPct).toBeGreaterThanOrEqual(0);
    }
  });

  it('TEST-A8-TREK-03: une nuit courte réduit la récupération de la capacité suivante', () => {
    const moderate = day(1, { distanceM: 12000, gainM: 800, lossM: 800, packWeightKg: 8 });
    const shortNight = simulateMultiDayTrek(
      [
        { ...moderate, sleepQuality: 0.2 },
        day(2, { distanceM: 12000, gainM: 800, lossM: 800, packWeightKg: 8 }),
        day(3, { distanceM: 12000, gainM: 800, lossM: 800, packWeightKg: 8 }),
      ],
      { recoveryPerNight: 20 }
    );
    const fullNight = simulateMultiDayTrek(
      [
        { ...moderate, sleepQuality: 1 },
        day(2, { distanceM: 12000, gainM: 800, lossM: 800, packWeightKg: 8 }),
        day(3, { distanceM: 12000, gainM: 800, lossM: 800, packWeightKg: 8 }),
      ],
      { recoveryPerNight: 20 }
    );

    expect(shortNight.daily[0].capacityPct).toBe(fullNight.daily[0].capacityPct);
    expect(shortNight.daily[1].capacityPct).toBeLessThan(fullNight.daily[1].capacityPct);
  });

  it('TEST-A8-TREK-04: une journée courte améliore la capacité de la journée suivante', () => {
    const shortDay2 = simulateMultiDayTrek(
      [day(1), day(2, { distanceM: 5000, gainM: 200, lossM: 200, packWeightKg: 6 }), day(3)],
      { recoveryPerNight: 20 }
    );
    const longDay2 = simulateMultiDayTrek([day(1), day(2), day(3)], { recoveryPerNight: 20 });

    expect(shortDay2.daily[2].capacityPct).toBeGreaterThan(longDay2.daily[2].capacityPct);
  });

  it('TEST-A8-TREK-05: la dérive et les difficultés élevées déclenchent des ajustements expliqués', () => {
    const result = simulateMultiDayTrek(
      [
        day(1, { distanceM: 30000, gainM: 2000, lossM: 2000, packWeightKg: 14, technicalClass: 4 }),
        day(2, { distanceM: 30000, gainM: 2000, lossM: 2000, packWeightKg: 14, technicalClass: 4 }),
        day(3, {
          distanceM: 30000,
          gainM: 2000,
          lossM: 2000,
          packWeightKg: 14,
          technicalClass: 4,
          sleepQuality: 0.3,
        }),
      ],
      { recoveryPerNight: 20, heavyPackKg: 8 }
    );

    for (const entry of result.daily) {
      expect(entry.adjustments.length).toBeGreaterThan(0);
      for (const adjustment of entry.adjustments) {
        expect(adjustment.label.trim().length).toBeGreaterThan(0);
        expect(adjustment.reason.trim().length).toBeGreaterThan(0);
      }
    }

    const firstKinds = result.daily[0].adjustments.map((adjustment) => adjustment.kind);
    expect(firstKinds).toContain('shorten');
    expect(firstKinds).toContain('transfer_gear');

    const lastKinds = result.daily[2].adjustments.map((adjustment) => adjustment.kind);
    expect(lastKinds).toContain('recovery_day');
    expect(lastKinds).toContain('change_refuge');

    const driftRisks = result.daily.map((entry) => entry.driftRisk);
    expect(result.totalDriftRisk).toBe(Math.max(...driftRisks));
    expect(result.totalDriftRisk).toBeGreaterThan(0.5);
    expect(result.totalDriftRisk).toBeLessThanOrEqual(1);

    const worst = result.daily.find((entry) => entry.dayNumber === result.worstDay);
    expect(worst?.difficulty).toBe(Math.max(...result.daily.map((entry) => entry.difficulty)));
  });
});

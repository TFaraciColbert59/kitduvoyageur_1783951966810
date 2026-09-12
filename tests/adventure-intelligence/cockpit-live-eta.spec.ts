/**
 * Phase 6 — ETA et consommation live sur fixes GPS réels (TEST-PHASE6-ETA).
 *
 *   • TEST-PHASE6-ETA-01 : avance/retard projeté depuis allure et distance réelles ;
 *   • TEST-PHASE6-ETA-02 : aucune valeur inventée sans fix/pace/ETA ;
 *   • TEST-PHASE6-ETA-03 : consommation (charge A3) sur durée et D+ réels ;
 *   • TEST-PHASE6-ETA-04 : la vue cockpit porte la consommation live.
 */
import { describe, it, expect } from 'vitest';
import {
  computeAheadBehindMinutes,
  consumptionFromPositions,
  type CockpitPosition,
} from '@/features/adventure-intelligence/domain/cockpitLive';
import { computeFatigue } from '@/features/adventure-intelligence/domain/fatigue';
import { buildCockpitView, type CockpitInput } from '@/features/adventure-intelligence/domain/cockpit';

function position(
  lat: number,
  timestamp: string,
  altitudeM?: number | null
): CockpitPosition {
  return { lat, lng: 6, timestamp, altitudeM: altitudeM ?? null };
}

describe('Phase 6 — ETA et consommation live (TEST-PHASE6-ETA)', () => {
  it('TEST-PHASE6-ETA-01: avance/retard projeté depuis allure et distance réelles', () => {
    // Départ 10:00, 4 km restants à 15 min/km → arrivée projetée 11:00.
    const ahead = computeAheadBehindMinutes({
      plannedEtaIso: '2026-09-12T12:00:00.000Z',
      paceMinPerKm: 15,
      remainingDistanceKm: 4,
      nowIso: '2026-09-12T10:00:00.000Z',
    });
    expect(ahead).toBe(60);

    const behind = computeAheadBehindMinutes({
      plannedEtaIso: '2026-09-12T10:30:00.000Z',
      paceMinPerKm: 20,
      remainingDistanceKm: 4,
      nowIso: '2026-09-12T10:00:00.000Z',
    });
    expect(behind).toBe(-50);

    const onTime = computeAheadBehindMinutes({
      plannedEtaIso: '2026-09-12T11:00:00.000Z',
      paceMinPerKm: 15,
      remainingDistanceKm: 4,
      nowIso: '2026-09-12T10:00:00.000Z',
    });
    expect(onTime).toBe(0);
  });

  it('TEST-PHASE6-ETA-02: aucune valeur inventée sans fix, allure ou ETA valides', () => {
    const base = {
      plannedEtaIso: '2026-09-12T12:00:00.000Z',
      paceMinPerKm: 15,
      remainingDistanceKm: 4,
      nowIso: '2026-09-12T10:00:00.000Z',
    };
    expect(computeAheadBehindMinutes({ ...base, plannedEtaIso: null })).toBeNull();
    expect(computeAheadBehindMinutes({ ...base, plannedEtaIso: 'pas-une-date' })).toBeNull();
    expect(computeAheadBehindMinutes({ ...base, paceMinPerKm: null })).toBeNull();
    expect(computeAheadBehindMinutes({ ...base, paceMinPerKm: 0 })).toBeNull();
    expect(computeAheadBehindMinutes({ ...base, remainingDistanceKm: null })).toBeNull();
    expect(computeAheadBehindMinutes({ ...base, remainingDistanceKm: -1 })).toBeNull();
    expect(computeAheadBehindMinutes({ ...base, nowIso: 'hier' })).toBeNull();
  });

  it('TEST-PHASE6-ETA-03: consommation (charge A3) sur durée et D+ réels uniquement', () => {
    const positions = [
      position(45.1, '2026-09-12T08:00:00.000Z', 1000),
      position(45.2, '2026-09-12T08:30:00.000Z', 1150),
      position(45.3, '2026-09-12T09:00:00.000Z', 1100), // descente : pas de D+
      position(45.4, '2026-09-12T09:15:00.000Z', 1250),
    ];

    const consumption = consumptionFromPositions(positions);
    expect(consumption).not.toBeNull();
    expect(consumption!.activeDurationS).toBe(4500);
    expect(consumption!.elevationGainM).toBe(300);
    expect(consumption!.loadScore).toBe(
      computeFatigue({ activeDurationS: 4500, gainM: 300, lossM: 0 }).score
    );

    expect(consumptionFromPositions([positions[0]])).toBeNull();
    expect(
      consumptionFromPositions([
        position(45.1, 'pas-une-date', 100),
        position(45.2, '2026-09-12T08:00:00.000Z', 150),
      ])
    ).toBeNull();
    // Altitudes manquantes : le D+ reste 0, jamais deviné.
    const noAltitude = consumptionFromPositions([
      position(45.1, '2026-09-12T08:00:00.000Z'),
      position(45.2, '2026-09-12T08:30:00.000Z'),
    ]);
    expect(noAltitude!.elevationGainM).toBe(0);
  });

  it('TEST-PHASE6-ETA-04: la vue cockpit porte la consommation live', () => {
    const input: CockpitInput = {
      plan: null,
      prediction: null,
      liveReports: [],
      decisionsRequired: [],
      recalcReasons: [],
      offline: false,
      consumption: { activeDurationS: 3600, elevationGainM: 300, loadScore: 13 },
    };

    const view = buildCockpitView(input);
    expect(view.consumption).toEqual({
      activeDurationS: 3600,
      elevationGainM: 300,
      loadScore: 13,
    });
    expect(buildCockpitView({ ...input, consumption: null }).consumption).toBeNull();
  });
});

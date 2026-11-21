import { describe, expect, it } from 'vitest';
import {
  buildDestinationSafetyBrief,
  diffReservationChange,
  evaluateTrackGuidance,
  recomputeResourcesWithoutLoss,
  resolveCollectiveDecision,
  shiftUpcomingSteps,
  summarizeSubgroups,
} from '@/features/hub/cockpit/terrainAndCollectiveContracts';

describe('terrain and collective contracts (P02-10, P03, P05-15, P07)', () => {
  it('recomputes group resources without overwriting manual user overrides (P02-10)', () => {
    const out = recomputeResourcesWithoutLoss([
      { id: 'water', perPerson: 2, quantity: 4 },
      { id: 'tent', perPerson: 0.5, quantity: 3, manualOverride: true },
    ], 5);
    expect(out[0].quantity).toBe(10);
    expect(out[1].quantity).toBe(3); // preserved!
  });

  it('detects off-track deviation and computes track guidance progress (P07-13)', () => {
    expect(evaluateTrackGuidance(3000, 10000, 15)).toEqual({
      offTrack: false, crossM: 15, remainingM: 7000, progressPct: 30,
    });
    expect(evaluateTrackGuidance(3000, 10000, 95).offTrack).toBe(true);
  });

  it('shifts only upcoming incomplete steps (P07-26)', () => {
    const shifted = shiftUpcomingSteps([
      { id: 's1', plannedMinutes: 480, completed: true },
      { id: 's2', plannedMinutes: 600, completed: false },
    ], 30);
    expect(shifted[0].plannedMinutes).toBe(480);
    expect(shifted[1].plannedMinutes).toBe(630);
  });

  it('summarizes subgroups, resolves collective polls, diffs reservations and builds destination brief', () => {
    const subs = summarizeSubgroups([
      { id: '1', subgroup: 'Rapide', presence: 'present' },
      { id: '2', subgroup: 'Rapide', presence: 'absent' },
      { id: '3', subgroup: 'Tranquille', presence: 'pending' },
    ]);
    expect(subs).toEqual({
      Rapide: { present: 1, absent: 1, pending: 0 },
      Tranquille: { present: 0, absent: 0, pending: 1 },
    });

    expect(resolveCollectiveDecision({ u1: 'A', u2: 'A', u3: 'B' })).toEqual({
      winner: 'A', counts: { A: 2, B: 1 }, tie: false,
    });
    expect(resolveCollectiveDecision({ u1: 'A', u2: 'B' }).tie).toBe(true);

    const changes = diffReservationChange(
      { id: 'r1', status: 'pending', when: '2026-11-22', reference: 'ABC' },
      { id: 'r1', status: 'confirmed', when: '2026-11-23', reference: 'XYZ' },
    );
    expect(changes).toHaveLength(3);

    expect(buildDestinationSafetyBrief('CH').emergencyNumber).toBe('112 / 1414 (REGA)');
    expect(buildDestinationSafetyBrief('FR').emergencyNumber).toBe('112');
  });
});

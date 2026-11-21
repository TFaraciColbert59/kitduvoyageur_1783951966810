import { describe, expect, it } from 'vitest';
import {
  classifyWeatherHorizon,
  estimateTrailCondition,
  sampleRouteWeatherPoints,
} from '@/features/hub/cockpit/weatherAdvanced';
import {
  canViewDocumentByHolder,
  computeExactSettlements,
  evaluateGearMaintenance,
} from '@/features/hub/cockpit/settlementsAndGear';
import {
  IdempotentActivityFinalizer,
  isTempShareValid,
  shouldNotifyChange,
} from '@/features/hub/cockpit/activityFinalization';
import { buildTripStoryDraft } from '@/features/hub/cockpit/storySummary';

describe('cockpit complete domain (P03, P05, P07, P08)', () => {
  it('separates forecast horizon vs climatology and estimates trail surface honestly', () => {
    expect(classifyWeatherHorizon('2026-11-23', '2026-11-21')).toBe('short_term_forecast');
    expect(classifyWeatherHorizon('2026-11-28', '2026-11-21')).toBe('extended_forecast');
    expect(classifyWeatherHorizon('2026-12-15', '2026-11-21')).toBe('beyond_horizon_climatology');

    expect(estimateTrailCondition({ rainMm: 5, minTempC: -1 }).condition).toBe('snow_ice_risk');
    expect(estimateTrailCondition({ rainMm: 18, minTempC: 10 }).condition).toBe('muddy');
    expect(estimateTrailCondition({}).condition).toBe('unknown');

    const pts = sampleRouteWeatherPoints([[[6.8, 45.9], [6.85, 45.92], [6.9, 45.94], [6.95, 45.96]]]);
    expect(pts).toHaveLength(3);
  });

  it('computes exact integer-cent settlements, gear maintenance and holder-strict document access', () => {
    const settlements = computeExactSettlements({ u1: 1000, u2: -334, u3: -666 });
    expect(settlements.reduce((s, t) => s + t.cents, 0)).toBe(1000);
    expect(settlements).toEqual([
      { fromUserId: 'u3', toUserId: 'u1', cents: 666, amount: 6.66 },
      { fromUserId: 'u2', toUserId: 'u1', cents: 334, amount: 3.34 },
    ]);

    expect(evaluateGearMaintenance({ condition: 'a_remplacer', ownershipMode: 'rented' }).needsAttention).toBe(true);
    expect(evaluateGearMaintenance({ condition: 'bon', ownershipMode: 'borrowed' }).needsAttention).toBe(false);

    // Passeport/médical strictement réservé au titulaire même si le viewer est éditeur
    expect(canViewDocumentByHolder({ category: 'passport', holderUserId: 'u1', viewerUserId: 'u2', viewerIsTripEditor: true })).toBe(false);
    expect(canViewDocumentByHolder({ category: 'passport', holderUserId: 'u1', viewerUserId: 'u1', viewerIsTripEditor: false })).toBe(true);
    expect(canViewDocumentByHolder({ category: 'booking', holderUserId: 'u1', viewerUserId: 'u2', viewerIsTripEditor: true })).toBe(true);
  });

  it('enforces single activity finalization, revocable temp share, notification filtering and story export', () => {
    const finalizer = new IdempotentActivityFinalizer();
    const first = finalizer.finalize('sess-1', 'op-1', '2026-11-21T10:00:00Z');
    const second = finalizer.finalize('sess-1', 'op-2', '2026-11-21T10:05:00Z');
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.record.operationId).toBe('op-1');

    const now = Date.parse('2026-11-21T12:00:00Z');
    expect(isTempShareValid({ token: 't', tripId: '1', expiresAtMs: now + 60_000, revoked: false }, now)).toBe(true);
    expect(isTempShareValid({ token: 't', tripId: '1', expiresAtMs: now + 60_000, revoked: true }, now)).toBe(false);
    expect(isTempShareValid({ token: 't', tripId: '1', expiresAtMs: now - 1, revoked: false }, now)).toBe(false);

    expect(shouldNotifyChange('route_revision_published')).toBe(true);
    expect(shouldNotifyChange('minor_note_edit')).toBe(false);

    const story = buildTripStoryDraft({
      title: 'Tour des Aiguilles',
      steps: [{ id: 's1', title: 'Col', day: 1, time: '08:00', place: null, distance: 8, elevation: 500, description: null, coordinate: null }],
      executions: {
        s1: {
          step_id: 's1', status: 'completed', version: 1, occurred_at: '2026-11-21T10:00:00Z',
          actual_started_at: null, actual_arrived_at: null, actual_completed_at: '2026-11-21T10:00:00Z',
          note: 'NOTE INTERNE SECRETE', archived: false, planned_title: 'Col', planned_day_number: 1, planned_start_time: '08:00',
        },
      },
      moments: [{ title: 'Lever de soleil', day: 1, time: '07:15' }],
    });
    expect(story.completedSteps).toBe(1);
    expect(story.markdown).not.toContain('NOTE INTERNE SECRETE');
  });
});

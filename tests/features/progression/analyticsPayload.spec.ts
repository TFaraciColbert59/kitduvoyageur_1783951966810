/** T46 — payloads analytics : clés interdites retirées, valeurs suspectes neutralisées. */
import { describe, it, expect } from 'vitest';
import {
  PROGRESSION_ANALYTICS_EVENTS,
  analyticsDoctrine,
  sanitizeAnalyticsPayload,
} from '@/features/progression/domain/analytics';

describe('assainissement des payloads analytics', () => {
  it('retire traces, coordonnées, conversations, documents et santé', () => {
    const { payload, droppedKeys } = sanitizeAnalyticsPayload({
      source: 'progression_card',
      count: 3,
      positions: [{ lat: 45.1 }],
      latitude: 45.123456,
      conversation_id: 'abc',
      health_note: 'blessure',
      passport_number: 'X123',
      email: 'user@test.fr',
    });

    expect(payload).toEqual({ source: 'progression_card', count: 3 });
    expect(droppedKeys.sort()).toEqual(
      ['conversation_id', 'email', 'health_note', 'latitude', 'passport_number', 'positions'].sort()
    );
    expect(JSON.stringify(payload)).not.toMatch(/45\.1|@|blessure|X123/);
  });

  it('valeurs suspectes (email/coordonnée) supprimées même sous une clé innocente', () => {
    const { payload, droppedKeys } = sanitizeAnalyticsPayload({
      label: 'user@test.fr',
      point: '45.123456',
      ok: true,
      n: 42,
    });
    expect(payload).toEqual({ ok: true, n: 42 });
    expect(droppedKeys.sort()).toEqual(['label', 'point'].sort());
  });

  it('payload profond/objet → jamais transmis ; doctrine : XP seul ≠ succès', () => {
    const { payload } = sanitizeAnalyticsPayload({ nested: { deep: 1 } });
    expect(payload).toEqual({});
    expect(analyticsDoctrine()).toEqual({ xpAloneIsSuccess: false, cohortRequired: true });
    expect(PROGRESSION_ANALYTICS_EVENTS.length).toBeGreaterThan(8);
  });
});

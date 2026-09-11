import { describe, it, expect } from 'vitest';
import {
  MAX_PROCESSING_ATTEMPTS,
  SESSION_LEASE_MINUTES,
  computeRetryDelayMinutes,
  planSessionFailure,
} from '@/features/adventure-intelligence/domain/sessionRetry';

const NOW = '2026-09-11T10:00:00.000Z';

describe('A10 — Politique de reprise des sessions (TEST-A10-LEASE)', () => {
  it('TEST-A10-LEASE-01: une première tentative replanifie avec backoff 2 minutes', () => {
    const plan = planSessionFailure(1, NOW);

    expect(plan.status).toBe('pending');
    expect(plan.exhausted).toBe(false);
    expect(plan.delayMinutes).toBe(2);
    expect(plan.nextRetryAt).toBe('2026-09-11T10:02:00.000Z');
  });

  it('TEST-A10-LEASE-02: le backoff double à chaque tentative', () => {
    expect(computeRetryDelayMinutes(0)).toBe(1);
    expect(computeRetryDelayMinutes(1)).toBe(2);
    expect(computeRetryDelayMinutes(2)).toBe(4);
    expect(computeRetryDelayMinutes(3)).toBe(8);

    const beforeLast = planSessionFailure(4, NOW);
    expect(beforeLast.status).toBe('pending');
    expect(beforeLast.delayMinutes).toBe(16);
    expect(beforeLast.nextRetryAt).toBe('2026-09-11T10:16:00.000Z');
  });

  it('TEST-A10-LEASE-03: au-delà du plafond, la session est dead-letter terminale', () => {
    const plan = planSessionFailure(MAX_PROCESSING_ATTEMPTS, NOW);

    expect(plan.status).toBe('dead_letter');
    expect(plan.exhausted).toBe(true);
    expect(plan.nextRetryAt).toBeNull();
    expect(plan.delayMinutes).toBe(0);

    expect(planSessionFailure(9, NOW).status).toBe('dead_letter');
    expect(SESSION_LEASE_MINUTES).toBe(15);
  });
});

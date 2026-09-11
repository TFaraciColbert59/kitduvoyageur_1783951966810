import { describe, it, expect } from 'vitest';
import {
  AUTONOMY_CONFIRMATION_ACTIONS,
  AUTONOMY_LEVELS,
  canAutoExecute,
  requiredConfirmations,
} from '@/features/adventure-intelligence/domain/autonomy';
import { DECISION_TYPES } from '@/features/adventure-intelligence/domain/decisions';

describe('A6 — autonomie et confirmations (TEST-A6-AUTO)', () => {
  it('TEST-A6-AUTO-01: les actions à confirmation couvrent exactement les types structurants', () => {
    expect([...AUTONOMY_CONFIRMATION_ACTIONS]).toEqual([
      'payment',
      'cancellation',
      'safety_change',
      'location_share',
      'group_change',
    ]);
    expect([...AUTONOMY_CONFIRMATION_ACTIONS]).toEqual(
      DECISION_TYPES.filter((type) => type !== 'other')
    );

    for (const action of AUTONOMY_CONFIRMATION_ACTIONS) {
      expect(requiredConfirmations(action)).toBe(true);
    }
    expect(requiredConfirmations('other')).toBe(false);
  });

  it('TEST-A6-AUTO-02: les niveaux d’autonomie bornent l’exécution automatique', () => {
    expect([...AUTONOMY_LEVELS]).toEqual(['advisor', 'copilot', 'guided_autopilot']);

    expect(canAutoExecute('advisor', 'other')).toBe(false);
    expect(canAutoExecute('copilot', 'other')).toBe(true);
    expect(canAutoExecute('guided_autopilot', 'other')).toBe(true);

    for (const level of AUTONOMY_LEVELS) {
      expect(canAutoExecute(level, 'payment')).toBe(false);
      expect(canAutoExecute(level, 'cancellation')).toBe(false);
      expect(canAutoExecute(level, 'safety_change')).toBe(false);
      expect(canAutoExecute(level, 'location_share')).toBe(false);
      expect(canAutoExecute(level, 'group_change')).toBe(false);
    }
  });
});

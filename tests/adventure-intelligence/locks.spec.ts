import { describe, it, expect } from 'vitest';
import {
  detectLockViolations,
  restoreLockedConstraints,
  buildLockConfirmationDecisions,
} from '@/features/adventure-intelligence/domain/locks';
import type { AdventureConstraint } from '@/features/adventure-intelligence/domain/constraints';

const PLAN_ID = 'a6000000-0000-4000-8000-0000000000aa';
const NOW = '2026-09-11T12:00:00.000Z';

function constraint(overrides: Partial<AdventureConstraint> = {}): AdventureConstraint {
  return {
    id: 'budget-max',
    kind: 'hard',
    label: 'Budget maximum',
    value: 800,
    locked: true,
    source: 'user',
    ...overrides,
  };
}

describe('A6 — verrous (TEST-A6-LOCK)', () => {
  it('TEST-A6-LOCK-01: toute violation d’un verrou est détectée (valeur, déverrouillage, disparition)', () => {
    const before = [
      constraint({ id: 'budget-max', value: 800 }),
      constraint({ id: 'safety-level', value: 'prudent', source: 'safety' }),
      constraint({ id: 'gear-weight', value: 8, label: 'Poids max', source: 'system' }),
      constraint({ id: 'free-choice', value: 'nord', locked: false, source: 'user' }),
    ];
    const after = [
      constraint({ id: 'budget-max', value: 950 }),
      constraint({ id: 'safety-level', value: 'prudent', locked: false, source: 'safety' }),
      constraint({ id: 'free-choice', value: 'sud', locked: false, source: 'user' }),
    ];

    const violations = detectLockViolations(before, after);

    expect(violations).toEqual(['budget-max', 'safety-level', 'gear-weight']);
    expect(violations).not.toContain('free-choice');

    const intact = detectLockViolations(before, before);
    expect(intact).toEqual([]);
  });

  it('TEST-A6-LOCK-02: la restauration réapplique la valeur verrouillée sans toucher au reste', () => {
    const before = [
      constraint({ id: 'budget-max', value: 800 }),
      constraint({ id: 'gear-weight', value: 8, label: 'Poids max', source: 'system' }),
    ];
    const after = [
      constraint({ id: 'budget-max', value: 950 }),
      constraint({ id: 'free-choice', value: 'sud', locked: false, source: 'user' }),
    ];

    const violations = detectLockViolations(before, after);
    const restored = restoreLockedConstraints(before, after, violations);
    const byId = new Map(restored.map((item) => [item.id, item]));

    expect(byId.get('budget-max')).toMatchObject({ value: 800, locked: true, source: 'user' });
    expect(byId.get('gear-weight')).toMatchObject({ value: 8, locked: true, source: 'system' });
    expect(byId.get('free-choice')).toMatchObject({ value: 'sud', locked: false });

    const untouched = restoreLockedConstraints(before, before, []);
    expect(untouched).toHaveLength(2);
    expect(detectLockViolations(before, restored)).toEqual([]);
  });

  it('TEST-A6-LOCK-03: une violation journalise une décision à confirmer', () => {
    const before = [constraint({ id: 'budget-max', value: 800 })];
    const decisions = buildLockConfirmationDecisions(PLAN_ID, before, ['budget-max'], NOW);

    expect(decisions).toHaveLength(1);
    const decision = decisions[0];
    expect(decision.planId).toBe(PLAN_ID);
    expect(decision.requiresConfirmation).toBe(true);
    expect(decision.status).toBe('proposed');
    expect(decision.proposal).toContain('Budget maximum');
    expect(decision.impact.length).toBeGreaterThan(0);
    expect(decision.impact[0].severity).toBe('warning');
    expect(decision.createdAt).toBe(NOW);
  });
});

import { describe, it, expect } from 'vitest';
import {
  AI_BUDGET_CONFIG,
  evaluateAiBudget,
  maskUserId,
  summarizeAiUsage,
  type AiUsageDailyRow,
} from '@/lib/observability/aiBudget';

const USER_A = 'a1000000-0000-4000-8000-0000000000aa';
const USER_B = 'b2000000-0000-4000-8000-0000000000bb';

describe('Phase 10 — budget IA (TEST-P10-BUDGET)', () => {
  it('TEST-P10-BUDGET-01: agrégation réelle de `ai_usage_daily` (totaux, features, jours)', () => {
    const rows: AiUsageDailyRow[] = [
      {
        user_id: USER_A,
        day: '2026-09-11',
        requests_heavy: 3,
        requests_fast: 10,
        requests_by_feature: { adventure_generate: 2, narrative: 1 },
      },
      {
        user_id: USER_A,
        day: '2026-09-12',
        requests_heavy: 1,
        requests_fast: 5,
        requests_by_feature: { narrative: 2 },
      },
      { user_id: USER_B, day: '2026-09-12', requests_heavy: 0, requests_fast: 2, requests_by_feature: {} },
    ];

    const summary = summarizeAiUsage(rows);

    expect(summary.rows).toBe(3);
    expect(summary.users).toBe(2);
    expect(summary.requestsHeavy).toBe(4);
    expect(summary.requestsFast).toBe(17);
    expect(summary.totalRequests).toBe(21);
    expect(summary.byFeature).toEqual({ adventure_generate: 2, narrative: 3 });
    expect(summary.firstDay).toBe('2026-09-11');
    expect(summary.lastDay).toBe('2026-09-12');
  });

  it('TEST-P10-BUDGET-02: budget global/monétaire non configuré ⇒ insufficient_data (jamais un faux ok)', () => {
    const evaluation = evaluateAiBudget([
      { user_id: USER_A, day: '2026-09-12', requests_heavy: 2, requests_fast: 8 },
    ]);

    expect(evaluation.status).toBe('insufficient_data');
    expect(evaluation.checks.find((check) => check.id === 'global_daily_requests')?.ok).toBeNull();
    expect(evaluation.checks.find((check) => check.id === 'monetary_budget_usd')?.ok).toBeNull();
    expect(evaluation.reason).toContain('INSUFFICIENT_DATA');
    expect(AI_BUDGET_CONFIG.globalDailyRequests).toBeNull();
  });

  it('TEST-P10-BUDGET-03: dépassement du plafond réel par utilisateur ⇒ quota_exceeded, identifiant masqué', () => {
    const evaluation = evaluateAiBudget([
      { user_id: USER_A, day: '2026-09-12', requests_heavy: 21, requests_fast: 0 },
      { user_id: USER_B, day: '2026-09-12', requests_heavy: 0, requests_fast: 101 },
    ]);

    expect(evaluation.status).toBe('quota_exceeded');
    expect(evaluation.offenders).toHaveLength(2);
    expect(evaluation.offenders.map((offender) => offender.tier)).toEqual(['heavy', 'fast']);
    for (const offender of evaluation.offenders) {
      expect(offender.userId).not.toBe(USER_A);
      expect(offender.userId).not.toBe(USER_B);
      expect(offender.userId).toContain('…');
    }
  });

  it('TEST-P10-BUDGET-04: budget global fourni ⇒ comparaison réelle', () => {
    const rows: AiUsageDailyRow[] = [
      { user_id: USER_A, day: '2026-09-12', requests_heavy: 5, requests_fast: 50 },
    ];

    const within = evaluateAiBudget(rows, {
      ...AI_BUDGET_CONFIG,
      globalDailyRequests: 100,
      monetaryBudgetUsd: 10,
      costPerRequestUsd: 0.001,
    });
    expect(within.status).toBe('within_budget');
    expect(within.totals.totalRequests).toBe(55);

    const exceeded = evaluateAiBudget(rows, {
      ...AI_BUDGET_CONFIG,
      globalDailyRequests: 10,
      monetaryBudgetUsd: 0.01,
      costPerRequestUsd: 0.001,
    });
    expect(exceeded.status).toBe('quota_exceeded');
    expect(exceeded.checks.find((check) => check.id === 'monetary_budget_usd')?.ok).toBe(false);
  });

  it('TEST-P10-BUDGET-05: masquage d’identifiant stable et sans UUID complet', () => {
    expect(maskUserId(USER_A)).toBe('a1000000…');
    expect(maskUserId(null)).toBe('inconnu');
    expect(maskUserId(undefined)).toBe('inconnu');
  });
});

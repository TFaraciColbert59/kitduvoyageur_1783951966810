import { describe, expect, it } from 'vitest';

import { auditInputSchema } from '@/server/admin/audit';

const ACTOR = '11111111-1111-4111-8111-111111111111';

describe('audit strict', () => {
  it('accepte les champs canoniques risk_tier/correlation/command/reason/result', () => {
    const parsed = auditInputSchema.safeParse({
      action: 'commerce.refund.request',
      actor_id: ACTOR,
      target_table: 'orders',
      target_id: 'order-1',
      risk_tier: 3,
      correlation_id: '00000000-0000-4000-8000-000000000000',
      command_id: '00000000-0000-4000-8000-000000000001',
      reason: 'client débité deux fois, ticket #123',
      result: 'succeeded',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.risk_tier).toBe(3);
      expect(parsed.data.reason).toMatch(/ticket/);
    }
  });

  it('rejette un risk_tier hors 0-4', () => {
    const parsed = auditInputSchema.safeParse({
      action: 'test',
      actor_id: ACTOR,
      risk_tier: 9,
    });
    expect(parsed.success).toBe(false);
  });
});

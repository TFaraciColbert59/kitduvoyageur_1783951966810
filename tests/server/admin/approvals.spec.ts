import { describe, expect, it } from 'vitest';

import { SOD_RULE, isSelfApproval } from '@/server/admin/approvals';

describe('approval SoD', () => {
  it('interdit initiateur=approbateur', () => {
    expect(SOD_RULE).toMatch(/initiator.*approver/i);
    expect(
      isSelfApproval(
        '11111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111111'
      )
    ).toBe(true);
  });

  it('autorise un approbateur distinct', () => {
    expect(
      isSelfApproval(
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222'
      )
    ).toBe(false);
  });
});

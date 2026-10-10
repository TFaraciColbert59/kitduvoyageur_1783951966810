import { describe, expect, it } from 'vitest';

import { AdminRiskBadge, TIER_LABEL } from '@/components/admin-os/AdminRiskBadge';
import { diffObjects } from '@/features/admin-os/audit/diff';

describe('primitives', () => {
  it('AdminRiskBadge expose les 5 tiers', () => {
    expect(AdminRiskBadge).toBeDefined();
    expect(TIER_LABEL[4]).toMatch(/critique/i);
  });

  it('diffObjects liste les champs modifiés', () => {
    const d = diffObjects({ a: 1, b: 2 }, { a: 1, b: 3 });
    expect(d).toEqual([{ field: 'b', before: 2, after: 3 }]);
  });

  it('diffObjects signale les suppressions (forensique)', () => {
    const d = diffObjects({ a: 1, mfa: true }, { a: 1 });
    expect(d).toEqual([{ field: 'mfa', before: true, after: undefined }]);
  });
});

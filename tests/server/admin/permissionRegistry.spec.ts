import { describe, expect, it } from 'vitest';

import { PERMISSION_REGISTRY, requiresApproval } from '@/server/admin/permissions';

describe('permission registry', () => {
  it('expose commerce.refund.approve en Tier4 avec approbation', () => {
    expect(PERMISSION_REGISTRY['commerce.refund.approve'].tier).toBe(4);
    expect(requiresApproval('commerce.refund.approve')).toBe(true);
  });

  it('expose users.profile.read en Tier0 sans approbation', () => {
    expect(PERMISSION_REGISTRY['users.profile.read'].tier).toBe(0);
    expect(requiresApproval('users.profile.read')).toBe(false);
  });
});

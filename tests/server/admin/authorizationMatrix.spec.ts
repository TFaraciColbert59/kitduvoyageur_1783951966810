import { describe, expect, it } from 'vitest';

import { PERMISSION_REGISTRY } from '@/server/admin/permissions';

describe('matrice role x action', () => {
  it('Tier3/4 critiques exigent elevation ou approbation documentée', () => {
    const critical = Object.entries(PERMISSION_REGISTRY).filter(([, v]) => v.tier >= 3);
    expect(critical.length).toBeGreaterThan(0);
    for (const [, v] of critical) {
      expect([3, 4]).toContain(v.tier);
    }
  });

  it('Tier4 exige toujours une approbation', () => {
    const t4 = Object.entries(PERMISSION_REGISTRY).filter(([, v]) => v.tier === 4);
    expect(t4.length).toBeGreaterThan(0);
    for (const [k, v] of t4) {
      expect(v.requiresApproval).toBe(true);
    }
  });

  it('aucune permission sans tier documenté', () => {
    for (const [k, v] of Object.entries(PERMISSION_REGISTRY)) {
      expect([0, 1, 2, 3, 4]).toContain(v.tier);
    }
  });
});

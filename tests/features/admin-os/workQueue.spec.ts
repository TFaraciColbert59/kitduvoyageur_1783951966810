import { describe, expect, it } from 'vitest';

import { groupWorkItems, maskReason } from '@/features/admin-os/work/queries';

describe('work queue grouping', () => {
  it('regroupe par niveau P0/P1/P2 en conservant l’ordre', () => {
    const g = groupWorkItems([
      { level: 'P1' as const, title: 'b' },
      { level: 'P0' as const, title: 'a' },
      { level: 'P0' as const, title: 'c' },
    ]);
    expect(g.P0.map((i) => i.title)).toEqual(['a', 'c']);
    expect(g.P1.map((i) => i.title)).toEqual(['b']);
    expect(g.P2).toEqual([]);
  });

  it('maskReason masque les emails et tronque', () => {
    expect(maskReason('contacter alice@example.com vite')).toBe('contacter a***@example.com vite');
    expect(maskReason('x'.repeat(200)).length).toBeLessThanOrEqual(141);
  });
});

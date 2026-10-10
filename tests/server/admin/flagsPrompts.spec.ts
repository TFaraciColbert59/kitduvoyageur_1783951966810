import { describe, expect, it } from 'vitest';

import { flagDebt } from '@/features/admin-os/experiments/flags';
import { canTransitionPrompt } from '@/features/admin-os/ai/prompts';

describe('flag debt', () => {
  it('détecte stale + always-on', () => {
    const old = new Date(Date.now() - 100 * 86400000).toISOString();
    const d = flagDebt([
      { id: 'x', enabled: true, updated_at: old },
      { id: 'y', enabled: false, updated_at: new Date().toISOString() },
    ]);
    expect(d.find((f) => f.id === 'x')?.tags).toEqual(
      expect.arrayContaining(['stale', 'always_on'])
    );
    expect(d.find((f) => f.id === 'y')?.tags).toEqual([]);
  });
});

describe('prompt transitions', () => {
  it('production exige une commande approved liée', () => {
    expect(canTransitionPrompt('review', 'production', null)).toBe('promotion_unlinked');
    expect(
      canTransitionPrompt('review', 'production', {
        command_key: 'ai.prompt.promote',
        status: 'awaiting_approval',
        resource_id: 'k',
      })
    ).toBe('promotion_not_approved');
    expect(
      canTransitionPrompt('review', 'production', {
        command_key: 'ai.prompt.promote',
        status: 'approved',
        resource_id: 'k',
      })
    ).toBeNull();
  });

  it('production liée à une autre clé → refusé', () => {
    expect(
      canTransitionPrompt('review', 'production', {
        command_key: 'ai.prompt.promote',
        status: 'approved',
        resource_id: 'other-key',
      }, 'my-key')
    ).toBe('promotion_unlinked');
  });

  it('draft → review libre, statut inconnu refusé', () => {
    expect(canTransitionPrompt('draft', 'review', null)).toBeNull();
    expect(canTransitionPrompt('draft', 'nope', null)).toBe('invalid_status');
  });
});

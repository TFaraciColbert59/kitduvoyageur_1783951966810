import { describe, it, expect } from 'vitest';
import { isCrewVisible, isCrewSolo } from '@/features/hub/engine/crewVisibility';

/**
 * H-ACT §4 — Couche groupe universelle : visibilité des équipages auto-créés.
 */

describe('H-ACT — isCrewVisible / isCrewSolo', () => {
  it('GRP-1: équipage manuel toujours visible', () => {
    expect(isCrewVisible({ auto_created: false, member_count: 1 })).toBe(true);
    expect(isCrewVisible({ auto_created: null, member_count: 0 })).toBe(true);
    expect(isCrewVisible({})).toBe(true);
  });

  it('GRP-2: équipage auto solo (<=1 membre) = invisible', () => {
    expect(isCrewVisible({ auto_created: true, member_count: 1 })).toBe(false);
    expect(isCrewVisible({ auto_created: true, member_count: 0 })).toBe(false);
    expect(isCrewVisible({ auto_created: true })).toBe(false);
  });

  it('GRP-3: équipage auto collectif (>=2 membres) = visible', () => {
    expect(isCrewVisible({ auto_created: true, member_count: 2 })).toBe(true);
    expect(isCrewVisible({ auto_created: true, member_count: 5 })).toBe(true);
  });

  it('GRP-4: isCrewSolo reflète l\'état invisible', () => {
    expect(isCrewSolo({ auto_created: true, member_count: 1 })).toBe(true);
    expect(isCrewSolo({ auto_created: true, member_count: 2 })).toBe(false);
    expect(isCrewSolo({ auto_created: false, member_count: 1 })).toBe(false);
  });
});
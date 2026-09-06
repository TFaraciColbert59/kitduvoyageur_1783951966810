import { describe, it, expect } from 'vitest';
import { getPreDepartureChecklist, getChecklistProgress } from '@/features/trips/components/TripChecklistView';

describe('Phase 5.1 & 8.2 — Checklist Pré-Départ Automatisée', () => {
  it('generates the 3 temporal groups: J-30, J-7, J-1', () => {
    const checklist = getPreDepartureChecklist(15); // 15 days before start
    expect(checklist).toHaveProperty('j30');
    expect(checklist).toHaveProperty('j7');
    expect(checklist).toHaveProperty('j1');
    expect(checklist.j30.length).toBeGreaterThan(0);
    expect(checklist.j7.length).toBeGreaterThan(0);
    expect(checklist.j1.length).toBeGreaterThan(0);
  });

  it('calculates progress accurately based on checked items', () => {
    const checked = new Set(['j30-passport', 'j30-insurance']);
    const progress = getChecklistProgress(checked, 10);
    expect(progress).toBe(20); // 2 / 10 * 100%
  });
});

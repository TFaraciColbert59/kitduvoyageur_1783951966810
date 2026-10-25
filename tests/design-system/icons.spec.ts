import { describe, it, expect } from 'vitest';
import { SEMANTIC_ICONS, getSemanticIcon } from '@/lib/icons';

describe('Sous-phase 2.4 — Normalisation des icônes Lucide (TDD)', () => {
  it('TEST-ICON-01: semantic icon registry contains standard icons', () => {
    expect(SEMANTIC_ICONS.compass).toBeDefined();
    expect(SEMANTIC_ICONS.users).toBeDefined();
    expect(SEMANTIC_ICONS.gear).toBeDefined();
    expect(SEMANTIC_ICONS.mountain).toBeDefined();
  });

  it('TEST-ICON-02: getSemanticIcon returns valid React component', () => {
    const IconComp = getSemanticIcon('safety');
    expect(typeof IconComp).toBe('object'); // forwardRef component
  });

  it('TEST-ICON-03: fallback icon is Compass when unknown name passed', () => {
    const Fallback = getSemanticIcon('unknown' as any);
    expect(Fallback).toBe(SEMANTIC_ICONS.compass);
  });
});

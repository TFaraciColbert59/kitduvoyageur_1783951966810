import { describe, it, expect } from 'vitest';
import { SEMANTIC_ICONS, getSemanticIcon } from '@/lib/icons';

describe('Icônes sémantiques — toutes issues de la base LKDV V2', () => {
  it('TEST-ICON-01: le registre sémantique contient les icônes standard', () => {
    expect(SEMANTIC_ICONS.compass).toBeDefined();
    expect(SEMANTIC_ICONS.users).toBeDefined();
    expect(SEMANTIC_ICONS.gear).toBeDefined();
    expect(SEMANTIC_ICONS.mountain).toBeDefined();
  });

  it('TEST-ICON-02: getSemanticIcon renvoie un composant React valide', () => {
    const IconComp = getSemanticIcon('safety');
    expect(typeof IconComp).toBe('function');
  });

  it('TEST-ICON-03: la boussole sert de repli pour un nom inconnu', () => {
    const Fallback = getSemanticIcon('unknown' as never);
    expect(Fallback).toBe(SEMANTIC_ICONS.compass);
  });
});

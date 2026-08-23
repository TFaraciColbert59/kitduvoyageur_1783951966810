import { describe, it, expect } from 'vitest';
import { detectConflicts } from '@/lib/materiel/conflicts';

const loans = [
  { id: 'l1', product_ownership_id: 'p1', due_date: '2026-09-01', status: 'en_cours' },
  { id: 'l2', product_ownership_id: 'p2', due_date: '2026-08-20', status: 'en_retard' },
  { id: 'l3', product_ownership_id: 'p3', due_date: null, status: 'rendu' },
];
const kitIds = new Set(['p1', 'p3']);
const itemsById = new Map<string, string>([['p1', 'Tente'], ['p2', 'Réchaud'], ['p3', 'Lampe']]);

describe('detectConflicts', () => {
  it('détecte un objet prêté et présent dans un kit', () => {
    const c = detectConflicts(loans, kitIds, itemsById);
    expect(c.length).toBe(1);
    expect(c[0].itemId).toBe('p1');
    expect(c[0].itemName).toBe('Tente');
    expect(c[0].conflictType).toBe('kit_vs_loan');
  });

  it('ignore les prêts rendus', () => {
    const c = detectConflicts(loans, kitIds, itemsById);
    expect(c.some((x) => x.itemId === 'p3')).toBe(false);
  });

  it('ne signale pas de conflit sans chevauchement', () => {
    const c = detectConflicts([{ id: 'x', product_ownership_id: 'p2', due_date: null, status: 'en_cours' }], kitIds, itemsById);
    expect(c).toEqual([]);
  });
});

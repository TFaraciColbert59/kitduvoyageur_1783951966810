import { describe, it, expect } from 'vitest';
import { compareKits } from '@/lib/materiel/comparator';

const A = [
  { name: 'Tente', category: 'Couchage', weight_g: 2200, quantity: 1 },
  { name: 'Sac', category: 'Portage', weight_g: 1200, quantity: 1 },
];
const B = [
  { name: 'Tente', category: 'Couchage', weight_g: 1900, quantity: 1 },
  { name: 'Réchaud', category: 'Cuisine', weight_g: 300, quantity: 1 },
];

describe('comparator', () => {
  it('calcule les totaux et l’écart', () => {
    const r = compareKits(A, B);
    expect(r.aTotalG).toBe(3400);
    expect(r.bTotalG).toBe(2200);
    expect(r.deltaG).toBe(-1200);
  });

  it('identifie communs et exclusifs', () => {
    const r = compareKits(A, B);
    expect(r.common).toEqual(['Tente']);
    expect(r.onlyA).toEqual(['Sac']);
    expect(r.onlyB).toEqual(['Réchaud']);
  });

  it('regroupe les poids par catégorie', () => {
    const r = compareKits(A, B);
    const couchage = r.categories.find((c) => c.category === 'Couchage');
    expect(couchage?.aG).toBe(2200);
    expect(couchage?.bG).toBe(1900);
  });
});

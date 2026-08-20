import { describe, it, expect } from 'vitest';
import { materielKitSchema, productOwnershipSchema, exportSchema } from '@/lib/schemas/materiel';

describe('productOwnershipSchema', () => {
  it('rejette un objet sans nom', () => {
    const result = productOwnershipSchema.safeParse({});
    expect(result.success).toBe(false);
  });
  it('accepte un objet valide', () => {
    const result = productOwnershipSchema.safeParse({ name: 'Tente 2P', weight_g: 2200 });
    expect(result.success).toBe(true);
  });
  it('rejette un poids négatif', () => {
    const result = productOwnershipSchema.safeParse({ name: 'X', weight_g: -5 });
    expect(result.success).toBe(false);
  });
});

describe('materielKitSchema', () => {
  it('rejette un kit sans nom', () => {
    const result = materielKitSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });
  it('accepte un kit valide', () => {
    const result = materielKitSchema.safeParse({ name: 'Trek 3 jours', items: [] });
    expect(result.success).toBe(true);
  });
  it('rejette plus de 200 articles', () => {
    const items = Array.from({ length: 201 }, () => ({ name: 'a', weight_g: 1 }));
    const result = materielKitSchema.safeParse({ name: 'K', items });
    expect(result.success).toBe(false);
  });
});

describe('exportSchema', () => {
  it('accepte un export csv inventaire', () => {
    expect(exportSchema.safeParse({ format: 'csv', scope: 'inventory' }).success).toBe(true);
  });
  it('rejette un format inconnu', () => {
    expect(exportSchema.safeParse({ format: 'xml', scope: 'inventory' }).success).toBe(false);
  });
});

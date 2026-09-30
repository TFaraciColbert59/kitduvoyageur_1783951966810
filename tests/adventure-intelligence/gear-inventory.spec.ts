import { describe, it, expect } from 'vitest';
import {
  assessOwnedGear,
  inventoryToKitItems,
  summarizeInventory,
  type OwnedGearRow,
} from '@/features/adventure-intelligence/domain/gearInventory';

const row = (overrides: Partial<OwnedGearRow> = {}): OwnedGearRow => ({
  id: 'g1',
  name: 'Lampe frontale Petzl',
  category: 'Lampes & Éclairage',
  weight_g: 90,
  condition: 'bon',
  is_lent: false,
  maintenance_due_at: null,
  expiry_date: null,
  quantity: 1,
  ...overrides,
});

describe('Chantier P0 — inventaire réel : possédé ≠ disponible ≠ préparé', () => {
  it('INV-01: un objet en bon état et non prêté est disponible', () => {
    expect(assessOwnedGear(row(), '2026-10-10').availability).toBe('disponible');
  });

  it('INV-02: un objet prêté n’est jamais disponible', () => {
    expect(assessOwnedGear(row({ is_lent: true }), '2026-10-10').availability).toBe('prete');
  });

  it('INV-03: « à remplacer » et « pour pièces » sont hors service', () => {
    expect(assessOwnedGear(row({ condition: 'a_remplacer' }), null).availability).toBe('hors_service');
    expect(assessOwnedGear(row({ condition: 'pour_pieces' }), null).availability).toBe('hors_service');
  });

  it('INV-04: entretien ou péremption échus au départ → à vérifier', () => {
    expect(
      assessOwnedGear(row({ maintenance_due_at: '2026-10-01' }), '2026-10-10').availability
    ).toBe('a_verifier');
    expect(assessOwnedGear(row({ expiry_date: '2026-10-10' }), '2026-10-10').availability).toBe(
      'a_verifier'
    );
    expect(assessOwnedGear(row({ expiry_date: '2027-01-01' }), '2026-10-10').availability).toBe(
      'disponible'
    );
  });

  it('INV-05: seuls les objets disponibles entrent dans le kit, jamais emballés', () => {
    const items = inventoryToKitItems(
      [row(), row({ id: 'g2', is_lent: true }), row({ id: 'g3', weight_g: null })],
      '2026-10-10',
      '2026-09-30T00:00:00.000Z'
    );
    expect(items.map((item) => item.inventory_item_id)).toEqual(['g1', 'g3']);
    expect(items.every((item) => item.is_packed === false)).toBe(true);
    expect(items[1].weight_grams).toBeNull();
  });

  it('INV-06: le résumé ne compte que des états, aucun nom', () => {
    const summary = summarizeInventory(
      [row(), row({ id: 'g2', is_lent: true }), row({ id: 'g3', condition: 'a_remplacer' })],
      null
    );
    expect(summary).toEqual({ disponible: 1, prete: 1, hors_service: 1, a_verifier: 0 });
  });
});

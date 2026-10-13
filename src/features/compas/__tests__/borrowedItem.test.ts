import { describe, expect, it } from 'vitest';
import { buildCompasModel, type CompasItemInput } from '../engine/compasModel';
import { compasInput, item, U2 } from './helpers/compasData';

/*
 * Un objet EMPRUNTÉ à quelqu'un de l'équipe (lot AH) : il est disponible. Avant, « Emprunter » n'écrivait
 * que le porteur (`owner_id`, `ownership`) : l'objet restait « manquant », dans `toAcquire` et
 * `vitalMissing`, et proposait encore Emprunter / Louer / Acheter.
 */

const stove = (extra: Partial<CompasItemInput> = {}) =>
  item({ id: 'stove', name: 'Réchaud', isVital: true, ownership: 'shared', ownerId: U2, ...extra });

const model = (items: CompasItemInput[], inventory = compasInput().inventory) =>
  buildCompasModel(compasInput({ items, inventory }));

describe('modèle : un objet emprunté est disponible', () => {
  it('CONTRE-EXEMPLE — confié à quelqu’un sans être emprunté, l’objet manque encore', () => {
    const m = model([stove()]);
    expect(m.kit.lines[0].status).toBe('missing');
    expect(m.kit.toAcquire).toHaveLength(1);
    expect(m.kit.vitalMissing).toHaveLength(1);
  });

  it('emprunté : ni manquant, ni à acquérir, ni vital manquant', () => {
    const m = model([stove({ borrowedFrom: U2 })]);
    const line = m.kit.lines[0];
    expect(line.status).toBe('owned');
    expect(line.borrowedFrom).toBe(U2);
    expect(m.kit.toAcquire).toEqual([]);
    expect(m.kit.vitalMissing).toEqual([]);
    // La prochaine décision n'est plus « Trouver : réchaud ».
    expect(m.nextDecision?.label ?? '').not.toMatch(/réchaud/i);
  });

  it('le prêteur est celui de la ligne, même sans porteur', () => {
    const m = model([stove({ borrowedFrom: U2, ownerId: null })]);
    expect(m.kit.lines[0].borrowedFrom).toBe(U2);
    expect(m.kit.lines[0].status).toBe('owned');
  });

  it('sans emprunt, borrowedFrom vaut null', () => {
    expect(model([stove()]).kit.lines[0].borrowedFrom).toBeNull();
    expect(model([stove({ borrowedFrom: undefined })]).kit.lines[0].borrowedFrom).toBeNull();
  });

  it('emprunté, l’état de TON exemplaire (prêté, à remplacer) ne le rend ni indisponible ni « à remplacer »', () => {
    const own = {
      id: 'p1',
      name: 'Frontale',
      brand: 'Petzl',
      category: null,
      weightG: 80,
      condition: 'bon',
      isLent: true,
      maintenanceDueAt: null,
      expiryDate: null,
      quantity: 1,
    };
    const lamp = (extra: Partial<CompasItemInput>) =>
      item({ id: 'a', name: 'Frontale', isVital: true, inventoryItemId: 'p1', ...extra });
    // Sans emprunt, la frontale prêtée est « à récupérer » ; empruntée, elle est là.
    expect(model([lamp({})], [own]).kit.lines[0].status).toBe('lent');
    const m = model([lamp({ borrowedFrom: U2, condition: 'a_remplacer' })], [own]);
    expect(m.kit.lines[0].status).toBe('owned');
    expect(m.kit.lines[0].lent).toBe(false);
    expect(m.kit.toAcquire).toEqual([]);
    expect(m.kit.vitalMissing).toEqual([]);
  });

  it('un objet emprunté s’emballe : l’emballage compte dans la préparation', () => {
    const m = model([stove({ borrowedFrom: U2, isPacked: true })]);
    expect(m.kit.lines[0].packed).toBe(true);
    expect(m.kit.packedPct).toBe(100);
  });

  it('un autre objet manquant reste manquant à côté d’un emprunt', () => {
    const m = model([stove({ borrowedFrom: U2 }), item({ id: 'bag', name: 'Duvet', isVital: true })]);
    expect(m.kit.toAcquire.map((l) => l.id)).toEqual(['bag']);
    expect(m.kit.vitalMissing.map((l) => l.id)).toEqual(['bag']);
    expect(m.nextDecision?.label).toBe('Trouver : duvet');
  });
});

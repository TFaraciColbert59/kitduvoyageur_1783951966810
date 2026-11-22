import { describe, expect, it } from 'vitest';
import { distributeSharedGear } from '../sharedGear';
import { kit } from './fixtures';

describe('distributeSharedGear', () => {
  const items = [kit('tente', { weightGrams: 2000 }), kit('rechaud', { weightGrams: 400 }), kit('corde', { weightGrams: 800 }), kit('perso', { shared: false, weightGrams: 9000 })];
  it('répartit selon le niveau : le confirmé porte plus que le débutant', () => {
    const p = distributeSharedGear(items, [
      { id: 'a', name: 'Ana', level: 'confirme' },
      { id: 'b', name: 'Ben', level: 'debutant' },
    ]);
    expect(p.totalGrams).toBe(3200);
    const [a, b] = p.loads;
    expect(a.totalGrams + b.totalGrams).toBe(3200);
    expect(a.totalGrams).toBeGreaterThan(b.totalGrams);
    expect(p.loads.flatMap((l) => l.carries).map((c) => c.itemId)).not.toContain('perso');
    expect(p.balanced).toBe(true);
    expect(p.maxDeviationGrams).toBeLessThanOrEqual(p.reasonableDeviationGrams);
  });
  it('tient compte de l’allure et conserve les affectations existantes', () => {
    const p = distributeSharedGear([kit('tente', { weightGrams: 2000, assigneeUserId: 'b' }), kit('gaz', { weightGrams: 200 })], [
      { id: 'a', name: 'Ana', speedKmh: 5 },
      { id: 'b', name: 'Ben', speedKmh: 3 },
    ]);
    const b = p.loads.find((l) => l.memberId === 'b')!;
    expect(b.carries.find((c) => c.itemId === 'tente')?.kept).toBe(true);
    expect(p.loads.find((l) => l.memberId === 'a')!.carries.map((c) => c.itemId)).toEqual(['gaz']);
  });
  it('poids inconnu : listé à part, jamais compté comme 0 g ; profils inconnus signalés', () => {
    const p = distributeSharedGear([kit('x', { weightGrams: null }), kit('y', { weightGrams: 300 })], [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Ben' }]);
    expect(p.unweightedItemIds).toEqual(['x']);
    expect(p.totalGrams).toBe(300);
    expect(p.unknownProfileMemberIds).toEqual(['a', 'b']);
    expect(p.loads.flatMap((l) => l.carries).find((c) => c.itemId === 'x')?.grams).toBeNull();
  });
  it('la quantité est répartie par unité ; aucun membre : plan vide', () => {
    const p = distributeSharedGear([kit('bidon', { weightGrams: 1000, quantity: 4 })], [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
    expect(p.loads.map((l) => l.totalGrams)).toEqual([2000, 2000]);
    expect(distributeSharedGear(items, []).loads).toEqual([]);
  });
});

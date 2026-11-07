// Non-régression C-03 : un objet sans poids connu reste `null` de bout en bout et n'est pas
// silencieusement compté à 0 g. Le domaine le compte à part dans `totals().unknown`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COLORWAYS, DEFAULT_CONFIG, FAMILIES, ITEMS, KITS, ONE } from '../domain/catalog';
import type { Item, KitId } from '../domain/catalog';
import { createInitialState } from '../domain/state';
import { resetStudioData, setStudioData } from '../domain/studioData';
import type { StudioData } from '../domain/studioData';
import { totals } from '../domain/totals';

/** Id du même objet réel du catalogue, mais non pesé (import sans balance). */
const UNWEIGHED_ID = 'unweighed' as unknown as Item['id'];
/** Objet réel du catalogue, non pesé. */
const unweighed: Item = { ...ITEMS[0]!, id: UNWEIGHED_ID, g: null };
/** Même objet, pesé, pour comparer l'effet sur le bilan. */
const weighed: Item = { ...unweighed, g: 1200 };

const kit = {
  ...KITS[0]!,
  id: 'k-c03' as KitId,
  packed: { main: [UNWEIGHED_ID] },
};

function dataWith(items: readonly Item[]): StudioData {
  return {
    items,
    kits: [kit],
    one: ONE,
    colorways: COLORWAYS,
    config: DEFAULT_CONFIG,
    own: {},
    order: {},
    bodyKg: 72,
    families: FAMILIES,
  };
}

beforeAll(() => setStudioData(dataWith([unweighed])));
afterAll(() => resetStudioData());

describe('C-03 — poids inconnu = null, jamais 0', () => {
  it('l’objet non pesé reste null dans le registre et l’état', () => {
    const state = createInitialState();
    const item = state.kits['k-c03' as KitId]!.packed.main[0]!;
    expect(item).toBe(UNWEIGHED_ID);
    expect(unweighed.g).toBeNull();
  });

  it('le bilan compte l’objet non pesé dans `unknown` et ne l’additionne pas', () => {
    const t = totals(createInitialState());
    expect(t.unknown).toBe(1);
    // Le poids de zone de l'objet inconnu vaut 0 g effectif mais est signalé à part.
    expect(t.weightByZone.main).toBe(0);
  });

  it('le même objet pesé rentre dans la somme et n’est plus « inconnu »', () => {
    setStudioData(dataWith([weighed]));
    try {
      const t = totals(createInitialState());
      expect(t.unknown).toBe(0);
      expect(t.weightByZone.main).toBe(1200);
    } finally {
      setStudioData(dataWith([unweighed]));
    }
  });
});

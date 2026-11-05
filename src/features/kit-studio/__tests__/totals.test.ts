// Valeurs attendues : obtenues en exécutant les fonctions JS de la maquette v2 (script jetable hors dépôt)
// sur les mêmes données de catalogue ; le nom de chaque test porte la ligne d'origine.
import { describe, expect, it } from 'vitest';
import type { AccessoryId, CapacityZoneId, ShapeSlot } from '../domain/catalog';
import { ITEMS } from '../domain/catalog';
import { createInitialState } from '../domain/state';
import type { ExtraItem, KitState } from '../domain/types';
import {
  autoSlot, bagWeight, capOf, effG, effLid, partW, room, shapeOf, totalCap, totals,
} from '../domain/totals';

const item = (id: string) => {
  const it = ITEMS.find((x) => x.id === id);
  if (!it) throw new Error(id);
  return it;
};
const tmb = (day = 1): KitState => ({ ...createInitialState('tmb'), day });
const withBody = (s: KitState, shape: string): KitState => ({
  ...s, config: { ...s.config, b42: { ...s.config.b42, body: { ...s.config.b42.body, shape } } },
});
const withAcc = (s: KitState, acc: readonly AccessoryId[]): KitState => ({
  ...s, config: { ...s.config, b42: { ...s.config.b42, acc } },
});
const ZONES: readonly CapacityZoneId[] = ['lid', 'main', 'front', 'sides', 'hip', 'back'];
const PARTS: readonly ShapeSlot[] = ['body', 'lid', 'front', 'sides', 'hip', 'harness'];

describe('effLid — l.760', () => {
  it('suit la forme du couvercle de la config', () => expect(effLid(tmb())).toBe('std'));
  it('corps roll : aucun couvercle', () => expect(effLid(withBody(tmb(), 'roll'))).toBe('none'));
});

describe('shapeOf — l.761', () => {
  it('renvoie l option active de la pièce', () => expect(shapeOf(tmb(), 'front')?.id).toBe('zip'));
  it('couvercle en roll : option « none » (poids "-", capacité 0)', () => {
    const sh = shapeOf(withBody(tmb(), 'roll'), 'lid');
    expect(sh?.id).toBe('none');
    expect(sh?.g).toBe('-');
  });
  it('forme inconnue : undefined', () => expect(shapeOf(withBody(tmb(), 'zzz'), 'body')).toBeUndefined());
});

describe('capOf — l.762', () => {
  it('kit TMB initial, zone par zone', () => {
    const exp: Record<CapacityZoneId, number> = { lid: 4, main: 30, front: 2.625, sides: 2, hip: 1, back: 2.5 };
    for (const z of ZONES) expect(capOf(tmb(), z)).toBeCloseTo(exp[z], 6);
  });
  it('corps roll : couvercle à 0 et principal agrandi', () => {
    const s = withBody(tmb(), 'roll');
    expect(capOf(s, 'lid')).toBe(0);
    expect(capOf(s, 'main')).toBeCloseTo(31.75, 6);
  });
  it('corps slim retire du principal (cap relatif au sac)', () => {
    expect(capOf(withBody(tmb(), 'slim'), 'main')).toBeCloseTo(27.375, 6);
  });
  it('accessoire poche (spocket) : +0,6 L à la ceinture seulement', () => {
    const s = withAcc(tmb(), ['spocket']);
    expect(capOf(s, 'hip')).toBeCloseTo(1.6, 6);
    expect(capOf(s, 'main')).toBeCloseTo(30, 6);
  });
  it('kit cabine (sac b28)', () => expect(totalCap({ ...createInitialState('cabine') })).toBeCloseTo(27.55, 6));
});

describe('totalCap — l.763', () => {
  it('somme des six zones du TMB', () => expect(totalCap(tmb())).toBeCloseTo(42.125, 6));
  it('roll : 39,875', () => expect(totalCap(withBody(tmb(), 'roll'))).toBeCloseTo(39.875, 6));
});

describe('partW — l.764', () => {
  it('poids de chaque pièce du TMB (facteur matière sauf ceinture et harnais)', () => {
    const exp: Record<ShapeSlot, number> = {
      body: 436.128, lid: 114.224, front: 87.42658064516128, sides: 41.772, hip: 177, harness: 271.4,
    };
    for (const p of PARTS) expect(partW(tmb(), p)).toBeCloseTo(exp[p], 6);
  });
  it('couvercle en roll : poids "-" donc 0', () => expect(partW(withBody(tmb(), 'roll'), 'lid')).toBe(0));
});

describe('bagWeight — l.765', () => {
  it('sac TMB vide : 1128 g', () => expect(bagWeight(tmb())).toBe(1128));
  it('sac cabine b28 : 860 g', () => expect(bagWeight(createInitialState('cabine'))).toBe(860));
  it('roll retire le couvercle : 1047 g', () => expect(bagWeight(withBody(tmb(), 'roll'))).toBe(1047));
  it('accessoire spocket : +45 g', () => expect(bagWeight(withAcc(tmb(), ['spocket']))).toBe(1173));
  it('accessoires cover + axe : +110 +15 g', () => expect(bagWeight(withAcc(tmb(), ['cover', 'axe']))).toBe(1253));
});

describe('effG — l.862-863 (consommables selon le jour)', () => {
  const series = (id: string, kit = tmb) => [1, 2, 3, 4, 5, 6].map((d) => effG(kit(d), item(id)));
  it('nourriture : 650 g/j portés 2 j (carry 2)', () => expect(series('food')).toEqual([1300, 650, 1300, 650, 1300, 650]));
  it('en-cas : 120 g × jours portés', () => expect(series('bars')).toEqual([240, 120, 240, 120, 240, 120]));
  it('gaz : 140 + reste de 230 - 25 g/j', () => expect(series('gas')).toEqual([370, 345, 320, 295, 270, 245]));
  it('eau : poids plein constant hors cabine', () => expect(series('bottle')).toEqual([530, 530, 530, 530, 530, 530]));
  it('non consommable : poids fixe', () => expect(effG(tmb(4), item('tent1'))).toBe(item('tent1').g));
  it('kit cabine : l eau compte à sec (dry)', () => {
    expect(effG(createInitialState('cabine'), item('bottle'))).toBe(30);
  });
  it('poids inconnu (null) : 0', () => {
    const x = { ...item('hat'), g: null } as unknown as ExtraItem;
    expect(effG(tmb(), x)).toBe(0);
  });
});

describe('autoSlot — l.864', () => {
  it('couchage : au fond', () => expect(autoSlot(tmb(), item('sleep0'))).toBe('bottom'));
  it('trousse / isolation : en haut', () => {
    expect(autoSlot(tmb(), item('firstaid'))).toBe('top');
    expect(autoSlot(tmb(), item('down'))).toBe('top');
  });
  it('dense ou abri : milieu contre le dos', () => {
    expect(autoSlot(tmb(), item('tent1'))).toBe('midBack');
    expect(autoSlot(tmb(), item('food'))).toBe('midBack');
  });
  it('léger et volumineux : milieu côté poche', () => {
    expect(autoSlot(tmb(), item('fleece'))).toBe('midFront');
    expect(autoSlot(tmb(), item('shoe-mid'))).toBe('midFront');
  });
});

describe('totals — l.884-886', () => {
  it('kit TMB jour 1 : tous les champs', () => {
    const t = totals(tmb());
    expect(t.baseWeight).toBe(5761);
    expect(t.consumables).toBe(4520);
    expect(t.onBack).toBe(10281);
    expect(t.worn).toBe(1252);
    expect(t.usedVolume).toBeCloseTo(29.26, 6);
    expect(t.capacity).toBeCloseTo(42.125, 6);
    expect(t.weightByZone).toEqual({
      worn: 1252, lid: 473, main: 5310, front: 480, sides: 530, hip: 280, back: 2080,
    });
    expect(t.volumeByZone.main).toBeCloseTo(24.1, 6);
    expect(t.volumeByZone.worn).toBeUndefined();
    expect([t.buy, t.rent, t.unknown]).toEqual([0, 0, 0]);
  });
  it('le jour change les consommables, pas la base ni le porté', () => {
    const exp: Record<number, [number, number]> = { 2: [3725, 9486], 3: [4470, 10231] };
    for (const d of [2, 3]) {
      const t = totals(tmb(d));
      expect([t.consumables, t.onBack]).toEqual(exp[d]);
      expect([t.baseWeight, t.worn]).toEqual([5761, 1252]);
    }
  });
  it('kit cabine : seule l eau à sec compte (30 g)', () => {
    const t = totals(createInitialState('cabine'));
    expect([t.baseWeight, t.consumables, t.onBack, t.worn]).toEqual([3690, 30, 3720, 1012]);
    expect(t.capacity).toBeCloseTo(27.55, 6);
  });
  it('kit Vercors (2 j) : 4646 g de base', () => {
    const t = totals(createInitialState('vercors'));
    expect([t.baseWeight, t.consumables, t.worn]).toEqual([4646, 4520, 892]);
  });
  it('objets ajoutés : achat, location sur la durée, poids inconnu', () => {
    const s0 = tmb();
    const extras = [
      { ...item('hat'), id: 'x1', g: 100, L: 1, planned: 'shop', eur: 50 },
      { ...item('hat'), id: 'x2', g: 200, L: 2, planned: 'rent', day: 3 },
      { ...item('hat'), id: 'x3', g: null, L: 0.5 },
    ] as unknown as ExtraItem[];
    const k = s0.kits.tmb;
    const s: KitState = {
      ...s0, extraItems: extras,
      kits: { ...s0.kits, tmb: { ...k, packed: { ...k.packed, main: [...k.packed.main, 'x1', 'x2', 'x3'] } } },
    };
    const t = totals(s);
    expect([t.buy, t.rent, t.unknown]).toEqual([50, 18, 1]);
    expect(t.baseWeight).toBe(6061);
    expect(t.usedVolume).toBeCloseTo(32.76, 6);
  });
  it('zone vide : aucun volume ni poids pour cette zone', () => {
    const s0 = tmb();
    const k = s0.kits.tmb;
    const s: KitState = { ...s0, kits: { ...s0.kits, tmb: { ...k, packed: { ...k.packed, hip: [] } } } };
    const t = totals(s);
    expect(t.volumeByZone.hip).toBeUndefined();
    expect(t.weightByZone.hip).toBeUndefined();
  });
  it('ne mute pas l état reçu', () => {
    const s = tmb();
    const snap = JSON.stringify(s);
    totals(s); room(s, 'main'); capOf(s, 'main'); bagWeight(s);
    expect(JSON.stringify(s)).toBe(snap);
  });
});

describe('room — l.1293', () => {
  it('place restante du TMB = capacité - volume rangé', () => {
    const exp: Record<CapacityZoneId, number> = { lid: 2.94, main: 5.9, front: 1.425, sides: 1.45, hip: 0.75, back: 0.4 };
    for (const z of ZONES) expect(room(tmb(), z)).toBeCloseTo(exp[z], 6);
  });
  it('couvercle supprimé (roll) : place négative = objets débordants', () => {
    expect(room(withBody(tmb(), 'roll'), 'lid')).toBeCloseTo(-1.06, 6);
  });
});

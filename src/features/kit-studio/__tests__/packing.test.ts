// Valeurs attendues : obtenues en exécutant les fonctions JS de la maquette v2 (script jetable hors dépôt)
// sur les mêmes données de catalogue ; le nom de chaque test porte la ligne d'origine.
import { describe, expect, it } from 'vitest';
import { ALTERNATIVES } from '../domain/catalog';
import { createInitialState, currentKit, getItem, isPacked, zoneOf } from '../domain/state';
import type { KitState } from '../domain/types';
import { autopack, candidates, pack, relocate, setBag, unpack } from '../domain/packing';
import { addPlanned, altsFor, swapItem } from '../domain/swap';

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}
const tmb = (): KitState => deepFreeze(createInitialState('tmb'));
const rollB28 = (s: KitState): KitState => ({
  ...s, config: { ...s.config, b28: { ...s.config.b28, body: { ...s.config.b28.body, shape: 'roll' } } },
});

describe('pack — l.1300', () => {
  it('range dans la zone demandée quand elle a la place', () => {
    const r = pack(tmb(), 'gloves', 'lid');
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, 'gloves')).toBe('lid');
    expect(r.altZone).toBeUndefined();
  });
  it('zone « bag » ou non admise : première zone de l objet', () => {
    expect(zoneOf(pack(tmb(), 'gloves', 'bag').state, 'gloves')).toBe('lid');
    expect(zoneOf(pack(tmb(), 'blanket', 'sides').state, 'blanket')).toBe('lid');
    expect(zoneOf(pack(tmb(), 'filter', 'hip').state, 'filter')).toBe('sides');
  });
  it('zone pleine : propose la zone alternative et y range (front plein → lid)', () => {
    const r = pack(tmb(), 'rain3l', 'front');
    expect(r.ok).toBe(true);
    expect(r.altZone).toBe('lid');
    expect(zoneOf(r.state, 'rain3l')).toBe('lid');
  });
  it('dos plein : laptop bascule vers main', () => {
    const r = pack(tmb(), 'laptop', 'back');
    expect(r.altZone).toBe('main');
    expect(zoneOf(r.state, 'laptop')).toBe('main');
  });
  it('aucune zone avec la place : refus « full », état inchangé', () => {
    const s = tmb();
    const r = pack(s, 'sleep-5', 'main');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('full');
    expect(r.state).toBe(s);
  });
  it('objet prêté refusé — l.1290 (warnLent)', () => {
    const s = tmb();
    const r = pack(s, 'rainul', 'front');
    expect(r).toMatchObject({ ok: false, reason: 'lent' });
    expect(isPacked(r.state, 'rainul')).toBe(false);
  });
  it('objet déjà rangé : « already »', () => {
    expect(pack(tmb(), 'phone', 'hip')).toMatchObject({ ok: false, reason: 'already' });
  });
  it('objet inconnu : « zone »', () => {
    expect(pack(tmb(), 'nimporte', 'lid')).toMatchObject({ ok: false, reason: 'zone' });
  });
});

describe('unpack — l.1303', () => {
  it('retire l objet de sa zone et du placement fin', () => {
    const s = tmb();
    const r = unpack(s, 'phone');
    expect(isPacked(r, 'phone')).toBe(false);
    expect(currentKit(r).slots?.phone).toBeUndefined();
    expect(currentKit(s).slots).toEqual(currentKit(tmb()).slots);
  });
  it('objet non rangé : même état', () => {
    const s = tmb();
    expect(unpack(s, 'laptop')).toBe(s);
  });
});

describe('swapItem / altsFor / addPlanned — l.1275-1279, l.1304', () => {
  it('swap conserve la zone (rain3l front → rainul prêté refusé, puis gloves)', () => {
    const s = pack(tmb(), 'gloves', 'lid').state;
    const r = swapItem(s, 'gloves', 'blanket');
    expect(zoneOf(r, 'blanket')).toBe('lid');
    expect(isPacked(r, 'gloves')).toBe(false);
    expect(currentKit(r).packed.lid.indexOf('blanket')).toBe(currentKit(s).packed.lid.indexOf('gloves'));
  });
  it('swap vers un objet prêté : état inchangé', () => {
    const s = pack(tmb(), 'rain3l', 'front').state;
    expect(swapItem(s, 'rain3l', 'rainul')).toBe(s);
  });
  it('swap vers un objet dont la zone diffère : va dans sa première zone', () => {
    const r = swapItem(tmb(), 'poles-alu', 'poles-carbon');
    expect(zoneOf(r, 'poles-carbon')).toBe('front');
    const r2 = swapItem(tmb(), 'phone', 'poles-carbon');
    expect(zoneOf(r2, 'poles-carbon')).toBe('front');
    expect(isPacked(r2, 'phone')).toBe(false);
  });
  it('altsFor : objets possédés du même usage puis alternatives du catalogue, avec écart de poids', () => {
    const s = pack(tmb(), 'rain3l', 'lid').state;
    const a = altsFor(s, 'rain3l');
    expect(a.filter((x) => x.kind === 'own').map((x) => x.e.id)).toEqual(['rainul']);
    expect(a[0]?.d).toBe(230 - 395);
    expect(a.filter((x) => x.kind === 'alt').length).toBe((ALTERNATIVES.rainshell ?? []).length);
  });
  it('addPlanned : ajoute l alternative à l inventaire, idempotent', () => {
    const alt = (ALTERNATIVES.rainshell ?? [])[0];
    if (!alt) throw new Error('alt');
    const s = tmb();
    const r = addPlanned(s, alt, getItem(s, 'rain3l'));
    expect(r.id).toBe(alt.id);
    expect(getItem(r.state, alt.id)).toMatchObject({ planned: alt.src, fn: 'rainshell', L: 1.5 });
    expect(addPlanned(r.state, alt).state).toBe(r.state);
    expect(s.extraItems).toHaveLength(0);
  });
});

describe('candidates — l.1260', () => {
  it('exclut les objets rangés ; filtre par zone ; vital puis prêt en dernier', () => {
    const ids = candidates(tmb(), 'front').map((i) => i.id);
    expect(ids).not.toContain('phone');
    expect(ids).toContain('rain3l');
    expect(ids).not.toContain('filter');
    expect(ids.indexOf('rainul')).toBeGreaterThan(ids.indexOf('rain3l'));
  });
  it('zone « bag » : tout ce qui n est pas rangé', () => {
    expect(candidates(tmb(), 'bag').length).toBe(15);
  });
  it('les manques du kit (ghosts) passent en tête', () => {
    expect(candidates(tmb(), 'bag')[0]?.fn).toBe('emergency');
  });
});

describe('setBag / relocate — l.1308, l.1683', () => {
  it('même sac : rien ne bouge', () => {
    const s = tmb();
    expect(setBag(s, 'b42')).toEqual({ state: s, moved: 0 });
  });
  it('b42 → b28 : change le sac, rien à déplacer quand toutes les poches existent', () => {
    const r = setBag(tmb(), 'b28');
    expect(currentKit(r.state).bag).toBe('b28');
    expect(r.moved).toBe(0);
  });
  it('b42 → b28 corps roll : le couvercle disparaît, ses 4 objets vont ailleurs', () => {
    const s = rollB28(tmb());
    const r = setBag(s, 'b28');
    expect(r.moved).toBe(4);
    const k = currentKit(r.state);
    expect(k.packed.lid).toEqual([]);
    for (const id of ['headlamp', 'map', 'sunscreen', 'bars']) expect(isPacked(r.state, id)).toBe(true);
    const count = (x: KitState) => Object.values(currentKit(x).packed).reduce((a, l) => a + l.length, 0);
    expect(count(r.state)).toBe(count(s));
  });
  it('relocate seul : renvoie le nombre d objets déplacés', () => {
    const s = setBag(rollB28(tmb()), 'b28').state;
    expect(relocate(s)).toMatchObject({ moved: 0 });
  });
});

describe('autopack — l.1311', () => {
  it('efface le placement fin ; deux fois = même résultat', () => {
    const once = autopack(tmb());
    expect(currentKit(once).slots).toBeNull();
    expect(autopack(once)).toEqual(once);
  });
});

describe('immutabilité', () => {
  it('aucune fonction ne mute l état gelé en profondeur', () => {
    const s = tmb();
    expect(() => {
      pack(s, 'gloves', 'lid');
      pack(s, 'laptop', 'back');
      unpack(s, 'phone');
      swapItem(s, 'poles-alu', 'poles-carbon');
      setBag(rollB28(s), 'b28');
      relocate(s);
      autopack(s);
      candidates(s, 'bag');
      altsFor(s, 'rain3l');
      const alt = (ALTERNATIVES.rainshell ?? [])[0];
      if (alt) addPlanned(s, alt);
    }).not.toThrow();
  });
});

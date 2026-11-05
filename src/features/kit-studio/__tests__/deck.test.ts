import { describe, expect, it } from 'vitest';
import { createDeck, decide, deckSummary, fillOrder, lighten } from '../domain/deck';
import { createInitialState, currentKit, getItem } from '../domain/state';

const tmb = () => createInitialState('tmb');

describe('deck : ordre de remplissage', () => {
  it('liste exactement les objets rangés, dos puis principal puis le reste', () => {
    const s = tmb();
    const k = currentKit(s);
    const order = fillOrder(s);
    const all = Object.values(k.packed).flat();
    expect([...order].sort()).toEqual(all.filter((id) => getItem(s, id)).sort());
    k.packed.back.forEach((id, n) => expect(order[n]).toBe(id));
    const lastMain = Math.max(...k.packed.main.map((id) => order.indexOf(id)));
    k.packed.lid.forEach((id) => expect(order.indexOf(id)).toBeGreaterThan(lastMain));
  });
  it('le débrief exclut les consommables', () => {
    const s = tmb();
    const d = createDeck(s, 'debrief');
    expect(d.list.length).toBeGreaterThan(0);
    d.list.forEach((id) => expect(getItem(s, id)?.cons).toBeFalsy());
  });
});

describe('deck : décisions', () => {
  it('oui et non avancent sans muter le deck', () => {
    const d0 = createDeck(tmb(), 'fill');
    const a = decide(d0, true);
    const b = decide(a, false);
    expect(d0.i).toBe(0);
    expect(d0.yes).toEqual([]);
    expect(a.yes).toEqual([d0.list[0]]);
    expect(b.no).toEqual([d0.list[1]]);
    expect(b.i).toBe(2);
  });
  it('sans effet une fois terminé', () => {
    let d = createDeck(tmb(), 'fill');
    for (let n = 0; n < d.list.length; n++) d = decide(d, true);
    expect(decide(d, false)).toBe(d);
  });
});

describe('deck : résumé et allègement', () => {
  it('résumé du remplissage', () => {
    const s = tmb();
    let d = createDeck(s, 'fill');
    d = decide(decide(d, true), false);
    const sum = deckSummary(s, d);
    expect(sum.title).toBe('Sac rempli');
    expect(sum.text).toContain('1 objet dedans');
    expect(sum.text).toContain('plus tard');
  });
  it('« Tout a servi » quand tout est utilisé', () => {
    const s = tmb();
    let d = createDeck(s, 'debrief');
    while (d.i < d.list.length) d = decide(d, true);
    expect(deckSummary(s, d).title).toBe('Tout a servi');
  });
  it('lighten retire les refusés non vitaux, garde les vitaux, sans muter', () => {
    const s = tmb();
    let d = createDeck(s, 'debrief');
    while (d.i < d.list.length) d = decide(d, false);
    const before = JSON.stringify(s);
    const sum = deckSummary(s, d);
    const { state, removed } = lighten(s, d);
    expect(JSON.stringify(s)).toBe(before);
    expect(removed).toEqual(sum.cut);
    const packed = Object.values(currentKit(state).packed).flat();
    removed.forEach((id) => expect(packed).not.toContain(id));
    sum.keep.forEach((id) => expect(packed).toContain(id));
    expect(removed.length).toBe(d.no.length - sum.keep.length);
  });
  it('lighten ne fait rien en remplissage', () => {
    const s = tmb();
    expect(lighten(s, createDeck(s, 'fill')).removed).toEqual([]);
  });
});

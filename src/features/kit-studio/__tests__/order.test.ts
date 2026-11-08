import { describe, expect, it } from 'vitest';
import { COLORWAYS, ONE } from '../domain/catalog';
import { canAddModule, ptsCap, ptsUsed, toggleModule } from '../domain/attach';
import { confirmOrder, orderLines, orderTotalCents, toOrder } from '../domain/order';
import { cwOf, modOn, pieceCw, pieceInfo, pieceState, pieces, setMod } from '../domain/parts';
import { createInitialState, currentConfig } from '../domain/state';
import type { KitState } from '../domain/types';

const withBodyColor = (s: KitState, col: (typeof COLORWAYS)['sauge']['body']): KitState => ({
  ...s,
  config: { ...s.config, b42: { ...s.config.b42, body: { ...s.config.b42.body, col } } },
});

describe('parts (maquette v2 l.700-717)', () => {
  it('l.701 modOn : état initial TMB = couvercle, poche avant, latérales actifs', () => {
    const s = createInitialState('tmb');
    expect(modOn(s, 'lid')).toBe(true);
    expect(modOn(s, 'front')).toBe(true);
    expect(modOn(s, 'sides')).toBe(true);
    expect(modOn(s, 'tool')).toBe(false);
    expect(modOn(s, 'hipp')).toBe(false);
  });

  it('l.702 setMod : renvoie un nouvel état sans muter l’ancien', () => {
    const s = createInitialState('tmb');
    const snap = JSON.stringify(s);
    const t = setMod(s, 'hipp', true);
    expect(JSON.stringify(s)).toBe(snap);
    expect(modOn(t, 'hipp')).toBe(true);
    expect(currentConfig(t).hip.shape).toBe('wide');
    expect(modOn(setMod(t, 'hipp', false), 'hipp')).toBe(false);
    expect(modOn(setMod(s, 'tool', true), 'tool')).toBe(true);
    expect(modOn(setMod(setMod(s, 'tool', true), 'tool', false), 'tool')).toBe(false);
  });

  it('l.707 cwOf compare des clés matière', () => {
    expect(cwOf(COLORWAYS.sauge.body)).toBe('sauge');
    expect(cwOf(COLORWAYS.nuit.trim)).toBe('nuit');
  });

  it('l.709 pieces : châssis, corps du kit, modules actifs', () => {
    expect(pieces(createInitialState('tmb'))).toEqual(['chassis', 'corps:b42', 'mod:lid', 'mod:front', 'mod:sides']);
  });

  it('l.710 pieceInfo : prix du catalogue', () => {
    expect(pieceInfo('chassis').eur).toBe(ONE.chassis.eur);
    expect(pieceInfo('mod:hipp').n).toBe(ONE.mods.hipp.n);
  });
});

describe('attach (l.705-706, l.1735)', () => {
  it('l.705 ptsCap : châssis 4, corps b42 8', () => {
    const s = createInitialState('tmb');
    expect(ptsCap(s, 'chassis')).toBe(ONE.chassis.pts);
    expect(ptsCap(s, 'corps')).toBe(ONE.corps.b42.pts);
  });

  it('l.706 ptsUsed : somme des modules actifs par hôte', () => {
    const s = createInitialState('tmb');
    expect(ptsUsed(s, 'corps')).toBe(6);
    expect(ptsUsed(s, 'chassis')).toBe(0);
  });

  it('l.1735 toggleMod : refus d’un module sans points suffisants (corps b28 plein)', () => {
    const full = createInitialState('cabine');
    expect(ptsUsed(full, 'corps')).toBe(ptsCap(full, 'corps'));
    expect(canAddModule(full, 'tool')).toBe(false);
    expect(toggleModule(full, 'tool', true)).toBe(full);
    expect(modOn(toggleModule(full, 'tool', true), 'tool')).toBe(false);
  });

  it('l.1735 toggleMod : module accepté quand il reste des points (châssis)', () => {
    const s = toggleModule(createInitialState('tmb'), 'hipp', true);
    expect(modOn(s, 'hipp')).toBe(true);
    expect(ptsUsed(s, 'chassis')).toBe(2);
    expect(canAddModule(s, 'flask')).toBe(true);
  });
});

describe('order (l.713-717, l.1470-1502)', () => {
  it('l.716 état initial TMB : rien à commander, total 0, tout « own »', () => {
    const s = createInitialState('tmb');
    expect(toOrder(s)).toEqual([]);
    expect(orderTotalCents(s)).toBe(0);
    expect(pieces(s).every((k) => pieceState(s, k) === 'own')).toBe(true);
    expect(orderLines(s).every((l) => l.state === 'own')).toBe(true);
  });

  it('l.716 changer le coloris du corps : le corps passe à commander', () => {
    const s = withBodyColor(createInitialState('tmb'), COLORWAYS.sauge.body);
    expect(pieceCw(s, 'corps:b42')).toBe('sauge');
    expect(toOrder(s)).toEqual(['corps:b42']);
    expect(orderTotalCents(s)).toBe(ONE.corps.b42.eur! * 100);
  });

  it('l.717 total exact en centimes (entier)', () => {
    let s = createInitialState('tmb');
    s = toggleModule(s, 'hipp', true);
    s = toggleModule(s, 'tool', true);
    s = withBodyColor(s, COLORWAYS.nuit.body);
    expect(toOrder(s).sort()).toEqual(['corps:b42', 'mod:hipp', 'mod:tool']);
    const total = orderTotalCents(s);
    expect(Number.isInteger(total)).toBe(true);
    expect(total).toBe((149 + 29 + 15) * 100);
  });

  it('l.1470 orderLines : clé, nom, coloris, prix en centimes, état', () => {
    const s = withBodyColor(createInitialState('tmb'), COLORWAYS.sauge.body);
    const l = orderLines(s).find((x) => x.key === 'corps:b42');
    expect(l).toMatchObject({ colorway: 'sauge', colorwayName: 'Sauge', priceCents: 14900, state: 'new' });
  });

  it('l.1500 confirmOrder : pièces passées dans order, pieceState = order, sans mutation', () => {
    const s = withBodyColor(createInitialState('tmb'), COLORWAYS.sauge.body);
    const snap = JSON.stringify(s);
    const t = confirmOrder(s);
    expect(JSON.stringify(s)).toBe(snap);
    expect(t.order['corps:b42']).toBe('sauge');
    expect(pieceState(t, 'corps:b42')).toBe('order');
    expect(toOrder(t)).toEqual([]);
    expect(orderTotalCents(t)).toBe(0);
  });
});

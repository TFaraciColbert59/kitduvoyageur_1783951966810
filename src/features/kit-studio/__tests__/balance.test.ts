// Valeurs attendues : obtenues en exécutant les fonctions JS de la maquette v2 (script jetable hors dépôt,
// extraits verbatim de Kit_Studio_v2.html branchés sur les mêmes données de catalogue). Le nom de chaque test porte la ligne d'origine.
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../domain/state';
import type { KitState } from '../domain/types';
import { cog, cogState, dayWeights } from '../domain/balance';
import { activeGhosts, blockers, cabinDims, readiness, readinessGain, tips } from '../domain/blockers';
import { frontZ, packedLocal, reindex } from '../domain/layout';

const NB = ' ';
const tmb = (): KitState => createInitialState('tmb');
const withPacked = (s: KitState, f: (p: Record<string, string[]>) => void): KitState => {
  const c = structuredClone(s);
  f(c.kits[c.kitId].packed as unknown as Record<string, string[]>);
  return c;
};
const heavyFront = (): KitState => withPacked(tmb(), (p) => { p.front = [...p.front, ...p.main]; p.main = []; });

describe('layout (l.873-880)', () => {
  it('l.873 reindex : kit TMB, zones, rangs et emplacements du principal', () => {
    const i = reindex(tmb());
    expect(i['shoe-mid']).toEqual({ zone: 'worn', i: 0, n: 4 });
    expect(i.food).toEqual({ zone: 'main', i: 0, n: 10, slot: 'bottomF', si: 0, sn: 2 });
    expect(i.stove).toEqual({ zone: 'main', i: 2, n: 10, slot: 'bottom', si: 0, sn: 1 });
    expect(i.firstaid).toMatchObject({ slot: 'top', si: 1, sn: 3 });
  });
  it('l.875 packedLocal : positions locales par zone (TMB)', () => {
    const s = tmb();
    expect(packedLocal(s, 'headlamp')[0]).toBeCloseTo(-0.225, 12);
    expect(packedLocal(s, 'headlamp').slice(1)).toEqual([0.86, 0.02]);
    expect(packedLocal(s, 'food')).toEqual([-0.1, -0.5, 0.13]);
    expect(packedLocal(s, 'sleep0')).toEqual([0, 0.06, -0.13]);
    expect(packedLocal(s, 'bottle')).toEqual([0.44, -0.42, 0.02]);
    expect(packedLocal(s, 'knife')).toEqual([-0.5, -0.6, -0.12]);
    expect(packedLocal(s, 'bladder')).toEqual([0, 0.12, -0.2]);
    expect(packedLocal(s, 'poles-alu')[2]).toBeCloseTo(0.3, 10);
    expect(packedLocal(s, 'shoe-mid')).toEqual([0, 0, 0]);
    expect(packedLocal(s, 'absent')).toEqual([0, 0, 0]);
  });
  it('l.767 frontZ : profondeur de la poche avant', () => {
    expect(frontZ(tmb())).toBeCloseTo(0.28 + 0.07 - 0.01, 10);
  });
});

describe('équilibre (l.888-889)', () => {
  it('l.888 cog : kit TMB initial', () => {
    const c = cog(tmb());
    expect(c.x).toBeCloseTo(0.009923645559770449, 12);
    expect(c.y).toBeCloseTo(-0.03974274875984826, 12);
    expect(c.z).toBeCloseTo(-3.7739519501975126e-6, 12);
  });
  it('l.888 cog : lourd déplacé devant', () => {
    const c = cog(heavyFront());
    expect(c.x).toBeCloseTo(-0.08705135687189962, 12);
    expect(c.y).toBeCloseTo(-0.07249909541873359, 12);
    expect(c.z).toBeCloseTo(0.11803600817041147, 12);
  });
  it('l.889 trop loin du dos : lourd devant (kit TMB initial inclus)', () => {
    const t = 'Trop loin du dos';
    const s = 'Le lourd est devant ou en bas : le sac tire en arrière. Double-tape le sac pour le ranger.';
    expect(cogState(cog(tmb()))).toEqual({ ok: false, t, s });
    expect(cogState(cog(heavyFront()))).toEqual({ ok: false, t, s });
  });
  it('l.889 trop bas / trop haut / penche / bien équilibré', () => {
    expect(cogState({ x: 0, y: -0.2, z: -0.1 })).toEqual({ ok: false, t: 'Trop bas', s: 'Monte le lourd au niveau des omoplates. Double-tape le sac pour le ranger.' });
    expect(cogState({ x: 0, y: 0.5, z: -0.1 })).toEqual({ ok: false, t: 'Trop haut', s: 'Le sac va basculer dans les descentes.' });
    const rep = 'Répartis les objets lourds des poches latérales et de la ceinture des deux côtés.';
    expect(cogState({ x: 0.06, y: 0, z: -0.1 })).toEqual({ ok: false, t: 'Penche à droite', s: rep });
    expect(cogState({ x: -0.06, y: 0, z: -0.1 })).toEqual({ ok: false, t: 'Penche à gauche', s: rep });
    expect(cogState({ x: 0, y: 0.1, z: -0.1 })).toEqual({ ok: true, t: 'Bien équilibré', s: 'Le lourd est plaqué contre le dos, à hauteur des omoplates.' });
  });
  it('l.889 vercors est bien équilibré (oracle)', () => {
    expect(cogState(cog(createInitialState('vercors'))).ok).toBe(true);
  });
  it('l.1389 dayWeights : TMB, 6 jours, sans toucher à s.day', () => {
    const s = tmb();
    expect(dayWeights(s)).toEqual([10281, 9486, 10231, 9436, 10181, 9386]);
    expect(s.day).toBe(1);
    expect(dayWeights(createInitialState('vercors'))).toEqual([9166, 8371]);
  });
});

describe('blocages (l.891-905)', () => {
  it('l.891 activeGhosts : TMB manque veste et couverture de survie', () => {
    expect(activeGhosts(tmb()).map((g) => g.fn)).toEqual(['rainshell', 'emergency']);
  });
  it('l.893 veste manquante : texte et motif', () => {
    expect(blockers(tmb())[0]).toEqual({
      kind: 'ghost', zone: 'front', gl: 'jacket', fn: 'rainshell', t: `Manque${NB}: veste imperméable`, s: 'Pluie 40 % annoncée au col de la Seigne',
    });
  });
  it('l.894 trousse périmée : TMB', () => {
    expect(blockers(tmb())[2]).toEqual({
      kind: 'expired', zone: 'main', gl: 'aid', id: 'firstaid', t: 'Trousse de secours périmée', s: 'Depuis sept. 2026. À renouveler avant le départ.',
    });
    expect(blockers(tmb())).toHaveLength(3);
  });
  it('l.895 cabine : couteau interdit et dépassement en profondeur', () => {
    const b = blockers(createInitialState('cabine'));
    expect(b.map((x) => x.t)).toEqual(['Couteau interdit en cabine', `Dépasse de 4${NB}cm en profondeur`]);
    expect(b[0]).toMatchObject({ kind: 'cabin', zone: 'hip', id: 'knife', s: 'À laisser à la maison ou à mettre en soute.' });
    expect(b[1].s).toBe(`Limite 55 × 40 × 20${NB}cm. Serre les sangles de compression.`);
  });
  it('l.892 cabinDims : TMB et cabine', () => {
    const d = cabinDims(tmb());
    expect(d.w).toBeCloseTo(35.2, 8);
    expect(d.h).toBeCloseTo(72.4416, 8);
    expect(d.d).toBeCloseTo(26.4616, 8);
    expect(cabinDims(createInitialState('cabine')).d).toBeCloseTo(23.4608, 8);
  });
  it('l.898 zone trop pleine : poche avant surchargée', () => {
    const b = blockers(heavyFront());
    expect(b[3]).toEqual({ kind: 'cap', zone: 'front', gl: 'bag', t: 'Extérieur trop plein', s: `+23${NB}L au-delà de sa capacité.` });
  });
  it('l.893 filtre manquant (vercors)', () => {
    expect(blockers(createInitialState('vercors'))[0]).toMatchObject({ kind: 'ghost', t: `Manque${NB}: filtre à eau`, s: 'Aucune source sûre sur 14 km' });
  });
  it('l.901 readiness : 100 - 13 par blocage - 7 si déséquilibré, borné', () => {
    const s = tmb();
    expect(readiness(blockers(s), cogState(cog(s)))).toBe(54);
    expect(readiness(blockers(heavyFront()), cogState(cog(heavyFront())))).toBe(41);
    expect(readiness(blockers(createInitialState('cabine')), { ok: true })).toBe(74);
    expect(readiness([], { ok: true })).toBe(100);
    const many = Array.from({ length: 9 }, () => blockers(tmb())[0]);
    expect(readiness(many, { ok: false })).toBe(0);
  });
  it('l.1389 gain de préparation : 13 par blocage, 7 pour l’équilibre', () => {
    const s = tmb();
    for (const b of blockers(s)) expect(readinessGain(s, b)).toBe(13);
    expect(readinessGain(s, { kind: 'cog', t: 'Trop loin du dos' })).toBe(7);
    expect(readinessGain(createInitialState('vercors'), { kind: 'cog', t: 'x' })).toBe(0);
  });
  it('l.903 tip : objet utile en marchant au fond du sac', () => {
    const s = withPacked(tmb(), (p) => { p.lid = p.lid.filter((x) => x !== 'headlamp'); p.main.push('headlamp'); });
    expect(tips(s)[0]).toEqual({ t: 'Frontale 450 lm au fond du sac', s: 'Sert en marchant : à mettre en haut ou dans le couvercle.', id: 'headlamp' });
  });
  it('l.904 tip : deux objets pour le même usage', () => {
    const s = withPacked(tmb(), (p) => { p.front.push('poles-carbon'); });
    expect(tips(s)).toContainEqual({
      t: '2 objets pour le même usage', s: `Bâtons alu, Bâtons carbone. −340${NB}g possible.`, id: 'poles-alu',
    });
  });
  it('l.903 kit TMB initial : aucun conseil', () => {
    expect(tips(tmb())).toEqual([]);
  });
  it('fonctions pures : l’état reçu n’est pas modifié', () => {
    const s = tmb();
    const snap = JSON.stringify(s);
    cog(s); blockers(s); tips(s); dayWeights(s); reindex(s);
    expect(JSON.stringify(s)).toBe(snap);
  });
});

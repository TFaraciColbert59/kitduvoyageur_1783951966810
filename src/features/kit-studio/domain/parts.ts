// Pièces ONE : état des modules, coloris, état de chaque pièce. Pur, sans mutation.
// Maquette Kit_Studio_v2.html l.700-717, l.756-761. Catalogue lu dans le registre runtime.
import { BAGS, MODULE_IDS } from './catalog';
import type { BagId, ColorwayId, ConfigSet, MaterialKey, ModuleId } from './catalog';
import { currentConfig, currentKit } from './state';
import { studioData } from './studioData';
import type { KitState, PieceKey } from './types';

/** Coloris disponibles, dans l'ordre du catalogue réel. */
const colorwayIds = (): readonly ColorwayId[] => Object.keys(studioData().colorways) as ColorwayId[];

/** Forme effective du couvercle (maquette effLid, l.759) : un corps « roll » n'a pas de couvercle. */
export function effLid(s: KitState): string | undefined {
  const c = currentConfig(s);
  return c.body.shape === 'roll' ? 'none' : c.lid.shape;
}

/** Module actif (maquette modOn, l.701). */
export function modOn(s: KitState, m: ModuleId): boolean {
  const c = currentConfig(s);
  const M = studioData().one.mods[m];
  if (M.acc) return c.acc.includes(M.acc);
  if (m === 'lid') return effLid(s) !== 'none';
  if (m === 'hipp') return c.hip.shape === 'wide';
  return c[M.part].shape !== 'none';
}

function withShape(c: ConfigSet, part: 'lid' | 'front' | 'sides' | 'hip', shape: string): ConfigSet {
  return { ...c, [part]: { ...c[part], shape } };
}

/** Active ou retire un module, sans contrôle de points (maquette setMod, l.702-703). Renvoie un nouvel état. */
export function setMod(s: KitState, m: ModuleId, on: boolean): KitState {
  const M = studioData().one.mods[m];
  const bag = currentKit(s).bag;
  let c = currentConfig(s);
  if (M.acc) {
    const has = c.acc.includes(M.acc);
    if (on && !has) c = { ...c, acc: [...c.acc, M.acc] };
    else if (!on && has) c = { ...c, acc: c.acc.filter((a) => a !== M.acc) };
  } else if (m === 'lid') c = withShape(c, 'lid', on ? 'std' : 'none');
  else if (m === 'front') c = withShape(c, 'front', on ? 'zip' : 'none');
  else if (m === 'sides') c = withShape(c, 'sides', on ? 'std' : 'none');
  else if (m === 'hipp') c = withShape(c, 'hip', on ? 'wide' : 'padded');
  return { ...s, config: { ...s.config, [bag]: c } };
}

/** Coloris d'une couleur : comparaison des clés matière (maquette cwOf, l.707). Défaut : premier coloris. */
export function cwOf(col: MaterialKey | undefined): ColorwayId {
  const colorways = studioData().colorways;
  const ids = colorwayIds();
  if (col === undefined) return ids[0] ?? 'foret';
  return (
    ids.find((id) => {
      const w = colorways[id];
      return w.body === col || w.pocket === col || w.trim === col || w.accent === col;
    }) ?? ids[0] ?? 'foret'
  );
}

/** Coloris courant d'une pièce (maquette pieceCw, l.708). */
export function pieceCw(s: KitState, key: PieceKey): ColorwayId {
  const c = currentConfig(s);
  if (key === 'chassis') return cwOf(c.harness.col);
  if (key.startsWith('corps')) return cwOf(c.body.col);
  const M = studioData().one.mods[key.slice(4) as ModuleId];
  return cwOf(c[M.part].col);
}

/** Pièces de la configuration courante : châssis, corps, modules actifs (maquette pieces, l.709). */
export function pieces(s: KitState): PieceKey[] {
  const bag = currentKit(s).bag;
  const mods = MODULE_IDS.filter((m) => modOn(s, m)).map((m): PieceKey => `mod:${m}`);
  return ['chassis', `corps:${bag}`, ...mods];
}

export interface PieceInfo {
  readonly n: string;
  readonly eur: number | null;
  readonly pts?: number | null;
  readonly gl: string;
  readonly d: string;
  readonly vs: boolean;
}

/** Fiche d'une pièce (maquette pieceInfo, l.710). Prix du catalogue réel (centimes ÷ 100), `null` si non renseigné. */
export function pieceInfo(key: PieceKey): PieceInfo {
  const one = studioData().one;
  if (key === 'chassis') return { n: one.chassis.n, eur: one.chassis.eur, pts: one.chassis.pts, gl: one.chassis.gl, d: one.chassis.d, vs: true };
  if (key.startsWith('corps')) {
    const b = key.slice(6) as BagId;
    return { n: BAGS[b].n, eur: one.corps[b]?.eur ?? null, pts: one.corps[b]?.pts ?? null, gl: 'v_bag', d: one.corps[b]?.d ?? '', vs: true };
  }
  const M = one.mods[key.slice(4) as ModuleId];
  return { n: M.n, eur: M.eur, pts: M.pts, gl: M.gl, d: M.d, vs: M.gl.startsWith('v_') };
}

export type PieceState = 'own' | 'order' | 'new';

/** État d'une pièce (maquette pieceState, l.715) : possédée, commandée ou à commander. */
export function pieceState(s: KitState, key: PieceKey): PieceState {
  const cw = pieceCw(s, key);
  if (s.own[key] === cw) return 'own';
  if (s.order[key] === cw) return 'order';
  return 'new';
}

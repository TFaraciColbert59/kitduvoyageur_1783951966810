// Options d'apparence (pures, sans mutation) : forme, module, coloris, matière, finition, accessoire.
// Reproduit la maquette Kit_Studio_v2.html : catsFor/fixCat l.1627-1628, mutate l.1656-1662, simulate l.1663,
// optList l.1664-1671, applyOpt l.1689-1706 (gardes « déjà appliqué » et « plus de place »).
import { ACCESSORIES, BAGS, COLORWAYS, MODULE_IDS, ONE } from '../domain/catalog';
import type {
  AccessoryId, BagId, ColorwayId, ConfigSet, MaterialKey, ModuleId, PartNameId,
} from '../domain/catalog';
import { ptsUsed } from '../domain/attach';
import { setBag } from '../domain/packing';
import { modOn, setMod } from '../domain/parts';
import { currentConfig, currentKit, withKit } from '../domain/state';
import { bagWeight, totalCap } from '../domain/totals';
import type { KitState } from '../domain/types';

export type OptionCat = 'shape' | 'mod' | 'col' | 'mat' | 'fin' | 'acc';
export type OptionReason = 'points' | 'current';
export interface OptionResult { readonly state: KitState; readonly ok: boolean; readonly reason?: OptionReason }

/** Entrée de la liste d'options (maquette optList) : id au format de la maquette ('preset:x', 'cw:x', id de corps ou de module). */
export interface OptionEntry {
  readonly id: string;
  readonly n: string;
  readonly cur: boolean;
  readonly off: boolean;
  readonly why: string;
  readonly bag?: BagId;
  readonly mod?: ModuleId;
  readonly cw?: ColorwayId;
  readonly col?: MaterialKey;
  readonly own?: boolean;
}

export interface Simulation { readonly dw: number; readonly dc: number }

type Role = 'body' | 'pocket' | 'trim';
type NamedPart = Exclude<PartNameId, 'all'>;
type Draft = Record<string, Record<string, string | undefined>> & { accent: string; acc: AccessoryId[] };

const FAB_PARTS: readonly NamedPart[] = ['body', 'lid', 'front', 'sides'];
const FIN_ALL: readonly NamedPart[] = ['body', 'lid', 'front', 'sides', 'hip', 'harness', 'webbing'];
const CW_IDS: readonly ColorwayId[] = ['foret', 'sauge', 'pierre', 'nuit'];
const ROLE: Readonly<Record<NamedPart, Role>> = {
  body: 'body', lid: 'body', front: 'pocket', sides: 'pocket', hip: 'trim', harness: 'trim', webbing: 'trim',
};

/** Catégories d'une pièce (maquette catsFor, l.1627). */
export function catsFor(part: PartNameId): readonly ('shape' | 'mod' | 'col')[] {
  if (part === 'all') return ['shape', 'mod', 'col'];
  if (part === 'body') return ['shape', 'col'];
  if (part === 'webbing') return ['col'];
  return ['mod', 'col'];
}

const withConfig = (s: KitState, c: ConfigSet): KitState => ({
  ...s, config: { ...s.config, [currentKit(s).bag]: c },
});

/** Maquette mutate (l.1656-1662) : applique une option, renvoie un nouvel état. */
function mutate(s: KitState, part: PartNameId, cat: OptionCat, id: string): KitState {
  if (cat === 'mod') return setMod(s, id as ModuleId, !modOn(s, id as ModuleId));
  const c = structuredClone(currentConfig(s)) as unknown as Draft;
  const done = (): KitState => withConfig(s, c as unknown as ConfigSet);
  if (cat === 'col' && id.startsWith('cw:') && part !== 'all') {
    const w = COLORWAYS[id.slice(3) as ColorwayId];
    if (part === 'harness') {
      c.harness.col = w.trim; c.hip.col = w.trim; c.webbing.col = w.trim;
    } else c[part].col = w[ROLE[part]];
    return done();
  }
  if (cat === 'acc') {
    const a = ACCESSORIES[id as AccessoryId];
    if (c.acc.includes(id as AccessoryId)) c.acc = c.acc.filter((x) => x !== id);
    else c.acc = [...c.acc.filter((x) => ACCESSORIES[x].slot !== a.slot), id as AccessoryId];
    return done();
  }
  if (cat === 'col' && id.startsWith('preset:')) {
    const cw = id.slice(7) as ColorwayId;
    const w = COLORWAYS[cw];
    c.body.col = w.body; c.lid.col = w.body; c.front.col = w.pocket; c.sides.col = w.pocket;
    c.hip.col = w.trim; c.harness.col = w.trim; c.webbing.col = w.trim; c.accent = w.accent;
    // Le coloris du kit suit le dernier preset appliqué (affichage des tuiles) ; la config reste la source.
    return withKit(done(), { ...currentKit(s), cw });
  }
  if (cat === 'shape' && part !== 'all') { c[part].shape = id; return done(); }
  const tg: readonly NamedPart[] = part === 'all' ? (cat === 'fin' ? FIN_ALL : FAB_PARTS) : [part];
  for (const q of tg) c[q][cat] = id;
  return done();
}

/** Poids et capacité simulés d'une option (maquette simulate, l.1663). */
export function simulateOption(s: KitState, part: PartNameId, cat: OptionCat, id: string): Simulation {
  const k = currentKit(s);
  if (cat === 'shape' && (part === 'all' || part === 'body')) {
    return { dw: BAGS[id as BagId].g - BAGS[k.bag].g, dc: BAGS[id as BagId].L - BAGS[k.bag].L };
  }
  const next = mutate(s, part, cat, id);
  return { dw: bagWeight(next) - bagWeight(s), dc: totalCap(next) - totalCap(s) };
}

/** Options proposées (maquette optList, l.1664-1671). */
export function optionList(s: KitState, part: PartNameId, cat: OptionCat): readonly OptionEntry[] {
  const k = currentKit(s);
  const c = currentConfig(s);
  if (cat === 'shape') {
    const need = ptsUsed(s, 'corps');
    return Object.values(BAGS).map((b) => {
      const cur = k.bag === b.id;
      const cap = ONE.corps[b.id].pts;
      const off = !cur && need > cap;
      return {
        id: b.id, n: b.n, cur, off, bag: b.id,
        why: off ? `${b.n} : ${cap} points d’attache, tes modules en utilisent ${need}. Retire d’abord un module.` : '',
      };
    });
  }
  if (cat === 'mod') {
    return MODULE_IDS.filter((m) => part === 'all' || ONE.mods[m].part === part).map((m) => {
      const M = ONE.mods[m];
      const on = modOn(s, m);
      const free = (M.host === 'chassis' ? ONE.chassis.pts : ONE.corps[k.bag].pts) - ptsUsed(s, M.host);
      const off = !on && free < M.pts;
      const place = M.host === 'chassis' ? 'châssis' : BAGS[k.bag].n.toLowerCase();
      const alt = M.host === 'corps' && k.bag === 'b28' ? ' ou passe au corps 42 L' : '';
      return {
        id: m, n: M.n, cur: on, off, mod: m,
        why: off ? `Plus de points d’attache libres sur le ${place}. Retire un module${alt}.` : '',
        own: s.own[`mod:${m}`] !== undefined || s.order[`mod:${m}`] !== undefined,
      };
    });
  }
  if (cat === 'col') {
    return CW_IDS.map((id) => {
      const w = COLORWAYS[id];
      if (part === 'all') {
        return { id: `preset:${id}`, n: w.n, cw: id, cur: c.body.col === w.body && c.harness.col === w.trim, off: false, why: '' };
      }
      const hex = w[ROLE[part]];
      const cur = String(c[part].col).toLowerCase() === hex.toLowerCase();
      return { id: `cw:${id}`, n: w.n, cw: id, col: hex, cur, off: false, why: '' };
    });
  }
  return [];
}

/**
 * Applique une option (maquette applyOpt, l.1689-1706, hors effets visuels).
 * `value` : id de la maquette ('preset:x', 'cw:x', id de corps, id de module, id d'accessoire, matière, finition).
 * Un id de coloris nu est accepté ('x' → 'preset:x' sur « all », 'cw:x' ailleurs).
 */
export function setPartOption(s: KitState, part: PartNameId, cat: OptionCat, value: string): OptionResult {
  const k = currentKit(s);
  let id = value;
  if (cat === 'col' && (CW_IDS as readonly string[]).includes(id)) id = `${part === 'all' ? 'preset' : 'cw'}:${id}`;
  if (cat === 'shape' || cat === 'mod' || (cat === 'col' && /^(cw|preset):/.test(id))) {
    const o = optionList(s, part, cat).find((x) => x.id === id);
    if (!o) return { state: s, ok: false };
    if (o.off) return { state: s, ok: false, reason: 'points' };
    if (o.cur && cat !== 'mod') return { state: s, ok: false, reason: 'current' };
  }
  if (cat === 'shape' && id in BAGS) {
    const copy = { ...s, config: { ...s.config, [id]: structuredClone(s.config[k.bag]) } };
    return { state: setBag(copy, id as BagId).state, ok: true };
  }
  return { state: mutate(s, part, cat, id), ok: true };
}

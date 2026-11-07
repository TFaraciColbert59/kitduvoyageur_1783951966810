// Totaux, capacités et place restante (moteur pur). Chaque fonction cite la ligne de la maquette
// kit-studio-bundle/reference/Kit_Studio_v2.html. Aucune mutation de l'état reçu.
import { ACCESSORIES, BAGS, MATERIALS, PACK_ZONE_IDS, PART_WEIGHTS, SHAPE_OPTIONS } from './catalog';
import type { CapacityZoneId, Item, PackZoneId, ShapeOption, ShapeSlot } from './catalog';
import { currentConfig, currentKit, getItem } from './state';
import type { AnyItemId, ExtraItem, KitState } from './types';

const SHAPE_PARTS: readonly ShapeSlot[] = ['body', 'lid', 'front', 'sides', 'hip', 'harness'];
const CAP_ZONES: readonly CapacityZoneId[] = ['lid', 'main', 'front', 'sides', 'hip', 'back'];

/** Champs d'achat/location d'un objet ajouté (maquette addPlanned) : eur = prix, day = tarif/jour. */
type PlannedFields = { readonly eur?: number; readonly day?: number; readonly planned?: 'shop' | 'rent' };
type AnyItem = Item | ExtraItem;

/** Bilan complet (maquette totals() l.884-886 v2). Nom d'origine entre parenthèses. */
export interface Totals {
  /** Poids de base : sac + objets non consommables, hors porté (base). */
  readonly baseWeight: number;
  /** Poids des consommables dans le sac (cons). */
  readonly consumables: number;
  /** Poids porté sur soi (worn). */
  readonly worn: number;
  /** Volume utilisé en L (used). */
  readonly usedVolume: number;
  /** Capacité totale en L (cap). */
  readonly capacity: number;
  /** Volume utilisé par zone (vol). */
  readonly volumeByZone: Readonly<Partial<Record<PackZoneId, number>>>;
  /** Poids par zone, porté compris (zg). */
  readonly weightByZone: Readonly<Partial<Record<PackZoneId, number>>>;
  /** Total des achats prévus en euros (buy). */
  readonly buy: number;
  /** Total des locations prévues en euros sur la durée du kit (rent). */
  readonly rent: number;
  /** Nombre d'objets au poids inconnu (unknown). */
  readonly unknown: number;
  /** Poids sur le dos = base + consommables (back). */
  readonly onBack: number;
}

/** maquette v2 l.760 : sans corps « roll », le couvercle suit la config ; sinon aucun couvercle. */
export function effLid(s: KitState): string {
  const c = currentConfig(s);
  return c.body.shape === 'roll' ? 'none' : (c.lid.shape ?? '');
}

/** maquette v2 l.761 : option de forme active d'une pièce (le couvercle passe par effLid). */
export function shapeOf(s: KitState, part: ShapeSlot): ShapeOption | undefined {
  const c = currentConfig(s);
  if (part === 'lid') return SHAPE_OPTIONS.lid.find((o) => o.id === effLid(s));
  return (SHAPE_OPTIONS[part] ?? []).find((o) => o.id === c[part]?.shape);
}

/** maquette v2 l.762 : capacité en L d'une zone selon le sac, les formes et l'accessoire poche. */
export function capOf(s: KitState, zone: CapacityZoneId): number {
  const bag = BAGS[currentKit(s).bag];
  const r = bag.L / 48;
  let v = bag.cap[zone] || 0;
  for (const p of SHAPE_PARTS) {
    const sh = shapeOf(s, p);
    if (!sh) continue;
    const set = sh.capSet?.[zone];
    if (set != null) v = set * r;
    const add = sh.cap?.[zone];
    if (add) v += add * r;
    const mul = sh.capMul?.[zone];
    if (mul) v *= mul;
  }
  if (zone === 'hip' && currentConfig(s).acc.includes('spocket')) v += 0.6;
  return Math.max(0, v);
}

/** maquette v2 l.763 : somme des capacités des six zones. */
export function totalCap(s: KitState): number {
  return CAP_ZONES.reduce((a, z) => a + capOf(s, z), 0);
}

/** maquette v2 l.764 : poids d'une pièce du sac (part du poids, forme, facteur matière). */
export function partW(s: KitState, part: ShapeSlot): number {
  const b = BAGS[currentKit(s).bag];
  const c = currentConfig(s);
  const r = b.g / 1240;
  const sh = shapeOf(s, part);
  if (sh && sh.g === '-') return 0;
  let w = PART_WEIGHTS[part] * b.g + (sh && typeof sh.g === 'number' ? sh.g * r : 0);
  const mat = c[part]?.mat;
  if (mat && part !== 'hip' && part !== 'harness') w *= MATERIALS[mat].f;
  return Math.max(0, w);
}

/** maquette v2 l.765 : poids du sac vide en g (pièces + accessoires), arrondi. */
export function bagWeight(s: KitState): number {
  let g = SHAPE_PARTS.reduce((a, p) => a + partW(s, p), 0);
  for (const a of currentConfig(s).acc) g += ACCESSORIES[a].g;
  return Math.round(g);
}

/**
 * maquette v2 l.869 (effG) : poids effectif d'un objet ; les consommables dépendent du jour.
 * Poids inconnu (`null`, règle C-03) : n'entre pas dans les sommes (0 g effectif) mais reste
 * compté à part par `totals().unknown` — jamais confondu avec un objet réellement à 0 g.
 */
export function effG(s: KitState, item: AnyItem): number {
  const k = currentKit(s);
  const g = item.g;
  if (g == null) return 0;
  if (!item.cons) return g;
  if (k.cabin && item.cons === 'water') return item.dry ?? 0;
  const d = s.day;
  const left = k.days - d + 1;
  const carry = k.food ? k.food.carry : k.days;
  const cd = Math.min(carry - ((d - 1) % carry), left);
  switch (item.cons) {
    case 'water':
      return g;
    case 'food':
      return k.food ? k.food.perDay * cd : g;
    case 'snack':
      return 120 * cd;
    case 'gas':
      return 140 + Math.max(0, 230 - 25 * (d - 1));
    default:
      return g;
  }
}

/** maquette v2 l.870 (autoSlot) : emplacement automatique dans le compartiment principal. */
export function autoSlot(s: KitState, item: AnyItem): string {
  if (item.fn === 'sleep' || item.fn === 'sleeppad') return 'bottom';
  if (['firstaid', 'insulation', 'rainshell', 'hygiene', 'rainpants'].includes(item.fn)) return 'top';
  const dens = effG(s, item) / Math.max(0.1, item.L || 0.5);
  if (dens >= 250 || item.fn === 'shelter' || item.fn === 'laptop') return 'midBack';
  return 'midFront';
}

/** maquette v2 l.884-886 (totals) : bilan du kit courant au jour s.day. */
export function totals(s: KitState): Totals {
  const k = currentKit(s);
  let base = bagWeight(s);
  let cons = 0;
  let worn = 0;
  let used = 0;
  let buy = 0;
  let rent = 0;
  let unknown = 0;
  const vol: Partial<Record<PackZoneId, number>> = {};
  const zg: Partial<Record<PackZoneId, number>> = {};
  for (const z of PACK_ZONE_IDS) {
    for (const id of k.packed[z] ?? ([] as readonly AnyItemId[])) {
      const it = getItem(s, id);
      if (!it) continue;
      const g = effG(s, it);
      zg[z] = (zg[z] ?? 0) + g;
      const pl = it as AnyItem & PlannedFields;
      if (pl.planned === 'shop') buy += pl.eur || 0;
      if (pl.planned === 'rent') rent += (pl.day || 0) * k.days;
      if ((it.g as number | null | undefined) == null) unknown++;
      if (z === 'worn') {
        worn += g;
        continue;
      }
      if (it.cons) cons += g;
      else base += g;
      vol[z] = (vol[z] ?? 0) + (it.L || 0);
      used += it.L || 0;
    }
  }
  return {
    baseWeight: base, consumables: cons, worn, usedVolume: used, capacity: totalCap(s),
    volumeByZone: vol, weightByZone: zg, buy, rent, unknown, onBack: base + cons,
  };
}

/** maquette v2 l.1293 (room) : place restante en L dans une zone = capacité - volume rangé. */
export function room(s: KitState, zone: CapacityZoneId): number {
  return capOf(s, zone) - (totals(s).volumeByZone[zone] ?? 0);
}

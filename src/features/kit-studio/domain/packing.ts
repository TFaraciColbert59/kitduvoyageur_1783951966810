// Rangement dans le sac (moteur pur) : pack, unpack, setBag, relocate, autopack, candidates.
// Chaque fonction cite la ligne de la maquette kit-studio-bundle/reference/Kit_Studio_v2.html.
// Les effets visuels (hud, haptic, objets 3D) restent hors du domaine : le résultat décrit l'événement.
import { ITEMS, PACK_ZONE_IDS } from './catalog';
import type { BagId, CapacityZoneId, Item, PackZoneId, ZoneId } from './catalog';
import { currentKit, getItem, isPacked, withKit, zoneOf } from './state';
import { capOf, room } from './totals';
import type { AnyItemId, ExtraItem, KitState, LiveKit } from './types';

export type PackReason = 'full' | 'lent' | 'already' | 'zone';

export interface PackResult {
  readonly state: KitState;
  readonly ok: boolean;
  readonly reason?: PackReason;
  /** Zone effectivement choisie quand la zone demandée était pleine (maquette : « <zone> plein »). */
  readonly altZone?: PackZoneId;
  /** Zone où l'objet a été rangé (si ok). */
  readonly zone?: PackZoneId;
  /** Volume manquant en L dans la zone demandée (reason 'full'). */
  readonly missing?: number;
}

type AnyItem = Item | ExtraItem;
const TOL = 0.05;

/** INV de la maquette : catalogue puis objets ajoutés. */
export function inventory(s: KitState): readonly AnyItem[] {
  return [...ITEMS, ...s.extraItems];
}

const asCap = (z: ZoneId): z is CapacityZoneId => z !== 'worn' && z !== 'bag';

function withPacked(s: KitState, packed: LiveKit['packed'], slots?: LiveKit['slots']): KitState {
  const k = currentKit(s);
  return withKit(s, { ...k, packed, slots: slots === undefined ? k.slots : slots });
}

/** maquette v2 l.1300-1301 (pack) : range un objet, bascule vers une zone voisine si la zone est pleine. */
export function pack(s: KitState, id: AnyItemId, zone: ZoneId): PackResult {
  const it = getItem(s, id);
  if (!it) return { state: s, ok: false, reason: 'zone' };
  if (isPacked(s, id)) return { state: s, ok: false, reason: 'already' };
  if (it.state === 'lent') return { state: s, ok: false, reason: 'lent' };
  const zs = it.zones.filter((z): z is PackZoneId => z !== 'bag');
  let z: PackZoneId | undefined = zone !== 'bag' && it.zones.includes(zone) ? (zone as PackZoneId) : zs[0];
  if (!z) return { state: s, ok: false, reason: 'zone' };
  let altZone: PackZoneId | undefined;
  if (z !== 'worn' && asCap(z) && (it.L || 0) > room(s, z) + TOL) {
    const alt = zs.find((q) => q !== z && asCap(q) && (it.L || 0) <= room(s, q) + TOL);
    if (!alt) {
      return { state: s, ok: false, reason: 'full', missing: (it.L || 0) - room(s, z) };
    }
    altZone = alt;
    z = alt;
  }
  const k = currentKit(s);
  const packed = { ...k.packed, [z]: [...(k.packed[z] ?? []), id] };
  return { state: withPacked(s, packed), ok: true, zone: z, ...(altZone ? { altZone } : {}) };
}

/** maquette v2 l.1303 (unpack) : retire l'objet de sa zone et de son placement fin. */
export function unpack(s: KitState, id: AnyItemId): KitState {
  const z = zoneOf(s, id);
  if (!z) return s;
  const k = currentKit(s);
  const packed = { ...k.packed, [z]: k.packed[z].filter((x) => x !== id) };
  let slots = k.slots;
  if (slots && id in slots) {
    const { [id]: _drop, ...rest } = slots;
    void _drop;
    slots = rest;
  }
  return withPacked(s, packed, slots);
}

/** maquette v2 l.1683 (relocate) : vide les poches sans capacité (hors main/back/worn). */
export function relocate(s: KitState): { state: KitState; moved: number } {
  const k = currentKit(s);
  const packed: Record<PackZoneId, AnyItemId[]> = {} as Record<PackZoneId, AnyItemId[]>;
  for (const z of PACK_ZONE_IDS) packed[z] = [...(k.packed[z] ?? [])];
  let moved = 0;
  for (const z of ['lid', 'front', 'sides', 'hip'] as const) {
    if (capOf(s, z) > 0) continue;
    for (const id of [...packed[z]]) {
      const it = getItem(s, id);
      const to = (it?.zones.find((q) => q !== z && asCap(q) && capOf(s, q) > 0) as PackZoneId | undefined) ?? 'main';
      packed[z] = packed[z].filter((x) => x !== id);
      packed[to].push(id);
      moved++;
    }
  }
  return moved ? { state: withPacked(s, packed), moved } : { state: s, moved: 0 };
}

/** maquette v2 l.1308 (setBag) : change le corps de sac puis range ailleurs ce qui ne tient plus. */
export function setBag(s: KitState, bagId: BagId): { state: KitState; moved: number } {
  const k = currentKit(s);
  if (k.bag === bagId) return { state: s, moved: 0 };
  return relocate(withKit(s, { ...k, bag: bagId }));
}

/** maquette v2 l.1311 (autopack) : retire le placement fin, l'emplacement redevient automatique. */
export function autopack(s: KitState): KitState {
  const k = currentKit(s);
  return k.slots === null ? s : withKit(s, { ...k, slots: null });
}

/** Manques actifs du kit (maquette l.889 activeGhosts) : usages sans aucun objet rangé. */
function wantedFns(s: KitState): Set<string> {
  const k = currentKit(s);
  const have = new Set<string>();
  for (const z of PACK_ZONE_IDS) for (const id of k.packed[z] ?? []) {
    const it = getItem(s, id);
    if (it) have.add(it.fn);
  }
  return new Set(k.ghosts.filter((g) => !have.has(g.fn)).map((g) => g.fn));
}

/** maquette v2 l.1260-1263 (candidates) : objets non rangés pour une zone, manques d'abord, prêtés en dernier. */
export function candidates(s: KitState, zone: ZoneId, fam?: string | null): readonly AnyItem[] {
  const want = wantedFns(s);
  const list = inventory(s).filter(
    (it) => !isPacked(s, it.id) && (zone === 'bag' || it.zones.includes(zone)) && (!fam || it.fam === fam),
  );
  return list.sort(
    (a, b) =>
      Number(want.has(b.fn)) - Number(want.has(a.fn)) ||
      (b.vital || 0) - (a.vital || 0) ||
      Number(a.state === 'lent') - Number(b.state === 'lent') ||
      a.fam.localeCompare(b.fam),
  );
}

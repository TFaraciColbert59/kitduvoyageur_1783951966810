// Accès de base à l'état (coordinateur). Pur, sans dépendance extérieure au domaine.
import { BAGS, DEFAULT_CONFIG, ITEMS, KITS, PACK_ZONE_IDS } from './catalog';
import type { Bag, ConfigSet, Item, KitId, PackZoneId } from './catalog';
import type { AnyItemId, ExtraItem, KitState, LiveKit, PieceKey } from './types';

const ITEM_MAP: ReadonlyMap<string, Item> = new Map(ITEMS.map((i) => [i.id, i]));

function liveKit(id: KitId): LiveKit {
  const k = KITS.find((x) => x.id === id);
  if (!k) throw new Error(`kit inconnu : ${id}`);
  const packed = {} as Record<PackZoneId, AnyItemId[]>;
  for (const z of PACK_ZONE_IDS) packed[z] = [...(k.packed[z] ?? [])];
  return { ...k, packed, slots: k.slots ? { ...k.slots } : null };
}

function cloneConfig(c: ConfigSet): ConfigSet {
  return JSON.parse(JSON.stringify(c)) as ConfigSet;
}

/** État de départ : 3 kits de la maquette, kit TMB, jour 1, pièces possédées (maquette OWN l.713 v2). */
export function createInitialState(kitId: KitId = 'tmb'): KitState {
  const own: Partial<Record<PieceKey, 'foret'>> = {
    chassis: 'foret', 'corps:b42': 'foret', 'mod:lid': 'foret', 'mod:front': 'foret', 'mod:sides': 'foret',
  };
  return {
    version: 1,
    kitId,
    kits: { tmb: liveKit('tmb'), vercors: liveKit('vercors'), cabine: liveKit('cabine') },
    config: { b42: cloneConfig(DEFAULT_CONFIG.b42), b28: cloneConfig(DEFAULT_CONFIG.b28) },
    day: 1,
    own,
    order: {},
    extraItems: [],
  };
}

export const currentKit = (s: KitState): LiveKit => s.kits[s.kitId];
export const currentBag = (s: KitState): Bag => BAGS[currentKit(s).bag];
export const currentConfig = (s: KitState): ConfigSet => s.config[currentKit(s).bag];

/** Objet par id : catalogue puis objets ajoutés (maquette get()). */
export function getItem(s: KitState, id: AnyItemId): Item | ExtraItem | undefined {
  return ITEM_MAP.get(id) ?? s.extraItems.find((x) => x.id === id);
}

export function zoneOf(s: KitState, id: AnyItemId): PackZoneId | null {
  const k = currentKit(s);
  for (const z of PACK_ZONE_IDS) if (k.packed[z].includes(id)) return z;
  return null;
}

export const isPacked = (s: KitState, id: AnyItemId): boolean => zoneOf(s, id) !== null;

/** Remplace le kit courant (aide pour les fonctions de transformation). */
export function withKit(s: KitState, k: LiveKit): KitState {
  return { ...s, kits: { ...s.kits, [s.kitId]: k } };
}

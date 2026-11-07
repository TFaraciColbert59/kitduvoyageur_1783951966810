// Accès de base à l'état (coordinateur). Pur, sans dépendance extérieure au domaine.
// Les données viennent du registre runtime (`studioData`) : jeu de démonstration par défaut,
// données Supabase en production (cf. server/getStudioData.ts).
import { BAGS, PACK_ZONE_IDS } from './catalog';
import type { Bag, ConfigSet, Item, KitId, PackZoneId } from './catalog';
import { studioData } from './studioData';
import type { AnyItemId, ExtraItem, KitState, LiveKit } from './types';

let itemMapCache: { items: readonly Item[]; map: ReadonlyMap<string, Item> } | null = null;

function itemMap(): ReadonlyMap<string, Item> {
  const items = studioData().items;
  if (!itemMapCache || itemMapCache.items !== items) {
    itemMapCache = { items, map: new Map(items.map((i) => [i.id, i])) };
  }
  return itemMapCache.map;
}

function liveKit(id: KitId): LiveKit {
  const k = studioData().kits.find((x) => x.id === id);
  if (!k) throw new Error(`kit inconnu : ${id}`);
  const packed = {} as Record<PackZoneId, AnyItemId[]>;
  for (const z of PACK_ZONE_IDS) packed[z] = [...(k.packed[z] ?? [])];
  return { ...k, packed, slots: k.slots ? { ...k.slots } : null };
}

function cloneConfig(c: ConfigSet): ConfigSet {
  return JSON.parse(JSON.stringify(c)) as ConfigSet;
}

/**
 * État de départ : kits, configuration, pièces possédées et précommandes lus dans le registre.
 * Démonstration : kit TMB, jour 1, pièces possédées de la maquette (OWN l.713 v2).
 * Production : premier kit du compte, configuration et pièces possédées réelles.
 */
export function createInitialState(kitId?: KitId): KitState {
  const data = studioData();
  const first = data.kits[0];
  if (!first) throw new Error('registre studio vide : aucun kit');
  const id = kitId ?? first.id;
  const kits = {} as Record<KitId, LiveKit>;
  for (const k of data.kits) kits[k.id] = liveKit(k.id);
  return {
    version: 1,
    kitId: id,
    kits,
    config: { b42: cloneConfig(data.config.b42), b28: cloneConfig(data.config.b28) },
    day: 1,
    own: { ...data.own },
    order: { ...data.order },
    extraItems: [],
  };
}

export const currentKit = (s: KitState): LiveKit => s.kits[s.kitId];
export const currentBag = (s: KitState): Bag => BAGS[currentKit(s).bag];
export const currentConfig = (s: KitState): ConfigSet => s.config[currentKit(s).bag];

/** Objet par id : registre (catalogue / inventaire réel) puis objets ajoutés (maquette get()). */
export function getItem(s: KitState, id: AnyItemId): Item | ExtraItem | undefined {
  return itemMap().get(id) ?? s.extraItems.find((x) => x.id === id);
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

/** Une pièce est-elle connue du registre ? (garde de compatibilité de l'état local) */
export function registryHasKit(id: KitId): boolean {
  return studioData().kits.some((k) => k.id === id);
}

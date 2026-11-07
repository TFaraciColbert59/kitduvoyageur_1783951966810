// Échange d'objets (moteur pur). Maquette kit-studio-bundle/reference/Kit_Studio_v2.html.
import { ALTERNATIVES } from './catalog';
import type { Alternative, FamilyId, Item } from './catalog';
import { inventory } from './packing';
import { currentKit, getItem, isPacked, withKit, zoneOf } from './state';
import { effG } from './totals';
import type { AnyItemId, ExtraItem, KitState } from './types';

type AnyItem = Item | ExtraItem;

export type AltOption =
  | { readonly kind: 'own'; readonly e: AnyItem; readonly d: number }
  | { readonly kind: 'alt'; readonly e: Alternative; readonly d: number | null };

/** maquette v2 l.1275 (altsFor) : remplaçants possédés puis alternatives à acheter/louer, avec écart de poids. */
export function altsFor(s: KitState, id: AnyItemId): readonly AltOption[] {
  const it = getItem(s, id);
  if (!it) return [];
  const w = effG(s, it);
  const own = inventory(s)
    .filter((x) => x.fn === it.fn && x.id !== id && !isPacked(s, x.id))
    .map((x): AltOption => ({ kind: 'own', e: x, d: effG(s, x) - w }));
  const ext = (ALTERNATIVES[it.fn] ?? [])
    .filter((a) => !isPacked(s, a.id))
    .map((a): AltOption => ({ kind: 'alt', e: a, d: a.g == null ? null : a.g - w }));
  return [...own, ...ext];
}

/** maquette v2 l.1279 (addPlanned) : ajoute une alternative à l'inventaire (idempotent). */
export function addPlanned(s: KitState, a: Alternative, ref?: AnyItem, fn?: string): { state: KitState; id: string } {
  if (getItem(s, a.id)) return { state: s, id: a.id };
  const item: ExtraItem = {
    id: a.id,
    n: a.n,
    fam: (ref?.fam ?? '') as FamilyId,
    fn: ref?.fn ?? fn ?? '',
    sh: a.sh,
    gl: a.gl,
    g: a.g, // règle C-03 : une alternative non pesée reste null
    L: ref?.L || 0.6,
    color: a.color,
    zones: ref?.zones ?? ['main'],
    planned: a.src,
    eur: a.eur,
    day: a.day,
    state: 'stock',
    loc: a.src === 'rent' ? (a.n.split('· ')[1] ?? '') : 'Boutique LKDV',
    trips: 0,
  };
  return { state: { ...s, extraItems: [...s.extraItems, item] }, id: a.id };
}

/**
 * maquette v2 l.1304 (swapItem) : remplace en conservant la zone si le nouvel objet y va, sinon dans sa
 * première zone. Objet prêté ou ancien objet non rangé : état inchangé.
 */
export function swapItem(s: KitState, oldId: AnyItemId, newId: AnyItemId): KitState {
  const z = zoneOf(s, oldId);
  const it = getItem(s, newId);
  if (!z || !it || it.state === 'lent') return s;
  const k = currentKit(s);
  const packed = { ...k.packed };
  const arr = [...packed[z]];
  const i = arr.indexOf(oldId);
  if (it.zones.includes(z)) {
    arr[i] = newId;
    packed[z] = arr;
  } else {
    arr.splice(i, 1);
    packed[z] = arr;
    const to = it.zones.find((q) => q !== 'bag') ?? 'main';
    const t = to as keyof typeof packed;
    packed[t] = [...(packed[t] ?? []), newId];
  }
  let slots = k.slots;
  if (slots && oldId in slots) {
    const { [oldId]: _drop, ...rest } = slots;
    void _drop;
    slots = rest;
  }
  return withKit(s, { ...k, packed, slots });
}

// Positions de rangement dans le sac (moteur pur, aucune dépendance three/DOM).
// Maquette : kit-studio-bundle/reference/Kit_Studio_v2.html (SLOT l.860, bodyFront/frontZ l.766-767, reindex/packedLocal l.873-880).
import { PACK_ZONE_IDS } from './catalog';
import type { PackZoneId, Vec3 } from './catalog';
import { currentConfig, currentKit, getItem } from './state';
import { autoSlot } from './totals';
import type { AnyItemId, KitState } from './types';

/** Entrée d'index d'un objet rangé (maquette IDX[id]). */
export interface PackEntry {
  readonly zone: PackZoneId;
  /** Rang dans la zone. */
  readonly i: number;
  /** Nombre d'objets de la zone. */
  readonly n: number;
  /** Compartiment principal seulement : emplacement fin, rang et effectif dans cet emplacement. */
  readonly slot?: string;
  readonly si?: number;
  readonly sn?: number;
}
export type PackIndex = Readonly<Record<string, PackEntry>>;

/** maquette l.860 : position locale de chaque emplacement du compartiment principal. */
const SLOT: Readonly<Record<string, Vec3>> = {
  bottom: [0, -0.5, 0], bottomF: [0, -0.5, 0.13], midBack: [0, 0.06, -0.13], midFront: [0, 0, 0.13], top: [0, 0.46, 0],
};
const ORIGIN: Vec3 = [0, 0, 0];

/** maquette l.766. */
export const bodyFront = (s: KitState): number => (currentConfig(s).body.shape === 'slim' ? 0.25 : 0.28);

/** maquette l.767 : profondeur de la poche avant. */
export function frontZ(s: KitState): number {
  const sh = currentConfig(s).front.shape ?? '';
  const bf = bodyFront(s);
  if (sh === 'none') return bf + 0.005;
  const add: Readonly<Record<string, number>> = { stretch: 0.1, zip: 0.07, shove: 0.13 };
  return bf + (add[sh] ?? 0) - 0.01;
}

/** maquette l.873-874 (reindex) : index id → zone, rang, emplacement. Résultat pur, recalculé à la demande. */
export function reindex(s: KitState): PackIndex {
  const k = currentKit(s);
  const out: Record<string, PackEntry> = {};
  for (const z of PACK_ZONE_IDS as readonly PackZoneId[]) {
    const arr: readonly AnyItemId[] = k.packed[z] ?? [];
    if (z === 'main') {
      const groups: Record<string, AnyItemId[]> = {};
      for (const id of arr) {
        const it = getItem(s, id);
        const sl = k.slots?.[id] ?? (it ? autoSlot(s, it) : 'midFront');
        (groups[sl] ??= []).push(id);
      }
      for (const sl of Object.keys(groups)) {
        groups[sl].forEach((id, si) => {
          out[id] = { zone: z, i: arr.indexOf(id), n: arr.length, slot: sl, si, sn: groups[sl].length };
        });
      }
    } else {
      arr.forEach((id, i) => { out[id] = { zone: z, i, n: arr.length }; });
    }
  }
  return out;
}

/** maquette l.875-880 (packedLocal) : position locale d'un objet dans le sac (tuple, pas de three). */
export function packedLocal(s: KitState, id: AnyItemId, idx: PackIndex = reindex(s)): Vec3 {
  const x = idx[id];
  if (!x) return ORIGIN;
  switch (x.zone) {
    case 'main': {
      const b = SLOT[x.slot ?? 'midFront'] ?? SLOT.midFront;
      return [((x.si ?? 0) - ((x.sn ?? 1) - 1) / 2) * 0.2, b[1], b[2]];
    }
    case 'lid': return [(x.i - (x.n - 1) / 2) * 0.15, 0.86, 0.02];
    case 'front': return [(x.i - (x.n - 1) / 2) * 0.2, -0.18, frontZ(s) - 0.04];
    case 'sides': return [x.i % 2 ? -0.44 : 0.44, -0.42, 0.02];
    case 'hip': return [x.i % 2 ? -0.5 : 0.5, -0.6, -0.12];
    case 'back': return [0, 0.12 - x.i * 0.25, -0.2];
    default: return ORIGIN;
  }
}

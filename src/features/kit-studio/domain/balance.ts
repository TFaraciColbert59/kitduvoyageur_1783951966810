// Équilibre du sac et poids par jour (moteur pur). Maquette : Kit_Studio_v2.html l.887-890 (cog, cogState), l.1389 (dayWeights).
import { BAGS, PACK_ZONE_IDS } from './catalog';
import { packedLocal, reindex } from './layout';
import { currentBag, currentKit, getItem } from './state';
import { bagWeight, effG, totals } from './totals';
import type { AnyItemId, KitState } from './types';

export interface Cog { readonly x: number; readonly y: number; readonly z: number }
export interface CogState { readonly ok: boolean; readonly t: string; readonly s: string }

/** maquette l.888 (cog) : centre de gravité du sac (le porté « worn » n'y compte pas). */
export function cog(s: KitState): Cog {
  const k = currentKit(s);
  const sc = BAGS[currentBag(s).id].sc;
  const idx = reindex(s);
  const bw = bagWeight(s);
  let M = bw;
  let x = 0;
  let y = 0;
  let z = -0.05 * sc[2] * bw;
  for (const zn of PACK_ZONE_IDS) {
    if (zn === 'worn') continue;
    for (const id of (k.packed[zn] ?? []) as readonly AnyItemId[]) {
      const it = getItem(s, id);
      if (!it) continue;
      const m = effG(s, it);
      const p = packedLocal(s, id, idx);
      M += m;
      x += m * p[0] * sc[0];
      y += m * p[1] * sc[1];
      z += m * p[2] * sc[2];
    }
  }
  return { x: x / M, y: y / M, z: z / M };
}

/** maquette l.889 (cogState) : verdict d'équilibre, textes de la maquette. */
export function cogState(c: Cog): CogState {
  if (c.z > -0.02) return { ok: false, t: 'Trop loin du dos', s: 'Le lourd est devant ou en bas : le sac tire en arrière. Double-tape le sac pour le ranger.' };
  if (c.y < -0.1) return { ok: false, t: 'Trop bas', s: 'Monte le lourd au niveau des omoplates. Double-tape le sac pour le ranger.' };
  if (c.y > 0.42) return { ok: false, t: 'Trop haut', s: 'Le sac va basculer dans les descentes.' };
  if (Math.abs(c.x * 44) > 2) {
    return { ok: false, t: 'Penche à ' + (c.x > 0 ? 'droite' : 'gauche'), s: 'Répartis les objets lourds des poches latérales et de la ceinture des deux côtés.' };
  }
  return { ok: true, t: 'Bien équilibré', s: 'Le lourd est plaqué contre le dos, à hauteur des omoplates.' };
}

/** maquette l.1389 (dayWeights) : poids sur le dos de chaque jour, sans modifier l'état reçu. */
export function dayWeights(s: KitState): number[] {
  const days = currentKit(s).days;
  const out: number[] = [];
  for (let d = 1; d <= days; d++) out.push(totals({ ...s, day: d }).onBack);
  return out;
}

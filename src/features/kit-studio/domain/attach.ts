// Points d'attache : capacité, usage, ajout de module. Pur.
// Maquette Kit_Studio_v2.html l.705-706 (ptsCap, ptsUsed), l.1735-1736 (toggleMod).
import { MODULE_IDS, ONE } from './catalog';
import type { ModuleId } from './catalog';
import { modOn, setMod } from './parts';
import { currentKit } from './state';
import type { KitState } from './types';

export type AttachHost = 'chassis' | 'corps';

/** Points disponibles sur un hôte (maquette ptsCap). */
export function ptsCap(s: KitState, host: AttachHost): number {
  return host === 'chassis' ? ONE.chassis.pts : ONE.corps[currentKit(s).bag].pts;
}

/** Points occupés par les modules actifs d'un hôte (maquette ptsUsed). */
export function ptsUsed(s: KitState, host: AttachHost): number {
  return MODULE_IDS.filter((m) => ONE.mods[m].host === host && modOn(s, m)).reduce((a, m) => a + ONE.mods[m].pts, 0);
}

/** Un module absent peut-il être ajouté ? (refus si points insuffisants, maquette toggleMod). */
export function canAddModule(s: KitState, m: ModuleId): boolean {
  const M = ONE.mods[m];
  return ptsCap(s, M.host) - ptsUsed(s, M.host) >= M.pts;
}

/** Bascule un module avec la règle des points : renvoie le même état si refus ou sans effet. */
export function toggleModule(s: KitState, m: ModuleId, on: boolean): KitState {
  if (on === modOn(s, m)) return s;
  if (on && !canAddModule(s, m)) return s;
  return setMod(s, m, on);
}

/**
 * Compas — appliquer un de ses kits à un voyage (fonctions pures).
 *
 * « Compatibilité » = ce que le kit couvre parmi les conseils météo du voyage
 * et ce qui est déjà dans le voyage. Ce n'est pas un score : ce sont deux
 * décomptes que l'utilisateur peut recompter.
 */

import { adviseKit } from './kitRules';
import type { CompasDayPlan } from './compasModel';
import type { DayForecast } from './weather';

export interface MyKitItem {
  id: string;
  name: string;
  category: string | null;
  weightG: number | null;
  quantity: number;
  isVital: boolean;
  productOwnershipId: string | null;
}

export interface MyKit {
  id: string;
  name: string;
  season: string | null;
  items: MyKitItem[];
}

export const normalizeName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export interface KitApplyPlan {
  toAdd: MyKitItem[];
  alreadyThere: number;
}

/** Les objets du kit absents du voyage (même nom, accents et casse ignorés). */
export function planKitApply(kit: MyKit, tripNames: string[]): KitApplyPlan {
  const present = new Set(tripNames.map(normalizeName));
  const seen = new Set<string>();
  const toAdd: MyKitItem[] = [];
  let alreadyThere = 0;
  for (const item of kit.items) {
    const key = normalizeName(item.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (present.has(key)) alreadyThere += 1;
    else toAdd.push(item);
  }
  return { toAdd, alreadyThere };
}

export interface KitCompatibility {
  /** Conseils météo du voyage couverts par ce kit / total de conseils. */
  covered: number;
  total: number;
  /** Conseils couverts uniquement grâce à ce kit (absents du voyage actuel). */
  bringsNew: number;
}

export function kitCompatibility(input: {
  kit: MyKit;
  tripNames: string[];
  forecasts: Array<{ day: number; date: string; forecast: DayForecast | null }>;
  dayPlans: CompasDayPlan[];
  waterPointsCount: number | null;
}): KitCompatibility {
  const base = {
    forecasts: input.forecasts,
    dayPlans: input.dayPlans,
    waterPointsCount: input.waterPointsCount,
  };
  const withKit = adviseKit({ ...base, lines: input.kit.items });
  const now = adviseKit({ ...base, lines: input.tripNames.map((name) => ({ name })) });
  const nowCovered = new Set(now.filter((a) => a.covered).map((a) => a.id));
  const covered = withKit.filter((a) => a.covered);
  return {
    covered: covered.length,
    total: withKit.length,
    bringsNew: covered.filter((a) => !nowCovered.has(a.id)).length,
  };
}

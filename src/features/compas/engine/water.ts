/**
 * Eau du kit (maquette finale : onglet « Eau » du Kit). Fonctions pures.
 *
 * - Besoin par personne et par jour : le repère de `KIT_THRESHOLDS`
 *   (0,5 L par heure de marche, 0,75 L par temps chaud) × la marche prévue ce
 *   jour-là. Un jour sans durée de marche reste « non renseigné ».
 * - Contenants : les objets du kit reconnus comme contenants d'eau ; leur
 *   volume n'est compté que s'il est écrit dans le nom (« Gourde 1 L »,
 *   « 750 ml »). Jamais un volume supposé.
 */

import type { CompasDayPlan, CompasKitLine } from './compasModel';
import { KIT_THRESHOLDS } from './kitRules';
import type { DayForecast } from './weather';

export interface WaterDay {
  day: number;
  date: string | null;
  walkMin: number | null;
  tMax: number | null;
  hot: boolean;
  /** Litres par personne, arrondis au dixième ; null si la marche n'est pas connue. */
  liters: number | null;
}

export interface WaterContainer {
  id: string;
  name: string;
  quantity: number;
  /** Volume total (quantité comprise) lu dans le nom, sinon null. */
  liters: number | null;
}

export interface WaterPlan {
  days: WaterDay[];
  /** Plus gros besoin d'une journée, par personne. */
  peak: WaterDay | null;
  containers: WaterContainer[];
  /** Volume total lu ; null si aucun contenant n'a de volume écrit. */
  knownLiters: number | null;
  /** Des contenants sans volume lisible existent. */
  unknownCount: number;
}

const CONTAINER = /gourde|bouteille|poche [àa] eau|hydrat|camelbak|flask|bidon/i;

/** Volume écrit dans un nom d'objet : « 1 L », « 1,5l », « 750 ml », « 2 litres ». */
export function volumeFromName(name: string): number | null {
  const ml = /(\d+(?:[.,]\d+)?)\s*ml\b/i.exec(name);
  if (ml) {
    const v = Number(ml[1].replace(',', '.')) / 1000;
    return v > 0 && v <= 20 ? v : null;
  }
  const l = /(\d+(?:[.,]\d+)?)\s*(?:l|litres?)\b/i.exec(name);
  if (l) {
    const v = Number(l[1].replace(',', '.'));
    return v > 0 && v <= 20 ? v : null;
  }
  return null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function planWater(input: {
  dayPlans: readonly CompasDayPlan[];
  forecasts: ReadonlyArray<{ day: number; forecast: DayForecast | null }>;
  lines: ReadonlyArray<Pick<CompasKitLine, 'id' | 'name' | 'quantity'>>;
}): WaterPlan {
  const T = KIT_THRESHOLDS;
  const days: WaterDay[] = input.dayPlans.map((p) => {
    const tMax = input.forecasts.find((f) => f.day === p.day)?.forecast?.tMax ?? null;
    const hot = tMax != null && tMax >= T.sunC;
    const rate = hot ? T.waterLPerHourHot : T.waterLPerHour;
    return {
      day: p.day,
      date: p.date,
      walkMin: p.walkMin,
      tMax,
      hot,
      liters: p.walkMin != null && p.walkMin > 0 ? round1((p.walkMin / 60) * rate) : null,
    };
  });
  const peak = days.reduce<WaterDay | null>(
    (best, d) => (d.liters != null && (best?.liters == null || d.liters > best.liters) ? d : best),
    null
  );
  const containers: WaterContainer[] = input.lines
    .filter((l) => CONTAINER.test(l.name))
    .map((l) => {
      const v = volumeFromName(l.name);
      const q = Math.max(1, l.quantity);
      return { id: l.id, name: l.name, quantity: q, liters: v == null ? null : round1(v * q) };
    });
  const known = containers.filter((c) => c.liters != null);
  return {
    days,
    peak,
    containers,
    knownLiters: known.length ? round1(known.reduce((s, c) => s + (c.liters as number), 0)) : null,
    unknownCount: containers.length - known.length,
  };
}

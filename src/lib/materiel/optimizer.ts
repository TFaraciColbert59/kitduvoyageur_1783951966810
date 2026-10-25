/** Logique pure d'optimisation de kit — testable, sans I/O. */

export interface KitLine {
  name: string;
  category?: string | null;
  weight_g: number;
  quantity: number;
}

export interface OptimizeAction {
  item: string;
  reason?: string;
  weight_g?: number;
}

export interface OptimizeInput {
  current: KitLine[];
  afterWeightKg: number;
  removals: OptimizeAction[];
  additions: OptimizeAction[];
  replacements: OptimizeAction[];
}

export interface OptimizeDiff {
  beforeG: number;
  afterG: number;
  deltaG: number;
  deltaPct: number;
  removedG: number;
  addedG: number;
  score: number;
}

/** Poids total (g) d'une liste de lignes. */
export function kitTotalWeight(items: KitLine[]): number {
  return items.reduce((s, i) => s + (i.weight_g || 0) * (i.quantity || 1), 0);
}

/** Calcule le diff avant/après + un score /100 d'optimisation. */
export function computeDiff(input: OptimizeInput): OptimizeDiff {
  const beforeG = kitTotalWeight(input.current);
  const afterG = Math.round(input.afterWeightKg * 1000);
  const removedG = input.removals.reduce((s, r) => s + (r.weight_g || 0), 0);
  const addedG = input.additions.reduce((s, a) => s + (a.weight_g || 0), 0);
  const deltaG = afterG - beforeG;
  const deltaPct = beforeG > 0 ? Math.round((deltaG / beforeG) * 100) : 0;

  const saved = Math.max(0, -deltaG);
  const weightFactor = beforeG > 0 ? Math.min(1, saved / beforeG) : 0;
  const countFactor = input.removals.length + input.replacements.length > 0 ? 0.5 : 1;
  const score = Math.max(0, Math.min(100, Math.round((weightFactor * 60 + (1 - countFactor) * 0 + 40) * (weightFactor > 0 ? 1 : 0.5))));

  return { beforeG, afterG, deltaG, deltaPct, removedG, addedG, score };
}

/** Résume le diff en phrases prêtes à afficher. */
export function diffSummary(d: OptimizeDiff): string[] {
  if (d.deltaG === 0) return ['Poids inchangé'];
  const verb = d.deltaG < 0 ? 'allégé' : 'alourdi';
  return [
    `Kit ${verb} de ${Math.abs(d.deltaG) / 1000} kg (${d.deltaPct}%)`,
    `Poids : ${(d.beforeG / 1000).toFixed(1)} kg → ${(d.afterG / 1000).toFixed(1)} kg`,
  ];
}

import { scoreCompletude } from './completude';
import { scoreFaisabiliteF0 } from './faisabiliteF0';
import { scoreJustesse } from './justesse';
import { scorePrecision } from './precision';
import { GRILLE } from './types';
import type { Expected, TripScore, TripSnapshot } from './types';

export type { AxisScore, Critere, Expected, TripScore, TripSnapshot } from './types';
export { GRILLE } from './types';
export { F0_CHECKS } from './faisabiliteF0';
export { scoreJustesse, scoreCompletude, scoreFaisabiliteF0, scorePrecision };

/** Note un voyage sur quatre axes. Pur : même instantané, même note. */
export function scoreTrip(snapshot: TripSnapshot, expected: Expected | null): TripScore {
  return {
    grille: GRILLE,
    justesse: scoreJustesse(snapshot, expected),
    completude: scoreCompletude(snapshot),
    faisabilite: scoreFaisabiliteF0(snapshot),
    precision: scorePrecision(snapshot),
  };
}

type Axe = 'justesse' | 'completude' | 'faisabilite' | 'precision';
const AXES: Axe[] = ['justesse', 'completude', 'faisabilite', 'precision'];

export interface FamilyNotes {
  n: number;
  justesse: number | null;
  completude: number | null;
  faisabilite: number | null;
  precision: number | null;
}

/** Moyenne par famille (+ clé `tous`) des notes non nulles, arrondie à l'entier ; null si aucune note. */
export function aggregate(scores: Array<{ famille: string; score: TripScore }>): Record<string, FamilyNotes> {
  const groups = new Map<string, TripScore[]>();
  const add = (k: string, s: TripScore) => groups.set(k, [...(groups.get(k) ?? []), s]);
  for (const { famille, score } of scores) {
    add(famille, score);
    add('tous', score);
  }
  const out: Record<string, FamilyNotes> = {};
  for (const [k, list] of groups) {
    const row: FamilyNotes = { n: list.length, justesse: null, completude: null, faisabilite: null, precision: null };
    for (const a of AXES) {
      const notes = list.map((s) => s[a].note).filter((x): x is number => x != null);
      row[a] = notes.length ? Math.round(notes.reduce((t, x) => t + x, 0) / notes.length) : null;
    }
    out[k] = row;
  }
  if (!out.tous) out.tous = { n: 0, justesse: null, completude: null, faisabilite: null, precision: null };
  return out;
}

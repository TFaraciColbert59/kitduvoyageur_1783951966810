import type { CollaborativeKitItem, CollaborativeStage } from '../types';
import { formatDecimalFr, legsStats, stageLegs, type RouteGraph } from './shared';

/** Contenu comparable : une révision (`kitSnapshot`) ou un état d'atelier (`kitItems`). */
export interface RevisionContent extends RouteGraph {
  readonly stages: readonly CollaborativeStage[];
  readonly kitSnapshot?: readonly CollaborativeKitItem[];
  readonly kitItems?: readonly CollaborativeKitItem[];
}

export type ChangeFact =
  | { readonly kind: 'distance'; readonly dayNumber: number; readonly deltaKm: number }
  | { readonly kind: 'ascent'; readonly dayNumber: number; readonly deltaM: number }
  | { readonly kind: 'ascent_unknown'; readonly dayNumber: number }
  | { readonly kind: 'overnight'; readonly dayNumber: number; readonly change: 'moved' | 'added' | 'removed' }
  | { readonly kind: 'stage'; readonly dayNumber: number; readonly change: 'added' | 'removed' }
  | { readonly kind: 'kit_to_recheck'; readonly count: number };

export interface RevisionChangeSummary {
  readonly facts: readonly ChangeFact[];
  readonly sentence: string;
}

const MIN_KM = 0.1;

function kitOf(c: RevisionContent): readonly CollaborativeKitItem[] {
  return c.kitSnapshot ?? c.kitItems ?? [];
}

function signedKm(n: number): string {
  return `${n >= 0 ? '+' : '−'}${formatDecimalFr(Math.abs(n))} km`;
}

export function summarizeRevisionChanges(prev: RevisionContent, next: RevisionContent): RevisionChangeSummary {
  const facts: ChangeFact[] = [];
  const prevStages = new Map(prev.stages.map((s) => [s.id, s]));
  const nextStages = new Map(next.stages.map((s) => [s.id, s]));
  const nextSorted = next.stages.slice().sort((a, b) => a.dayNumber - b.dayNumber);
  for (const ns of nextSorted) {
    const ps = prevStages.get(ns.id);
    if (!ps) {
      facts.push({ kind: 'stage', dayNumber: ns.dayNumber, change: 'added' });
      continue;
    }
    const a = legsStats(stageLegs(prev, ps));
    const b = legsStats(stageLegs(next, ns));
    const dKm = Math.round((b.distanceKm - a.distanceKm) * 10) / 10;
    if (Math.abs(dKm) >= MIN_KM) facts.push({ kind: 'distance', dayNumber: ns.dayNumber, deltaKm: dKm });
    if (a.ascentM != null && b.ascentM != null) {
      const dM = Math.round(b.ascentM - a.ascentM);
      if (dM !== 0) facts.push({ kind: 'ascent', dayNumber: ns.dayNumber, deltaM: dM });
    } else if (b.ascentM == null && a.ascentM != null) {
      facts.push({ kind: 'ascent_unknown', dayNumber: ns.dayNumber });
    }
    const po = ps.overnightPlace;
    const no = ns.overnightPlace;
    if (!po && no) facts.push({ kind: 'overnight', dayNumber: ns.dayNumber, change: 'added' });
    else if (po && !no) facts.push({ kind: 'overnight', dayNumber: ns.dayNumber, change: 'removed' });
    else if (po && no && (po.id !== no.id || Math.abs(po.lat - no.lat) > 1e-4 || Math.abs(po.lon - no.lon) > 1e-4)) {
      facts.push({ kind: 'overnight', dayNumber: ns.dayNumber, change: 'moved' });
    }
  }
  for (const ps of prev.stages) {
    if (!nextStages.has(ps.id)) facts.push({ kind: 'stage', dayNumber: ps.dayNumber, change: 'removed' });
  }
  const prevKit = new Map(kitOf(prev).map((i) => [i.id, i]));
  const recheck = kitOf(next).filter((i) => i.status === 'needs_revalidation' && prevKit.get(i.id)?.status !== 'needs_revalidation').length;
  if (recheck > 0) facts.push({ kind: 'kit_to_recheck', count: recheck });
  return { facts, sentence: sentenceOf(facts) };
}

function sentenceOf(facts: readonly ChangeFact[]): string {
  if (facts.length === 0) return 'Aucun changement relevé';
  const parts: string[] = [];
  for (const f of facts) {
    if (f.kind === 'distance') parts.push(`${signedKm(f.deltaKm)} le jour ${f.dayNumber}`);
  }
  for (const f of facts) {
    if (f.kind === 'ascent') parts.push(`${f.deltaM > 0 ? '+' : '−'}${Math.abs(f.deltaM)} m de D+ le jour ${f.dayNumber}`);
    if (f.kind === 'ascent_unknown') parts.push(`D+ devenu inconnu le jour ${f.dayNumber}`);
  }
  const nights = facts.filter((f): f is Extract<ChangeFact, { kind: 'overnight' }> => f.kind === 'overnight');
  if (nights.length > 0) {
    const label = (c: 'moved' | 'added' | 'removed') => (c === 'moved' ? 'déplacée' : c === 'added' ? 'ajoutée' : 'retirée');
    for (const c of ['moved', 'added', 'removed'] as const) {
      const n = nights.filter((x) => x.change === c).length;
      if (n > 0) parts.push(n === 1 ? `nuit ${label(c)}` : `${n} nuits ${label(c)}s`);
    }
  }
  for (const f of facts) {
    if (f.kind === 'stage') parts.push(`jour ${f.dayNumber} ${f.change === 'added' ? 'ajouté' : 'supprimé'}`);
  }
  const kit = facts.find((f): f is Extract<ChangeFact, { kind: 'kit_to_recheck' }> => f.kind === 'kit_to_recheck');
  if (kit) parts.push(`${kit.count} ${kit.count > 1 ? 'objets' : 'objet'} à revérifier`);
  const s = parts.join(', ');
  return s.charAt(0) === '+' || s.charAt(0) === '−' ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

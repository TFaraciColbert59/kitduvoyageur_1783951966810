import type { CollaborativeKitItem } from '../types';

export type MemberLevel = 'debutant' | 'intermediaire' | 'confirme';

export interface GearMember {
  readonly id: string;
  readonly name: string;
  readonly level?: MemberLevel | null;
  readonly speedKmh?: number | null;
}

export interface CarriedUnit {
  readonly itemId: string;
  readonly name: string;
  readonly grams: number | null;
  /** Vrai si l'affectation existait déjà et a été conservée. */
  readonly kept: boolean;
}

export interface MemberLoad {
  readonly memberId: string;
  readonly name: string;
  readonly totalGrams: number;
  readonly targetGrams: number;
  /** Part de capacité (somme = 1). */
  readonly capacityShare: number;
  readonly carries: readonly CarriedUnit[];
}

export interface SharedGearPlan {
  readonly loads: readonly MemberLoad[];
  readonly totalGrams: number;
  /** Plus grand écart entre la charge d'un membre et sa cible. */
  readonly maxDeviationGrams: number;
  /** Écart raisonnable : le plus lourd objet indivisible (une unité ne se coupe pas). */
  readonly reasonableDeviationGrams: number;
  readonly balanced: boolean;
  readonly unweightedItemIds: readonly string[];
  /** Membres dont le niveau et l'allure sont inconnus : traités à égalité, pas devinés. */
  readonly unknownProfileMemberIds: readonly string[];
  readonly method: string;
}

const LEVEL_FACTOR: Record<MemberLevel, number> = { debutant: 0.75, intermediaire: 1, confirme: 1.25 };
export const SHARED_GEAR_METHOD =
  'Capacité = coefficient de niveau (débutant 0,75 · intermédiaire 1 · confirmé 1,25) × allure relative (bornée de 0,8 à 1,2) ; objets lourds d’abord, au membre le plus en dessous de sa cible ; affectations existantes conservées';

export function distributeSharedGear(items: readonly CollaborativeKitItem[], members: readonly GearMember[]): SharedGearPlan {
  const method = SHARED_GEAR_METHOD;
  const shared = items.filter((i) => i.shared);
  if (members.length === 0) {
    return { loads: [], totalGrams: 0, maxDeviationGrams: 0, reasonableDeviationGrams: 0, balanced: true, unweightedItemIds: shared.filter((i) => i.weightGrams == null).map((i) => i.id), unknownProfileMemberIds: [], method };
  }
  const speeds = members.map((m) => m.speedKmh).filter((s): s is number => typeof s === 'number' && s > 0);
  const meanSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;
  const capacity = members.map((m) => {
    const lf = m.level ? LEVEL_FACTOR[m.level] : 1;
    const pf = meanSpeed && typeof m.speedKmh === 'number' && m.speedKmh > 0 ? Math.min(1.2, Math.max(0.8, m.speedKmh / meanSpeed)) : 1;
    return lf * pf;
  });
  const capSum = capacity.reduce((a, b) => a + b, 0);

  interface Unit { itemId: string; name: string; grams: number | null }
  const loads = members.map(() => ({ total: 0, carries: [] as CarriedUnit[] }));
  const idx = new Map(members.map((m, i) => [m.id, i]));
  const pending: Unit[] = [];
  const unweighted: string[] = [];
  for (const it of shared) {
    const qty = Math.max(1, Math.floor(it.quantity || 1));
    const grams = it.weightGrams != null && it.weightGrams >= 0 ? it.weightGrams : null;
    if (grams === null) unweighted.push(it.id);
    const owner = it.assigneeUserId != null ? idx.get(it.assigneeUserId) : undefined;
    for (let q = 0; q < qty; q += 1) {
      if (owner !== undefined) {
        loads[owner].total += grams ?? 0;
        loads[owner].carries.push({ itemId: it.id, name: it.name, grams, kept: true });
      } else pending.push({ itemId: it.id, name: it.name, grams });
    }
  }
  const totalGrams = shared.reduce((s, it) => s + (it.weightGrams ?? 0) * Math.max(1, Math.floor(it.quantity || 1)), 0);
  const target = capacity.map((c) => (totalGrams * c) / capSum);

  const weighted = pending.filter((u) => u.grams !== null).sort((a, b) => (b.grams as number) - (a.grams as number) || a.itemId.localeCompare(b.itemId));
  for (const u of weighted) {
    let best = 0;
    for (let i = 1; i < members.length; i += 1) {
      if (target[i] - loads[i].total > target[best] - loads[best].total) best = i;
    }
    loads[best].total += u.grams as number;
    loads[best].carries.push({ itemId: u.itemId, name: u.name, grams: u.grams, kept: false });
  }
  for (const u of pending.filter((p) => p.grams === null).sort((a, b) => a.itemId.localeCompare(b.itemId))) {
    let best = 0;
    for (let i = 1; i < members.length; i += 1) if (loads[i].carries.length < loads[best].carries.length) best = i;
    loads[best].carries.push({ itemId: u.itemId, name: u.name, grams: null, kept: false });
  }

  const result: MemberLoad[] = members.map((m, i) => ({
    memberId: m.id,
    name: m.name,
    totalGrams: Math.round(loads[i].total),
    targetGrams: Math.round(target[i]),
    capacityShare: Math.round((capacity[i] / capSum) * 1000) / 1000,
    carries: loads[i].carries,
  }));
  const heaviest = shared.reduce((m, it) => Math.max(m, it.weightGrams ?? 0), 0);
  const maxDev = result.reduce((m, l) => Math.max(m, Math.abs(l.totalGrams - l.targetGrams)), 0);
  return {
    loads: result,
    totalGrams: Math.round(totalGrams),
    maxDeviationGrams: maxDev,
    reasonableDeviationGrams: heaviest,
    balanced: maxDev <= heaviest,
    unweightedItemIds: unweighted,
    unknownProfileMemberIds: members.filter((m) => !m.level && !(typeof m.speedKmh === 'number' && m.speedKmh > 0)).map((m) => m.id),
    method,
  };
}

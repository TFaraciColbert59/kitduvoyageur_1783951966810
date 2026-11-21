/**
 * Contrats métier finaux : recalcul ressources sans perte (P02-10),
 * guidage sur trace (P07-13), révision étapes futures (P07-24/26/27),
 * sous-groupes & décisions collectives (P05-15, P07-51/52/53),
 * billets hors-ligne & changements réservation (P07-44/46),
 * et infos destination / règles d'accès (P03-21/24/28, P07-16).
 */

export interface ResourceAllocationItem {
  id: string;
  perPerson: number;
  quantity: number;
  manualOverride?: boolean;
}

export function recomputeResourcesWithoutLoss(
  items: ResourceAllocationItem[],
  newPartySize: number,
): ResourceAllocationItem[] {
  const size = Math.max(1, Math.round(newPartySize));
  return items.map((item) => (
    item.manualOverride
      ? item
      : { ...item, quantity: Math.max(1, Math.ceil(item.perPerson * size)) }
  ));
}

export interface TrackGuidanceState {
  offTrack: boolean;
  crossM: number;
  remainingM: number;
  progressPct: number;
}

export function evaluateTrackGuidance(
  alongM: number,
  totalM: number,
  crossM: number,
  offTrackThresholdM = 60,
): TrackGuidanceState {
  const safeTotal = Math.max(1, totalM);
  const clampedAlong = Math.max(0, Math.min(alongM, safeTotal));
  return {
    offTrack: crossM > offTrackThresholdM,
    crossM: Math.round(crossM),
    remainingM: Math.round(safeTotal - clampedAlong),
    progressPct: Math.round((clampedAlong / safeTotal) * 100),
  };
}

export interface ScheduledStepSlot {
  id: string;
  plannedMinutes: number;
  completed: boolean;
}

export function shiftUpcomingSteps(
  steps: ScheduledStepSlot[],
  deltaMinutes: number,
): ScheduledStepSlot[] {
  return steps.map((step) => (
    step.completed
      ? step
      : { ...step, plannedMinutes: Math.max(0, step.plannedMinutes + deltaMinutes) }
  ));
}

export interface SubgroupMember {
  id: string;
  subgroup: string;
  presence: 'present' | 'absent' | 'pending';
}

export function summarizeSubgroups(members: SubgroupMember[]) {
  const groups = new Map<string, { present: number; absent: number; pending: number }>();
  for (const m of members) {
    const key = m.subgroup || 'Principal';
    const entry = groups.get(key) ?? { present: 0, absent: 0, pending: 0 };
    entry[m.presence] += 1;
    groups.set(key, entry);
  }
  return Object.fromEntries(groups.entries());
}

export function resolveCollectiveDecision(
  votes: Record<string, string>,
): { winner: string | null; counts: Record<string, number>; tie: boolean } {
  const counts: Record<string, number> = {};
  for (const choice of Object.values(votes)) {
    counts[choice] = (counts[choice] ?? 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (ranked.length === 0) return { winner: null, counts, tie: false };
  const tie = ranked.length > 1 && ranked[0][1] === ranked[1][1];
  return { winner: tie ? null : ranked[0][0], counts, tie };
}

export interface ReservationSnapshot {
  id: string;
  status: string;
  when: string | null;
  reference: string | null;
}

export function diffReservationChange(
  before: ReservationSnapshot,
  after: ReservationSnapshot,
): string[] {
  const changes: string[] = [];
  if (before.status !== after.status) changes.push(`statut: ${before.status} → ${after.status}`);
  if (before.when !== after.when) changes.push(`date: ${before.when ?? 'inconnue'} → ${after.when ?? 'inconnue'}`);
  if (before.reference !== after.reference) changes.push('référence mise à jour');
  return changes;
}

export interface DestinationRuleBrief {
  country: string;
  emergencyNumber: string;
  bivouacRuleNote: string;
  officialCheckRequired: true;
}

export function buildDestinationSafetyBrief(countryCode: string): DestinationRuleBrief {
  const code = countryCode.trim().toUpperCase();
  const emergencyNumber = code === 'US' || code === 'CA' ? '911' : code === 'CH' ? '112 / 1414 (REGA)' : '112';
  return {
    country: code || 'INTL',
    emergencyNumber,
    bivouacRuleNote: 'Vérifier les arrêtés locaux, réglementations de parcs nationaux et restrictions incendie avant départ.',
    officialCheckRequired: true,
  };
}

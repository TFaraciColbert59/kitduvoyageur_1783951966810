/**
 * Remboursements exacts au centime, suivi d'usure matériel et contrôle d'accès
 * par titulaire sur les documents (P07-07, P07-11, P07-39, P07-40, P07-47).
 */

export interface ExactSettlement {
  fromUserId: string;
  toUserId: string;
  cents: number;
  amount: number;
}

export function computeExactSettlements(
  netCentsByUser: Record<string, number>,
): ExactSettlement[] {
  const debtors = Object.entries(netCentsByUser)
    .filter(([, c]) => c < 0)
    .map(([id, c]) => ({ id, cents: -Math.round(c) }))
    .sort((a, b) => b.cents - a.cents || a.id.localeCompare(b.id));

  const creditors = Object.entries(netCentsByUser)
    .filter(([, c]) => c > 0)
    .map(([id, c]) => ({ id, cents: Math.round(c) }))
    .sort((a, b) => b.cents - a.cents || a.id.localeCompare(b.id));

  const result: ExactSettlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].cents, creditors[j].cents);
    if (transfer > 0) {
      result.push({
        fromUserId: debtors[i].id,
        toUserId: creditors[j].id,
        cents: transfer,
        amount: transfer / 100,
      });
      debtors[i].cents -= transfer;
      creditors[j].cents -= transfer;
    }
    if (debtors[i].cents === 0) i += 1;
    if (creditors[j].cents === 0) j += 1;
  }
  return result;
}

export type GearCondition = 'neuf' | 'bon' | 'use' | 'a_remplacer' | 'pour_pieces';

export function evaluateGearMaintenance(input: {
  condition?: GearCondition | null;
  usageCount?: number;
  ownershipMode?: 'owned' | 'borrowed' | 'rented';
}): { needsAttention: boolean; label: string } {
  const mode = input.ownershipMode === 'borrowed'
    ? 'Prêté'
    : input.ownershipMode === 'rented'
      ? 'Loué'
      : 'Personnel';
  if (input.condition === 'a_remplacer' || input.condition === 'pour_pieces') {
    return { needsAttention: true, label: `${mode} · À remplacer avant départ` };
  }
  if (input.condition === 'use' || (input.usageCount ?? 0) >= 50) {
    return { needsAttention: true, label: `${mode} · Usure avancée à vérifier` };
  }
  return { needsAttention: false, label: `${mode} · Bon état` };
}

export function canViewDocumentByHolder(input: {
  category: string;
  holderUserId: string;
  viewerUserId: string;
  viewerIsTripEditor: boolean;
}): boolean {
  // Documents strictement personnels (identité / médical) : réservés au titulaire seul
  if (input.category === 'passport' || input.category === 'medical') {
    return input.holderUserId === input.viewerUserId;
  }
  return input.holderUserId === input.viewerUserId || input.viewerIsTripEditor;
}

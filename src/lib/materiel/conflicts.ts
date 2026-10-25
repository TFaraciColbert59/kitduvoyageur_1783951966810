/** Logique pure de détection de conflits kit-vs-prêt — testable, sans I/O. */

export interface LoanRef { id: string; product_ownership_id: string | null; due_date: string | null; status: string }
export interface ItemRef { id: string; name: string }

export interface Conflict {
  itemId: string;
  itemName: string;
  conflictType: 'kit_vs_loan';
  details: string;
}

/**
 * Détecte les conflits : objets actuellement prêtés ET présents dans un kit.
 * `activeStatuses` : statuts considérés « actifs » (indisponibles).
 */
export function detectConflicts(
  loans: LoanRef[],
  kitProductIds: Set<string>,
  itemsById: Map<string, string>,
  activeStatuses: string[] = ['en_cours', 'en_retard']
): Conflict[] {
  const active = loans.filter((l) => l.product_ownership_id && activeStatuses.includes(l.status));
  const conflicts: Conflict[] = [];
  for (const l of active) {
    const pid = l.product_ownership_id!;
    if (!kitProductIds.has(pid)) continue;
    conflicts.push({
      itemId: pid,
      itemName: itemsById.get(pid) ?? 'Objet en conflit',
      conflictType: 'kit_vs_loan',
      details: l.due_date
        ? `Assigné à un kit alors qu'il est prêté (retour prévu ${new Date(l.due_date).toLocaleDateString('fr-FR')}).`
        : 'Assigné à un kit alors qu’il est actuellement prêté.',
    });
  }
  return conflicts;
}

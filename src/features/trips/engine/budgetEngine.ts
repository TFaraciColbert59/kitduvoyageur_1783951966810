import type { TripExpense } from '@/features/trips/types/trip.types';

export interface ParticipantBalance {
  userId: string;
  name: string;
  paid: number;
  share: number;
  net: number; // > 0: doit recevoir, < 0: doit payer
}

export interface DebtSettlement {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
}

export interface BudgetSummary {
  totalSpent: number;
  estimatedBudget: number | null;
  remainingBudget: number | null;
  spentPercentage: number | null;
  isOverBudget: boolean;
  currency: string;
  categories: Record<string, number>;
  balances: ParticipantBalance[];
  settlements: DebtSettlement[];
}

/**
 * Algorithme glouton (greedy) de simplification des remboursements entre membres.
 * Minimise le nombre de transactions financières nécessaires pour équilibrer les comptes.
 */
export function simplifyDebts(balances: ParticipantBalance[]): DebtSettlement[] {
  // Cloner les balances avec solde net mutable
  const debtors = balances
    .filter(b => b.net < -0.01)
    .map(b => ({ ...b, net: Math.round(b.net * 100) / 100 }))
    .sort((a, b) => a.net - b.net); // Les plus endettés en premier

  const creditors = balances
    .filter(b => b.net > 0.01)
    .map(b => ({ ...b, net: Math.round(b.net * 100) / 100 }))
    .sort((a, b) => b.net - a.net); // Les plus grands créanciers en premier

  const settlements: DebtSettlement[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const debtAmount = -debtor.net;
    const creditAmount = creditor.net;
    const transfer = Math.min(debtAmount, creditAmount);
    const roundedTransfer = Math.round(transfer * 100) / 100;

    if (roundedTransfer > 0) {
      settlements.push({
        fromUserId: debtor.userId,
        fromName: debtor.name,
        toUserId: creditor.userId,
        toName: creditor.name,
        amount: roundedTransfer,
      });

      debtor.net += roundedTransfer;
      creditor.net -= roundedTransfer;
    }

    if (Math.abs(debtor.net) < 0.01) {
      dIdx++;
    }
    if (Math.abs(creditor.net) < 0.01) {
      cIdx++;
    }
  }

  return settlements;
}

/**
 * Calcule la synthèse budgétaire complète :
 * Dépenses totales, catégories, reste, pourcentages, balances par membre et règlements simplifiés.
 */
export function calculateBudgetSummary(
  trip: { estimated_budget?: number | null; budget_currency: string },
  expenses: TripExpense[],
  collaborators: Array<{ user_id: string; profile?: { full_name?: string | null } }> = []
): BudgetSummary {
  const currency = trip.budget_currency || 'EUR';
  let totalSpent = 0;
  const categories: Record<string, number> = {};

  // Map des participants identifiés
  const participantMap = new Map<string, { name: string; paid: number; share: number }>();

  // 1. Initialiser avec les collaborateurs connus
  for (const collab of collaborators) {
    participantMap.set(collab.user_id, {
      name: collab.profile?.full_name || `Voyageur (${collab.user_id.slice(0, 6)})`,
      paid: 0,
      share: 0,
    });
  }

  // 2. Parcourir les dépenses pour agréger catégories et payeurs
  for (const exp of expenses) {
    const amount = Number(exp.amount) || 0;
    totalSpent += amount;

    const cat = exp.category?.trim().toLowerCase() || 'divers';
    categories[cat] = (categories[cat] || 0) + amount;

    // S'assurer que le payeur est répertorié
    if (!participantMap.has(exp.payer_id)) {
      participantMap.set(exp.payer_id, {
        name: exp.payer?.full_name || `Voyageur (${exp.payer_id.slice(0, 6)})`,
        paid: 0,
        share: 0,
      });
    }

    const payerData = participantMap.get(exp.payer_id)!;
    payerData.paid += amount;

    // Répartition de la part
    if (exp.split_type === 'individual') {
      // Le payeur assume 100% de la dépense
      payerData.share += amount;
    } else {
      // Split équitable (equal ou fallback)
      const allParticipants = Array.from(participantMap.values());
      const participantCount = allParticipants.length > 0 ? allParticipants.length : 1;
      const individualShare = amount / participantCount;

      for (const p of participantMap.values()) {
        p.share += individualShare;
      }
    }
  }

  totalSpent = Math.round(totalSpent * 100) / 100;

  // 3. Calculer les balances
  const balances: ParticipantBalance[] = [];
  for (const [userId, data] of participantMap.entries()) {
    const paid = Math.round(data.paid * 100) / 100;
    const share = Math.round(data.share * 100) / 100;
    const net = Math.round((paid - share) * 100) / 100;

    balances.push({
      userId,
      name: data.name,
      paid,
      share,
      net,
    });
  }

  // 4. Calculer les règlements simplifiés
  const settlements = simplifyDebts(balances);

  // 5. Comparaison au budget prévisionnel
  const estimatedBudget =
    typeof trip.estimated_budget === 'number' && trip.estimated_budget > 0
      ? Math.round(trip.estimated_budget * 100) / 100
      : null;

  let remainingBudget: number | null = null;
  let spentPercentage: number | null = null;
  let isOverBudget = false;

  if (estimatedBudget !== null) {
    remainingBudget = Math.round((estimatedBudget - totalSpent) * 100) / 100;
    spentPercentage = Math.round((totalSpent / estimatedBudget) * 100);
    isOverBudget = totalSpent > estimatedBudget;
  }

  return {
    totalSpent,
    estimatedBudget,
    remainingBudget,
    spentPercentage,
    isOverBudget,
    currency,
    categories,
    balances,
    settlements,
  };
}

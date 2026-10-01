/**
 * Compas — groupe : rythme et partage des dépenses (fonctions pures).
 *
 * Règle LKDV : une répartition qu'on ne sait pas calculer n'est pas devinée.
 * Les dépenses « custom » (parts libres non stockées ici) sont exclues du
 * solde et comptées à part, l'écran le dit.
 */

import { simplifyDebts, type ParticipantBalance } from '@/features/trips/engine/budgetEngine';

export interface CrewPerson {
  userId: string;
  name: string;
}

export interface CrewExpense {
  amount: number;
  isPlanned: boolean;
  payerId: string;
  splitType: string;
}

export interface CompasSettlement {
  balances: ParticipantBalance[];
  debts: Array<{
    fromUserId: string;
    fromName: string;
    toUserId: string;
    toName: string;
    amount: number;
  }>;
  /** Dépenses réelles dont la répartition n'est pas calculable (parts libres). */
  excludedCount: number;
  excludedAmount: number;
  /** Total des dépenses réelles prises en compte. */
  countedAmount: number;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Soldes et remboursements simplifiés. Seules les dépenses réelles comptent.
 * `equal` = partagée entre tous les membres, `individual` = à la charge du payeur.
 */
export function settleExpenses(expenses: CrewExpense[], members: CrewPerson[]): CompasSettlement {
  const people = new Map<string, { name: string; paid: number; share: number }>();
  members.forEach((m) => people.set(m.userId, { name: m.name, paid: 0, share: 0 }));

  const counted = expenses.filter(
    (e) => !e.isPlanned && e.splitType !== 'custom' && Number.isFinite(e.amount) && e.amount > 0
  );
  const excluded = expenses.filter(
    (e) => !e.isPlanned && e.splitType === 'custom' && Number.isFinite(e.amount) && e.amount > 0
  );
  counted.forEach((e) => {
    if (!people.has(e.payerId)) people.set(e.payerId, { name: 'Membre', paid: 0, share: 0 });
  });

  let countedAmount = 0;
  for (const e of counted) {
    countedAmount += e.amount;
    const payer = people.get(e.payerId)!;
    payer.paid += e.amount;
    if (e.splitType === 'individual') {
      payer.share += e.amount;
    } else {
      const each = e.amount / people.size;
      people.forEach((p) => (p.share += each));
    }
  }

  const balances: ParticipantBalance[] = [...people.entries()].map(([userId, p]) => ({
    userId,
    name: p.name,
    paid: cents(p.paid),
    share: cents(p.share),
    net: cents(p.paid - p.share),
  }));

  return {
    balances,
    debts: simplifyDebts(balances),
    excludedCount: excluded.length,
    excludedAmount: cents(excluded.reduce((t, e) => t + e.amount, 0)),
    countedAmount: cents(countedAmount),
  };
}

export interface CompasPace {
  /** Membre le plus lent parmi ceux dont l'allure est connue. */
  slowest: { userId: string; name: string; speedKmh: number } | null;
  known: number;
  total: number;
}

export function crewPace(members: Array<CrewPerson & { flatSpeedKmh: number | null }>): CompasPace {
  const withSpeed = members.filter((m) => m.flatSpeedKmh != null && m.flatSpeedKmh > 0);
  const slowest = withSpeed.reduce<CompasPace['slowest']>(
    (min, m) =>
      !min || m.flatSpeedKmh! < min.speedKmh
        ? { userId: m.userId, name: m.name, speedKmh: m.flatSpeedKmh! }
        : min,
    null
  );
  return { slowest, known: withSpeed.length, total: members.length };
}

import {
  simplifyDebts,
  type DebtSettlement,
  type ParticipantBalance,
} from '@/features/trips/engine/budgetEngine';

/**
 * Moteur mobile du collectif (groupe) — 100 % pur, testable sans DOM :
 * readiness calculé en direct, chemin critique des tâches et équilibres
 * de la caisse commune (réutilise simplifyDebts du budget voyage).
 */

export interface GroupeTaskInfo {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string | null;
  assignedName?: string | null;
}

export interface GroupeKitInfo {
  id: string;
  assigned: boolean;
}

export interface GroupeMemberInfo {
  userId: string;
  name: string;
  status?: string;
}

export interface GroupeExpenseInfo {
  id: string;
  title?: string;
  amount: number;
  paidBy?: string | null;
  splitBetween?: string[];
  settled?: boolean;
}

export interface GroupeReadinessInput {
  tasks: GroupeTaskInfo[];
  kit: GroupeKitInfo[];
  expenses: GroupeExpenseInfo[];
  members: GroupeMemberInfo[];
}

export interface GroupeReadiness {
  pct: number;
  factors: {
    tasks: number;
    kit: number;
    members: number;
    budget: number;
  };
}

export interface GroupeCriticalTask extends GroupeTaskInfo {
  daysLeft: number | null;
  isOverdue: boolean;
}

export interface GroupeBalancesView {
  rows: ParticipantBalance[];
  settlements: DebtSettlement[];
  outstanding: number;
  balanced: boolean;
}

const TASK_WEIGHT = 40;
const KIT_WEIGHT = 20;
const MEMBER_WEIGHT = 15;
const BUDGET_WEIGHT = 25;

function ratio(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function computeGroupeReadiness(input: GroupeReadinessInput): GroupeReadiness {
  const tasksRatio = ratio(input.tasks.filter((task) => task.completed).length, input.tasks.length);
  const kitRatio = ratio(input.kit.filter((item) => item.assigned).length, input.kit.length);

  const active = input.members.filter((m) => (m.status ?? 'active') === 'active').length;
  const pending = input.members.filter((m) => m.status === 'pending').length;

  const settled = input.expenses.filter((expense) => expense.settled).length;
  const budgetRatio = ratio(settled, input.expenses.length);

  const pct = Math.round(
    tasksRatio * TASK_WEIGHT +
      kitRatio * KIT_WEIGHT +
      ratio(active, active + pending) * MEMBER_WEIGHT +
      budgetRatio * BUDGET_WEIGHT
  );

  return {
    pct: clampPct(pct),
    factors: {
      tasks: Math.round(tasksRatio * 100),
      kit: Math.round(kitRatio * 100),
      members: Math.round(ratio(active, active + pending) * 100),
      budget: Math.round(budgetRatio * 100),
    },
  };
}

function toDayNumber(dateIso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000;
}

export function buildGroupeCriticalPath(tasks: GroupeTaskInfo[], today: string): GroupeCriticalTask[] {
  const todayNumber = toDayNumber(today);

  return tasks
    .filter((task) => !task.completed)
    .map((task) => {
      const dueNumber = task.dueDate ? toDayNumber(task.dueDate) : null;
      const daysLeft =
        dueNumber !== null && todayNumber !== null ? dueNumber - todayNumber : null;
      return { ...task, daysLeft, isOverdue: daysLeft !== null && daysLeft < 0 };
    })
    .sort((a, b) => {
      if (a.daysLeft === null && b.daysLeft === null) return 0;
      if (a.daysLeft === null) return 1;
      if (b.daysLeft === null) return -1;
      return a.daysLeft - b.daysLeft;
    });
}

export function buildGroupeBalances(
  expenses: GroupeExpenseInfo[],
  members: GroupeMemberInfo[]
): GroupeBalancesView {
  const memberIds = members.map((member) => member.userId);
  const names = new Map(members.map((member) => [member.userId, member.name]));
  const order = [...memberIds];
  const known = new Set(memberIds);

  const paid = new Map<string, number>();
  const share = new Map<string, number>();

  const addToOrder = (userId: string) => {
    if (!known.has(userId)) {
      known.add(userId);
      order.push(userId);
    }
  };

  for (const expense of expenses) {
    if (expense.settled) continue;
    const amount = Number(expense.amount || 0);

    if (expense.paidBy) {
      addToOrder(expense.paidBy);
      paid.set(expense.paidBy, (paid.get(expense.paidBy) ?? 0) + amount);
    }

    const split =
      expense.splitBetween && expense.splitBetween.length > 0 ? expense.splitBetween : memberIds;
    if (split.length === 0) continue;

    const part = amount / split.length;
    for (const userId of split) {
      addToOrder(userId);
      share.set(userId, (share.get(userId) ?? 0) + part);
    }
  }

  const rows: ParticipantBalance[] = order
    .map((userId) => {
      const paidAmount = round2(paid.get(userId) ?? 0);
      const shareAmount = round2(share.get(userId) ?? 0);
      return {
        userId,
        name: names.get(userId) ?? 'Membre',
        paid: paidAmount,
        share: shareAmount,
        net: round2(paidAmount - shareAmount),
      };
    })
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.name.localeCompare(b.name));

  const settlements = simplifyDebts(rows);
  const outstanding = round2(
    rows.reduce((sum, row) => sum + Math.max(0, -row.net), 0)
  );

  return {
    rows,
    settlements,
    outstanding,
    balanced: settlements.length === 0 && rows.every((row) => Math.abs(row.net) < 0.01),
  };
}

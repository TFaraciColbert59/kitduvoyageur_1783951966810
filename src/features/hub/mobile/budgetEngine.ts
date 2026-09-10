import type { LucideIcon } from 'lucide-react';
import { Clock, Sun, Target, TrendingUp, Users, Wallet } from 'lucide-react';
import {
  buildBudgetDayPlan,
  type BudgetSummary,
  type DebtSettlement,
  type ParticipantBalance,
} from '@/features/trips/engine/budgetEngine';
import type { TripExpense, TripFull } from '@/features/trips/types/trip.types';
import { formatDayLabel } from '@/features/trips/components/budget/budgetFormat';
import { formatEuro } from './mobileHubEngine';

export type BudgetFilter = 'all' | 'planned' | 'real' | 'today';

export interface BudgetChipDef {
  key: string;
  icon: LucideIcon;
  value: string;
  label: string;
  tone?: 'default' | 'warn' | 'accent';
  filter: BudgetFilter;
}

export interface BudgetProgress {
  pct: number;
  over: boolean;
  hasTarget: boolean;
}

export function budgetProgress(summary: BudgetSummary): BudgetProgress {
  const target = summary.estimatedBudget;
  if (target == null || target <= 0) return { pct: 0, over: false, hasTarget: false };
  const raw = (summary.totalSpent / target) * 100;
  return {
    pct: Math.min(100, Math.max(0, Math.round(raw))),
    over: summary.totalSpent > target,
    hasTarget: true,
  };
}

export function budgetOutstandingDebts(summary: BudgetSummary): number {
  return summary.balances.reduce((sum, balance) => sum + Math.max(0, -balance.net), 0);
}

export function buildBudgetChips(args: {
  summary: BudgetSummary;
  expenses: TripExpense[];
  isMulti: boolean;
  participantCount: number;
  daysCount: number;
  today: string;
}): BudgetChipDef[] {
  const { summary, expenses, isMulti, participantCount, daysCount, today } = args;
  const real = expenses.filter((e) => !e.is_planned);
  const planned = expenses.filter((e) => e.is_planned);
  const todayTotal = real
    .filter((e) => e.expense_date === today)
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const remaining = isMulti ? budgetOutstandingDebts(summary) : summary.remainingBudget;
  const days = Math.max(1, daysCount);

  const chips: BudgetChipDef[] = [
    {
      key: 'real',
      icon: Wallet,
      value: formatEuro(summary.totalSpent),
      label: `${real.length} dépense${real.length > 1 ? 's' : ''}`,
      filter: 'real',
    },
    {
      key: 'planned',
      icon: Clock,
      value: formatEuro(summary.plannedTotal),
      label: `${planned.length} à venir`,
      tone: planned.length > 0 ? 'accent' : 'default',
      filter: 'planned',
    },
    {
      key: 'remaining',
      icon: Target,
      value: remaining != null ? formatEuro(remaining) : '—',
      label: isMulti ? 'à régler' : 'du budget',
      tone: remaining != null && remaining < 0 ? 'warn' : 'default',
      filter: 'all',
    },
    {
      key: 'average',
      icon: TrendingUp,
      value: formatEuro(summary.totalSpent / days),
      label: 'par jour',
      filter: 'all',
    },
    {
      key: 'today',
      icon: Sun,
      value: formatEuro(todayTotal),
      label: 'aujourd’hui',
      tone: todayTotal > 0 ? 'accent' : 'default',
      filter: 'today',
    },
  ];

  if (isMulti) {
    chips.push({
      key: 'per-person',
      icon: Users,
      value: formatEuro(summary.totalSpent / Math.max(1, participantCount)),
      label: 'par personne',
      filter: 'all',
    });
  }

  return chips;
}

export interface BudgetDaySlide {
  key: string;
  dayNumber: number;
  date: string | null;
  label: string;
  isToday: boolean;
  realTotal: number;
  plannedTotal: number;
  expenseCount: number;
  /** Ids réels des dépenses rattachées à ce jour (inclut les dépenses hors plage clampées). */
  expenseIds: string[];
}

export function buildBudgetDaySlides(args: {
  trip: Pick<TripFull, 'start_date' | 'end_date'>;
  expenses: TripExpense[];
  today: string;
}): BudgetDaySlide[] {
  const plan = buildBudgetDayPlan(args.trip, args.expenses, args.today);
  return plan.map((row) => ({
    key: `d${row.dayNumber}-${row.date ?? 'nd'}`,
    dayNumber: row.dayNumber,
    date: row.date,
    label: formatDayLabel(row.date),
    isToday: row.isToday,
    realTotal: row.realTotal,
    plannedTotal: row.plannedTotal,
    expenseCount: row.planned.length + row.real.length,
    expenseIds: [...row.real, ...row.planned].map((expense) => expense.id),
  }));
}

export interface BudgetCategoryRow {
  key: string;
  label: string;
  amount: number;
  pct: number;
  color: string;
}

const CATEGORY_PALETTE = [
  'var(--lkv-primary)',
  'var(--lkv-secondary)',
  'var(--lkv-forest-300)',
  'var(--lkv-forest-200)',
  'var(--lkv-sand-500)',
  'var(--lkv-stone-400)',
];

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function buildBudgetCategoryRows(summary: BudgetSummary): BudgetCategoryRow[] {
  const total = summary.totalSpent;
  return Object.entries(summary.categories)
    .sort((a, b) => b[1] - a[1])
    .map(([key, amount], index) => ({
      key,
      label: capitalize(key),
      amount,
      pct: total > 0 ? Math.round((amount / total) * 100) : 0,
      color: CATEGORY_PALETTE[index % CATEGORY_PALETTE.length],
    }));
}

export interface BudgetBalancesView {
  rows: ParticipantBalance[];
  settlements: DebtSettlement[];
  balanced: boolean;
}

export function buildBudgetBalances(summary: BudgetSummary): BudgetBalancesView {
  const rows = [...summary.balances].sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const balanced =
    summary.settlements.length === 0 && rows.every((row) => Math.abs(row.net) < 0.01);
  return { rows, settlements: summary.settlements, balanced };
}

'use client';

import { Plus } from 'lucide-react';
import { GlassDrawer } from '@/components/ui/GlassDrawer';
import { ExpenseRow } from '@/features/trips/components/budget/ExpenseRow';
import type { TripExpense } from '@/features/trips/types/trip.types';
import { formatEuro } from '../../../mobile/mobileHubEngine';
import type { BudgetDaySlide } from '../../../mobile/budgetEngine';

export interface DayExpensesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slide: BudgetDaySlide | null;
  expenses: TripExpense[];
  currency: string;
  isMulti: boolean;
  canManage: boolean;
  isPending: boolean;
  onEdit: (expense: TripExpense) => void;
  onDelete: (expense: TripExpense) => void;
  onSettle: (expense: TripExpense) => void;
  onAdd: () => void;
}

export function DayExpensesDrawer({
  open,
  onOpenChange,
  slide,
  expenses,
  currency,
  isMulti,
  canManage,
  isPending,
  onEdit,
  onDelete,
  onSettle,
  onAdd,
}: DayExpensesDrawerProps) {
  return (
    <GlassDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={slide ? `Jour ${slide.dayNumber} · ${slide.label}` : 'Jour'}
      width={430}
    >
      <div className="space-y-3 pb-4">
        {slide && (
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--lkv-text-secondary)]">
            <span>Réel · {formatEuro(slide.realTotal)}</span>
            {slide.plannedTotal > 0 && <span>Prévu · {formatEuro(slide.plannedTotal)}</span>}
          </div>
        )}

        {expenses.length === 0 ? (
          <p className="py-8 text-center text-sm font-medium text-[var(--lkv-text-secondary)]">
            Aucune dépense ce jour-là.
          </p>
        ) : (
          <ul className="space-y-2">
            {expenses.map((expense) => (
              <li key={expense.id}>
                <ExpenseRow
                  expense={expense}
                  currency={currency}
                  isMulti={isMulti}
                  canManage={canManage}
                  isPending={isPending}
                  onEdit={() => onEdit(expense)}
                  onDelete={() => onDelete(expense)}
                  onSettle={expense.is_planned ? () => onSettle(expense) : undefined}
                />
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <button
            type="button"
            onClick={onAdd}
            className="glass-capsule-btn primary inline-flex w-full items-center justify-center gap-1.5 !py-3 text-sm font-bold"
          >
            <Plus size={15} aria-hidden="true" />
            Enregistrer une dépense
          </button>
        )}
      </div>
    </GlassDrawer>
  );
}

export default DayExpensesDrawer;

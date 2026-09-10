'use client';

import { Plus, X } from 'lucide-react';
import IOSSegmentedControl from '@/components/ui/IOSSegmentedControl';
import { GlassDrawer } from '@/components/ui/GlassDrawer';
import { ExpenseRow } from '@/features/trips/components/budget/ExpenseRow';
import type { TripExpense } from '@/features/trips/types/trip.types';
import type { BudgetFilter } from '../../../mobile/budgetEngine';

export interface BudgetAllExpensesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: TripExpense[];
  currency: string;
  isMulti: boolean;
  canManage: boolean;
  isPending: boolean;
  filter: BudgetFilter;
  onFilterChange: (filter: BudgetFilter) => void;
  categoryLabel: string | null;
  onClearCategory: () => void;
  onEdit: (expense: TripExpense) => void;
  onDelete: (expense: TripExpense) => void;
  onSettle: (expense: TripExpense) => void;
  onAdd: () => void;
}

export function BudgetAllExpensesDrawer({
  open,
  onOpenChange,
  rows,
  currency,
  isMulti,
  canManage,
  isPending,
  filter,
  onFilterChange,
  categoryLabel,
  onClearCategory,
  onEdit,
  onDelete,
  onSettle,
  onAdd,
}: BudgetAllExpensesDrawerProps) {
  const segmentValue = filter === 'today' ? 'all' : filter;

  return (
    <GlassDrawer open={open} onOpenChange={onOpenChange} title="Toutes les dépenses" width={430}>
      <div className="space-y-3 pb-4">
        <IOSSegmentedControl
          options={[
            { id: 'all', label: 'Tout' },
            { id: 'real', label: 'Réel' },
            { id: 'planned', label: 'Prévu' },
          ]}
          value={segmentValue}
          onChange={(value) => onFilterChange(value as BudgetFilter)}
        />

        {categoryLabel && (
          <button
            type="button"
            onClick={onClearCategory}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[var(--lkv-primary)]/10 px-3 text-[11px] font-bold text-[var(--lkv-primary)] transition-transform active:scale-[0.97]"
            aria-label={`Retirer le filtre catégorie ${categoryLabel}`}
          >
            {categoryLabel}
            <X size={12} aria-hidden="true" />
          </button>
        )}

        {canManage && (
          <button
            type="button"
            onClick={onAdd}
            className="glass-capsule-btn primary inline-flex w-full items-center justify-center gap-1.5 !py-3 text-sm font-bold"
          >
            <Plus size={15} aria-hidden="true" />
            Ajouter une dépense
          </button>
        )}

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm font-medium text-[var(--lkv-text-secondary)]">
            Aucune dépense pour ce filtre.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((expense) => (
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
      </div>
    </GlassDrawer>
  );
}

export default BudgetAllExpensesDrawer;

'use client';

import { Plus, X } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { Button, Sheet } from '@/components/ui';
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
    <Sheet open={open} onOpenChange={onOpenChange} title="Toutes les dépenses">
      <div className="space-y-3 pb-4">
        <Tabs
          options={[
            { id: 'all', label: 'Tout' },
            { id: 'real', label: 'Réel' },
            { id: 'planned', label: 'Prévu' },
          ]}
          value={segmentValue}
          onChange={(value) => onFilterChange(value as BudgetFilter)}
        />

        {categoryLabel && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onClearCategory}
            icon={<X size={12} aria-hidden="true" />}
            iconPosition="trailing"
            className="min-h-[44px] !px-3 text-[11px] font-bold"
            aria-label={`Retirer le filtre catégorie ${categoryLabel}`}
          >
            {categoryLabel}
          </Button>
        )}

        {canManage && (
          <Button
            variant="primary"
            fullWidth
            onClick={onAdd}
            icon={<Plus size={15} aria-hidden="true" />}
            className="!py-3 text-sm font-bold"
          >
            Ajouter une dépense
          </Button>
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
    </Sheet>
  );
}

export default BudgetAllExpensesDrawer;

'use client';

import Icon from '@/components/ui/Icon';
import type { TripExpense } from '../../types/trip.types';
import { Button, Card, IconButton } from '@/components/ui';

export interface ExpenseRowProps {
  expense: TripExpense;
  currency: string;
  isMulti: boolean;
  canManage: boolean;
  isPending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSettle?: () => void;
}

export function ExpenseRow({
  expense,
  currency,
  isMulti,
  canManage,
  isPending,
  onEdit,
  onDelete,
  onSettle,
}: ExpenseRowProps) {
  const isPlanned = expense.is_planned;
  return (
    <Card
      variant="compact"
      className={`flex items-center justify-between gap-[var(--space-2)] ${
        isPlanned ? 'border-dashed border-[color:var(--lkv-secondary)]/40' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="truncate text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
          {expense.title}
        </div>
        <div className="truncate text-[10px] text-[color:var(--lkv-text-secondary)]">
          <span className="capitalize">{expense.category || 'divers'}</span>
          {isMulti && expense.payer?.full_name && <> · {expense.payer.full_name}</>}
          {isPlanned && expense.split_type !== 'individual' && ' · partagé'}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-[var(--space-2)]">
        <div
          className={`text-[length:var(--lkv-text-footnote)] font-extrabold ${
            isPlanned
              ? 'text-[color:var(--lkv-text-secondary)]'
              : 'text-[color:var(--lkv-text-primary)]'
          }`}
        >
          {expense.amount} {currency}
        </div>
        {canManage && onSettle && (
          <Button
            type="button"
            size="sm"
            onClick={onSettle}
            disabled={isPending}
            title="Régler cette dépense prévue"
            icon={<Icon name="check-circle" size={14} />}
          >
            <span className="sr-only sm:inline">Régler</span>
          </Button>
        )}
        {canManage && (
          <>
            <IconButton
              type="button"
              size="sm"
              onClick={onEdit}
              disabled={isPending}
              aria-label="Modifier la dépense"
              title="Modifier la dépense"
            >
              <Icon name="pencil" size={14} />
            </IconButton>
            <IconButton
              type="button"
              size="sm"
              onClick={onDelete}
              disabled={isPending}
              aria-label="Supprimer la dépense"
              title="Supprimer la dépense"
            >
              <Icon name="trash2" size={14} />
            </IconButton>
          </>
        )}
      </div>
    </Card>
  );
}

export default ExpenseRow;

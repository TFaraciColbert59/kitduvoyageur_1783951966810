'use client';

import Icon from '@/components/ui/Icon';
import type { TripExpense } from '../../types/trip.types';

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
    <div
      className={`glass-sub-card p-2.5 rounded-[var(--lkv-radius-md)] border flex items-center justify-between gap-2 shadow-2xs ${
        isPlanned ? 'border-dashed border-[var(--lkv-secondary)]/40' : 'border-white/60'
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm font-bold text-lkv-primary truncate">{expense.title}</div>
        <div className="text-[10px] text-lkv-secondary truncate">
          <span className="capitalize">{expense.category || 'divers'}</span>
          {isMulti && expense.payer?.full_name && <> · {expense.payer.full_name}</>}
          {isPlanned && expense.split_type !== 'individual' && ' · partagé'}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div
          className={`text-sm font-extrabold ${isPlanned ? 'text-lkv-secondary' : 'text-lkv-primary'}`}
        >
          {expense.amount} {currency}
        </div>
        {canManage && onSettle && (
          <button
            onClick={onSettle}
            disabled={isPending}
            className="min-h-[44px] min-w-[44px] px-2 flex items-center justify-center gap-1 rounded-full bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)] text-[11px] font-bold hover:bg-[var(--lkv-primary)]/20 transition-all"
            title="Régler cette dépense prévue"
          >
            <Icon name="check-circle" size={14} />
            <span className="sr-only sm:inline">Régler</span>
          </button>
        )}
        {canManage && (
          <>
            <button
              onClick={onEdit}
              disabled={isPending}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full glass-sub-card border border-white/60 text-[var(--lkv-text-muted)] hover:text-lkv-primary transition-all shadow-2xs"
              title="Modifier la dépense"
            >
              <Icon name="pencil" size={14} />
            </button>
            <button
              onClick={onDelete}
              disabled={isPending}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full glass-sub-card border border-white/60 text-[var(--lkv-text-muted)] hover:text-[var(--lkv-danger)] hover:bg-[var(--lkv-danger)]/10 transition-all shadow-2xs"
              title="Supprimer la dépense"
            >
              <Icon name="trash2" size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ExpenseRow;

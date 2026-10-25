'use client';

import React from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui';
import type { TripFull, TripExpense } from '../../types/trip.types';
import { BUDGET_CATEGORY_OPTIONS } from './budgetFormat';

const FIELD_CLASS =
  'min-h-[var(--control-height-md)] w-full rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] text-[var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

const LABEL_CLASS =
  'mb-1 block text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]';

export interface ExpenseFormSheetProps {
  open: boolean;
  trip: TripFull;
  expense: TripExpense | null;
  isMulti: boolean;
  isPending: boolean;
  /** Date préremplie pour une nouvelle dépense (ex. jour sélectionné). */
  initialDate?: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>, target: TripExpense | null) => void;
  onClose: () => void;
}

export function ExpenseFormSheet({
  open,
  trip,
  expense,
  isMulti,
  isPending,
  initialDate = null,
  onSubmit,
  onClose,
}: ExpenseFormSheetProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={expense ? 'Modifier la dépense' : 'Nouvelle dépense'}
    >
      <div className="pb-2">
        <form onSubmit={(e) => onSubmit(e, expense)} className="space-y-[var(--space-4)]">
          <div>
            <label className={LABEL_CLASS}>Intitulé de la dépense</label>
            <input
              type="text"
              name="title"
              required
              defaultValue={expense?.title ?? ''}
              placeholder="ex : Refuge des Écrins, Ravitaillement bivouac"
              className={FIELD_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-[var(--space-3)]">
            <div>
              <label className={LABEL_CLASS}>
                Montant ({trip.budget_currency || 'EUR'})
              </label>
              <input
                type="number"
                name="amount"
                step="0.01"
                min="0.01"
                required
                defaultValue={expense?.amount ?? ''}
                placeholder="0.00"
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Catégorie</label>
              <select
                name="category"
                defaultValue={expense?.category ?? 'hébergement'}
                className={FIELD_CLASS}
              >
                {BUDGET_CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-[var(--space-3)]">
            <div>
              <label className={LABEL_CLASS}>Date</label>
              <input
                type="date"
                name="expenseDate"
                defaultValue={expense?.expense_date ?? initialDate ?? todayStr}
                required
                className={FIELD_CLASS}
              />
            </div>

            {isMulti ? (
              <div>
                <label className={LABEL_CLASS}>Répartition</label>
                <select
                  name="splitType"
                  defaultValue={expense?.split_type ?? 'equal'}
                  className={FIELD_CLASS}
                >
                  <option value="equal">Partagée équitablement</option>
                  <option value="individual">Dépense personnelle</option>
                </select>
              </div>
            ) : (
              <input
                type="hidden"
                name="splitType"
                value={expense?.split_type ?? 'equal'}
                className="hidden"
              />
            )}
          </div>

          {isMulti && (
            <div>
              <label className={LABEL_CLASS}>Payé par</label>
              <select
                name="payerId"
                defaultValue={expense?.payer_id ?? trip.user_id}
                className={FIELD_CLASS}
              >
                {(trip.collaborators || []).map((c) => (
                  <option key={c.user_id} value={c.user_id}>
                    {c.profile?.full_name || `Voyageur (${c.user_id.slice(0, 6)})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex min-h-[44px] cursor-pointer items-center gap-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]">
            <input
              type="checkbox"
              name="isPlanned"
              defaultChecked={expense?.is_planned ?? false}
              className="h-4 w-4 accent-[color:var(--lkv-primary)]"
            />
            Dépense prévue (à régler le jour venu)
          </label>

          <div className="flex items-center justify-end gap-[var(--space-3)] pt-[var(--space-2)]">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" size="sm" loading={isPending}>
              {isPending
                ? 'Enregistrement...'
                : expense
                  ? 'Enregistrer les modifications'
                  : 'Valider la dépense'}
            </Button>
          </div>
        </form>
      </div>
    </Sheet>
  );
}

export default ExpenseFormSheet;

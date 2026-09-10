'use client';

import React from 'react';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { GlassModal } from '@/components/ui/GlassModal';
import type { TripFull, TripExpense } from '../../types/trip.types';
import { BUDGET_CATEGORY_OPTIONS } from './budgetFormat';

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
    <GlassModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={expense ? 'Modifier la dépense' : 'Nouvelle dépense'}
      variant="sheet"
    >
      <div className="pb-2">
        <form onSubmit={(e) => onSubmit(e, expense)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-lkv-primary mb-1">
              Intitulé de la dépense
            </label>
            <input
              type="text"
              name="title"
              required
              defaultValue={expense?.title ?? ''}
              placeholder="ex : Refuge des Écrins, Ravitaillement bivouac"
              className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-lkv-primary mb-1">
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
                className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-lkv-primary mb-1">Catégorie</label>
              <select
                name="category"
                defaultValue={expense?.category ?? 'hébergement'}
                className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              >
                {BUDGET_CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-lkv-primary mb-1">Date</label>
              <input
                type="date"
                name="expenseDate"
                defaultValue={expense?.expense_date ?? initialDate ?? todayStr}
                required
                className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              />
            </div>

            {isMulti ? (
              <div>
                <label className="block text-xs font-semibold text-lkv-primary mb-1">
                  Répartition
                </label>
                <select
                  name="splitType"
                  defaultValue={expense?.split_type ?? 'equal'}
                  className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
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
              <label className="block text-xs font-semibold text-lkv-primary mb-1">Payé par</label>
              <select
                name="payerId"
                defaultValue={expense?.payer_id ?? trip.user_id}
                className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
              >
                {(trip.collaborators || []).map((c) => (
                  <option key={c.user_id} value={c.user_id}>
                    {c.profile?.full_name || `Voyageur (${c.user_id.slice(0, 6)})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 min-h-[44px] text-xs font-semibold text-lkv-primary cursor-pointer">
            <input
              type="checkbox"
              name="isPlanned"
              defaultChecked={expense?.is_planned ?? false}
              className="w-4 h-4 accent-[var(--lkv-primary)]"
            />
            Dépense prévue (à régler le jour venu)
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <GlassCapsuleBtn type="button" variant="default" size="sm" onClick={onClose}>
              Annuler
            </GlassCapsuleBtn>
            <GlassCapsuleBtn type="submit" variant="primary" size="sm" disabled={isPending}>
              {isPending
                ? 'Enregistrement...'
                : expense
                  ? 'Enregistrer les modifications'
                  : 'Valider la dépense'}
            </GlassCapsuleBtn>
          </div>
        </form>
      </div>
    </GlassModal>
  );
}

export default ExpenseFormSheet;

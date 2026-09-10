'use client';

import { Check, Package, RotateCcw, ShoppingBag, Truck } from 'lucide-react';
import { GlassDrawer } from '@/components/ui/GlassDrawer';
import { PURCHASE_META, type MissingRow } from '../../../mobile/gearEngine';
import type { TripPurchaseState } from '@/features/trips/types/trip.types';

export interface MissingItemsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: MissingRow[];
  busy: boolean;
  onAdvance: (row: MissingRow) => void;
  onReset: (row: MissingRow) => void;
}

const STATE_ICON: Record<TripPurchaseState, typeof ShoppingBag> = {
  needed: ShoppingBag,
  added: Check,
  in_cart: ShoppingBag,
  shipping: Truck,
};

export function MissingItemsDrawer({
  open,
  onOpenChange,
  rows,
  busy,
  onAdvance,
  onReset,
}: MissingItemsDrawerProps) {
  return (
    <GlassDrawer open={open} onOpenChange={onOpenChange} title="Ce qui manque" width={430}>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm font-medium text-[var(--lkv-text-secondary)]">
          Rien à acheter — votre sac est complet.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => {
            const Icon = STATE_ICON[row.state];
            const meta = PURCHASE_META[row.state];
            return (
              <li key={row.key} className="glass-sub-card rounded-2xl p-3">
                <div className="flex items-start gap-3">
                  {row.imageUrl ? (
                    <img
                      src={row.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-xl border border-white/60 object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/60 bg-white/70 text-[var(--lkv-text-muted)]">
                      <Package size={20} aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[var(--lkv-text-primary)]">{row.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-[var(--lkv-text-primary)]/80">
                      {row.brand && <span>{row.brand}</span>}
                      {row.priceEur != null && <span className="tabular-nums">{row.priceEur} €</span>}
                      {row.weightGrams != null && <span className="tabular-nums">{row.weightGrams} g</span>}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                      row.state === 'shipping'
                        ? 'bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]'
                        : row.state === 'in_cart'
                          ? 'bg-[var(--lkv-sky-100)] text-[var(--lkv-sky-700)]'
                          : 'bg-black/5 text-[var(--lkv-text-primary)]'
                    }`}
                  >
                    {meta.label}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAdvance(row)}
                    disabled={busy}
                    className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold transition-transform active:scale-[0.98] disabled:opacity-50 ${
                      row.state === 'needed'
                        ? 'bg-[var(--lkv-primary)] text-white'
                        : 'border border-[var(--lkv-primary)]/25 bg-white/80 text-[var(--lkv-primary)]'
                    }`}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {meta.action}
                  </button>
                  {row.state !== 'needed' && (
                    <button
                      type="button"
                      onClick={() => onReset(row)}
                      disabled={busy}
                      aria-label="Revenir à « à ajouter »"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/70 text-[var(--lkv-text-secondary)] transition-transform active:scale-[0.94] disabled:opacity-50"
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </GlassDrawer>
  );
}

export default MissingItemsDrawer;

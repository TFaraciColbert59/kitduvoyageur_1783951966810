'use client';

import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { BudgetChipDef, BudgetFilter } from '../../../mobile/budgetEngine';

export interface BudgetChipsRowProps {
  chips: BudgetChipDef[];
  onSelect: (filter: BudgetFilter) => void;
}

function chipClasses(tone: BudgetChipDef['tone']): string {
  if (tone === 'warn') {
    return 'border border-[var(--lkv-danger)]/20 bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)]';
  }
  if (tone === 'accent') {
    return 'border border-[var(--lkv-primary)]/15 bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]';
  }
  return 'glass-sub-card text-[var(--lkv-text-primary)]';
}

function bubbleClasses(tone: BudgetChipDef['tone']): string {
  if (tone === 'warn') return 'border-[var(--lkv-danger)]/20 bg-white/80 text-[var(--lkv-danger)]';
  if (tone === 'accent') return 'border-[var(--lkv-primary)]/15 bg-white/80 text-[var(--lkv-primary)]';
  return 'border-white/70 bg-white/70 text-[var(--lkv-secondary)]';
}

export function BudgetChipsRow({ chips, onSelect }: BudgetChipsRowProps) {
  const { triggerHaptic } = useHapticFeedback();
  if (chips.length === 0) return null;

  return (
    <section aria-label="Indicateurs budget">
      <ul
        tabIndex={0}
        className="hub-hscroll -mx-4 flex list-none gap-2 overflow-x-auto rounded-xl px-4 pb-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] md:mx-0 md:px-1"
      >
        {chips.map((chip) => {
          const Icon = chip.icon;
          return (
            <li key={chip.key} className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  onSelect(chip.filter);
                }}
                aria-label={`${chip.value} — ${chip.label}`}
                className={`flex min-h-[44px] items-center gap-2 rounded-2xl px-3 py-2 transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] ${chipClasses(chip.tone)}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${bubbleClasses(chip.tone)}`}
                >
                  <Icon size={14} aria-hidden="true" />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[13px] font-extrabold tabular-nums">{chip.value}</span>
                  <span className="block max-w-[10rem] truncate text-[9px] font-medium uppercase tracking-[0.12em] opacity-90">
                    {chip.label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default BudgetChipsRow;

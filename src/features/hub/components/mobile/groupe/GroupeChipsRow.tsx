'use client';

import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { LucideIcon } from 'lucide-react';

export interface GroupeChipDef {
  key: string;
  icon: LucideIcon;
  value: string;
  label: string;
  tone?: 'default' | 'warn' | 'accent';
  onClick: () => void;
}

export interface GroupeChipsRowProps {
  chips: GroupeChipDef[];
}

export function GroupeChipsRow({ chips }: GroupeChipsRowProps) {
  const { triggerHaptic } = useHapticFeedback();
  if (chips.length === 0) return null;

  return (
    <section aria-label="Indicateurs du groupe">
      <ul
        tabIndex={0}
        className="hub-hscroll -mx-4 flex list-none gap-2 overflow-x-auto rounded-xl px-4 pb-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
      >
        {chips.map((chip) => {
          const Icon = chip.icon;
          return (
            <li key={chip.key} className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  chip.onClick();
                }}
                aria-label={`${chip.value} — ${chip.label}`}
                className="glass-capsule-btn flex min-h-[44px] !items-center !gap-2 !rounded-2xl !px-3 !py-2 transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/10">
                  <Icon size={14} aria-hidden="true" />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[13px] font-extrabold tabular-nums">{chip.value}</span>
                  <span className="block max-w-[10rem] truncate text-[9px] font-medium uppercase tracking-[0.12em]">
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

export default GroupeChipsRow;

'use client';

import type { GearInfoCard } from '../../../mobile/gearEngine';

export interface GearInfoSliderProps {
  cards: GearInfoCard[];
  onOpenMissing: () => void;
  onOpenList: () => void;
}

function cardClasses(tone: GearInfoCard['tone']): string {
  if (tone === 'warn') {
    return 'border border-[var(--lkv-danger)]/20 bg-[var(--lkv-danger)]/10';
  }
  if (tone === 'accent') {
    return 'border border-[var(--lkv-primary)]/15 bg-[var(--lkv-primary)]/10';
  }
  return 'glass-sub-card';
}

export function GearInfoSlider({ cards, onOpenMissing, onOpenList }: GearInfoSliderProps) {
  if (cards.length === 0) return null;

  return (
    <section aria-label="Infos du sac">
      <ul className="hub-hscroll -mx-4 flex list-none gap-2.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-1">
        {cards.map((card) => {
          const isGap = card.key === 'vital-gaps' || card.key === 'recommended-gaps';
          const handleClick = () => {
            if (isGap) onOpenMissing();
            else onOpenList();
          };
          return (
            <li key={card.key} className="shrink-0">
              <button
                type="button"
                onClick={handleClick}
                aria-label={`${card.label} — ${card.value}. ${card.hint}`}
                className={`flex h-[6.75rem] w-[10.75rem] flex-col items-start justify-between rounded-[1.4rem] p-3 text-left transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] ${cardClasses(card.tone)}`}
              >
                <span
                  className={`text-[10px] font-medium uppercase tracking-[0.14em] ${
                    card.tone === 'warn' ? 'text-[var(--lkv-danger)]' : 'text-[var(--lkv-text-primary)]'
                  }`}
                >
                  {card.label}
                </span>
                <span className="w-full">
                  <span
                    className={`block font-display text-xl font-extrabold tabular-nums ${
                      card.tone === 'warn' ? 'text-[var(--lkv-danger)]' : 'text-[var(--lkv-text-primary)]'
                    }`}
                  >
                    {card.value}
                  </span>
                  <span className="block truncate text-[10.5px] font-medium text-[var(--lkv-text-primary)]/80">
                    {card.hint}
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

export default GearInfoSlider;

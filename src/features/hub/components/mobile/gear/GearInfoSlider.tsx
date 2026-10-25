'use client';

import { Button } from '@/components/ui';
import type { GearInfoCard } from '../../../mobile/gearEngine';

export interface GearInfoSliderProps {
  cards: GearInfoCard[];
  onOpenMissing: () => void;
  onOpenList: () => void;
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
              <Button
                variant="secondary"
                onClick={handleClick}
                aria-label={`${card.label} — ${card.value}. ${card.hint}`}
                className="flex h-[6.75rem] w-[10.75rem] !flex-col !items-start !justify-between !rounded-[var(--lkv-radius-lg)] !p-3 text-left"
              >
                <span className="text-[10px] font-medium uppercase tracking-[0.14em]">
                  {card.label}
                </span>
                <span className="w-full">
                  <span className="block font-display text-xl font-extrabold tabular-nums">
                    {card.value}
                  </span>
                  <span className="block truncate text-[10.5px] font-medium">
                    {card.hint}
                  </span>
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default GearInfoSlider;

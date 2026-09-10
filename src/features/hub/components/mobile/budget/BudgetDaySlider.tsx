'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { formatEuro } from '../../../mobile/mobileHubEngine';
import type { BudgetDaySlide } from '../../../mobile/budgetEngine';

export interface BudgetDaySliderProps {
  slides: BudgetDaySlide[];
  onSelectDay: (slide: BudgetDaySlide) => void;
}

export function BudgetDaySlider({ slides, onSelectDay }: BudgetDaySliderProps) {
  const { triggerHaptic } = useHapticFeedback();
  const scrollRef = useRef<HTMLUListElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const syncArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    syncArrows();
  }, [slides.length, syncArrows]);

  const scrollByCard = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const first = el.querySelector('li');
    const step = first ? first.offsetWidth + 12 : Math.round(el.clientWidth * 0.8);
    triggerHaptic('light');
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  if (slides.length === 0) return null;

  return (
    <section aria-label="Jour par jour">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]">
            Jour par jour
          </p>
          <p className="mt-0.5 text-xs font-medium text-[var(--lkv-text-primary)]/70">
            {slides.length} jour{slides.length > 1 ? 's' : ''} · prévu vs réel
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            disabled={!canLeft}
            aria-label="Jours précédents"
            className="glass-circle-btn h-10 w-10 disabled:opacity-40"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            disabled={!canRight}
            aria-label="Jours suivants"
            className="glass-circle-btn primary h-10 w-10 disabled:opacity-40"
          >
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <ul
        ref={scrollRef}
        onScroll={syncArrows}
        className="hub-hscroll -mx-4 flex list-none snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0"
      >
        {slides.map((slide) => (
          <li key={slide.key} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onSelectDay(slide);
              }}
              aria-label={`Jour ${slide.dayNumber} — ${slide.label}, ${formatEuro(slide.realTotal)} réel${
                slide.plannedTotal > 0 ? `, ${formatEuro(slide.plannedTotal)} prévu` : ''
              }`}
              className={`relative flex h-[9rem] w-[9rem] flex-col justify-between rounded-[1.4rem] p-3 text-left transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] ${
                slide.isToday
                  ? 'glass interactive border-2 border-[var(--lkv-primary)]/35 text-[var(--lkv-text-primary)]'
                  : 'glass interactive text-[var(--lkv-text-primary)]'
              }`}
            >
              <span className="flex w-full items-start justify-between gap-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                    slide.isToday
                      ? 'bg-[var(--lkv-primary)] text-white'
                      : 'bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]'
                  }`}
                >
                  J{slide.dayNumber}
                </span>
              </span>

              <span className="w-full">
                <span
                  className={`block truncate text-[10px] font-semibold uppercase tracking-[0.08em] ${
                    slide.isToday ? 'text-[var(--lkv-primary)]' : 'text-[var(--lkv-text-primary)]/60'
                  }`}
                >
                  {slide.isToday ? 'Aujourd’hui' : slide.label}
                </span>
                <span className="mt-0.5 block font-display text-lg font-extrabold tabular-nums">
                  {formatEuro(slide.realTotal)}
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] font-medium text-[var(--lkv-text-primary)]/70">
                  {slide.plannedTotal > 0
                    ? `+ ${formatEuro(slide.plannedTotal)} prévu`
                    : slide.expenseCount === 0
                      ? 'Rien prévu'
                      : `${slide.expenseCount} dépense${slide.expenseCount > 1 ? 's' : ''}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default BudgetDaySlider;

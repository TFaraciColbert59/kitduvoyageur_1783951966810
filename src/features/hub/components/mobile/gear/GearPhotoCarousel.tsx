'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { GearCardData } from '../../../mobile/gearEngine';

export interface GearPhotoCarouselProps {
  cards: GearCardData[];
  onSelect: (card: GearCardData) => void;
  heading?: string;
}

export function GearPhotoCarousel({ cards, onSelect, heading = 'Équipement du sac' }: GearPhotoCarouselProps) {
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
  }, [cards.length, syncArrows]);

  const scrollByCard = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const first = el.querySelector('li');
    const step = first ? first.offsetWidth + 12 : Math.round(el.clientWidth * 0.8);
    triggerHaptic('light');
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  if (cards.length === 0) return null;

  return (
    <section aria-label={heading}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]">
            {heading}
          </p>
          <p className="mt-0.5 text-xs font-medium text-[var(--lkv-text-primary)]/70">
            {cards.length} objet{cards.length > 1 ? 's' : ''} dans le sac
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            disabled={!canLeft}
            aria-label="Éléments précédents"
            className="glass-sub-card flex h-10 w-10 items-center justify-center rounded-full text-[var(--lkv-primary)] transition-transform active:scale-[0.94] disabled:opacity-40"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            disabled={!canRight}
            aria-label="Éléments suivants"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--lkv-primary)] text-white shadow-sm transition-transform active:scale-[0.94] disabled:opacity-40"
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
        {cards.map((card) => (
          <li
            key={card.id}
            className="w-[72vw] max-w-[19rem] shrink-0 snap-start sm:w-[17rem] lg:w-[20rem]"
          >
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onSelect(card);
              }}
              aria-label={`${card.name} — ${card.categoryLabel}${card.weightKg != null ? `, ${card.weightKg} kg` : ''}`}
              className="relative block h-[23rem] w-full overflow-hidden rounded-[1.75rem] border border-white/40 bg-[var(--lkv-forest-50)] text-left shadow-sm transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] lg:h-[26rem]"
            >
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--lkv-forest-100)] to-[var(--lkv-forest-50)]">
                  <span
                    className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/70 text-2xl font-extrabold text-[var(--lkv-primary)] ring-1 ring-white/70"
                    aria-hidden="true"
                  >
                    {card.name.slice(0, 1).toUpperCase()}
                  </span>
                </span>
              )}

              <span
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/5 to-black/25"
                aria-hidden="true"
              />

              <span className="absolute left-4 right-14 top-4 block">
                <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/85">
                  {card.categoryLabel}
                </span>
                <span className="mt-1 line-clamp-3 block font-display text-xl font-extrabold leading-snug text-white drop-shadow-sm">
                  {card.name}
                </span>
              </span>

              {card.isPacked && (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-[var(--lkv-primary)] shadow-2xs">
                  <Check size={11} aria-hidden="true" />
                  Prêt
                </span>
              )}

              <span className="glass absolute bottom-4 left-4 inline-flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold text-[var(--lkv-text-primary)]">
                {card.weightKg != null && <span className="tabular-nums">{card.weightKg} kg</span>}
                {card.quantity > 1 && <span className="tabular-nums">×{card.quantity}</span>}
                {card.isConsumable && <span>consommable</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default GearPhotoCarousel;

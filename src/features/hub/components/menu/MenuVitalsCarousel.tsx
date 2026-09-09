'use client';

// UI Layouts (MIT) — carrousel progressif adapté aux vitaux mobiles du Hub.
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  ProgressSlider,
  SliderContent,
  SliderWrapper,
  SliderBtnGroup,
  SliderBtn,
} from '@/components/ui-layouts/progressive-carousel';
import { cn } from '@/lib/utils';

export interface MenuVital {
  id: string;
  label: string;
  value: string;
  sub?: string;
  href?: string;
  /** Pastille de couleur du progress (default green). */
  tone?: string;
}

export interface MenuVitalsCarouselProps {
  vitals: MenuVital[];
  className?: string;
}

/**
 * Hub V4 — Carrousel progressif des VITAUX mobiles (au-dessus du MENU).
 * Auto-avance type « stories » ; pastilles de progression cliquables.
 * Masqué sur desktop (le rail droit prend le relais).
 */
export function MenuVitalsCarousel({ vitals, className }: MenuVitalsCarouselProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  if (!isMobile || vitals.length < 2) return null;

  return (
    <ProgressSlider duration={6000} activeSlider={vitals[0].id} className={cn('md:hidden', className)}>
      <SliderContent>
        {vitals.map((v) => (
          <SliderWrapper key={v.id} value={v.id}>
            <div
              className="glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3 border border-white/60 shadow-sm"
              onClick={() => {
                if (v.href) window.location.href = v.href;
              }}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)]">
                  {v.label}
                </p>
                <p className="mt-0.5 text-lg font-extrabold text-[var(--lkv-text-primary)] truncate">
                  {v.value}
                </p>
                {v.sub && (
                  <p className="text-[11px] text-[var(--lkv-text-secondary)] truncate">{v.sub}</p>
                )}
              </div>
            </div>
          </SliderWrapper>
        ))}
      </SliderContent>
      <SliderBtnGroup className="mt-2 flex gap-1.5">
        {vitals.map((v) => (
          <SliderBtn
            key={v.id}
            value={v.id}
            progressBarClass={cn('bg-[var(--lkv-primary)]', v.tone)}
            className="h-1.5 flex-1 rounded-full bg-black/5"
          />
        ))}
      </SliderBtnGroup>
    </ProgressSlider>
  );
}

export default MenuVitalsCarousel;
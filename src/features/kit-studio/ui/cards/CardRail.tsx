'use client';
import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import './cards.css';

/** Côté d'une carte : (min(vw, 560) − 2·12 − 24 − 2·8) / 3 (SPEC-DRAWER) : 112,7 px à 402, 122 à 430. */
export function cardSide(vw: number): number {
  return (Math.min(vw, 560) - 2 * 12 - 24 - 2 * 8) / 3;
}

export const VISIBLE_CARDS = 3;
const GAP = 8;

interface CardRailProps {
  label: string;
  children: ReactNode;
  count: number;
  onPageChange: (page: number) => void;
  /** Index de la carte à amener en tête à l'affichage (carte courante). */
  focusIndex?: number;
  railRef?: (el: HTMLDivElement | null) => void;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
}

/** Rail horizontal aimanté : trois cartes exactement visibles, défilement de droite à gauche. */
export function CardRail({ label, children, count, onPageChange, focusIndex, railRef, onPointerDown }: CardRailProps) {
  const el = useRef<HTMLDivElement | null>(null);
  const last = useRef(0);
  const set = (node: HTMLDivElement | null) => {
    el.current = node;
    railRef?.(node);
  };

  useEffect(() => {
    const r = el.current;
    const first = r?.firstElementChild as HTMLElement | null;
    if (!r || !first || !focusIndex) return;
    r.scrollLeft = first.offsetWidth ? focusIndex * (first.offsetWidth + GAP) : 0;
  }, [focusIndex]);

  const onScroll = () => {
    const r = el.current;
    const first = r?.firstElementChild as HTMLElement | null;
    if (!r || !first || !first.offsetWidth) return;
    const p = Math.round(r.scrollLeft / (first.offsetWidth + GAP) / VISIBLE_CARDS);
    const clamped = Math.max(0, Math.min(p, Math.max(0, Math.ceil(count / VISIBLE_CARDS) - 1)));
    if (clamped !== last.current) {
      last.current = clamped;
      onPageChange(clamped);
    }
  };

  return (
    <div ref={set} className="ks-rail" role="group" aria-label={label} onScroll={onScroll} onPointerDown={onPointerDown} onContextMenu={(e) => e.preventDefault()}>
      {children}
    </div>
  );
}

/** Points de pagination (décoratifs, entre les deux capsules). */
export function PageDots({ count, page }: { count: number; page: number }) {
  const n = Math.ceil(count / VISIBLE_CARDS);
  return (
    <div className="ks-sdots" aria-hidden="true" hidden={n < 2}>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className={i === page ? 'cur' : undefined} />
      ))}
    </div>
  );
}

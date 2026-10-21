'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

/** Seuil de déclenchement d'un changement de lentille par swipe (plan §3.2). */
export const LENS_SWIPE_THRESHOLD = 24;
/** Durée du snap de fin de swipe (plan §3.2). */
export const LENS_SNAP_MS = 250;
/** Courbe du snap de fin de swipe (plan §3.2). */
export const LENS_SNAP_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

type DragAxis = 'pending' | 'x' | 'y';

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  axis: DragAxis;
}

export interface LensPagerProps {
  /** Index de la lentille active (0-based), piloté par le `.flow`. */
  index: number;
  /** Nombre de lentilles de la piste. */
  count: number;
  /** Appelé quand le swipe ou le clavier demande une autre lentille. */
  onIndexChange: (index: number) => void;
  /** Une pane par lentille (largeur 100 %). */
  children: React.ReactNode;
  label?: string;
}

/**
 * Piste horizontale de lentilles.
 *
 * - `pointerdown/move/up` : seuil de 24 px, verrouillage d'axe pour laisser le
 *   scroll vertical au conteneur.
 * - `transform: translateX(...)` sur la piste, snap de 250 ms.
 * - `ArrowLeft` / `ArrowRight` au clavier.
 * - Synchronise la lentille du segmented `.flow` (`.sel-lens` + `aria-selected`).
 * - `prefers-reduced-motion` : le changement de lentille reste possible, sans
 *   animation de translation.
 */
export function LensPager({
  index,
  count,
  onIndexChange,
  children,
  label = 'Lentilles',
}: LensPagerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, []);

  // Le segmented `.flow` reste la source d'affichage : on le resynchronise
  // lorsque le swipe (ou le clavier) change de lentille.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const shell = viewportRef.current?.closest('.lkdv-slot-shell');
    const flow = (shell ?? document).querySelector('.flow');
    if (!flow) return;
    const lens = flow.querySelector<HTMLElement>('.sel-lens');
    if (lens) lens.style.setProperty('--i', String(index));
    flow.querySelectorAll('[role="tab"]').forEach((tab, tabIndex) => {
      const active = tabIndex === index;
      tab.setAttribute('aria-selected', String(active));
      tab.classList.toggle('cur', active);
    });
  }, [index]);

  const reset = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
    setDragX(0);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= count || next === index) return;
      onIndexChange(next);
    },
    [count, index, onIndexChange]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (count < 2 || event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      axis: 'pending',
    };
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (drag.axis === 'pending') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.axis === 'x') {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* capture optionnelle (Safari ancien, tests) */
        }
      }
    }

    if (drag.axis !== 'x') return;
    if (event.cancelable) event.preventDefault();

    let next = dx;
    // Résistance douce aux extrémités, pour ne jamais sortir de la piste.
    if (index === 0 && next > 0) next = Math.min(next * 0.24, 12);
    if (index === count - 1 && next < 0) next = Math.max(next * 0.24, -12);
    setDragX(next);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const axis = drag.axis;
    const dx = event.clientX - drag.startX;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      /* capture optionnelle */
    }
    reset();
    if (axis !== 'x') return;
    if (dx <= -LENS_SWIPE_THRESHOLD) goTo(index + 1);
    else if (dx >= LENS_SWIPE_THRESHOLD) goTo(index - 1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(index + 1);
    }
  };

  const trackStyle: React.CSSProperties = {
    transform: `translateX(calc(${-index * 100}% + ${dragX}px))`,
    transition:
      dragging || reducedMotion ? 'none' : `transform ${LENS_SNAP_MS}ms ${LENS_SNAP_EASING}`,
  };

  return (
    <div
      ref={viewportRef}
      className="lkdv-lens-pager"
      role="group"
      aria-roledescription="carrousel"
      aria-label={label}
      tabIndex={0}
      data-lens-index={index}
      data-dragging={dragging ? 'true' : 'false'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={reset}
      onKeyDown={handleKeyDown}
    >
      <div className="lkdv-lens-track" style={trackStyle}>
        {children}
      </div>
    </div>
  );
}

export default LensPager;

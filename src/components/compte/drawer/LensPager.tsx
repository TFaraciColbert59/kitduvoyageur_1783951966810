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
  /** Référence du segmented `.flow` à resynchroniser (jamais de query globale). */
  flowRef?: React.RefObject<HTMLElement | null>;
  label?: string;
}

/**
 * Piste horizontale de lentilles.
 *
 * - `pointerdown/move/up` : seuil de 24 px, verrouillage d'axe pour laisser le
 *   scroll vertical au conteneur ; un `pointerup` hors zone ou un
 *   `pointercancel` termine toujours le geste et remet `dragging` à false.
 * - `transform: translateX(...)` sur la piste, snap de 250 ms.
 * - `ArrowLeft` / `ArrowRight` au clavier.
 * - Synchronise la lentille du `.flow` via `flowRef` (`.sel-lens` +
 *   `aria-selected`), sans requête DOM globale.
 * - `prefers-reduced-motion` : le changement de lentille reste possible, sans
 *   animation de translation.
 */
export function LensPager({
  index,
  count,
  onIndexChange,
  children,
  flowRef,
  label = 'Lentilles',
}: LensPagerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  /**
   * Geste rendu à un scroller horizontal interne (`[data-hscroll]`). Le pager
   * repasse alors en `touch-action:auto` le temps du geste : sans cela, le
   * `pan-y` du pager, hérité par intersection CSS, interdirait le pan
   * horizontal du rail même si celui-ci déclare `pan-x pan-y`.
   */
  const hscrollPointerRef = useRef<number | null>(null);
  const [hscrollActive, setHscrollActive] = useState(false);
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
    const flow = flowRef?.current;
    if (!flow) return;
    const lens = flow.querySelector<HTMLElement>('.sel-lens');
    if (lens) lens.style.setProperty('--i', String(index));
    const igLens = flow.querySelector<HTMLElement>('.ig-th.lens');
    if (igLens) igLens.style.transform = `translateX(${index * 100}%)`;
    flow.querySelectorAll<HTMLElement>('[role="tab"]').forEach((tab, tabIndex) => {
      const active = tabIndex === index;
      tab.setAttribute('aria-selected', String(active));
      tab.classList.toggle('cur', active);
      // Roving tabindex : le swipe doit aussi déplacer l'onglet tabbable.
      tab.tabIndex = active ? 0 : -1;
    });
  }, [flowRef, index]);

  // Pendant un swipe, l'indicateur du `.flow` suit la progression du doigt au
  // lieu d'attendre le relâchement. Au repos, il revient sur l'index actif.
  useEffect(() => {
    const flow = flowRef?.current;
    const lens = flow?.querySelector<HTMLElement>('.sel-lens');
    const igLens = flow?.querySelector<HTMLElement>('.ig-th.lens');
    if (!flow || (!lens && !igLens)) return;
    if (!dragging) {
      lens?.style.setProperty('--i', String(index));
      if (igLens) igLens.style.transform = `translateX(${index * 100}%)`;
      return;
    }
    const width = viewportRef.current?.clientWidth ?? 0;
    if (!width) return;
    const progress = Math.max(0, Math.min(count - 1, index - dragX / width));
    lens?.style.setProperty('--i', String(progress));
    if (igLens) igLens.style.transform = `translateX(${progress * 100}%)`;
  }, [count, dragX, dragging, flowRef, index]);

  const reset = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
    setDragX(0);
  }, []);

  const releaseHscrollTouch = useCallback((pointerId?: number) => {
    if (pointerId !== undefined && hscrollPointerRef.current !== pointerId) return;
    if (hscrollPointerRef.current === null) return;
    hscrollPointerRef.current = null;
    setHscrollActive(false);
    const viewport = viewportRef.current;
    if (!viewport) return;
    // Retire la déclaration inline : le `pan-y` de la feuille reprend la main.
    viewport.style.touchAction = '';
  }, []);

  // Filet de sécurité : un geste rendu à un scroller peut se terminer hors du
  // pager (le doigt sort, ou le navigateur annule le geste).
  useEffect(() => {
    if (!hscrollActive) return;
    const release = () => releaseHscrollTouch();
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [hscrollActive, releaseHscrollTouch]);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= count || next === index) return;
      onIndexChange(next);
    },
    [count, index, onIndexChange]
  );

  const settle = useCallback(
    (axis: DragAxis, dx: number) => {
      reset();
      if (axis !== 'x') return;
      if (dx <= -LENS_SWIPE_THRESHOLD) goTo(index + 1);
      else if (dx >= LENS_SWIPE_THRESHOLD) goTo(index - 1);
    },
    [goTo, index, reset]
  );

  // Filet de sécurité : si le doigt sort de la piste avant le verrouillage
  // d'axe (pas encore de capture), le `pointerup` est reçu par la fenêtre.
  useEffect(() => {
    if (!dragging) return;
    const onWindowPointerUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      settle(drag.axis, event.clientX - drag.startX);
    };
    const onWindowPointerCancel = () => reset();
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerCancel);
    return () => {
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerCancel);
    };
  }, [dragging, reset, settle]);

  /**
   * Détecté en phase de capture : le rail des clubs appelle
   * `stopPropagation()` sur `pointerdown`, et le pager doit tout de même
   * repasser en `auto` pour ce geste.
   */
  const handlePointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    // Bouton primaire seulement : 0 pour un doigt ou un stylet, 1/2 pour la
    // molette et le bouton droit.
    if (event.button > 0 || hscrollPointerRef.current !== null) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const hscroll = target.closest('[data-hscroll]');
    const viewport = event.currentTarget;
    if (!hscroll || !viewport.contains(hscroll)) return;

    hscrollPointerRef.current = event.pointerId;
    viewport.style.touchAction = 'auto';
    setHscrollActive(true);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (hscrollPointerRef.current !== null) return;
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
    releaseHscrollTouch(event.pointerId);
    const drag = dragRef.current;
    if (!drag) return;
    const { axis, startX } = drag;
    const dx = event.clientX - startX;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      /* capture optionnelle */
    }
    settle(axis, dx);
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    releaseHscrollTouch(event.pointerId);
    reset();
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
      onPointerDownCapture={handlePointerDownCapture}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={(event) => {
        releaseHscrollTouch(event.pointerId);
        if (dragRef.current) reset();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="lkdv-lens-track" style={trackStyle}>
        {children}
      </div>
    </div>
  );
}

export default LensPager;

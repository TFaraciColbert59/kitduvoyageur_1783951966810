'use client';

import { useEffect, useRef } from 'react';
import { isHorizontalSwipe, isVerticalDismiss } from './gestureMath';

export interface TouchSwipeHandlers {
  onSwipeLeft?: (ctx: { target: EventTarget | null }) => void;
  onSwipeRight?: (ctx: { target: EventTarget | null }) => void;
  onSwipeDown?: (ctx: { target: EventTarget | null }) => void;
}

export interface TouchSwipeOptions extends TouchSwipeHandlers {
  /** Faux : aucun geste n'est suivi (panneau ouvert, etc.). */
  enabled?: boolean;
  /** Vrai : le geste est ignoré (champ de saisie, volet imbriqué…). */
  ignore?: (target: EventTarget | null) => boolean;
}

/**
 * Balayage tactile fiable sur iPhone : événements `touch*` natifs.
 *
 * Pourquoi pas `pointer*` : iOS (WebKit) émet `pointercancel` dès qu'il prend la main
 * pour un défilement — un vrai pouce dérive toujours un peu à la verticale, donc un
 * balayage horizontal est annulé avant d'atteindre le seuil. Les événements `touch*`
 * continuent d'arriver pendant le défilement natif : le geste est détecté de bout en bout.
 *
 * Mêmes seuils que partout (hooks/gestures) : balayage 48 px, fermeture vers le bas 80 px.
 * Un seul déclenchement par doigt posé. La souris reste gérée par les événements pointer.
 */
export function useTouchSwipe(ref: React.RefObject<HTMLElement | null>, options: TouchSwipeOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { x: number; y: number; target: EventTarget | null } | null = null;

    const reset = () => {
      start = null;
    };
    const onStart = (event: TouchEvent) => {
      const o = optionsRef.current;
      if (o.enabled === false || event.touches.length !== 1 || (o.ignore && o.ignore(event.target))) {
        start = null;
        return;
      }
      const t = event.touches[0];
      start = { x: t.clientX, y: t.clientY, target: event.target };
    };
    const evaluate = (clientX: number, clientY: number) => {
      if (!start) return;
      const o = optionsRef.current;
      const dx = clientX - start.x;
      const dy = clientY - start.y;
      const ctx = { target: start.target };
      if (o.onSwipeDown && isVerticalDismiss(dx, dy)) {
        reset();
        o.onSwipeDown(ctx);
      } else if (isHorizontalSwipe(dx, dy)) {
        reset();
        if (dx < 0) o.onSwipeLeft?.(ctx);
        else o.onSwipeRight?.(ctx);
      }
    };
    const onMove = (event: TouchEvent) => {
      const t = event.touches[0];
      if (t) evaluate(t.clientX, t.clientY);
    };
    const onEnd = (event: TouchEvent) => {
      const t = event.changedTouches[0];
      if (t) evaluate(t.clientX, t.clientY);
      reset();
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', reset, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', reset);
    };
  }, [ref]);
}

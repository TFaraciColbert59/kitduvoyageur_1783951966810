'use client';

import { useCallback, useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';

/**
 * Navigation entre les jours du carnet (Carnet#11, Carnet#20).
 *
 * - `nextTabIndex` : roving tabindex du tablist (flèches, Home, End), pur ;
 * - `swipeDirection` : décision pure d'un glisser horizontal (distance, rapport
 *   horizontal/vertical, vitesse) ;
 * - `useDaySwipe` : le panneau suit le doigt (transform seul, jamais de layout),
 *   revient en ressort au relâchement, et rien ne bouge sous
 *   `prefers-reduced-motion` (le changement de jour reste immédiat).
 */

export const DAY_PANEL_ID = 'cv2c-day-panel';

export const dayTabId = (dayId: string): string => `cv2c-day-tab-${dayId}`;

/** Index de l'onglet visé par une touche, `null` si la touche n'est pas gérée. */
export function nextTabIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowRight':
      return Math.min(count - 1, current + 1);
    case 'ArrowLeft':
      return Math.max(0, current - 1);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

export const SWIPE_MIN_DISTANCE = 56;
export const SWIPE_AXIS_RATIO = 1.4;
export const SWIPE_FLICK_SPEED = 0.45; // px/ms

/**
 * +1 = jour suivant (glisser vers la gauche), -1 = jour précédent (vers la
 * droite), 0 = pas de changement. Un geste surtout vertical (défilement) ne
 * change jamais de jour.
 */
export function swipeDirection(dx: number, dy: number, elapsedMs: number): -1 | 0 | 1 {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < absY * SWIPE_AXIS_RATIO) return 0;
  const speed = absX / Math.max(1, elapsedMs);
  if (absX < SWIPE_MIN_DISTANCE && !(absX >= 24 && speed >= SWIPE_FLICK_SPEED)) return 0;
  return dx < 0 ? 1 : -1;
}

const INTERACTIVE =
  'button, input, textarea, select, a, [contenteditable="true"], [role="slider"], [data-hscroll], [data-no-swipe]';

interface SwipeOptions {
  panelRef: RefObject<HTMLElement | null>;
  onSwipe: (direction: -1 | 1) => void;
  enabled: boolean;
}

interface SwipeHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function useDaySwipe({ panelRef, onSwipe, enabled }: SwipeOptions): SwipeHandlers {
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const dragging = useRef(false);

  const reset = useCallback(() => {
    start.current = null;
    dragging.current = false;
    const panel = panelRef.current;
    if (panel) {
      panel.style.transition = prefersReducedMotion()
        ? 'none'
        : 'transform .28s cubic-bezier(.16, 1, .3, 1)';
      panel.style.transform = '';
    }
  }, [panelRef]);

  return useMemo<SwipeHandlers>(
    () => ({
      onPointerDown: (event) => {
        if (!enabled || event.pointerType === 'mouse' || event.button > 0) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest(INTERACTIVE)) return;
        start.current = { x: event.clientX, y: event.clientY, t: event.timeStamp, id: event.pointerId };
        dragging.current = false;
      },
      onPointerMove: (event) => {
        const origin = start.current;
        if (!origin || origin.id !== event.pointerId) return;
        const dx = event.clientX - origin.x;
        const dy = event.clientY - origin.y;
        if (!dragging.current) {
          if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * SWIPE_AXIS_RATIO) return;
          dragging.current = true;
        }
        const panel = panelRef.current;
        if (panel && !prefersReducedMotion()) {
          panel.style.transition = 'none';
          panel.style.transform = `translate3d(${Math.round(dx * 0.35)}px, 0, 0)`;
        }
      },
      onPointerUp: (event) => {
        const origin = start.current;
        if (!origin || origin.id !== event.pointerId) return;
        const direction = swipeDirection(
          event.clientX - origin.x,
          event.clientY - origin.y,
          event.timeStamp - origin.t,
        );
        reset();
        if (direction !== 0) onSwipe(direction);
      },
      onPointerCancel: () => reset(),
    }),
    [enabled, onSwipe, panelRef, reset],
  );
}

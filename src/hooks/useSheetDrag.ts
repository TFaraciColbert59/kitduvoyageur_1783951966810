'use client';

import { useCallback, useRef } from 'react';
import type React from 'react';

/**
 * P1-3 (fin) — drag-to-dismiss des bottom-sheets sans framer-motion.
 * Suit le pointeur vertical (y ≥ 0), ferme au-delà du seuil (la position du
 * doigt est passée à l'animation CSS de sortie via --lkv-sheet-from), sinon
 * retour élastique. Transform appliqué par ref : aucun re-render par frame.
 */
export function useSheetDrag({
  onDismiss,
  threshold = 120,
  disabled = false,
}: {
  onDismiss: () => void;
  threshold?: number;
  disabled?: boolean;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const dragState = useRef<{ startY: number; active: boolean }>({ startY: 0, active: false });

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (disabled) return;
      const target = e.target as HTMLElement;
      // Les contrôles interactifs internes gardent leurs gestes natifs.
      if (target.closest('input, textarea, select, button, a, [data-sheet-no-drag]')) return;
      dragState.current = { startY: e.clientY, active: true };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture optionnelle */
      }
    },
    [disabled]
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const state = dragState.current;
    if (!state.active) return;
    const dy = Math.max(0, e.clientY - state.startY);
    if (panelRef.current) panelRef.current.style.transform = dy ? `translateY(${dy}px)` : '';
  }, []);

  const finish = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const state = dragState.current;
      if (!state.active) return;
      state.active = false;
      const dy = Math.max(0, e.clientY - state.startY);
      const el = panelRef.current;
      if (!el) return;
      if (dy > threshold) {
        // L'anim de fermeture reprend depuis la position du doigt.
        el.style.setProperty('--lkv-sheet-from', `${dy}px`);
        el.style.transform = '';
        onDismiss();
      } else {
        el.style.transition = 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = '';
        window.setTimeout(() => {
          if (el) el.style.transition = '';
        }, 220);
      }
    },
    [onDismiss, threshold]
  );

  return {
    panelRef,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    },
  };
}

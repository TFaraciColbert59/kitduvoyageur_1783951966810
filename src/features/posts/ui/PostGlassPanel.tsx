'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface PostGlassPanelProps {
  side: 'comments' | 'share';
  headerRef?: React.RefObject<HTMLElement | null>;
  topInset?: number;
  onClose: () => void;
  /** Conservé pour compatibilité : les gestes ne basculent plus d'un panneau à l'autre. */
  onSwitch?: (side: 'comments' | 'share') => void;
  children: React.ReactNode;
}

/**
 * Panneau verre partagé (commentaires / partage).
 *
 * - verre unique de la carte, sans seconde couche de blur ;
 * - plein cadre de la carte (406×541) ;
 * - Échap, piège de focus, restitution au déclencheur ;
 * - blur coupé pendant le geste et en reduced-motion ;
 * - gestes : partage ← photo → commentaires. Le geste inverse de celui qui a
 *   ouvert le panneau ramène à la photo (commentaires : vers la droite ; partage :
 *   vers la gauche) ; vers le bas : ferme aussi. Le panneau garde ses gestes pour
 *   lui (aucune propagation à la carte) et un geste ne déclenche qu'une action.
 */
export function PostGlassPanel({
  side,
  headerRef,
  topInset = 64,
  onClose,
  children,
}: PostGlassPanelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const [gesture, setGesture] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const article = root.closest<HTMLElement>('.lkdv-feed-post');
    const header = headerRef?.current;
    if (!article || !header) {
      root.style.setProperty('--post-panel-top', `${topInset}px`);
      return;
    }

    const update = () => {
      const articleRect = article.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const next = Math.max(56, Math.round(headerRect.bottom - articleRect.top + 8));
      root.style.setProperty('--post-panel-top', `${next}px`);
    };

    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(header);
    observer?.observe(article);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [headerRef, topInset]);

  /* Focus : entrée dans le panneau, piège de tabulation, restitution. */
  useEffect(() => {
    const root = rootRef.current;
    const previous = document.activeElement as HTMLElement | null;
    const focusFirst = () => {
      const first = root?.querySelector<HTMLElement>(
        'input, button, textarea, [href], [tabindex]:not([tabindex="-1"])',
      );
      (first ?? root)?.focus?.({ preventScroll: true });
    };
    const timer = window.setTimeout(focusFirst, 20);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const surface = root?.querySelector<HTMLElement>('.lkdv-post-panel');
      const nodes = Array.from(
        (surface ?? root)?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((node) => node.getClientRects().length > 0);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || !root?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <div
      key={side}
      ref={rootRef}
      className="lkdv-post-panel-slot"
      data-side={side}
      data-gesture={gesture ? 'true' : undefined}
      tabIndex={-1}
      style={{ top: 'var(--post-panel-top, 64px)' }}
      onPointerDown={(event) => {
        event.stopPropagation();
        if ((event.target as HTMLElement).closest('button,a,input,textarea')) return;
        pointerStart.current = { x: event.clientX, y: event.clientY };
        setGesture(true);
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        const start = pointerStart.current;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          pointerStart.current = null;
          setGesture(false);
          // Retour à la photo par le geste inverse ; l'autre sens ne fait rien.
          const towardPhoto = side === 'comments' ? dx > 0 : dx < 0;
          if (towardPhoto) onClose();
        }
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        const start = pointerStart.current;
        pointerStart.current = null;
        setGesture(false);
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        const body = (event.target as HTMLElement).closest('.lkdv-post-panel-body') as HTMLElement | null;
        if (dy > 70 && dy > Math.abs(dx) && (!body || body.scrollTop <= 0)) onClose();
      }}
      onPointerCancel={(event) => {
        event.stopPropagation();
        pointerStart.current = null;
        setGesture(false);
      }}
    >
      {children}
    </div>
  );
}

export default PostGlassPanel;

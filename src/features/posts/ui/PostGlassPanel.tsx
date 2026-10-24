'use client';

import React, { useEffect, useRef } from 'react';

export interface PostGlassPanelProps {
  side: 'comments' | 'share';
  headerRef?: React.RefObject<HTMLElement | null>;
  topInset?: number;
  onClose: () => void;
  onSwitch: (side: 'comments' | 'share') => void;
  children: React.ReactNode;
}

/**
 * Panneau verre partagé (commentaires / partage).
 *
 * - reprend le verre exact de la carte Compte via `post-system.css` ;
 * - mesure le header du post et commence 8 px sous lui : la pillule auteur et
 *   le `···` restent visibles et cliquables ;
 * - swipe horizontal : bascule commentaires ↔ partage ;
 * - swipe vers le bas : ferme.
 */
export function PostGlassPanel({
  side,
  headerRef,
  topInset = 64,
  onClose,
  onSwitch,
  children,
}: PostGlassPanelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

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

  return (
    <div
      key={side}
      ref={rootRef}
      className="lkdv-post-panel-slot"
      data-side={side}
      style={{ top: 'var(--post-panel-top, 64px)' }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('button,a,input,textarea')) return;
        pointerStart.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerMove={(event) => {
        const start = pointerStart.current;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          pointerStart.current = null;
          onSwitch(side === 'comments' ? 'share' : 'comments');
        }
      }}
      onPointerUp={(event) => {
        const start = pointerStart.current;
        pointerStart.current = null;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        const body = (event.target as HTMLElement).closest('.lkdv-post-panel-body') as HTMLElement | null;
        if (dy > 70 && dy > Math.abs(dx) && (!body || body.scrollTop <= 0)) onClose();
      }}
    >
      {children}
    </div>
  );
}

export default PostGlassPanel;

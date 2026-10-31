'use client';

import React, { useRef, useState } from 'react';
import { shouldDismiss } from '@/hooks/gestures';
import { OverlaySheet } from './OverlaySheet';

export interface PostSheetProps {
  title: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}

/**
 * Feuille de verre qui porte un post (Compte, Carnet…) : poignée de fermeture
 * par glissement vers le bas, tap sur la poignée, Échap et scrim (OverlaySheet).
 * Le contenu est toujours le bloc `CommunityFeedPost`.
 */
export function PostSheet({ title, onClose, className = '', children }: PostSheetProps) {
  const [dragY, setDragY] = useState(0);
  const [grabbing, setGrabbing] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const didDragRef = useRef(false);
  const startedAt = useRef(0);

  const start = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragStartY.current = event.clientY;
    startedAt.current = performance.now();
    didDragRef.current = false;
    setGrabbing(true);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* optionnel */ }
  };
  const move = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragStartY.current === null) return;
    const distance = Math.max(0, event.clientY - dragStartY.current);
    if (distance > 4) didDragRef.current = true;
    setDragY(distance);
  };
  const end = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragStartY.current === null) return;
    const distance = Math.max(0, event.clientY - dragStartY.current);
    dragStartY.current = null;
    setGrabbing(false);
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* optionnel */ }
    // Mêmes seuils et même flick que toutes les feuilles de l'app (hooks/gestures).
    const elapsed = Math.max(1, performance.now() - startedAt.current);
    if (shouldDismiss(distance, (distance / elapsed) * 1000)) {
      setDragY(520);
      window.setTimeout(onClose, 300);
    } else {
      setDragY(0);
    }
  };

  return (
    <OverlaySheet
      title={title}
      onClose={onClose}
      className={`lkdv-post-drawer lkdv-post-glass-sheet ${className}`.trim()}
      dragY={dragY}
      dragActive={grabbing}
    >
      <button
        type="button"
        className="lkdv-post-grab"
        aria-label="Fermer la publication"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={() => { dragStartY.current = null; setDragY(0); setGrabbing(false); }}
        onClick={() => { if (!didDragRef.current) onClose(); didDragRef.current = false; }}
      />
      <div className="lkdv-account-glass">{children}</div>
    </OverlaySheet>
  );
}

export default PostSheet;

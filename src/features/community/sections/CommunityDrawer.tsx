'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface CommunityDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  ariaLabel?: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/**
 * Demi-tiroir bas 50dvh, même forme que le drawer Profil du Compte :
 * poignée, aucun titre, aucune croix ; fermeture backdrop / Échap / glissement.
 */
export function CommunityDrawer({ open, onClose, title = 'Explorer', children, ariaLabel, onSwipeLeft, onSwipeRight }: CommunityDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [gesture, setGesture] = useState(false);
  const swipeX = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setDragY(0);
    const trigger = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      (panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') || panelRef.current?.querySelector<HTMLElement>('button, input, a'))?.focus();
    }, 50);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => node.getClientRects().length > 0);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      trigger?.focus?.();
    };
  }, [onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="lkdv-drawer-layer">
      <div className="lkdv-drawer-backdrop" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        className="lkdv-half-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title}
        data-gesture={gesture ? 'true' : undefined}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        <div
          className="lkdv-drawer-grab"
          aria-hidden="true"
          onPointerDown={(event) => {
            dragStart.current = event.clientY;
            setGesture(true);
            (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragStart.current === null) return;
            const delta = Math.max(0, event.clientY - dragStart.current);
            setDragY(delta);
          }}
          onPointerUp={(event) => {
            const start = dragStart.current;
            dragStart.current = null;
            const delta = start === null ? 0 : event.clientY - start;
            setGesture(false);
            if (delta > 80) {
              onClose();
              return;
            }
            setDragY(0);
          }}
          onPointerCancel={() => {
            dragStart.current = null;
            setGesture(false);
            setDragY(0);
          }}
        >
          <span />
        </div>
        <div
          className="lkdv-drawer-body"
          onPointerDown={(event) => { swipeX.current = event.clientX; }}
          onPointerUp={(event) => {
            const start = swipeX.current;
            swipeX.current = null;
            if (start === null) return;
            const dx = event.clientX - start;
            if (Math.abs(dx) < 60) return;
            if (dx < 0) onSwipeLeft?.();
            else onSwipeRight?.();
          }}
          onPointerCancel={() => { swipeX.current = null; }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CommunityDrawer;

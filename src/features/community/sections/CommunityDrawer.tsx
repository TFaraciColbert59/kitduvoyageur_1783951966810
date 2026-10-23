'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface CommunityDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  ariaLabel?: string;
}

/**
 * Demi-tiroir bas 50dvh, verre du Compte, poignée, focus et Échap.
 * Tous les bottom drawers de la Communauté utilisent cette coquille.
 */
export function CommunityDrawer({ open, onClose, title, children, headerRight, ariaLabel }: CommunityDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      (panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') || panelRef.current?.querySelector<HTMLElement>('button, input, a'))?.focus();
    }, 50);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

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
      >
        <div className="lkdv-drawer-grab" aria-hidden="true"><span /></div>
        <div className="lkdv-drawer-head">
          <h2>{title}</h2>
          <div className="flex items-center gap-2">
            {headerRight}
            <button type="button" className="lkdv-drawer-close" aria-label="Fermer" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="lkdv-drawer-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export default CommunityDrawer;

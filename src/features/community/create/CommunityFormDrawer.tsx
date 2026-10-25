'use client';

import React, { useContext, useEffect, useRef, useState } from 'react';
import { EmbeddedFormContext } from './EmbeddedFormContext';
import { createPortal } from 'react-dom';

export interface CommunityFormDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  error?: string | null;
  ariaLabel: string;
}

/** Drawer de formulaire 76dvh, forme du drawer Profil : poignée, pas d'en-tête, footer collant. */
export function CommunityFormDrawer({ open, onClose, children, footer, error, ariaLabel }: CommunityFormDrawerProps) {
  const embedded = useContext(EmbeddedFormContext);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (!open || embedded) return;
    setDragY(0);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
    }, 60);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [embedded, onClose, open]);

  if (!open) return null;

  if (embedded) {
    return (
      <>
        <div className="lkdv-embedded-form">
          {error ? <p className="lkdv-form-error" role="alert">{error}</p> : null}
          {children}
        </div>
        <div className="lkdv-form-footer lkdv-embedded-form-footer">{footer}</div>
      </>
    );
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="lkdv-form-layer">
      <div className="lkdv-form-backdrop" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        className="lkdv-form-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        <div
          className="lkdv-form-grab"
          aria-hidden="true"
          onPointerDown={(event) => {
            dragStart.current = event.clientY;
            (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragStart.current === null) return;
            setDragY(Math.max(0, event.clientY - dragStart.current));
          }}
          onPointerUp={(event) => {
            const start = dragStart.current;
            dragStart.current = null;
            const delta = start === null ? 0 : event.clientY - start;
            if (delta > 90) {
              onClose();
              return;
            }
            setDragY(0);
          }}
          onPointerCancel={() => {
            dragStart.current = null;
            setDragY(0);
          }}
        >
          <span />
        </div>
        <div className="lkdv-form-body">
          {error ? <p className="lkdv-form-error" role="alert">{error}</p> : null}
          {children}
        </div>
        <div className="lkdv-form-footer">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}

export default CommunityFormDrawer;

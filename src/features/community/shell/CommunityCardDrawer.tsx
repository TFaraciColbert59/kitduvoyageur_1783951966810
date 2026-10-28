'use client';

import React, { useEffect, useRef } from 'react';
import { useKeyboardInset } from './useKeyboardInset';

export interface CommunityCardDrawerProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  /** Volets sans défilement vertical (étapes qui tiennent dans la carte). */
  strict?: boolean;
  children: React.ReactNode;
}

const SWIPE_CLOSE_PX = 56;

/**
 * Hôte « le drawer EST la carte » de la Communauté.
 *
 * Aucun modal, aucun voile, aucun titre, aucune croix : la carte recouvre la
 * zone stories + fil (`.lkdv-feed-body`) et ne garde que la poignée (18 px)
 * puis la capsule d'onglets du `DrawerShell`. Fermeture : clic ou glissement
 * vers le bas sur la poignée, touche Échap (et re-clic sur l'onglet actif,
 * géré par le contenu).
 */
export function CommunityCardDrawer({ open, onClose, ariaLabel, strict = false, children }: CommunityCardDrawerProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<number | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const keyboardInset = useKeyboardInset(open);

  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => {
      cardRef.current
        ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
        ?.focus({ preventScroll: true });
    }, 60);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      restoreFocus.current?.focus?.({ preventScroll: true });
    };
  }, [onClose, open]);

  if (!open) return null;

  const keyboardOpen = keyboardInset > 0;

  return (
    <div
      ref={cardRef}
      className="lkdv-cd"
      role="dialog"
      aria-label={ariaLabel}
      data-strict={strict ? 'true' : 'false'}
      data-keyboard={keyboardOpen ? 'true' : 'false'}
      style={keyboardOpen ? ({ '--lkdv-cd-kb': `${keyboardInset}px` } as React.CSSProperties) : undefined}
    >
      <button
        type="button"
        className="lkdv-cd-grab"
        aria-label="Fermer"
        onClick={onClose}
        onPointerDown={(event) => {
          dragStart.current = event.clientY;
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerUp={(event) => {
          const start = dragStart.current;
          dragStart.current = null;
          if (start !== null && event.clientY - start > SWIPE_CLOSE_PX) {
            event.preventDefault();
            onClose();
          }
        }}
        onPointerCancel={() => {
          dragStart.current = null;
        }}
      >
        <span aria-hidden="true" />
      </button>
      <div className="lkdv-cd-body">{children}</div>
    </div>
  );
}

export default CommunityCardDrawer;

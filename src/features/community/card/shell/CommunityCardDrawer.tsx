'use client';

import React, { useEffect, useRef } from 'react';
import { useKeyboardInset } from './useKeyboardInset';

export interface CommunityCardDrawerProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  /** Volets sans défilement vertical (étapes qui tiennent dans la carte). */
  strict?: boolean;
  /** Glissement horizontal hors zone qui le gère déjà : onglet suivant ou précédent. */
  onSwipeX?: (direction: 'next' | 'prev') => void;
  children: React.ReactNode;
}

const SWIPE_CLOSE_PX = 56;
/** Glissement vers le bas, n'importe où sur la carte, pour la fermer. */
const DRAG_CLOSE_PX = 90;
const SWIPE_X_PX = 70;
/** Zones qui gardent leurs propres gestes : champs, carte géographique, formulaire en étapes (il glisse seul). */
const OWN_GESTURES = 'input, textarea, select, [contenteditable="true"], .lkdv-carnet-map, .maplibregl-canvas';
const OWN_HORIZONTAL = '.lkdv-wz, .lkdv-drawer-secondary, .lkdv-drawer-topnav';

/** Plus proche ancêtre qui défile vraiment dans l'axe demandé (dans la carte). */
function scrollerOf(start: Element | null, axis: 'x' | 'y', stop: Element | null): HTMLElement | null {
  for (let node = start; node && node !== stop; node = node.parentElement) {
    if (!(node instanceof HTMLElement)) continue;
    const style = window.getComputedStyle(node);
    const overflow = axis === 'x' ? style.overflowX : style.overflowY;
    const scrollable = overflow === 'auto' || overflow === 'scroll';
    if (!scrollable) continue;
    if (axis === 'x' ? node.scrollWidth > node.clientWidth + 2 : node.scrollHeight > node.clientHeight + 2) return node;
  }
  return null;
}

type TouchTrack = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  own: boolean;
  ownX: boolean;
  /** Liste horizontale sous le doigt : déjà au début / à la fin au moment du contact. */
  scrollerX: { atStart: boolean; atEnd: boolean } | null;
  scrolledY: boolean;
};

/**
 * Hôte « le drawer EST la carte » de la Communauté.
 *
 * Aucun modal, aucun voile, aucun titre, aucune croix : la carte recouvre la
 * zone stories + fil (`.lkdv-feed-body`) et ne garde que la poignée (18 px)
 * puis la capsule d'onglets du `DrawerShell`. Fermeture : clic ou glissement
 * vers le bas sur la poignée, touche Échap (et re-clic sur l'onglet actif,
 * géré par le contenu).
 */
export function CommunityCardDrawer({ open, onClose, ariaLabel, strict = false, onSwipeX, children }: CommunityCardDrawerProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<number | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const keyboardInset = useKeyboardInset(open);
  const touch = useRef<TouchTrack | null>(null);

  // La barre du bas native (iOS) s'efface aussi tant qu'une carte est ouverte ; la web est masquée en CSS.
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: true } }));
    return () => {
      window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: false } }));
    };
  }, [open]);

  const resetDrag = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = 'translate 0.24s cubic-bezier(0.32, 0.72, 0, 1)';
    card.style.translate = '';
  };

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) {
      touch.current = null;
      resetDrag();
      return;
    }
    const point = event.touches[0];
    const target = event.target as Element;
    const scroller = scrollerOf(target, 'x', cardRef.current);
    const scrollerY = scrollerOf(target, 'y', cardRef.current);
    touch.current = {
      x: point.clientX,
      y: point.clientY,
      dx: 0,
      dy: 0,
      own: Boolean(target.closest(OWN_GESTURES)),
      ownX: Boolean(target.closest(OWN_HORIZONTAL)),
      scrollerX: scroller
        ? { atStart: scroller.scrollLeft <= 2, atEnd: scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2 }
        : null,
      scrolledY: Boolean(scrollerY && scrollerY.scrollTop > 0),
    };
  };

  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const track = touch.current;
    const point = event.touches[0];
    if (!track || !point) return;
    track.dx = point.clientX - track.x;
    track.dy = point.clientY - track.y;
    // La carte suit le doigt vers le bas (retenue), puis se ferme ou revient au relâchement.
    if (!track.own && !track.scrolledY && track.dy > 8 && track.dy > Math.abs(track.dx) * 1.2) {
      const card = cardRef.current;
      if (card) {
        card.style.transition = 'none';
        card.style.translate = `0 ${Math.round(track.dy * 0.55)}px`;
      }
    }
  };

  const onTouchEnd = () => {
    const track = touch.current;
    touch.current = null;
    if (!track) return;
    const { dx, dy } = track;
    if (!track.own && !track.scrolledY && dy > DRAG_CLOSE_PX && dy > Math.abs(dx) * 1.2) {
      onClose();
      return;
    }
    resetDrag();
    if (!onSwipeX || track.own || track.ownX) return;
    if (Math.abs(dx) < SWIPE_X_PX || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    const direction = dx < 0 ? 'next' : 'prev';
    // Une liste horizontale garde le geste tant qu'elle peut encore défiler dans ce sens.
    if (track.scrollerX && !(direction === 'next' ? track.scrollerX.atEnd : track.scrollerX.atStart)) return;
    onSwipeX(direction);
  };

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
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        touch.current = null;
        resetDrag();
      }}
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

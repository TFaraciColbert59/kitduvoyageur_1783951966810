'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Eye } from 'lucide-react';

export const SheetPreviewContext = createContext<HTMLElement | null>(null);

function findActiveScrollPane(from: HTMLElement | null): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const sheet = from?.closest('.lkdv-cv2-sheet') ?? document.querySelector('.lkdv-cv2-sheet');
  if (!sheet) return null;
  return (
    sheet.querySelector<HTMLElement>(
      '.lkdv-cv2-pane[data-active="true"], .lkdv-lens-pane, .lkdv-cv2c-ps-scroll',
    ) ?? sheet.querySelector<HTMLElement>('.lkdv-cv2-pane')
  );
}

function isPreviewInteractiveDragTarget(target: EventTarget | null): boolean {
  const el = target instanceof HTMLElement ? target : null;
  if (!el) return false;
  return Boolean(
    el.closest(
      'input[type="range"], [data-story-draggable], .lkdv-photo-thumb-remove, .lkdv-photo-jiggle-done, .lkdv-cv2c-map-canvas',
    ),
  );
}

/** Cible rendue par `CommunitySheetShell` entre la capsule et le pager. */
export function SheetPreviewSlot({
  slotRef,
}: {
  slotRef: (element: HTMLDivElement | null) => void;
}) {
  const localRef = useRef<HTMLDivElement | null>(null);

  const setRefs = useCallback(
    (element: HTMLDivElement | null) => {
      localRef.current = element;
      slotRef(element);
    },
    [slotRef],
  );

  // Permet de faire défiler tout le contenu du drawer quand on scrolle verticalement sur l'aperçu
  useEffect(() => {
    const slot = localRef.current;
    if (!slot) return undefined;

    let startX = 0;
    let startY = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocityY = 0;
    let tracking = false;
    let isVerticalScroll = false;
    let inertiaFrame: number | null = null;

    const stopInertia = () => {
      if (inertiaFrame !== null) {
        cancelAnimationFrame(inertiaFrame);
        inertiaFrame = null;
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const pane = findActiveScrollPane(slot);
      if (!pane) return;
      pane.scrollTop += event.deltaY;
      document.dispatchEvent(
        new CustomEvent('lkdv-preview-vertical-drag', {
          detail: {
            dy: event.deltaY,
            totalDy: event.deltaY,
            scrollTop: pane.scrollTop,
          },
        }),
      );
    };

    const onTouchStart = (event: TouchEvent) => {
      stopInertia();
      if (event.touches.length !== 1 || isPreviewInteractiveDragTarget(event.target)) {
        tracking = false;
        isVerticalScroll = false;
        return;
      }
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      lastY = touch.clientY;
      lastTime = performance.now();
      velocityY = 0;
      tracking = true;
      isVerticalScroll = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!tracking || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const totalDx = touch.clientX - startX;
      const totalDy = startY - touch.clientY; // > 0 : doigt monte => défilement vers le bas du drawer
      if (!isVerticalScroll) {
        if (Math.abs(totalDx) > 10 && Math.abs(totalDx) > Math.abs(totalDy)) {
          tracking = false;
          return;
        }
        if (Math.abs(totalDy) > 6 && Math.abs(totalDy) >= Math.abs(totalDx)) {
          isVerticalScroll = true;
        } else {
          return;
        }
      }

      const pane = findActiveScrollPane(slot);
      if (!pane) return;

      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      const dy = lastY - touch.clientY;
      lastY = touch.clientY;
      lastTime = now;
      velocityY = 0.7 * (dy / dt) + 0.3 * velocityY;

      if (event.cancelable) {
        event.preventDefault();
      }
      event.stopPropagation();

      pane.scrollTop += dy;
      document.dispatchEvent(
        new CustomEvent('lkdv-preview-vertical-drag', {
          detail: {
            dy,
            totalDy,
            scrollTop: pane.scrollTop,
          },
        }),
      );
    };

    const onTouchEnd = () => {
      if (!tracking || !isVerticalScroll) {
        tracking = false;
        isVerticalScroll = false;
        return;
      }
      tracking = false;
      isVerticalScroll = false;

      const pane = findActiveScrollPane(slot);
      if (!pane || Math.abs(velocityY) < 0.15) return;

      let v = velocityY * 16; // px par frame (~16ms)
      const step = () => {
        if (Math.abs(v) < 0.6) {
          inertiaFrame = null;
          return;
        }
        const prev = pane.scrollTop;
        pane.scrollTop += v;
        if (Math.abs(pane.scrollTop - prev) < 0.2 && v < 0) {
          inertiaFrame = null;
          return;
        }
        v *= 0.92;
        inertiaFrame = requestAnimationFrame(step);
      };
      inertiaFrame = requestAnimationFrame(step);
    };

    slot.addEventListener('wheel', onWheel, { passive: true });
    slot.addEventListener('touchstart', onTouchStart, { passive: true });
    slot.addEventListener('touchmove', onTouchMove, { passive: false });
    slot.addEventListener('touchend', onTouchEnd, { passive: true });
    slot.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      stopInertia();
      slot.removeEventListener('wheel', onWheel);
      slot.removeEventListener('touchstart', onTouchStart);
      slot.removeEventListener('touchmove', onTouchMove);
      slot.removeEventListener('touchend', onTouchEnd);
      slot.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  return (
    <div
      ref={setRefs}
      className="lkdv-cv2-preview-slot"
      data-testid="cv2-preview-slot"
      data-no-swipe=""
      data-vaul-no-drag=""
      role="group"
      aria-label="Aperçu en direct"
    />
  );
}

export interface SheetPreviewSummary {
  icon?: ReactNode;
  title: string;
  meta?: string;
  badge?: string;
}

/**
 * Bandeau résumé 1 ligne dépliable (ou carte complète) dans l'emplacement fixe
 * de la coque (`CommunitySheetShell`). En mode compact, affiche une barre
 * claire de 44 px avec bouton « Aperçu » pour éviter de couper les cartes ou
 * d'écraser le formulaire sur mobile.
 */
export function SheetPreview({
  children,
  compact = false,
  summary,
}: {
  children: ReactNode;
  compact?: boolean;
  summary?: SheetPreviewSummary;
}) {
  const host = useContext(SheetPreviewContext);
  const [expanded, setExpanded] = useState(false);
  if (!host) return null;

  const showCollapsedBar = compact && !expanded && Boolean(summary);

  return createPortal(
    <div
      className="lkdv-cv2-preview-frame"
      data-compact={showCollapsedBar ? 'true' : undefined}
      data-expanded={compact && expanded ? 'true' : undefined}
    >
      {showCollapsedBar && summary ? (
        <div className="lkdv-cv2c-preview-bar">
          {summary.icon ? (
            <span className="lkdv-cv2c-preview-bar-ico" aria-hidden="true">
              {summary.icon}
            </span>
          ) : null}
          <span className="lkdv-cv2c-preview-bar-txt">
            <b>{summary.title}</b>
            {summary.meta ? <small>{summary.meta}</small> : null}
          </span>
          {summary.badge ? <span className="lkdv-cv2c-preview-bar-badge">{summary.badge}</span> : null}
          <button
            type="button"
            className="lkdv-cv2c-preview-toggle"
            aria-expanded={false}
            onClick={() => setExpanded(true)}
          >
            <Eye size={13} aria-hidden="true" />
            Aperçu
            <ChevronDown size={13} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <>
          {compact ? (
            <div className="lkdv-cv2c-preview-collapse-row">
              <button
                type="button"
                className="lkdv-cv2c-preview-toggle"
                aria-expanded={true}
                onClick={() => setExpanded(false)}
              >
                Masquer l’aperçu
                <ChevronDown
                  size={13}
                  aria-hidden="true"
                  style={{ transform: 'rotate(180deg)' }}
                />
              </button>
            </div>
          ) : null}
          {children}
        </>
      )}
    </div>,
    host,
  );
}

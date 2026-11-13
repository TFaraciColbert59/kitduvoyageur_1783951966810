'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { XpIcon } from '../ui/XpIcon';
import type { Detent } from '../state/types';
import {
  clampDragHeight,
  decideAxis,
  lowHeight,
  resolveSheetRelease,
  velocityFromSamples,
  type SheetSample,
} from './sheetGesture';

export interface SheetTab {
  id: string;
  label: string;
  icon: string;
  render: () => React.ReactNode;
}

export interface ExplorerSheetProps {
  title: string;
  subtitle?: string | null;
  tabs?: SheetTab[];
  tab: number;
  onTab: (index: number) => void;
  detent: Detent;
  onDetent: (detent: Detent) => void;
  onHaptic?: (event: 'sheet-open' | 'tab') => void;
  actions?: React.ReactNode;
  onBack?: () => void;
  /** Mini-sélecteur bas droite (Région, Lieu, Itinéraire uniquement). */
  mini?: { items: Array<{ id: string; label: string; icon: string }>; value: number; onChange: (i: number) => void } | null;
  /** Barre basse occupée (px) : la feuille s'arrête au-dessus. */
  bottomInset?: number;
  children?: React.ReactNode;
  labelledBy?: string;
  /** Capsule d'onglets ancrée en bas de la feuille (écran Monde). */
  tabsBottom?: boolean;
  /** Appelé quand la sortie est terminée. `restoreFocus` : le focus était dans la feuille ou la sortie vient du clavier. */
  onClose?: (info?: { restoreFocus: boolean }) => void;
  /** Appelé dès le début de la sortie (la pilule et la barre d'onglets peuvent réapparaître). */
  onClosing?: () => void;
  /** Change de valeur pour annuler une sortie en cours (la feuille remonte au cran courant). */
  cancelCloseSignal?: number;
}

/** Durée de l'animation de sortie (ms) ; doit suivre `.xp-sheet[data-closing]` dans explorer-v2.css. */
const CLOSE_ANIMATION_MS = 320;

function isInteractive(target: EventTarget | null) {
  return target instanceof Element && target.closest('button, a, input, select, textarea, [role="tab"]') !== null;
}

function heightsFor(viewport: number, _bottomInset: number) {
  // Strictement deux points d'arrêt : Minimum 30 % et Maximum 90 %
  const minH = Math.round(viewport * 0.30);
  const maxH = Math.round(viewport * 0.90);
  return {
    peek: minH,
    low: minH,
    mid: maxH,
    full: maxH,
  } as Record<Detent, number>;
}

export function ExplorerSheet({
  title,
  subtitle,
  tabs,
  tab,
  onTab,
  detent,
  onDetent,
  onHaptic,
  actions,
  onBack,
  mini,
  bottomInset = 64,
  children,
  labelledBy,
  tabsBottom = false,
  onClose,
  onClosing,
  cancelCloseSignal,
}: ExplorerSheetProps) {
  const [viewport, setViewport] = useState(844);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  /** Hauteur figée pendant l'animation de sortie (la feuille glisse vers le bas, puis `onClose`). */
  const [closeFrom, setCloseFrom] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    axis: 'pending' | 'vertical' | 'horizontal';
    startHeight: number;
    startDetent: Detent;
    lastY: number;
    lastHeight: number;
    samples: SheetSample[];
    active: boolean;
    captured: boolean;
  } | null>(null);

  useEffect(() => {
    const read = () =>
      setViewport(
        typeof window === 'undefined' ? 844 : Math.round(window.visualViewport?.height ?? window.innerHeight),
      );
    read();
    window.addEventListener('resize', read);
    window.visualViewport?.addEventListener?.('resize', read);
    return () => {
      window.removeEventListener('resize', read);
      window.visualViewport?.removeEventListener?.('resize', read);
    };
  }, []);

  const heights = useMemo(() => heightsFor(viewport, bottomInset), [viewport, bottomInset]);
  const targetHeight = heights[detent];
  const height = closeFrom ?? dragHeight ?? targetHeight;
  const lowH = lowHeight(heights);

  // Les écouteurs natifs (tactile sur le contenu) lisent toujours les dernières valeurs.
  const latest = useRef({ heights, detent, height, onClose, onClosing, onDetent, onHaptic });
  latest.current = { heights, detent, height, onClose, onClosing, onDetent, onHaptic };

  const closingRef = useRef(false);
  const keyboardCloseRef = useRef(false);
  const startClose = useCallback((fromHeight: number) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setDragHeight(null);
    setCloseFrom(Math.max(1, Math.round(fromHeight)));
    latest.current.onClosing?.();
  }, []);

  // Annulation de la sortie (tap sur la pilule pendant la glissade) : la feuille remonte.
  useEffect(() => {
    closingRef.current = false;
    keyboardCloseRef.current = false;
    setCloseFrom(null);
  }, [cancelCloseSignal]);

  // Sortie : la feuille glisse vers le bas (transform), puis `onClose`.
  useEffect(() => {
    if (closeFrom === null) return undefined;
    const reduced =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const timer = window.setTimeout(() => {
      const section = sectionRef.current;
      const restoreFocus =
        keyboardCloseRef.current ||
        (section !== null && document.activeElement instanceof Node && section.contains(document.activeElement));
      latest.current.onClose?.({ restoreFocus });
    }, reduced ? 0 : CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [closeFrom]);

  const beginDrag = useCallback((x: number, y: number, t: number) => {
    const { height: current, detent: startDetent } = latest.current;
    dragRef.current = {
      startX: x,
      startY: y,
      axis: 'pending',
      startHeight: current,
      startDetent,
      lastY: y,
      lastHeight: current,
      samples: [{ y, t }],
      active: false,
      captured: false,
    };
  }, []);

  /** Renvoie vrai quand le geste est (devenu) un glissement. */
  const moveDrag = useCallback((x: number, y: number, t: number): boolean => {
    const drag = dragRef.current;
    if (!drag) return false;
    const dy = y - drag.startY;
    if (!drag.active) {
      // Axe verrouillé au premier franchissement du seuil : un geste horizontal n'est pas pour la feuille.
      if (drag.axis === 'pending') drag.axis = decideAxis(x - drag.startX, dy);
      if (drag.axis !== 'vertical') return false;
      drag.active = true;
    }
    drag.samples.push({ y, t });
    if (drag.samples.length > 16) drag.samples.shift();
    drag.lastY = y;
    // La feuille suit le doigt, y compris sous le cran bas.
    drag.lastHeight = clampDragHeight(drag.startHeight - dy, latest.current.heights);
    setDragHeight(drag.lastHeight);
    return true;
  }, []);

  /** Termine le geste. Renvoie 'tap' si le doigt n'a pas bougé. */
  const finishDrag = useCallback(
    (t: number): 'tap' | 'done' | 'none' => {
      const drag = dragRef.current;
      if (!drag) return 'none';
      dragRef.current = null;
      if (!drag.active) return drag.axis === 'horizontal' ? 'none' : 'tap';
      const { heights: h, onClose: close, onDetent: setDetent } = latest.current;
      // Un doigt arrêté avant de lâcher ne lance pas la feuille.
      const samples = [...drag.samples, { y: drag.lastY, t: Math.max(t, drag.samples[drag.samples.length - 1].t) }];
      const release = resolveSheetRelease({
        height: drag.lastHeight,
        velocity: velocityFromSamples(samples),
        heights: h,
        current: drag.startDetent,
        canClose: Boolean(close),
      });
      if (release === 'close') {
        startClose(drag.lastHeight);
      } else {
        setDragHeight(null);
        if (release !== drag.startDetent) setDetent(release);
      }
      return 'done';
    },
    [startClose],
  );

  const toggleDetent = useCallback(() => {
    const { heights: h, height: current, onDetent: setDetent } = latest.current;
    setDetent(current <= lowHeight(h) + 1 ? 'full' : 'peek');
  }, []);

  const onGrabPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (closeFrom !== null) return;
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      const onHandle = event.target instanceof Element && event.target.closest('.xp-sheet-handle') !== null;
      if (!onHandle && isInteractive(event.target)) return;
      beginDrag(event.clientX, event.clientY, event.timeStamp);
    },
    [beginDrag, closeFrom],
  );

  const onGrabPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (moveDrag(event.clientX, event.clientY, event.timeStamp) && !drag.captured) {
        drag.captured = true;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Pointeur synthétique (tests) : la capture n'est pas disponible.
        }
      }
    },
    [moveDrag],
  );

  const onGrabPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const result = finishDrag(event.timeStamp);
      try {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // idem
      }
      if (result === 'tap' && event.type === 'pointerup') {
        const onHandle = event.target instanceof Element && event.target.closest('.xp-sheet-handle') !== null;
        if (onHandle) {
          latest.current.onHaptic?.('sheet-open');
          toggleDetent();
        }
      }
    },
    [finishDrag, toggleDetent],
  );

  // Contenu défilant : un glissement vers le bas ne pilote la feuille que si le contenu
  // est en haut de son défilement. Écouteurs natifs : React pose `touchmove` en passif,
  // or il faut pouvoir annuler le défilement natif.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    let scroller: HTMLElement | null = null;
    let armed = false;
    let startX = 0;
    let startY = 0;
    let dragging = false;

    const onStart = (event: TouchEvent) => {
      armed = false;
      dragging = false;
      const target = event.target instanceof Element ? event.target : null;
      scroller = target?.closest<HTMLElement>('.xp-sheet-scroll') ?? null;
      if (!scroller || event.touches.length !== 1) return;
      armed = scroller.scrollTop <= 0;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    };
    const onMove = (event: TouchEvent) => {
      if (!scroller || event.touches.length !== 1) return;
      const x = event.touches[0].clientX;
      const y = event.touches[0].clientY;
      if (!dragging) {
        if (!armed) return;
        const dy = y - startY;
        const axis = decideAxis(x - startX, dy);
        if (axis === 'pending') return;
        // Horizontal (carrousel) ou vers le haut ou contenu défilé : le contenu garde le geste.
        if (axis === 'horizontal' || dy < 0 || scroller.scrollTop > 0) {
          armed = false;
          return;
        }
        dragging = true;
        beginDrag(x, y, event.timeStamp);
        if (dragRef.current) {
          dragRef.current.axis = 'vertical';
          dragRef.current.active = true;
        }
        return;
      }
      if (event.cancelable) event.preventDefault();
      moveDrag(x, y, event.timeStamp);
    };
    const onEnd = (event: TouchEvent) => {
      armed = false;
      if (!dragging) return;
      dragging = false;
      finishDrag(event.timeStamp);
    };

    section.addEventListener('touchstart', onStart, { passive: true });
    section.addEventListener('touchmove', onMove, { passive: false });
    section.addEventListener('touchend', onEnd);
    section.addEventListener('touchcancel', onEnd);
    return () => {
      section.removeEventListener('touchstart', onStart);
      section.removeEventListener('touchmove', onMove);
      section.removeEventListener('touchend', onEnd);
      section.removeEventListener('touchcancel', onEnd);
    };
  }, [beginDrag, moveDrag, finishDrag]);

  const onSectionKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !onClose) return;
      event.preventDefault();
      keyboardCloseRef.current = true;
      startClose(latest.current.height);
    },
    [onClose, startClose],
  );

  const onHandleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Deux crans seulement (30 % et 90 %) : une flèche monte ou descend d'un cran.
      if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
        event.preventDefault();
        onDetent('full');
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
        event.preventDefault();
        onDetent('peek');
      } else if (event.key === 'Home') {
        event.preventDefault();
        onDetent('peek');
      } else if (event.key === 'End') {
        event.preventDefault();
        onDetent('full');
      }
    },
    [onDetent],
  );

  const activeTab = tabs?.[tab];
  const grab = {
    onPointerDown: onGrabPointerDown,
    onPointerMove: onGrabPointerMove,
    onPointerUp: onGrabPointerEnd,
    onPointerCancel: onGrabPointerEnd,
  };

  return (
    <section
      ref={sectionRef}
      className="xp-sheet"
      data-detent={detent}
      data-dragging={dragHeight === null ? 'false' : 'true'}
      data-closing={closeFrom === null ? 'false' : 'true'}
      style={{ height: `${height}px` }}
      aria-label={labelledBy ? undefined : title}
      aria-labelledby={labelledBy}
      role="region"
      onKeyDown={onSectionKeyDown}
    >
      <div
        className="xp-sheet-handle"
        role="button"
        tabIndex={0}
        aria-label="Ajuster la hauteur du tiroir"
        aria-expanded={targetHeight > lowH + 1}
        onKeyDown={onHandleKeyDown}
        {...grab}
      >
        <span />
      </div>

      <header className="xp-sheet-head" {...grab}>
        <div className="xp-sheet-headtext">
          <h2 className="xp-sheet-title" id={labelledBy} title={title}>
            {title}
          </h2>
          {subtitle ? <p className="xp-sheet-sub">{subtitle}</p> : null}
        </div>
        <div className="xp-head-actions">
          {actions}
          {onBack ? (
            <button type="button" className="xp-round-glass" onClick={onBack} aria-label="Retour">
              <XpIcon name="chevl" size={17} />
            </button>
          ) : null}
        </div>
      </header>

      <div className="xp-sheet-body">
        {tabs && tabs.length > 1 && !tabsBottom ? (
          <div
            className="xp-tabs"
            role="tablist"
            aria-label="Sections"
            style={{ '--n': tabs.length } as React.CSSProperties}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              event.preventDefault();
              const next = event.key === 'ArrowRight' ? (tab + 1) % tabs.length : (tab - 1 + tabs.length) % tabs.length;
              onTab(next);
              onHaptic?.('tab');
            }}
          >
            <span className="xp-tab-lens" aria-hidden="true" style={{ '--i': tab } as React.CSSProperties} />
            {tabs.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                className="xp-tab"
                id={`xp-tab-${item.id}`}
                aria-selected={index === tab}
                aria-label={item.label}
                aria-controls={`xp-panel-${item.id}`}
                tabIndex={index === tab ? 0 : -1}
                onClick={() => {
                  onTab(index);
                  onHaptic?.('tab');
                }}
              >
                <XpIcon name={item.icon} size={17} />
                <span className="xp-tab-label">{item.label}</span>
              </button>
            ))}
          </div>
        ) : null}

        {activeTab ? (
          <div
            className="xp-sheet-scroll"
            role="tabpanel"
            tabIndex={0}
            id={`xp-panel-${activeTab.id}`}
            aria-labelledby={`xp-tab-${activeTab.id}`}
            key={activeTab.id}
          >
            {activeTab.render()}
          </div>
        ) : (
          <div className="xp-sheet-scroll" tabIndex={0} aria-label={`Contenu : ${title}`}>
            {children}
          </div>
        )}

        {tabs && tabs.length > 1 && tabsBottom ? (
          <div
            className="xp-tabs xp-tabs-bottom"
            role="tablist"
            aria-label="Sections"
            style={{ '--n': tabs.length } as React.CSSProperties}
          >
            <span className="xp-tab-lens" aria-hidden="true" style={{ '--i': tab } as React.CSSProperties} />
            {tabs.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                className="xp-tab"
                id={`xp-tab-b-${item.id}`}
                aria-selected={index === tab}
                aria-label={item.label}
                tabIndex={index === tab ? 0 : -1}
                onClick={() => {
                  onTab(index);
                  onHaptic?.('tab');
                }}
              >
                <XpIcon name={item.icon} size={17} />
                <span className="xp-tab-label">{item.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {mini && mini.items.length > 1 ? (
        <div className="xp-mini">
          <div
            className="xp-mini-inner"
            role="tablist"
            aria-label="Affichage"
            style={{ '--n': mini.items.length } as React.CSSProperties}
          >
            <span className="xp-mini-thumb" aria-hidden="true" style={{ '--i': mini.value } as React.CSSProperties} />
            {mini.items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={index === mini.value}
                aria-label={item.label}
                title={item.label}
                onClick={() => mini.onChange(index)}
              >
                <XpIcon name={item.icon} size={15} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

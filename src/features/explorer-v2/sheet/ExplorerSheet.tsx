'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { XpIcon } from '../ui/XpIcon';
import type { Detent } from '../state/types';

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
  onClose?: () => void;
  /**
   * Trois hauteurs nettes (aperçu, moitié, plein) au lieu de deux : la moitié laisse la carte lisible.
   * Facultatif et désactivé par défaut : les autres écrans gardent leurs deux crans.
   */
  threeDetents?: boolean;
}

const PEEK = 176;
const LOW = 300;

const DETENTS: Detent[] = ['peek', 'low', 'mid', 'full'];
const THREE_DETENTS: Detent[] = ['peek', 'mid', 'full'];

function heightsFor(viewport: number, _bottomInset: number, three = false) {
  // Sur iPhone 16 Pro, safe-area-inset-top + .xp-chrome requiert au moins ~148px de dégagement pour éviter la collision
  const topClearance = 148;
  const minH = Math.max(248, Math.round(viewport * 0.32));
  const maxH = Math.max(minH + 40, Math.min(Math.round(viewport * 0.85), viewport - topClearance));
  if (three) {
    // Aperçu : l'en-tête et la capsule d'onglets ; moitié : la carte reste lisible ; plein : le maximum.
    const peek = Math.min(190, Math.max(150, Math.round(viewport * 0.2)));
    const mid = Math.min(maxH - 60, Math.max(peek + 90, Math.round(viewport * 0.5)));
    return { peek, low: mid, mid, full: maxH } as Record<Detent, number>;
  }
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
  threeDetents = false,
}: ExplorerSheetProps) {
  const [viewport, setViewport] = useState(844);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startHeight: number; lastY: number; lastT: number; velocity: number } | null>(
    null,
  );

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

  const heights = useMemo(() => heightsFor(viewport, bottomInset, threeDetents), [viewport, bottomInset, threeDetents]);
  const detents = threeDetents ? THREE_DETENTS : DETENTS;
  // En trois crans, « low » (ancien cran) vaut « moitié ».
  const shownDetent: Detent = threeDetents && detent === 'low' ? 'mid' : detent;
  const targetHeight = heights[shownDetent];
  const height = dragHeight ?? targetHeight;

  const setDetentFromHeight = useCallback(
    (next: number, velocity: number) => {
      if (threeDetents) {
        // Relâchement : le cran le plus proche, ou le voisin dans le sens du geste s'il est vif.
        const index = THREE_DETENTS.indexOf(shownDetent);
        if (velocity < -0.3) return onDetent(THREE_DETENTS[Math.min(2, index + 1)]);
        if (velocity > 0.3) {
          if (index === 0 && onClose) return onClose();
          return onDetent(THREE_DETENTS[Math.max(0, index - 1)]);
        }
        if (next < heights.peek * 0.82 && onClose) return onClose();
        const nearest = THREE_DETENTS.reduce((best, d) =>
          Math.abs(heights[d] - next) < Math.abs(heights[best] - next) ? d : best
        );
        return onDetent(nearest);
      }
      // Relâchement : strictement deux crans (30 % min et 90 % max)
      const minH = heights.low;
      const maxH = heights.full;
      const midpoint = (minH + maxH) / 2;

      if (velocity < -0.3) {
        return onDetent('full');
      }
      if (velocity > 0.3) {
        if (next < minH * 0.65 && onClose) {
          return onClose();
        }
        return onDetent('low');
      }
      if (next < minH * 0.65 && onClose) {
        return onClose();
      }
      onDetent(next >= midpoint ? 'full' : 'low');
    },
    [heights, onClose, onDetent, shownDetent, threeDetents],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      const target = event.currentTarget as HTMLElement;
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Pointeur synthétique (tests) : la capture n'est pas disponible.
      }
      dragRef.current = {
        startY: event.clientY,
        startHeight: height,
        lastY: event.clientY,
        lastT: event.timeStamp,
        velocity: 0,
      };
      onHaptic?.('sheet-open');
    },
    [height, onHaptic],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dy = drag.startY - event.clientY;
      const next = Math.min(heights.full, Math.max(heights.peek * 0.82, drag.startHeight + dy));
      const dt = Math.max(1, event.timeStamp - drag.lastT);
      drag.velocity = (drag.lastY - event.clientY) / dt;
      drag.lastY = event.clientY;
      drag.lastT = event.timeStamp;
      setDragHeight(next);
    },
    [heights.full, heights.peek],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      const finalHeight = dragHeight ?? drag.startHeight;
      setDragHeight(null);
      if (Math.abs(finalHeight - drag.startHeight) < 2) {
        // Un simple toucher sur la poignée fait monter d'un cran (et revient à l'aperçu depuis le plein).
        const index = detents.indexOf(shownDetent);
        onDetent(detents[index >= detents.length - 1 && threeDetents ? 0 : Math.min(detents.length - 1, index + 1)]);
        return;
      }
      setDetentFromHeight(finalHeight, drag.velocity);
      try {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // idem
      }
    },
    [detents, dragHeight, onDetent, setDetentFromHeight, shownDetent, threeDetents],
  );

  const onHandleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const index = detents.indexOf(shownDetent);
      if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
        event.preventDefault();
        onDetent(detents[Math.min(detents.length - 1, index + 1)]);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
        event.preventDefault();
        onDetent(detents[Math.max(0, index - 1)]);
      } else if (event.key === 'Home') {
        event.preventDefault();
        onDetent('peek');
      } else if (event.key === 'End') {
        event.preventDefault();
        onDetent('full');
      }
    },
    [detents, onDetent, shownDetent],
  );

  const safeTab = tabs && tabs.length > 0 ? Math.min(Math.max(0, tab), tabs.length - 1) : 0;
  const activeTab = tabs?.[safeTab];
  const grab = {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  return (
    <section
      className="xp-sheet"
      data-detent={shownDetent}
      data-dragging={dragHeight === null ? 'false' : 'true'}
      style={{ height: `${height}px` }}
      aria-label={labelledBy ? undefined : title}
      aria-labelledby={labelledBy}
      role="region"
    >
      <div
        className="xp-sheet-handle"
        role="button"
        tabIndex={0}
        aria-label="Ajuster la hauteur du tiroir"
        aria-expanded={shownDetent !== 'peek'}
        onKeyDown={onHandleKeyDown}
        {...grab}
      >
        <span />
      </div>

      <header className="xp-sheet-head">
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
          {onClose ? (
            <button type="button" className="xp-round-glass" onClick={onClose} aria-label="Fermer">
              <XpIcon name="x" size={16} />
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
            <span className="xp-tab-lens" aria-hidden="true" style={{ '--i': safeTab } as React.CSSProperties} />
            {tabs.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                className="xp-tab"
                id={`xp-tab-${item.id}`}
                aria-selected={index === safeTab}
                aria-label={item.label}
                aria-controls={`xp-panel-${item.id}`}
                tabIndex={index === safeTab ? 0 : -1}
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
            <span className="xp-tab-lens" aria-hidden="true" style={{ '--i': safeTab } as React.CSSProperties} />
            {tabs.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                className="xp-tab"
                id={`xp-tab-b-${item.id}`}
                aria-selected={index === safeTab}
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

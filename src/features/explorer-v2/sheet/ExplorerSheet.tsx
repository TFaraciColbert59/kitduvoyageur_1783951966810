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
}

const PEEK = 176;
const LOW = 300;

const DETENTS: Detent[] = ['peek', 'low', 'mid', 'full'];

function heightsFor(viewport: number, bottomInset: number) {
  const available = Math.max(240, viewport - bottomInset);
  return {
    peek: PEEK,
    low: Math.min(LOW, available * 0.5),
    mid: Math.round(available * 0.52),
    full: Math.round(available * 0.88),
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

  const heights = useMemo(() => heightsFor(viewport, bottomInset), [viewport, bottomInset]);
  const targetHeight = heights[detent];
  const height = dragHeight ?? targetHeight;

  const setDetentFromHeight = useCallback(
    (next: number, velocity: number) => {
      // Relâchement : cran le plus proche, arbitré par la vitesse.
      if (velocity < -0.6) {
        const index = DETENTS.indexOf(detent);
        return onDetent(DETENTS[Math.min(DETENTS.length - 1, index + 1)]);
      }
      if (velocity > 0.6) {
        const index = DETENTS.indexOf(detent);
        return onDetent(DETENTS[Math.max(0, index - 1)]);
      }
      let best: Detent = 'peek';
      let bestDelta = Number.POSITIVE_INFINITY;
      for (const candidate of DETENTS) {
        const delta = Math.abs(heights[candidate] - next);
        if (delta < bestDelta) {
          bestDelta = delta;
          best = candidate;
        }
      }
      onDetent(best);
    },
    [detent, heights, onDetent],
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
        // Un simple toucher sur la poignée fait monter d'un cran.
        const index = DETENTS.indexOf(detent);
        onDetent(DETENTS[Math.min(DETENTS.length - 1, index + 1)]);
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
    [detent, dragHeight, onDetent, setDetentFromHeight],
  );

  const onHandleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const index = DETENTS.indexOf(detent);
      if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
        event.preventDefault();
        onDetent(DETENTS[Math.min(DETENTS.length - 1, index + 1)]);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
        event.preventDefault();
        onDetent(DETENTS[Math.max(0, index - 1)]);
      } else if (event.key === 'Home') {
        event.preventDefault();
        onDetent('peek');
      } else if (event.key === 'End') {
        event.preventDefault();
        onDetent('full');
      }
    },
    [detent, onDetent],
  );

  const activeTab = tabs?.[tab];
  const grab = {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  return (
    <section
      className="xp-sheet"
      data-detent={detent}
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
        aria-expanded={detent !== 'peek'}
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

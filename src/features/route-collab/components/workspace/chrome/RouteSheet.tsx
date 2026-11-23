'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { XpIcon } from '@/features/explorer-v2/ui/XpIcon';
import { Flow } from '@/features/compas/v5/ui/primitives';
import { V5Icon, type V5IconName } from '@/features/compas/v5/ui/icons';
import { SheetShell } from '@/features/compas/v5/ui/SheetShell';
import {
  SHEET_DETENTS,
  detentFromKey,
  detentHeights,
  nextDetentOnTap,
  settleDetent,
  shownDetent,
  type SheetDetent,
} from '@/features/compas/v5/ui/sheetDetents';
import { V5Scope } from '../ui/V5Scope';

export interface RouteSheetTab {
  id: string;
  label: string;
  icon: V5IconName;
  render: () => ReactNode;
}

export interface RouteSheetProps {
  title: string;
  subtitle?: string | null;
  tabs?: RouteSheetTab[];
  tab: number;
  onTab: (index: number) => void;
  detent: SheetDetent;
  onDetent: (detent: SheetDetent) => void;
  actions?: ReactNode;
  onBack?: () => void;
  /** Mini-sélecteur bas droite (sections d'« Analyser »). */
  mini?: { items: Array<{ id: string; label: string; icon: string }>; value: number; onChange: (i: number) => void } | null;
  labelledBy?: string;
  /** Fermeture : croix du tiroir. */
  onClose: () => void;
  /** Tirer l'aperçu vers le bas ferme le tiroir (sous-tiroir seulement : le tiroir principal se ferme à la croix). */
  dragCloses?: boolean;
  summary?: ReactNode;
  children?: ReactNode;
}

/**
 * Le tiroir de `/compas/itineraire` (4.2) : la coquille du tiroir du Compas v5 (`SheetShell` : poignée, verre,
 * capsule d'icônes, titre, croix) posée au bas de la carte, avec les trois hauteurs de l'itinéraire (aperçu,
 * moitié, plein) tirées au doigt, à la souris et au clavier. Échap n'est pas écouté ici : `useRouteLevels` ferme
 * un niveau à la fois (menu de la carte, détail, sous-tiroir, tiroir).
 */
export function RouteSheet({
  title,
  subtitle,
  tabs,
  tab,
  onTab,
  detent,
  onDetent,
  actions,
  onBack,
  mini,
  labelledBy,
  onClose,
  dragCloses = false,
  summary,
  children,
}: RouteSheetProps) {
  const [viewport, setViewport] = useState(844);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startHeight: number; lastY: number; lastT: number; velocity: number } | null>(null);

  useEffect(() => {
    const read = () => setViewport(typeof window === 'undefined' ? 844 : Math.round(window.visualViewport?.height ?? window.innerHeight));
    read();
    window.addEventListener('resize', read);
    window.visualViewport?.addEventListener?.('resize', read);
    return () => {
      window.removeEventListener('resize', read);
      window.visualViewport?.removeEventListener?.('resize', read);
    };
  }, []);

  const heights = useMemo(() => detentHeights(viewport), [viewport]);
  const shown = shownDetent(detent);
  const height = dragHeight ?? heights[shown];

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointeur synthétique (tests) : pas de capture.
      }
      dragRef.current = { startY: event.clientY, startHeight: height, lastY: event.clientY, lastT: event.timeStamp, velocity: 0 };
    },
    [height]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = Math.min(heights.full, Math.max(heights.peek * 0.82, drag.startHeight + (drag.startY - event.clientY)));
      const dt = Math.max(1, event.timeStamp - drag.lastT);
      drag.velocity = (drag.lastY - event.clientY) / dt;
      drag.lastY = event.clientY;
      drag.lastT = event.timeStamp;
      setDragHeight(next);
    },
    [heights.full, heights.peek]
  );

  const endDrag = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      const finalHeight = dragHeight ?? drag.startHeight;
      setDragHeight(null);
      try {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // idem
      }
      if (Math.abs(finalHeight - drag.startHeight) < 2) {
        onDetent(nextDetentOnTap(detent));
        return;
      }
      const next = settleDetent(detent, finalHeight, drag.velocity, heights, dragCloses);
      if (next === 'close') onClose();
      else onDetent(next);
    },
    [detent, dragCloses, dragHeight, heights, onClose, onDetent]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const next = detentFromKey(detent, event.key);
      if (!next) return;
      event.preventDefault();
      onDetent(next);
    },
    [detent, onDetent]
  );

  const safeTab = tabs && tabs.length > 0 ? Math.min(Math.max(0, tab), tabs.length - 1) : 0;
  const activeTab = tabs?.[safeTab];
  const showTabs = Boolean(tabs && tabs.length > 1);

  return (
    <V5Scope>
      <SheetShell
        open
        role="region"
        label={title || 'Itinéraire'}
        labelledBy={title ? labelledBy : undefined}
        title={title}
        titleId={labelledBy}
        subtitle={subtitle}
        closeLabel="Fermer"
        onClose={onClose}
        trapFocus={false}
        autoFocus={false}
        className="rcw-sheet"
        style={{ height: `${height}px` }}
        data={{ 'data-dock': '', 'data-detent': shown, 'data-dragging': dragHeight === null ? 'false' : 'true' }}
        handle={{
          label: 'Ajuster la hauteur du tiroir',
          expanded: shown !== 'peek',
          onKeyDown,
          onPointerDown,
          onPointerMove,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
        }}
        head={
          showTabs && tabs ? (
            <Flow
              tabs={tabs.map((t) => ({ icon: t.icon, label: t.label }))}
              selected={safeTab}
              onSelect={onTab}
              label="Sections"
            />
          ) : null
        }
        actions={
          <>
            {actions}
            {onBack ? (
              <button type="button" className="v5-sx rcw-sheet-back" onClick={onBack} aria-label="Retour">
                <V5Icon name="left" size="s" />
              </button>
            ) : null}
          </>
        }
        summary={summary ? <div className="rcw-sheet-summary">{summary}</div> : null}
        bodyClassName="rcw-sheet-body"
        bodyKey={activeTab?.id}
        bodyProps={
          activeTab
            ? { role: 'tabpanel', tabIndex: 0, id: `rcw-panel-${activeTab.id}`, 'aria-label': activeTab.label }
            : { tabIndex: 0, 'aria-label': `Contenu : ${title || 'tiroir'}` }
        }
        footer={
          mini && mini.items.length > 1 ? (
            <div className="xp-mini">
              <div className="xp-mini-inner" role="tablist" aria-label="Affichage" style={{ '--n': mini.items.length } as React.CSSProperties}>
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
          ) : null
        }
      >
        {activeTab ? activeTab.render() : children}
      </SheetShell>
    </V5Scope>
  );
}

export { SHEET_DETENTS };

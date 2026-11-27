'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Compass, Layers, Leaf, Play, ShieldAlert, Users } from 'lucide-react';
import {
  DRAWER_V2_CSS,
  SlotShell,
  type SlotContentState,
  type SlotLens,
} from '@/components/compte/drawer/SlotShell';
import { CapsuleTabs, type CapsuleTabItem } from '@/components/ui/CapsuleTabs';
import '@/styles/carnet-v2.css';
import '@/components/clubs/drawer/club-drawers-v2.css';
import '@/styles/explorer-glass.css';
import {
  EXPLORER_CATEGORY_ORDER,
  type ExplorerCategory,
  type ExplorerDetent,
} from './mapContext';

export interface ExplorerGlassDrawerProps {
  detent: ExplorerDetent;
  onDetentChange: (detent: ExplorerDetent) => void;
  activeCategory: ExplorerCategory;
  onCategoryChange: (category: ExplorerCategory) => void;
  categoryTitle: string;
  lenses: SlotLens[];
  activeLensIndex: number;
  onLensChange: (index: number) => void;
  renderLens?: (lens: SlotLens, index: number, active: boolean) => React.ReactNode;
  children?: React.ReactNode;
  state?: SlotContentState;
  emptyLabel?: string;
  errorLabel?: string;
  onRetry?: () => void;
  onOpenSportLaunch: () => void;
  categoryBadges?: Partial<Record<ExplorerCategory, number | string>>;
  overlayView?: React.ReactNode;
  floatingLeftAction?: React.ReactNode;
  bottomRightFilter?: React.ReactNode;
  forceHideBottomBar?: boolean;
  hudContrast?: 'standard' | 'sunlight' | 'night-red';
}

const CATEGORY_META: Record<ExplorerCategory, { label: string; icon: React.ReactNode }> = {
  explorer: {
    label: 'Explorer',
    icon: <Compass size={19} strokeWidth={2} aria-hidden="true" />,
  },
  layers: {
    label: 'Carte & Calques',
    icon: <Layers size={19} strokeWidth={2} aria-hidden="true" />,
  },
  pokedex: {
    label: 'Pokédex',
    icon: <Leaf size={19} strokeWidth={2} aria-hidden="true" />,
  },
  safety: {
    label: 'Sécurité & Terrain',
    icon: <ShieldAlert size={19} strokeWidth={2} aria-hidden="true" />,
  },
  community: {
    label: 'Communauté',
    icon: <Users size={19} strokeWidth={2} aria-hidden="true" />,
  },
};

function nextTapDetent(current: ExplorerDetent): ExplorerDetent {
  if (current === 'peek') return 'mid';
  if (current === 'mid') return 'full';
  return 'peek';
}

function resolveDraggedDetent(
  current: ExplorerDetent,
  deltaY: number,
  velocityY: number,
): ExplorerDetent {
  const pulledUp = deltaY < -44 || velocityY < -0.45;
  const pulledDown = deltaY > 44 || velocityY > 0.45;

  if (pulledUp) {
    if (current === 'peek') return deltaY < -220 ? 'full' : 'mid';
    return 'full';
  }
  if (pulledDown) {
    if (current === 'full') return deltaY > 240 ? 'peek' : 'mid';
    return 'peek';
  }
  return current;
}

export function ExplorerGlassDrawer({
  detent,
  onDetentChange,
  activeCategory,
  onCategoryChange,
  categoryTitle,
  lenses,
  activeLensIndex,
  onLensChange,
  renderLens,
  children,
  state = 'ready',
  emptyLabel,
  errorLabel,
  onRetry,
  onOpenSportLaunch,
  categoryBadges,
  overlayView,
  floatingLeftAction,
  bottomRightFilter,
  forceHideBottomBar = false,
  hudContrast = 'standard',
}: ExplorerGlassDrawerProps) {
  const [dragging, setDragging] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startTime: number;
    lastY: number;
    moved: boolean;
  } | null>(null);
  const suppressNextClickRef = useRef(false);

  const shouldHideBottomBar = forceHideBottomBar || detent !== 'peek';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (shouldHideBottomBar) {
      document.documentElement.dataset.explorerSheetOpen = 'true';
      window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: true } }));
    } else {
      delete document.documentElement.dataset.explorerSheetOpen;
      window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: false } }));
    }
  }, [shouldHideBottomBar]);

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return;
      delete document.documentElement.dataset.explorerSheetOpen;
      window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: false } }));
    };
  }, []);

  const categoryItems = useMemo<CapsuleTabItem[]>(
    () =>
      EXPLORER_CATEGORY_ORDER.map((id) => ({
        id,
        label: CATEGORY_META[id].label,
        icon: CATEGORY_META[id].icon,
        badge: categoryBadges?.[id],
      })),
    [categoryBadges],
  );

  const activeCategoryIndex = Math.max(0, EXPLORER_CATEGORY_ORDER.indexOf(activeCategory));

  const handleCategoryIndexChange = useCallback(
    (index: number) => {
      const nextCategory = EXPLORER_CATEGORY_ORDER[index];
      if (!nextCategory) return;
      onCategoryChange(nextCategory);
      if (detent === 'peek') {
        onDetentChange('mid');
      }
    },
    [detent, onCategoryChange, onDetentChange],
  );

  const handleHeadTabsClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (detent !== 'peek') return;
      const target = event.target as HTMLElement | null;
      const tabButton = target?.closest<HTMLElement>('[role="tab"]');
      if (tabButton && tabButton.getAttribute('aria-selected') === 'true') {
        onDetentChange('mid');
      }
    },
    [detent, onDetentChange],
  );

  const handleGrabberPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTime: performance.now(),
      lastY: event.clientY,
      moved: false,
    };
    suppressNextClickRef.current = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture errors in synthetic test environments
    }
    setDragging(true);
    setDragOffsetY(0);
  }, []);

  const handleGrabberPointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const stateRef = dragRef.current;
      if (!stateRef || stateRef.pointerId !== event.pointerId) return;
      const rawDy = event.clientY - stateRef.startY;
      stateRef.lastY = event.clientY;
      if (Math.abs(rawDy) >= 8) {
        stateRef.moved = true;
      }

      // Apply light rubber-band damping beyond physical detent limits.
      let clampedDy = rawDy;
      if (detent === 'full' && rawDy < 0) {
        clampedDy = rawDy * 0.2;
      } else if (detent === 'peek' && rawDy > 0) {
        clampedDy = rawDy * 0.2;
      }
      setDragOffsetY(Math.max(-280, Math.min(280, clampedDy)));
    },
    [detent],
  );

  const finishGrabberDrag = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
      const stateRef = dragRef.current;
      if (!stateRef || stateRef.pointerId !== event.pointerId) return;
      dragRef.current = null;
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore release errors in synthetic test environments
      }
      setDragging(false);
      setDragOffsetY(0);

      if (cancelled || !stateRef.moved) return;

      suppressNextClickRef.current = true;
      const dy = stateRef.lastY - stateRef.startY;
      const dt = Math.max(1, performance.now() - stateRef.startTime);
      const next = resolveDraggedDetent(detent, dy, dy / dt);
      if (next !== detent) {
        onDetentChange(next);
      }
    },
    [detent, onDetentChange],
  );

  const handleGrabberClick = useCallback(() => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    onDetentChange(nextTapDetent(detent));
  }, [detent, onDetentChange]);

  const drawerStyle = useMemo(
    () =>
      ({
        '--xp20-y': `${dragOffsetY}px`,
      }) as React.CSSProperties,
    [dragOffsetY],
  );

  const topSelector = (
    <div className="xp20-drawer-head-row">
      <div className="xp20-drawer-head-tabs" onClick={handleHeadTabsClick}>
        <CapsuleTabs
          items={categoryItems}
          activeIndex={activeCategoryIndex}
          onIndexChange={handleCategoryIndexChange}
          ariaLabel="Catégories Explorer"
          className="lkdv-slot-selector"
          showLabels={false}
          idFor={(id) => `lkdv-slot-tab-${id}`}
          panelIdFor={(id) => `lkdv-slot-panel-${id}`}
          dataSlot
        />
      </div>
      <button
        type="button"
        className="xp20-sport-launch-btn"
        aria-label="Démarrer une activité"
        title="Démarrer une activité"
        data-testid="xp20-sport-launch-btn"
        onClick={onOpenSportLaunch}
      >
        <Play size={19} fill="currentColor" strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <div
      className="xp20-drawer-wrap"
      data-detent={detent}
      data-hud-contrast={hudContrast !== 'standard' ? hudContrast : undefined}
    >
      <style dangerouslySetInnerHTML={{ __html: DRAWER_V2_CSS }} />
      <section
        className="xp20-drawer"
        data-detent={detent}
        data-dragging={dragging ? 'true' : 'false'}
        data-has-overlay={overlayView && detent !== 'peek' ? 'true' : 'false'}
        data-hud-contrast={hudContrast !== 'standard' ? hudContrast : undefined}
        style={drawerStyle}
        aria-label="Tiroir Explorer"
        data-testid="xp20-glass-drawer"
      >
        <button
          type="button"
          className="lkdv-mgrab"
          aria-label={
            detent === 'peek'
              ? 'Déployer le tiroir Explorer'
              : detent === 'mid'
                ? 'Agrandir le tiroir Explorer'
                : 'Réduire le tiroir Explorer'
          }
          onPointerDown={handleGrabberPointerDown}
          onPointerMove={handleGrabberPointerMove}
          onPointerUp={(e) => finishGrabberDrag(e, false)}
          onPointerCancel={(e) => finishGrabberDrag(e, true)}
          onClick={handleGrabberClick}
        >
          <span aria-hidden="true" />
        </button>

        <SlotShell
          slot={activeCategory}
          viewer="owner"
          title={categoryTitle}
          lenses={detent === 'peek' ? [] : lenses}
          activeLensIndex={activeLensIndex}
          onLensChange={onLensChange}
          state={state}
          emptyLabel={emptyLabel}
          errorLabel={errorLabel}
          onRetry={onRetry}
          renderLens={renderLens}
          selector={topSelector}
          bottomRightFilter={overlayView || detent === 'peek' ? undefined : bottomRightFilter}
        >
          {children}
        </SlotShell>

        {floatingLeftAction && !overlayView && detent !== 'peek' ? (
          <div className="xp20-floating-left club-drawer-floating-left">{floatingLeftAction}</div>
        ) : null}

        {overlayView && detent !== 'peek' ? (
          <div className="xp20-overlay-layer" data-testid="xp20-overlay-layer">
            {overlayView}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default ExplorerGlassDrawer;

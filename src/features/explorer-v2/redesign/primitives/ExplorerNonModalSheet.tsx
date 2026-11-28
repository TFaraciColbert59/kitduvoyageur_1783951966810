'use client';

import React, { useEffect } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import '@/styles/explorer-hud-extremes.css';

export type HudContrastVariant = 'standard' | 'sunlight' | 'night-red';

export interface ExplorerNonModalSheetProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  snapPoints?: Array<number | string>;
  activeSnapPoint?: number | string | null;
  onSnapPointChange?: (snap: number | string | null) => void;
  ariaLabel: string;
  contrast?: HudContrastVariant;
  glovesMode?: boolean;
  rainLocked?: boolean;
  children: React.ReactNode;
}

/**
 * Lot 07 — Primitif de tiroir non-modal basé sur `@base-ui/react/drawer` (MIT, iOS 26+ Safari).
 * - `modal={false}` + `disablePointerDismissal` : la carte MapLibre reste 100 % interactive derrière.
 * - Masque proprement la barre de navigation globale sans collision avec `ExplorerGlassDrawer`.
 */
export function ExplorerNonModalSheet({
  open,
  onOpenChange,
  snapPoints = ['136px', 0.52, 0.94],
  activeSnapPoint,
  onSnapPointChange,
  ariaLabel,
  contrast = 'standard',
  glovesMode = false,
  rainLocked = false,
  children,
}: ExplorerNonModalSheetProps) {
  useEffect(() => {
    if (typeof window === 'undefined' || !open) return;
    document.documentElement.dataset.explorerSheetOpen = 'true';
    window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: true } }));
    return () => {
      delete document.documentElement.dataset.explorerSheetOpen;
      window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: false } }));
    };
  }, [open]);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      modal={false}
      disablePointerDismissal
      snapPoints={snapPoints}
      snapPoint={activeSnapPoint ?? undefined}
      onSnapPointChange={onSnapPointChange}
    >
      <Drawer.Portal>
        <Drawer.Viewport className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center">
          <Drawer.Popup
            aria-label={ariaLabel}
            data-hud-contrast={contrast}
            data-gloves-mode={glovesMode ? 'true' : undefined}
            data-rain-lock={rainLocked ? 'true' : undefined}
            className="xp20-hud-surface xp20-hud-sheet-panel pointer-events-auto flex w-full max-w-[540px] flex-col outline-none"
            style={{
              maxHeight: '94dvh',
              paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="xp20-hud-grabber" aria-hidden="true" />
            <Drawer.Content className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-2">
              {children}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

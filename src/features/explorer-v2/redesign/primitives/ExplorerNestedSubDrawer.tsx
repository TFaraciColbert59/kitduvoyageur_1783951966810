'use client';

import React from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { X } from 'lucide-react';
import type { HudContrastVariant } from './ExplorerNonModalSheet';
import '@/styles/explorer-hud-extremes.css';

export interface ExplorerNestedSubDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  contrast?: HudContrastVariant;
  glovesMode?: boolean;
  maxHeight?: string;
  minHeight?: string;
  stickySubHeader?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Sous-tiroir Expert imbriqué (`@base-ui/react/drawer`) — finition Apple Liquid Glass.
 */
export function ExplorerNestedSubDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  contrast = 'standard',
  glovesMode = false,
  maxHeight = '86dvh',
  minHeight,
  stickySubHeader,
  children,
}: ExplorerNestedSubDrawerProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} modal>
      <Drawer.Portal>
        <Drawer.Backdrop
          className="xp20-nested-backdrop fixed inset-0 z-50"
          style={{
            background: 'rgba(13, 27, 21, 0.42)',
          }}
        />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
          <Drawer.Popup
            aria-label={title}
            data-hud-contrast={contrast}
            data-gloves-mode={glovesMode ? 'true' : undefined}
            className="xp20-hud-surface xp20-hud-sheet-panel xp20-nested-popup flex w-full max-w-[540px] flex-col overflow-hidden outline-none"
            style={{
              maxHeight,
              minHeight,
              background:
                contrast === 'standard'
                  ? 'linear-gradient(180deg, rgba(252, 251, 248, 0.97) 0%, rgba(246, 245, 240, 0.96) 100%)'
                  : undefined,
              boxShadow:
                contrast === 'night-red'
                  ? '0 -12px 40px rgba(0, 0, 0, 0.85)'
                  : 'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 -12px 44px rgba(16, 32, 25, 0.22)',
              paddingBottom: 'max(18px, env(safe-area-inset-bottom, 0px))', // lkdv-safe-area-ok
            }}
          >
            <div className="xp20-hud-grabber-hit flex w-full shrink-0 justify-center pt-1 pb-0.5" aria-hidden="true">
              <div className="xp20-hud-grabber" />
            </div>
            <div
              className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-1"
              style={{ borderBottom: '0.5px solid var(--xp-hud-border, rgba(23, 64, 44, 0.08))' }}
            >
              <div className="min-w-0 flex-1">
                <Drawer.Title
                  className="truncate text-[17px] font-extrabold tracking-tight"
                  style={{ color: 'var(--xp-hud-ink)' }}
                >
                  {title}
                </Drawer.Title>
                {subtitle ? (
                  <Drawer.Description
                    className="mt-0.5 truncate text-[12px] font-medium"
                    style={{ color: 'var(--xp-hud-ink-muted)' }}
                  >
                    {subtitle}
                  </Drawer.Description>
                ) : null}
              </div>
              <Drawer.Close
                aria-label="Fermer le sous-tiroir"
                className="xp20-tactile inline-flex shrink-0 items-center justify-center rounded-full"
                style={{
                  width: 40,
                  height: 40,
                  background:
                    contrast === 'night-red' ? '#1c0404' : 'rgba(23, 64, 44, 0.07)',
                  color: 'var(--xp-hud-ink)',
                  border: '0.5px solid var(--xp-hud-border, rgba(23, 64, 44, 0.08))',
                }}
              >
                <X size={17} aria-hidden="true" />
              </Drawer.Close>
            </div>
            {stickySubHeader ? (
              <div
                className="shrink-0"
                style={{ borderBottom: '0.5px solid var(--xp-hud-border, rgba(23, 64, 44, 0.08))' }}
              >
                {stickySubHeader}
              </div>
            ) : null}
            <Drawer.Content
              data-base-ui-swipe-ignore="x"
              className="xp20-nested-body min-h-0 flex-auto overflow-y-auto px-4 py-3.5"
            >
              {children}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

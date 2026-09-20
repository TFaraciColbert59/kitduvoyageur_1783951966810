'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import Icon from './Icon';

export type SheetDetent = 'auto' | 'medium' | 'large';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  detent?: SheetDetent;
  dismissible?: boolean;
  hideTitle?: boolean;
}

const DETENT: Record<SheetDetent, string> = {
  auto: '',
  medium: 'h-[55dvh]',
  large: 'h-[90dvh]',
};

/**
 * Sheet — bottom sheet canonique (Phase 2, Lot 5).
 * Radix Dialog ancré en bas : focus trap, Escape/overlay (si dismissible),
 * scroll interne, safe-area iOS. Pas de drag-to-dismiss : la fermeture passe
 * par le bouton, Escape ou le scrim (volontaire, cohérent avec les overlays
 * canoniques du Lot 3).
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  detent = 'auto',
  dismissible = true,
  hideTitle = false,
}: SheetProps) {
  const blockDismiss = (event: { preventDefault: () => void }) => {
    if (!dismissible) event.preventDefault();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="lkv-fade-in fixed inset-0 z-[var(--z-sheet)] bg-[color:var(--lkv-overlay-scrim)] backdrop-blur-[var(--blur-sm)]" />
        <Dialog.Content
          onEscapeKeyDown={blockDismiss}
          onPointerDownOutside={blockDismiss}
          onInteractOutside={blockDismiss}
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed inset-x-0 bottom-0 z-[var(--z-sheet)] flex flex-col focus:outline-none',
            DETENT[detent]
          )}
        >
          <div className="lkv-sheet-up flex max-h-[90dvh] min-h-0 flex-1 flex-col overflow-hidden rounded-t-[var(--lkv-radius-sheet)] border-t border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-card)] shadow-[var(--elevation-4)]">
            <div aria-hidden="true" className="flex shrink-0 justify-center pt-[var(--space-3)]">
              <div className="h-1.5 w-12 rounded-full bg-[color:var(--lkv-text-muted)] opacity-40" />
            </div>
            {title ? (
              <div className="flex shrink-0 items-center justify-between gap-[var(--space-3)] px-[var(--space-5)] pb-[var(--space-3)] pt-[var(--space-2)]">
                <div className="min-w-0">
                  <Dialog.Title
                    className={cn(
                      'text-[length:var(--lkv-text-title-sm)] font-bold leading-[var(--lkv-line-title)] text-[color:var(--lkv-text-primary)]',
                      hideTitle && 'sr-only'
                    )}
                  >
                    {title}
                  </Dialog.Title>
                  {description && (
                    <Dialog.Description className="mt-[var(--space-1)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-secondary)]">
                      {description}
                    </Dialog.Description>
                  )}
                </div>
                {dismissible && (
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Fermer"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--lkv-text-secondary)] transition-colors hover:bg-[color:var(--lkv-hover-surface)] hover:text-[color:var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
                    >
                      <Icon name="x" size={18} aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                )}
              </div>
            ) : (
              <Dialog.Title className="sr-only">Fenêtre de dialogue</Dialog.Title>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[var(--space-5)] pb-[var(--space-4)] pt-[var(--space-1)]">
              {children}
            </div>
            {footer && (
              <div className="shrink-0 border-t border-[color:var(--lkv-border)] px-[var(--space-5)] pb-[calc(var(--safe-bottom)+var(--space-4))] pt-[var(--space-4)]">
                {footer}
              </div>
            )}
            {!footer && <div className="shrink-0 pb-[calc(var(--safe-bottom)+var(--space-4))]" />}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default Sheet;

'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import Icon from './Icon';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  scrollable?: boolean;
  loading?: boolean;
  dismissible?: boolean;
  hideTitle?: boolean;
}

const SIZE: Record<ModalSize, string> = {
  sm: 'w-[min(92vw,24rem)]',
  md: 'w-[min(92vw,32rem)]',
  lg: 'w-[min(94vw,48rem)]',
};

/**
 * Modal — dialogue centré canonique (Phase 2, Lot 5).
 * Radix Dialog porté au body : focus trap, Escape/overlay (si dismissible),
 * scroll-lock, aria-labelledby/describedby. Contenu scrollable si demandé.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  scrollable = true,
  loading = false,
  dismissible = true,
  hideTitle = false,
}: ModalProps) {
  const canDismiss = dismissible && !loading;
  const blockDismiss = (event: { preventDefault: () => void }) => {
    if (!canDismiss) event.preventDefault();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="lkv-fade-in fixed inset-0 z-[var(--z-modal)] bg-[color:var(--lkv-overlay-scrim)] backdrop-blur-[var(--blur-sm)]" />
        <Dialog.Content
          onEscapeKeyDown={blockDismiss}
          onPointerDownOutside={blockDismiss}
          onInteractOutside={blockDismiss}
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed left-1/2 top-1/2 z-[var(--z-modal)] -translate-x-1/2 -translate-y-1/2 focus:outline-none',
            SIZE[size]
          )}
        >
          <div className="lkv-modal-in flex max-h-[85dvh] flex-col overflow-hidden rounded-[var(--lkv-radius-card)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-card)] shadow-[var(--elevation-4)]">
            <div className="flex shrink-0 items-start justify-between gap-[var(--space-3)] px-[var(--space-5)] pt-[var(--space-5)]">
              <div className="min-w-0">
                <Dialog.Title
                  className={cn(
                    'text-[length:var(--lkv-text-title-sm)] font-bold leading-[var(--lkv-line-title)] text-[color:var(--lkv-text-primary)]',
                    (hideTitle || !title) && 'sr-only'
                  )}
                >
                  {title ?? 'Fenêtre de dialogue'}
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
                    disabled={loading}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--lkv-text-secondary)] transition-colors hover:bg-[color:var(--lkv-hover-surface)] hover:text-[color:var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] disabled:pointer-events-none disabled:opacity-[var(--opacity-disabled)]"
                  >
                    <Icon name="x" size={18} aria-hidden="true" />
                  </button>
                </Dialog.Close>
              )}
            </div>
            <div
              className={cn(
                'min-h-0 flex-1 px-[var(--space-5)] py-[var(--space-4)]',
                scrollable && 'overflow-y-auto overscroll-contain'
              )}
            >
              {children}
            </div>
            {footer && (
              <div className="flex shrink-0 justify-end gap-[var(--space-2)] border-t border-[color:var(--lkv-border)] px-[var(--space-5)] py-[var(--space-4)]">
                {footer}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default Modal;

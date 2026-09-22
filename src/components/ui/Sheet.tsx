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
  /** Fermeture par glissement de la poignée (translation Y, seuil 25 %). */
  dragToDismiss?: boolean;
}

const DETENT: Record<SheetDetent, string> = {
  auto: '',
  medium: 'h-[55dvh]',
  large: 'h-[90dvh]',
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Sheet — bottom sheet canonique (Phase 2, Lot 5).
 * Radix Dialog ancré en bas : focus trap, Escape/overlay (si dismissible),
 * scroll interne, safe-area iOS. `dragToDismiss` ajoute la fermeture par
 * glissement de la poignée (désactivée si `prefers-reduced-motion`).
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
  dragToDismiss = false,
}: SheetProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const dragStart = React.useRef<number | null>(null);
  const [dragY, setDragY] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      dragStart.current = null;
      setDragY(0);
      setDragging(false);
    }
  }, [open]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragToDismiss || prefersReducedMotion()) return;
    dragStart.current = event.clientY;
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, event.clientY - dragStart.current));
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    const distance = Math.max(0, event.clientY - dragStart.current);
    const height = panelRef.current?.offsetHeight ?? 0;
    dragStart.current = null;
    setDragging(false);
    if (height > 0 && distance > height * 0.25) {
      onOpenChange(false);
      return;
    }
    setDragY(0);
  };

  const blockDismiss = (event: { preventDefault: () => void }) => {
    if (!dismissible) event.preventDefault();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="lkv-fade-in fixed inset-0 z-[var(--z-sheet)] bg-[color:var(--lkv-overlay-scrim)] backdrop-blur-[var(--blur-sm)] data-[state=closed]:[animation:lkv-fade-out_var(--motion-control-duration)_var(--lkv-ease)_both] motion-reduce:[animation:none]" />
        <Dialog.Content
          onEscapeKeyDown={blockDismiss}
          onPointerDownOutside={blockDismiss}
          onInteractOutside={blockDismiss}
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed inset-x-0 bottom-0 z-[var(--z-sheet)] flex flex-col focus:outline-none',
            'data-[state=closed]:[animation:lkv-sheet-down_var(--motion-control-duration)_var(--motion-ease-accelerate)_both] motion-reduce:[animation:none]',
            DETENT[detent]
          )}
        >
          <div
            ref={panelRef}
            style={{
              transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
              transition: dragging
                ? 'none'
                : 'transform var(--motion-control-duration) var(--motion-ease-standard)',
            }}
            className="lkv-sheet-up flex max-h-[90dvh] min-h-0 flex-1 flex-col overflow-hidden rounded-t-[var(--lkv-radius-sheet)] border-t border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] shadow-[var(--elevation-4)]"
          >
            <div
              aria-hidden="true"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              className={cn(
                'flex shrink-0 justify-center pt-[var(--space-3)]',
                dragToDismiss && 'cursor-grab touch-none select-none active:cursor-grabbing'
              )}
            >
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

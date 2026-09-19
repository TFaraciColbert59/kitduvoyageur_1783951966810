'use client';

import Icon from '@/components/ui/Icon';
import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { zIndex } from '@/lib/ui/zIndex';

export interface GlassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Titre (sr ou visible) — requis Radix, fournit aria-labelledby. */
  title: string;
  children: React.ReactNode;
  /** Bottom-sheet plein écran sur mobile, centré sur desktop (défaut). */
  variant?: 'sheet' | 'centered';
  /** Cacher le titre visuellement (garde l'anchor Radix). */
  hideTitle?: boolean;
}

/**
 * UX — Modale Glass partagée : Radix Dialog porté au body (focus trap,
 * Escape, scroll-lock, aria-modal) + animations CSS respectful du reduced
 * motion (P1-3 : framer-motion retiré du graphe statique des hubs).
 * Bottom-sheet sur mobile (safe-area aware), centrée sur desktop.
 */
export function GlassModal({
  open,
  onOpenChange,
  title,
  children,
  variant = 'centered',
  hideTitle = false,
}: GlassModalProps) {
  const isSheet = variant === 'sheet';

  const [render, setRender] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      setRender(true);
      setClosing(false);
      return;
    }
    if (!render) return;
    setClosing(true);
    const timer = setTimeout(() => {
      setClosing(false);
      setRender(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [open, render]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {render && (
        <Dialog.Portal forceMount>
          <Dialog.Overlay asChild>
            <div
              className={`lkv-fade-in${closing ? ' lkv-fade-in--closing' : ''} fixed inset-0 bg-ink-900/40`}
              style={{ zIndex: zIndex.modal }}
            />
          </Dialog.Overlay>
          <Dialog.Content
            aria-describedby={undefined}
            data-glass-variant="overlay"
            data-glass-shape={isSheet ? "sheet" : undefined}
            style={{ zIndex: zIndex.modal }}
            className={
              isSheet
                ? 'glass fixed inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl pb-[calc(16px+env(safe-area-inset-bottom,0px))] // lkdv-safe-area-ok'
                : 'glass fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(520px,92vw)] max-h-[88dvh] overflow-y-auto rounded-3xl p-6'
            }
          >
            <div
              className={
                isSheet
                  ? `lkv-sheet-up${closing ? ' lkv-sheet-up--closing' : ''}`
                  : `lkv-modal-in${closing ? ' lkv-modal-in--closing' : ''}`
              }
            >
              <div
                className={`flex items-center justify-between gap-3 ${isSheet ? 'px-5 pt-4 sticky top-0 z-10 bg-[color:var(--glass-bg-strong)] pb-3' : 'pb-3'}`}
              >
                <Dialog.Title
                  className={
                    hideTitle
                      ? 'sr-only'
                      : 'font-display font-bold text-lg text-[var(--lkv-text-primary)]'
                  }
                >
                  {title}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Fermer"
                    className="h-11 w-11 min-w-[44px] rounded-full glass-sub-card lkv-button-primitive flex items-center justify-center text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] cursor-pointer"
                  >
                    <Icon name="x" size={18} aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
              {isSheet ? <div className="px-5">{children}</div> : children}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
}

export default GlassModal;

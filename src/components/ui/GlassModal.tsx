'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

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
 * Escape, scroll-lock, aria-modal) + animation framer respectful du
 * reduced motion. Bottom-sheet sur mobile (safe-area aware), centrée
 * sur desktop. Fermeture 44px. Toutes les modales du hub migrent ici.
 */
export function GlassModal({
  open,
  onOpenChange,
  title,
  children,
  variant = 'centered',
  hideTitle = false,
}: GlassModalProps) {
  const reduceMotion = useReducedMotion();
  const isSheet = variant === 'sheet';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-[10000] bg-ink-900/40 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.18 }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              aria-describedby={undefined}
              className={
                isSheet
                  ? 'fixed inset-x-0 bottom-0 z-[10001] max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-[color:var(--glass-bg-strong)] backdrop-blur-[32px] backdrop-saturate-[200%] border border-white/40 shadow-2xl pb-[calc(16px+env(safe-area-inset-bottom,0px))] // lkdv-safe-area-ok'
                  : 'fixed left-1/2 top-1/2 z-[10001] -translate-x-1/2 -translate-y-1/2 w-[min(520px,92vw)] max-h-[88dvh] overflow-y-auto rounded-3xl bg-[color:var(--glass-bg-strong)] backdrop-blur-[32px] backdrop-saturate-[200%] border border-white/40 shadow-2xl p-6'
              }
            >
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: isSheet ? '100%' : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: isSheet ? '100%' : 8 }}
                transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.32, 0.72, 0, 1] }}
              >
                <div className={`flex items-center justify-between gap-3 ${isSheet ? 'px-5 pt-4 sticky top-0 z-10 bg-[color:var(--glass-bg-strong)]/90 backdrop-blur-xl pb-3' : 'pb-3'}`}>
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
                      className="h-11 w-11 min-w-[44px] rounded-full glass-sub-card border border-white/60 flex items-center justify-center text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] hover:bg-white transition-all cursor-pointer shadow-2xs active:scale-95"
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                </div>
                {isSheet ? <div className="px-5">{children}</div> : children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export default GlassModal;

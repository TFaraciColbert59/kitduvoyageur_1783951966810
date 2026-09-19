'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { ArrowLeftIcon as ArrowLeftAnimated } from '@/components/icons/arrow-left';
import { zIndex } from '@/lib/ui/zIndex';

/**
 * P1-3 (fin) — GlassSheet sans framer-motion : entrée/sortie animées en CSS
 * (.lkv-sheet-full, 320 ms, courbe [0.32,0.72,0,1]) via un état de fermeture ;
 * Radix Dialog conservé (focus trap, Escape, aria) avec forceMount + montage
 * conditionnel — même contrat qu'AnimatePresence.
 */
export function GlassSheet({
  open, onOpenChange, title, children,
}: { open: boolean; onOpenChange: (v: boolean) => void; title: string; children: React.ReactNode }) {
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
    }, 340);
    return () => clearTimeout(timer);
  }, [open, render]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {render && (
        <Dialog.Portal forceMount>
          <Dialog.Overlay asChild>
            <div
              className={`lkv-fade-in${closing ? ' lkv-fade-in--closing' : ''} fixed inset-0 bg-ink-900/30`}
              style={{ zIndex: zIndex.modal }}
            />
          </Dialog.Overlay>
          <Dialog.Content asChild aria-label={title}>
            <div
              data-glass-variant="overlay"
              data-glass-shape="full"
              style={{ zIndex: zIndex.modal }}
              className={`lkv-sheet-full${closing ? ' lkv-sheet-full--closing' : ''} glass backdrop-blur-xl fixed inset-0 overflow-y-auto`}
            >
              <header className="sticky top-0 z-10 flex items-center gap-3 px-4 pt-[env(safe-area-inset-top,0px)] h-[calc(56px+env(safe-area-inset-top,0px))] bg-[color:var(--glass-bg-strong)] border-b border-glass-border">
                <Dialog.Close asChild>
                  <button
                    aria-label="Retour"
                    className="glass-sub-card lkv-button-primitive h-11 w-11 flex items-center justify-center rounded-full cursor-pointer"
                  >
                    <ArrowLeftAnimated size={18} className="text-[color:var(--label)]" aria-hidden="true" />
                  </button>
                </Dialog.Close>
                <Dialog.Title className="font-display font-semibold text-[18px] sm:text-[20px] text-[color:var(--label)]">
                  {title}
                </Dialog.Title>
              </header>
              <div className="px-4 pb-[calc(96px+env(safe-area-inset-bottom,0px))] pt-4 max-w-[var(--page-max-w)] mx-auto">{children}</div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
}

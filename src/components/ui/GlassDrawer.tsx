'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, useReducedMotion } from 'framer-motion';
import { XIcon as X } from '@/components/icons/x';

export function GlassDrawer({
  open, onOpenChange, title, titleId, width = 520, children,
}: { open: boolean; onOpenChange: (v: boolean) => void; title: string; titleId?: string; width?: number; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[10000] bg-ink-900/25" />
        <Dialog.Content asChild aria-label={title} {...(titleId ? { 'aria-labelledby': titleId } : {})}>
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-[10001] h-full"
            style={{ width: `min(${width}px, 100vw)`, maxWidth: '100vw' }}
            initial={{ x: reduceMotion ? 0 : '100%' }} animate={{ x: 0 }} exit={{ x: reduceMotion ? 0 : '100%' }}
            transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div data-glass-variant="overlay" data-glass-shape="drawer" className="glass pt-safe pb-safe flex h-full flex-col rounded-l-[var(--r-xl)] rounded-r-none">
              <header className="flex h-14 shrink-0 items-center justify-between border-b border-glass-border px-5">
                <Dialog.Title {...(titleId ? { id: titleId } : {})} className="font-display font-semibold text-[17px]">{title}</Dialog.Title>
                <Dialog.Close asChild>
                  <button aria-label="Fermer" className="glass-sub-card lkv-button-primitive flex h-11 w-11 items-center justify-center rounded-full cursor-pointer">
                    <X size={18} aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </header>
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

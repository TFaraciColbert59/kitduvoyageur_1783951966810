'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { XIcon as X } from '@/components/icons/x';

export function GlassDrawer({
  open, onOpenChange, title, width = 520, children,
}: { open: boolean; onOpenChange: (v: boolean) => void; title: string; width?: number; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[10000] bg-ink-900/25" />
        <Dialog.Content asChild aria-label={title}>
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-[10001] h-full"
            style={{ width: `min(${width}px, 100vw)`, maxWidth: '100vw' }}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="glass pt-safe pb-safe flex h-full flex-col rounded-l-[var(--r-xl)] rounded-r-none">
              <header className="flex h-14 shrink-0 items-center justify-between border-b border-glass-border px-5">
                <Dialog.Title className="font-display font-semibold text-[17px]">{title}</Dialog.Title>
                <Dialog.Close asChild>
                  <button aria-label="Fermer" className="glass-sub-card flex h-11 w-11 items-center justify-center rounded-full cursor-pointer">
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

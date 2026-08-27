'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export function GlassDrawer({
  open, onOpenChange, title, width = 520, children,
}: { open: boolean; onOpenChange: (v: boolean) => void; title: string; width?: number; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-900/25" />
        <Dialog.Content asChild aria-label={title}>
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-50 h-full glass rounded-l-[var(--r-xl)] rounded-r-none overflow-y-auto"
            style={{
              width: `min(${width}px, 100vw)`,
              maxWidth: '100vw',
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="flex items-center justify-between px-5 h-14 border-b border-glass-border">
              <Dialog.Title className="font-display font-semibold text-[17px]">{title}</Dialog.Title>
              <Dialog.Close asChild>
                <button aria-label="Fermer" className="h-11 w-11 rounded-full glass interactive flex items-center justify-center cursor-pointer">
                  <X size={18} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </header>
            <div className="p-4 sm:p-5">{children}</div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

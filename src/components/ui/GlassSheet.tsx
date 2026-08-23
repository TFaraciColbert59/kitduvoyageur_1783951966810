'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

export function GlassSheet({
  open, onOpenChange, title, children,
}: { open: boolean; onOpenChange: (v: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-40 bg-ink-900/30"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild aria-label={title}>
              <motion.div
                className="fixed inset-0 z-50 overflow-y-auto bg-[color:var(--glass-bg-strong)] backdrop-blur-[32px] backdrop-saturate-[200%]"
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              >
                <header className="sticky top-0 z-10 flex items-center gap-3 px-4 h-14 glass border-b border-glass-border">
                  <Dialog.Close asChild>
                    <button
                      aria-label="Retour"
                      className="glass interactive h-9 w-9 flex items-center justify-center rounded-full"
                    >
                      <ArrowLeft size={18} className="text-[color:var(--label)]" aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                  <Dialog.Title className="font-display font-semibold text-[20px] text-[color:var(--label)]">
                    {title}
                  </Dialog.Title>
                </header>
                <div className="px-4 pb-24 pt-4 max-w-[var(--page-max-w)] mx-auto">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

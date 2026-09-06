'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export interface SheetProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

/**
 * Primitive Sheet / Modal unifiée LKDV (Phase 2.3).
 * - Mobile (<md) : Bottom-sheet iOS avec barre d'attrape (drag handle) et gesture drag-to-dismiss.
 * - Desktop (md+) : Modal centré avec backdrop glassmorphism et fermeture ESC.
 */
export function Sheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  className = '',
  maxWidth = 'max-w-lg',
}: SheetProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          {/* Backdrop avec flou Apple */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal / Sheet Container */}
          <motion.div
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose?.();
              }
            }}
            className={`relative z-10 w-full ${maxWidth} bg-white rounded-t-[28px] md:rounded-[28px] border border-stone-200/80 shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col ${className}`}
          >
            {/* iOS Pull Handle (Mobile) */}
            <div className="pt-3 pb-1 flex justify-center md:hidden cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-stone-300" />
            </div>

            {/* Header */}
            {(Boolean(title) || typeof onClose === 'function') && (
              <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                <div>
                  {title && (
                    <h3 className="text-lg font-bold text-lkv-primary">{title}</h3>
                  )}
                  {description && (
                    <p className="text-xs text-lkv-text-muted mt-0.5">{description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-11 h-11 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-lkv-primary"
                  aria-label="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default Sheet;

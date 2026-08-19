/* =============================================================================
   LKDV — FullscreenOverlay : Composant d'Expansion Cinématique Partagé
   =============================================================================
   Overlay fullscreen réutilisable pour les 6 widgets avec :
   - Shared layout animation via Framer Motion layoutId
   - Backdrop avec blur + fade
   - Focus trap + Escape
   - Scroll lock arrière-plan
   - Header fullscreen avec bouton fermer
   - Contenu avec stagger entrance
   ============================================================================= */

import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap } from '@/hooks/useWidgetExpansion';
import { CardId } from '@/hooks/useWidgetExpansion';

interface FullscreenOverlayProps {
  isOpen: boolean;
  cardId: CardId;
  cardTitle: string;
  layoutId: string;          // layoutId du conteneur principal
  headerLayoutId: string;    // layoutId du header
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

export const FullscreenOverlay = forwardRef<{ focus: () => void; close: () => void }, FullscreenOverlayProps>(
  (
    {
      isOpen,
      cardId,
      cardTitle,
      layoutId,
      headerLayoutId,
      onClose,
      children,
      className = '',
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Focus trap
    useFocusTrap(isOpen, containerRef);

    // Exposer méthodes pour test/debug
    useImperativeHandle(ref, () => ({
      focus: () => containerRef.current?.focus(),
      close: onClose,
    }));

    // Lock scroll au montage
    useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
      }
      return () => {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
      <AnimatePresence>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[600] bg-black/85 backdrop-blur-md"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Fullscreen Card */}
        <motion.div
          ref={containerRef}
          layoutId={layoutId}
          initial={{ opacity: 0, scale: 0.98, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -12 }}
          transition={{
            type: 'spring',
            stiffness: 280,
            damping: 28,
            duration: 0.5,
          }}
          className={`fixed inset-4 md:inset-8 z-[700] rounded-[32px] border border-white/20 bg-[#0B1F17] shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden select-text ${className}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`fullscreen-title-${cardId}`}
          aria-label={ariaLabel || `Widget ${cardTitle} en plein écran`}
          tabIndex={-1}
        >
          {/* Header Fullscreen */}
          <motion.div
            layoutId={headerLayoutId}
            className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/30 shrink-0"
          >
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-[#A3C4A3] animate-pulse" aria-hidden="true" />
              <h2 id={`fullscreen-title-${cardId}`} className="font-black text-xl uppercase tracking-wider text-[#A3C4A3]">
                {cardTitle}
              </h2>
            </div>

            <button
              onClick={onClose}
              aria-label={`Réduire le widget ${cardTitle}`}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </motion.div>

          {/* Contenu avec stagger */}
          <motion.div
            ref={contentRef}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ delay: 0.15, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 p-6 md:p-8 overflow-y-auto scrollbar-thin"
          >
            {children}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }
);

FullscreenOverlay.displayName = 'FullscreenOverlay';
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useDragDismiss } from '@/hooks/gestures';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { zIndex } from '@/lib/ui/zIndex';

interface PremiumBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  snapPoints?: ('peek' | 'half' | 'full')[];
  defaultSnap?: 'peek' | 'half' | 'full';
  showHandle?: boolean;
  className?: string;
  /** Alias historique : les deux valeurs utilisent le matériau overlay partagé. */
  surface?: 'default' | 'liquid';
}

const SNAP_HEIGHTS = {
  peek: '30dvh',
  half: '55dvh',
  full: '92dvh',
} as const;

/**
 * Sheet Liquid Glass à snap points.
 *
 * Migré (mission gestes, Phase 2) des touch handlers manuels
 * (touchstart/touchmove/touchend + dragOffset, seuil 80px) vers le hook
 * partagé `useDragDismiss` (framer-motion) — même seuil 80px, mêmes snap
 * points, API publique inchangée. Le drag démarre désormais depuis la
 * poignée et l'en-tête uniquement (mode 'handle') : le contenu reste
 * libre de scroller, comme sur Instagram.
 */
export default function PremiumBottomSheet({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = ['half', 'full'],
  defaultSnap = 'half',
  showHandle = true,
  className = '',
  surface = 'default',
}: PremiumBottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState(defaultSnap);
  const [mounted, setMounted] = useState(false);
  const { haptic } = useHapticFeedback();
  const reduceMotion = useReducedMotion();

  useEffect(() => setMounted(true), []);

  const onDismiss = useCallback(() => {
    const currentIndex = snapPoints.indexOf(currentSnap);
    if (currentIndex === 0) {
      haptic('medium');
      onClose();
    } else {
      haptic('light');
      setCurrentSnap(snapPoints[currentIndex - 1]);
    }
  }, [snapPoints, currentSnap, onClose, haptic]);

  const onDragUp = useCallback(() => {
    const currentIndex = snapPoints.indexOf(currentSnap);
    if (currentIndex < snapPoints.length - 1) {
      haptic('light');
      setCurrentSnap(snapPoints[currentIndex + 1]);
    }
  }, [snapPoints, currentSnap, haptic]);

  const { dragProps, handleProps, y } = useDragDismiss({
    onDismiss,
    onDragUp,
    threshold: 80,
    mode: 'handle',
  });

  useEffect(() => {
    if (isOpen) {
      setCurrentSnap(defaultSnap);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, defaultSnap]);

  if (!isOpen || !mounted) return null;

  const height = SNAP_HEIGHTS[currentSnap];



  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{
          zIndex: zIndex.modal,
          background: 'rgba(14,21,18,0.5)',
          animation: 'fadeIn 200ms ease both',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Panneau'}
        data-glass-variant="overlay"
        data-glass-shape="sheet"
        data-surface-alias={surface}
        className={`glass fixed left-0 right-0 bottom-0 flex flex-col ${className}`}
        style={{
          zIndex: zIndex.modal,
          height,
          y,

          overflow: 'hidden',
          }}
        // Entrée via framer-motion (remplace l'animation CSS `slideUp` qui
        // entrait en conflit de cascade avec le transform du drag).
        initial={{ y: reduceMotion ? 0 : '100%' }}
        animate={{ y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
        {...dragProps}
      >
        <div
          className="pb-safe flex h-full flex-col"
        >
          {/* Handle — zone de drag principale */}
          {showHandle && (
            <div
              {...handleProps}
              className="flex items-center justify-center pt-3 pb-2 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
              aria-hidden="true"
            >
              <div
                style={{
                  width: '36px',
                  height: '4px',
                  borderRadius: 'var(--lkv-radius-full)',
                  background: 'var(--lkv-text-muted)',                }}
              />
            </div>
          )}

          {/* Title — draggable également */}
          {title && (
            <div
              {...(showHandle ? handleProps : {})}
              className="flex items-center justify-between px-5 pb-3 flex-shrink-0 touch-none"
            >
              <h2
                className="font-display font-bold text-[var(--lkv-text-primary)]"
                style={{ fontSize: '18px', letterSpacing: '-0.02em' }}
              >
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label="Fermer"
                className="glass-sub-card lkv-button-primitive flex items-center justify-center w-11 h-11 rounded-full cursor-pointer"              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-hide">
            {children}
          </div>
        </div>
      </motion.div>
    </>,
    document.body,
  );
}

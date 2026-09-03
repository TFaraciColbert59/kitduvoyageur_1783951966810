'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSwipe } from '@/hooks/useSwipe';
import { useDragDismiss, useDoubleTap } from '@/hooks/gestures';

export interface ImageViewerProps {
  /** Images du carrousel (une seule = pas de navigation horizontale). */
  images: string[];
  index: number;
  onIndexChange?: (i: number) => void;
  alt?: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_ZOOM = 2.5;

/**
 * Visionneuse d'image plein écran (mission gestes, Phase 6) — n'existait pas
 * dans le repo. Gestes niveau Instagram :
 *   • pinch (2 doigts) → zoom 1x–4x
 *   • double-tap → zoom rapide 1x ↔ 2.5x sur le point tapé
 *   • pan au doigt quand zoomée
 *   • swipe vertical bas → fermeture élastique (useDragDismiss) — désactivé
 *     tant que l'image est zoomée (le geste verticale pan alors l'image)
 *   • swipe horizontal → image suivante/précédente (useSwipe, à zoom 1x)
 * Clavier : Échap ferme, ← → naviguent. Body scroll verrouillé.
 * Paletin noir + contrôles blancs, accents LKDV uniquement.
 */
export default function ImageViewer({
  images,
  index,
  onIndexChange,
  alt = 'Image',
  onClose,
}: ImageViewerProps) {
  const { haptic } = useHapticFeedback();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);

  const pinchBaseRef = useRef<{ dist: number; scale: number } | null>(null);
  const panBaseRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const multi = images.length > 1;
  const src = images[Math.min(index, images.length - 1)];

  // ── Fermeture au swipe bas (zoom 1x uniquement) ──
  const { dragProps, y } = useDragDismiss({
    onDismiss: onClose,
    mode: 'element',
    threshold: 90,
  });

  // ── Double-tap : zoom rapide 1x ↔ 2.5x vers le point tapé ──
  const doubleTap = useDoubleTap(() => {
    haptic('light');
    setScale((s) => {
      if (s > 1) {
        setOffset({ x: 0, y: 0 });
        return MIN_SCALE;
      }
      return DOUBLE_TAP_ZOOM;
    });
  }, {
    // Le tap isolé ne fait rien (pas de fermeture accidentelle).
  });

  // ── Navigation horizontale entre images (zoom 1x uniquement) ──
  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, images.length - 1));
      if (clamped === index) return;
      haptic('light');
      setScale(MIN_SCALE);
      setOffset({ x: 0, y: 0 });
      onIndexChange?.(clamped);
    },
    [index, images.length, onIndexChange, haptic]
  );

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => { if (scale === MIN_SCALE) goTo(index + 1); },
    onSwipeRight: () => { if (scale === MIN_SCALE) goTo(index - 1); },
  }, { threshold: 50 });

  // ── Scroll lock + clavier ──
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goTo(index + 1);
      if (e.key === 'ArrowLeft') goTo(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, goTo, index]);

  // ── Pinch (2 doigts) ──
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinchBaseRef.current = {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        scale,
      };
      setIsPinching(true);
    } else if (e.touches.length === 1 && scale > MIN_SCALE) {
      panBaseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ox: offset.x, oy: offset.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchBaseRef.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchBaseRef.current.scale * (dist / pinchBaseRef.current.dist)));
      setScale(next);
    } else if (e.touches.length === 1 && panBaseRef.current) {
      const p = panBaseRef.current;
      setOffset({
        x: p.ox + (e.touches[0].clientX - p.x),
        y: p.oy + (e.touches[0].clientY - p.y),
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchBaseRef.current = null;
      setIsPinching(false);
    }
    if (e.touches.length === 0) {
      panBaseRef.current = null;
      // Snap retour à 1x si le zoom retombe trop bas.
      setScale((s) => {
        if (s <= 1.15) {
          setOffset({ x: 0, y: 0 });
          return MIN_SCALE;
        }
        return s;
      });
    }
  };

  if (!src) return null;

  return (
    <motion.div
      ref={containerRef}
      className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center select-none"
      style={{ y, touchAction: 'none' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-modal="true"
      aria-label="Visionneuse d'image"
      {...(scale === MIN_SCALE ? dragProps : {})}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={doubleTap.onClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Image — transform GPU uniquement */}
      {/* eslint-disable-next-line @next/next/no-img-element -- URLs distantes/blob non supportées par next/image */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-w-full max-h-full object-contain"
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
          transition: isPinching ? 'none' : 'transform 220ms cubic-bezier(0.22,1,0.36,1)',
          willChange: 'transform',
        }}
      />

      {/* Navigation tactile horizontale (au-dessus de l'image, sous l'UI) */}
      {multi && scale === MIN_SCALE && (
        <div className="absolute inset-0" {...swipeHandlers} />
      )}

      {/* Compteur carrousel */}
      {multi && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-[11px] font-mono text-white" style={{ top: 'max(16px, env(safe-area-inset-top))' }}>
          {index + 1} / {images.length}
        </div>
      )}

      {/* Fermer */}
      <button
        type="button"
        onClick={onClose}
        className="absolute w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center text-sm font-bold hover:bg-black/70 transition-colors"
        style={{ top: 'max(12px, env(safe-area-inset-top))', right: 16 }}
        aria-label="Fermer la visionneuse"
      >
        ✕
      </button>

      {/* Indicateur zoom */}
      {scale > MIN_SCALE && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-[10px] font-mono font-bold text-white" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
          ×{scale.toFixed(1)}
          <span className="ml-2 text-white/70">double-tap = ×1</span>
        </div>
      )}
    </motion.div>
  );
}

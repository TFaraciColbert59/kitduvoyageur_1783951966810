'use client';

import { useRef, useState, useCallback } from 'react';
import { useDragControls, useMotionValue, type PanInfo, type MotionValue } from 'framer-motion';
import {
  shouldDismiss,
  shouldDragUp,
  DEFAULT_DISMISS_THRESHOLD_PX,
  DEFAULT_DISMISS_VELOCITY_PX_S,
} from './gestureMath';

/**
 * Drag-to-dismiss unifié (bottom sheets, story viewer, visionneuse d'image).
 *
 * Remplace les touch handlers manuels (touchstart/touchmove/touchend +
 * dragOffset) auparavant dupliqués dans PremiumBottomSheet.tsx et
 * ExplorerMobileSheet.tsx — la physique du doigt est déléguée à
 * framer-motion (déjà dans le bundle).
 *
 * Usage :
 *   const { dragProps, handleProps, y, isDragging } = useDragDismiss({ onDismiss });
 *   <motion.div {...dragProps} style={{ ...style, y }}>
 *
 * mode 'element' : tout l'élément est draggable (viewer plein écran, stories).
 * mode 'handle'  : seul le drag depuis `handleProps` démarre le geste —
 *                  à spreader sur la poignée / l'en-tête de la sheet, pour ne
 *                  pas confisquer le scroll du contenu interne.
 */
export interface UseDragDismissOptions {
  /** Seuil franchi vers le bas → fermeture / descente d'un palier. */
  onDismiss?: () => void;
  /** Seuil franchi vers le haut → dépliage (snap up). */
  onDragUp?: () => void;
  /** Seuil de déplacement en px (défaut 80, cf. PremiumBottomSheet historique). */
  threshold?: number;
  /** Vitesse de flick en px/s qui déclenche l'action sans seuil (défaut 500). */
  velocityThreshold?: number;
  /** 'element' (défaut) : drag sur tout l'élément ; 'handle' : via handleProps. */
  mode?: 'element' | 'handle';
  /** Un flick rapide ferme même sans seuil (défaut true, comportement IG). */
  dismissOnVelocity?: boolean;
}

export interface UseDragDismissResult {
  /** À spreader sur un `motion.div` (après ses autres props, avant style). */
  dragProps: {
    drag: 'y';
    dragListener: boolean;
    dragControls?: ReturnType<typeof useDragControls>;
    dragConstraints: { top: number; bottom: number };
    dragElastic: { top: number; bottom: number };
    onDragStart: () => void;
    onDragEnd: (e: unknown, info: PanInfo) => void;
  };
  /** En mode 'handle' : à spreader sur la poignée / zone de grip. */
  handleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
  };
  /** Offset vertical live (MotionValue) — à passer dans style={{ y }}. */
  y: MotionValue<number>;
  isDragging: boolean;
}

export function useDragDismiss(options: UseDragDismissOptions): UseDragDismissResult {
  const {
    onDismiss,
    onDragUp,
    threshold = DEFAULT_DISMISS_THRESHOLD_PX,
    velocityThreshold = DEFAULT_DISMISS_VELOCITY_PX_S,
    mode = 'element',
    dismissOnVelocity = true,
  } = options;

  const y = useMotionValue(0);
  const controls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);

  // Refs de callbacks : le drag end lit toujours la version à jour sans
  // re-créer dragProps (et donc sans re-render du motion.div) à chaque render.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const onDragUpRef = useRef(onDragUp);
  onDragUpRef.current = onDragUp;

  const handleDragEnd = useCallback(
    (_e: unknown, info: PanInfo) => {
      setIsDragging(false);
      const thresholdPx = dismissOnVelocity ? threshold : Number.POSITIVE_INFINITY;
      const velocityThresholdPxS = dismissOnVelocity ? velocityThreshold : Number.NEGATIVE_INFINITY;

      if (shouldDismiss(info.offset.y, info.velocity.y, thresholdPx, velocityThresholdPxS)) {
        onDismissRef.current?.();
      } else if (shouldDragUp(info.offset.y, info.velocity.y, thresholdPx, velocityThresholdPxS)) {
        onDragUpRef.current?.();
      }
      // Sinon : framer-motion ramène y à 0 (dragConstraints), pas d'action.
    },
    [threshold, velocityThreshold, dismissOnVelocity]
  );

  const dragProps = {
    drag: 'y' as const,
    dragListener: mode === 'element',
    ...(mode === 'handle' ? { dragControls: controls } : {}),
    dragConstraints: { top: 0, bottom: 0 },
    dragElastic: { top: 0, bottom: 0.6 },
    onDragStart: () => setIsDragging(true),
    onDragEnd: handleDragEnd,
  };

  const handleProps = {
    onPointerDown: (e: React.PointerEvent) => {
      controls.start(e);
    },
  };

  return { dragProps, handleProps, y, isDragging };
}

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Reorder, motion } from 'framer-motion';
import { Check, Minus, Plus } from 'lucide-react';
import type { MediaItemV2 } from '../engine/createSchemasV2';
import { POST_MEDIA_MAX_COUNT } from '../engine/createSchemasV2';
import { computePhotoStyle, computeVignetteOverlayStyle } from './photoEditor';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface PhotoThumbnailStripProps {
  media: readonly MediaItemV2[];
  activeIndex: number;
  onSelectPhoto: (index: number) => void;
  onRemovePhoto: (index: number) => void;
  onReorderPhotos?: (nextMedia: MediaItemV2[]) => void;
  onAddPhotoClick: () => void;
  maxCount?: number;
  className?: string;
}

/**
 * Bandeau de défilement horizontal des miniatures carrées :
 * - Appui long : active le mode tremblement iOS (jiggle)
 * - Réordonnancement fluide horizontal via Framer Motion `Reorder`
 * - Capsule `-` visible uniquement en mode tremblement pour supprimer en 1 tap
 */
export function PhotoThumbnailStrip({
  media,
  activeIndex,
  onSelectPhoto,
  onRemovePhoto,
  onReorderPhotos,
  onAddPhotoClick,
  maxCount = POST_MEDIA_MAX_COUNT,
  className = '',
}: PhotoThumbnailStripProps) {
  const canAddMore = media.length < maxCount;
  const [jiggleMode, setJiggleMode] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { haptic } = useHapticFeedback();

  useEffect(() => {
    if (media.length === 0) setJiggleMode(false);
  }, [media.length]);

  useEffect(() => {
    if (!jiggleMode) return undefined;
    const onOutside = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setJiggleMode(false);
      }
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [jiggleMode]);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startLongPress = () => {
    clearLongPress();
    suppressClickRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true;
      setJiggleMode(true);
      haptic('medium');
    }, 380);
  };

  return (
    <div
      ref={containerRef}
      className={`lkdv-photo-carousel-wrap ${jiggleMode ? 'is-jiggling' : ''} ${className}`.trim()}
      role="region"
      aria-label="Médias sélectionnés"
      data-testid="photo-thumbnail-strip"
    >
      <div className="lkdv-photo-carousel-scroll" role="tablist" aria-label="Liste des médias">
        <Reorder.Group
          axis="x"
          values={[...media]}
          onReorder={(nextOrder) => {
            onReorderPhotos?.(nextOrder);
          }}
          className="lkdv-photo-reorder-group"
        >
          {media.map((item, index) => {
            const isActive = index === activeIndex;
            const previewUrl = item.previewUrl || item.url;
            const thumbnailStyle = computePhotoStyle(item.modifiers);
            const vignetteStyle = computeVignetteOverlayStyle(item.modifiers?.vignette);
            const isVideo = item.type?.startsWith('video/');

            return (
              <Reorder.Item
                key={item.id || `media-${index}`}
                value={item}
                dragListener={jiggleMode && Boolean(onReorderPhotos)}
                className={`lkdv-photo-thumb-box ${isActive ? 'is-active' : ''}`}
                data-testid={`photo-thumb-${index}`}
                animate={
                  jiggleMode
                    ? {
                        rotate: index % 2 === 0 ? [-1.8, 1.8, -1.6, 1.6, 0] : [1.8, -1.8, 1.6, -1.6, 0],
                        transition: {
                          duration: 0.36,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        },
                      }
                    : { rotate: 0 }
                }
                whileDrag={{ scale: 1.08, zIndex: 10 }}
                onPointerDown={startLongPress}
                onPointerUp={clearLongPress}
                onPointerCancel={clearLongPress}
                onPointerMove={clearLongPress}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Média ${index + 1}${isActive ? ' (actif)' : ''}`}
                  className="lkdv-photo-thumb-btn"
                  onClick={() => {
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false;
                      return;
                    }
                    onSelectPhoto(index);
                  }}
                >
                  {previewUrl ? (
                    <div className="lkdv-photo-thumb-img-wrap">
                      {isVideo ? (
                        <video
                          src={previewUrl}
                          className="lkdv-photo-thumb-img"
                          style={thumbnailStyle}
                          muted
                          playsInline
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- miniature locale
                        <img
                          src={previewUrl}
                          alt={item.alt || `Média ${index + 1}`}
                          className="lkdv-photo-thumb-img"
                          style={thumbnailStyle}
                        />
                      )}
                      {vignetteStyle && <div style={vignetteStyle} />}
                    </div>
                  ) : (
                    <div className="lkdv-photo-thumb-placeholder">
                      <span>{index + 1}</span>
                    </div>
                  )}
                </button>

                {jiggleMode ? (
                  <motion.button
                    type="button"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="lkdv-photo-thumb-remove lkdv-photo-thumb-minus"
                    aria-label={`Retirer le média ${index + 1}`}
                    data-testid={`photo-remove-${index}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemovePhoto(index);
                      haptic('light');
                    }}
                  >
                    <Minus size={12} strokeWidth={2.8} aria-hidden="true" />
                  </motion.button>
                ) : null}
              </Reorder.Item>
            );
          })}
        </Reorder.Group>

        {canAddMore && (
          <button
            type="button"
            className="lkdv-photo-add-square"
            onClick={() => {
              setJiggleMode(false);
              onAddPhotoClick();
            }}
            aria-label="Ajouter une photo"
            data-testid="photo-add-square"
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        )}

        {jiggleMode ? (
          <button
            type="button"
            className="lkdv-photo-jiggle-done"
            onClick={() => setJiggleMode(false)}
            aria-label="Terminer la réorganisation"
          >
            <Check size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default PhotoThumbnailStrip;

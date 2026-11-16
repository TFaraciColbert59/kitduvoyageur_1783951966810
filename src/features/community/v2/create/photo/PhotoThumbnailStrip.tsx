'use client';

import React from 'react';
import { Plus, X } from 'lucide-react';
import type { MediaItemV2 } from '../engine/createSchemasV2';
import { POST_MEDIA_MAX_COUNT } from '../engine/createSchemasV2';
import { computePhotoStyle, computeVignetteOverlayStyle } from './photoEditor';

export interface PhotoThumbnailStripProps {
  media: readonly MediaItemV2[];
  activeIndex: number;
  onSelectPhoto: (index: number) => void;
  onRemovePhoto: (index: number) => void;
  onAddPhotoClick: () => void;
  maxCount?: number;
  className?: string;
}

/**
 * Bandeau de défilement horizontal des miniatures carrées (F1.2)
 * Jusqu'à 15 photos max, bague de sélection active, badge de suppression 'x',
 * et carré en pointillés avec '+' pour ajouter ou capturer d'autres photos.
 */
export function PhotoThumbnailStrip({
  media,
  activeIndex,
  onSelectPhoto,
  onRemovePhoto,
  onAddPhotoClick,
  maxCount = POST_MEDIA_MAX_COUNT,
  className = '',
}: PhotoThumbnailStripProps) {
  const canAddMore = media.length < maxCount;

  return (
    <div
      className={`lkdv-photo-carousel-wrap ${className}`.trim()}
      role="region"
      aria-label="Photos sélectionnées"
      data-testid="photo-thumbnail-strip"
    >
      <div className="lkdv-photo-carousel-scroll" role="tablist" aria-label="Liste des photos">
        {media.map((item, index) => {
          const isActive = index === activeIndex;
          const previewUrl = item.previewUrl || item.url;
          const thumbnailStyle = computePhotoStyle(item.modifiers);
          const vignetteStyle = computeVignetteOverlayStyle(item.modifiers?.vignette);

          return (
            <div
              key={item.id || index}
              className={`lkdv-photo-thumb-box ${isActive ? 'is-active' : ''}`}
              data-testid={`photo-thumb-${index}`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Photo ${index + 1}${isActive ? ' (active)' : ''}`}
                className="lkdv-photo-thumb-btn"
                onClick={() => onSelectPhoto(index)}
              >
                {previewUrl ? (
                  <div className="lkdv-photo-thumb-img-wrap">
                    <img
                      src={previewUrl}
                      alt={item.alt || `Photo ${index + 1}`}
                      className="lkdv-photo-thumb-img"
                      style={thumbnailStyle}
                    />
                    {vignetteStyle && <div style={vignetteStyle} />}
                  </div>
                ) : (
                  <div className="lkdv-photo-thumb-placeholder">
                    <span>{index + 1}</span>
                  </div>
                )}
              </button>

              <button
                type="button"
                className="lkdv-photo-thumb-remove"
                aria-label={`Supprimer la photo ${index + 1}`}
                data-testid={`photo-remove-${index}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemovePhoto(index);
                }}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          );
        })}

        {canAddMore && (
          <button
            type="button"
            className="lkdv-photo-add-square"
            onClick={onAddPhotoClick}
            aria-label="Ajouter une photo"
            data-testid="post-add-photo-btn"
            title={`Ajouter une photo (${media.length}/${maxCount})`}
          >
            <Plus size={22} aria-hidden="true" />
            <span className="lkdv-photo-add-counter">
              {media.length}/{maxCount}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

export default PhotoThumbnailStrip;

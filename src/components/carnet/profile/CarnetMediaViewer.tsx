'use client';

import React, { useCallback, useEffect } from 'react';
import type { CarnetMomentItem } from '@/features/carnet/detail/types';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export interface CarnetMediaViewerProps {
  items: CarnetMomentItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/** Viewer plein écran : image, 1/N, fermeture 38, légende verre. */
export function CarnetMediaViewer({ items, index, onIndexChange, onClose }: CarnetMediaViewerProps) {
  const safeIndex = Math.max(0, Math.min(index, items.length - 1));
  const item = items[safeIndex];

  const go = useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      onIndexChange((safeIndex + delta + items.length) % items.length);
    },
    [items.length, onIndexChange, safeIndex],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [go, onClose]);

  if (!item) return null;

  const caption = [item.place, item.caption].filter(Boolean).join(' · ');

  return (
    <div className="ckp-viewer" role="dialog" aria-modal="true" aria-label="Photo du carnet">
      {/* eslint-disable-next-line @next/next/no-img-element -- image distante du moment */}
      <img src={item.imageUrl ?? ''} alt={item.caption ?? 'Photo du carnet'} />
      <span className="ckp-viewer-count">
        {safeIndex + 1}/{items.length}
      </span>
      <button type="button" className="gbtn ckp-viewer-close" onClick={onClose} aria-label="Fermer">
        <LKDVIcon name="fermer" size={18} aria-hidden="true" />
      </button>
      {items.length > 1 ? (
        <>
          <button
            type="button"
            className="ckp-viewer-nav ckp-viewer-nav--prev"
            onClick={() => go(-1)}
            aria-label="Photo précédente"
          >
            <LKDVIcon name="retour" size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="ckp-viewer-nav ckp-viewer-nav--next"
            onClick={() => go(1)}
            aria-label="Photo suivante"
          >
            <LKDVIcon name="suivant" size={18} aria-hidden="true" />
          </button>
        </>
      ) : null}
      {caption ? <p className="ckp-viewer-caption">{caption}</p> : null}
    </div>
  );
}

export default CarnetMediaViewer;

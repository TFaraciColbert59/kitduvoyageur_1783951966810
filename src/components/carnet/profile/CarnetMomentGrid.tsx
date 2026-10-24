'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import type { CarnetMomentItem } from '@/features/carnet/detail/types';

export interface CarnetMomentGridProps {
  moments: CarnetMomentItem[];
  onOpenViewer: (index: number) => void;
  isOwner: boolean;
}

const MAX_TILES = 9;

/** Grille 3 colonnes du Compte, dans la carte : wrap r22, tuiles r2, gap 2. */
export function CarnetMomentGrid({ moments, onOpenViewer, isOwner }: CarnetMomentGridProps) {
  if (moments.length === 0) {
    return (
      <div className="ckp-grid-empty">
        <Icon name="image-plus" size={20} aria-hidden="true" />
        <b>Aucun moment pour l’instant.</b>
        <p>
          {isOwner
            ? 'Ajoutez un moment depuis votre carnet.'
            : 'L’auteur n’a pas encore ajouté de photo.'}
        </p>
      </div>
    );
  }

  const visible = moments.slice(0, MAX_TILES);
  const hidden = moments.length - visible.length;

  return (
    <div className="ckp-grid-wrap">
      {visible.map((moment, index) => (
        <button
          key={moment.id}
          type="button"
          className="ckp-tile"
          onClick={() => onOpenViewer(index)}
          aria-label={moment.caption ? `Photo ${index + 1} : ${moment.caption}` : `Photo ${index + 1}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- image distante du moment */}
          <img src={moment.imageUrl ?? ''} alt="" loading={index < 3 ? 'eager' : 'lazy'} />
          {index === MAX_TILES - 1 && hidden > 0 ? <span className="ckp-tile-more">+{hidden}</span> : null}
        </button>
      ))}
    </div>
  );
}

export default CarnetMomentGrid;

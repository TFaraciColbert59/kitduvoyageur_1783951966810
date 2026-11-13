'use client';

import React from 'react';
import { ChevronRight, Eye, EyeOff, Star } from 'lucide-react';
import type { SegmentDefinition } from '@/features/segments';
import { SegmentBadges, SegmentStats } from './SegmentBadges';
import { formatDistance } from './format';

export interface SegmentCardProps {
  segment: SegmentDefinition;
  isStarred: boolean;
  isHidden: boolean;
  distanceFromCenterM?: number | null;
  onOpen?: (segment: SegmentDefinition) => void;
  onToggleStar?: (segment: SegmentDefinition) => void;
  onToggleHidden?: (segment: SegmentDefinition) => void;
}

export function SegmentCard({
  segment,
  isStarred,
  isHidden,
  distanceFromCenterM,
  onOpen,
  onToggleStar,
  onToggleHidden,
}: SegmentCardProps) {
  return (
    <article
      className={`lkdv-seg-card${isHidden ? ' is-hidden' : ''}${segment.hazardous ? ' is-danger' : ''}`}
      aria-label={`Segment ${segment.name}`}
    >
      <div className="lkdv-seg-card-head">
        <div className="lkdv-seg-card-title">
          {onOpen ? (
            <button type="button" className="lkdv-seg-card-open" onClick={() => onOpen(segment)}>
              <span>{segment.name}</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <span className="lkdv-seg-card-name">{segment.name}</span>
          )}
          {typeof distanceFromCenterM === 'number' ? (
            <span className="lkdv-seg-distance">à {formatDistance(distanceFromCenterM)}</span>
          ) : null}
        </div>

        <div className="lkdv-seg-card-actions">
          {onToggleStar ? (
            <button
              type="button"
              className={`lkdv-seg-icon-btn${isStarred ? ' is-active' : ''}`}
              aria-label={isStarred ? `Retirer ${segment.name} des favoris` : `Ajouter ${segment.name} aux favoris`}
              aria-pressed={isStarred}
              onClick={() => onToggleStar(segment)}
            >
              <Star size={18} aria-hidden="true" fill={isStarred ? 'currentColor' : 'none'} />
            </button>
          ) : null}
          {onToggleHidden ? (
            <button
              type="button"
              className="lkdv-seg-icon-btn"
              aria-label={isHidden ? `Afficher ${segment.name}` : `Masquer ${segment.name}`}
              aria-pressed={isHidden}
              onClick={() => onToggleHidden(segment)}
            >
              {isHidden ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
            </button>
          ) : null}
        </div>
      </div>

      <SegmentBadges segment={segment} />
      <SegmentStats segment={segment} compact />

      {segment.hazardous ? (
        <p className="lkdv-seg-card-warning" role="note">
          Classement et notifications de compétition désactivés tant que le danger est actif.
        </p>
      ) : null}
    </article>
  );
}

export default SegmentCard;

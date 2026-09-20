'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import { TrendingUpIcon as TrendingUp } from '@/components/icons/trending-up';
import { NavigationIcon as Navigation } from '@/components/icons/navigation';
import { ClockIcon as Clock } from '@/components/icons/clock';
import { ChevronRightIcon as ChevronRight } from '@/components/icons/chevron-right';
import { Badge, Card } from '@/components/ui';
import type { MapTrail } from './types';
import {
  getTrailImage,
  getDifficultyColor,
  getDifficultyLabel,
  formatDistance,
  formatDuration,
} from './types';

interface Props {
  trail: MapTrail;
  isSelected: boolean;
  onClick: () => void;
  onPrepareClick?: (e: React.MouseEvent) => void;
}

export default function ExplorerListCard({ trail, isSelected, onClick }: Props) {
  const imgUrl = getTrailImage(trail.id);
  const diffColor = getDifficultyColor(trail.difficulty);
  const diffLabel = getDifficultyLabel(trail.difficulty);
  const dist = formatDistance(trail.distance_km);
  const dur = formatDuration(trail.duration_hours);
  const score = trail.adventure_score ? Math.round(trail.adventure_score) : null;

  return (
    <Card
      as="article"
      variant="interactive"
      selected={isSelected}
      onClick={onClick}
      className="group relative flex h-[84px] w-full shrink-0 items-stretch gap-2.5 p-2.5"
    >
      {/* Vignette Photo */}
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-surface-muted)] border border-[color:var(--glass-border)]">
        <img
          src={imgUrl}
          alt={trail.name}
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        <Badge
          className="absolute bottom-1 left-1 border-transparent text-white shadow-xs"
          style={{ backgroundColor: diffColor }}
        >
          {diffLabel}
        </Badge>
      </div>

      {/* Info & Metrics */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <h3 className="font-display text-[length:var(--lkv-text-body-sm)] font-bold leading-tight text-[color:var(--lkv-text-primary)] line-clamp-1">
            {trail.name}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[length:var(--lkv-text-caption)] font-medium text-[color:var(--lkv-text-muted)]">
            <Icon name="map-pin" size={9.5} className="shrink-0 text-[color:var(--lkv-primary)]/80" />
            <span>{trail.terrain_type || trail.network || 'Massif Alpin'}</span>
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-[color:var(--lkv-border)] pt-1">
          <div className="flex items-center gap-2 font-mono text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)]">
            <span className="flex items-center gap-0.5 font-semibold text-[color:var(--lkv-text-primary)]">
              <Navigation size={9} />
              {dist}
            </span>
            <span aria-hidden="true" className="opacity-40">·</span>
            <span className="flex items-center gap-0.5 font-medium text-[color:var(--lkv-text-muted)]">
              <Clock size={9} />
              {dur}
            </span>
            {trail.elevation_gain !== null && trail.elevation_gain !== undefined && (
              <>
                <span aria-hidden="true" className="opacity-40">·</span>
                <span className="flex items-center gap-0.5 font-bold text-[color:var(--lkv-text-primary)]">
                  <TrendingUp size={9} />+{Math.round(trail.elevation_gain)}m
                </span>
              </>
            )}
          </div>

          {score !== null ? (
            <div className="flex items-center gap-0.5 font-mono text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
              <Icon name="star" size={10} className="text-[color:var(--lkv-warning)]" />
              <span>{score}</span>
            </div>
          ) : (
            <div className="flex items-center gap-0.5 text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)] transition-transform group-hover:translate-x-0.5">
              <ChevronRight size={11} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

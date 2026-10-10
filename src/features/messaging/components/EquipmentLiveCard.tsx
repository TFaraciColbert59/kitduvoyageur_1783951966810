'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { EquipmentSnapshot } from '../types/outdoorObjects.types';

export interface EquipmentLiveCardProps {
  snapshot: EquipmentSnapshot;
  isMine?: boolean;
  onOpenDetails?: (id: string) => void;
}

export const EquipmentLiveCard: React.FC<EquipmentLiveCardProps> = React.memo(({
  snapshot,
  isMine = false,
  onOpenDetails,
}) => {
  const { haptic } = useHapticFeedback();
  const eqId = snapshot.equipmentId || snapshot.id || '';

  const handleClick = () => {
    haptic('light');
    onOpenDetails?.(eqId);
  };

  return (
    <article
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      aria-label={`Équipement : ${snapshot.name}`}
      className={`group relative my-1 flex w-full max-w-[260px] cursor-pointer flex-col overflow-hidden rounded-2xl border p-3 transition-all active:scale-[0.98] ${
        isMine
          ? 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--lkv-text-inverted)]'
          : 'border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] text-[color:var(--lkv-text-primary)] shadow-elevation-1 backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)]'
      }`}
    >
      <div className="flex gap-2.5">
        {/* Photo thumbnail or placeholder icon */}
        <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-black/[0.04] dark:bg-white/[0.04]">
          {snapshot.photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={snapshot.photoUrl}
              alt={snapshot.name}
              className="size-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
              }}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-[color:var(--lkv-secondary)]">
              <Icon name="ArchiveBoxIcon" size={22} aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono text-[9px] uppercase tracking-wider opacity-70">
              {snapshot.category || 'Équipement'}
            </span>
            <span className="font-mono text-[11px] font-bold text-[color:var(--lkv-action)]">
              {snapshot.weightGrams} g
            </span>
          </div>

          <h4 className="mt-0.5 truncate text-xs font-bold leading-tight">
            {snapshot.name}
          </h4>

          {snapshot.brand && (
            <p className="truncate text-[10px] opacity-70">
              {snapshot.brand} {snapshot.model && `· ${snapshot.model}`}
            </p>
          )}

          {snapshot.assignedTo && (
            <div className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
              <Icon name="user" size={10} aria-hidden="true" />
              <span className="truncate">Porté par {snapshot.assignedTo}</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
});

EquipmentLiveCard.displayName = 'EquipmentLiveCard';

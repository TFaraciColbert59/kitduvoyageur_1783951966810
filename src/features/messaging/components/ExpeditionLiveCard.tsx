'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { ExpeditionSnapshot } from '../types/outdoorObjects.types';

export interface ExpeditionLiveCardProps {
  snapshot: ExpeditionSnapshot;
  isMine?: boolean;
  onOpenExpedition?: (id: string) => void;
}

export const ExpeditionLiveCard: React.FC<ExpeditionLiveCardProps> = React.memo(({
  snapshot,
  isMine = false,
  onOpenExpedition,
}) => {
  const { haptic } = useHapticFeedback();
  const expId = snapshot.expeditionId || snapshot.id || '';

  const handleClick = () => {
    haptic('light');
    onOpenExpedition?.(expId);
  };

  const getStatusBadge = () => {
    switch (snapshot.status) {
      case 'active':
        return {
          label: 'active',
          displayLabel: 'En cours (active)',
          bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
        };
      case 'confirmed':
        return {
          label: 'confirmed',
          displayLabel: 'Confirmée',
          bg: 'bg-[color:var(--lkv-action)]/15 text-[color:var(--lkv-action)]',
        };
      default:
        return {
          label: snapshot.status || 'planning',
          displayLabel: 'En préparation',
          bg: 'bg-black/[0.06] text-[color:var(--lkv-text-secondary)] dark:bg-white/[0.08]',
        };
    }
  };

  const statusInfo = getStatusBadge();
  const distanceKm = snapshot.routeDistanceKm ?? snapshot.totalDistanceKm;
  const elevationGainM = snapshot.elevationGainM ?? snapshot.totalElevationGainM;
  const members = snapshot.members || snapshot.participantsPreview || [];

  return (
    <article
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      aria-label={`Expédition : ${snapshot.title}`}
      className={`group relative my-2 flex w-full max-w-[320px] cursor-pointer flex-col overflow-hidden rounded-2xl border p-3.5 transition-all active:scale-[0.98] ${
        isMine
          ? 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--lkv-text-inverted)]'
          : 'border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] text-[color:var(--lkv-text-primary)] shadow-elevation-1 backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)]'
      }`}
    >
      {/* Header: Status and Participant Count */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${statusInfo.bg}`}
        >
          {statusInfo.label}
        </span>
        <span className="text-[11px] opacity-75">
          {snapshot.participantCount} membres
        </span>
      </div>

      {/* Title & Location */}
      <div className="mt-2">
        <h4 className="truncate text-sm font-bold leading-tight">
          {snapshot.title}
        </h4>
        {snapshot.locationName && (
          <p className="mt-0.5 truncate text-[11px] opacity-70">
            📍 {snapshot.locationName}
          </p>
        )}
      </div>

      {/* Metrics Row */}
      {(distanceKm != null || elevationGainM != null) && (
        <div className="mt-2.5 flex items-center gap-3 border-y border-black/[0.06] py-1.5 font-mono text-xs font-bold dark:border-white/[0.08]">
          {distanceKm != null && (
            <span>{Math.round(distanceKm)} km</span>
          )}
          {elevationGainM != null && (
            <span className="text-[color:var(--lkv-action)]">
              +{Math.round(elevationGainM)} m D+
            </span>
          )}
        </div>
      )}

      {/* Footer: Member avatars stack and Open CTA */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-2 overflow-hidden">
          {members.slice(0, 4).map((m, idx) => {
            const memberName =
              ('name' in m && m.name) ||
              ('fullName' in m && m.fullName) ||
              'Membre';
            return (
              <div
                key={m.id || idx}
                className="relative size-7 shrink-0 overflow-hidden rounded-full ring-2 ring-white dark:ring-neutral-900"
              >
                {m.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={m.avatarUrl}
                    alt={memberName}
                    className="size-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
                    }}
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-[color:var(--lkv-secondary)] text-[10px] text-white">
                    {memberName.charAt(0)}
                  </div>
                )}
              </div>
            );
          })}
          {members.length > 4 && (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-black/10 text-[10px] font-bold ring-2 ring-white dark:bg-white/10 dark:ring-neutral-900">
              +{members.length - 4}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-[11px] font-semibold text-[color:var(--lkv-action)]">
          <span>Ouvrir</span>
          <Icon name="chevron-right" size={14} aria-hidden="true" />
        </div>
      </div>
    </article>
  );
});

ExpeditionLiveCard.displayName = 'ExpeditionLiveCard';

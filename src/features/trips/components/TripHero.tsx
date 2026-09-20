'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import { Button } from '@/components/ui';
import { TripBadge } from './TripBadge';
import { getTripCounters } from '../hooks/useTripCounters';
import type { TripFull } from '../types/trip.types';
import { formatCivilDateRange } from '@/lib/dates/tripDates';

export interface TripHeroProps {
  trip: TripFull;
  onEditClick?: () => void;
}

export function TripHero({ trip, onEditClick }: TripHeroProps) {
  const [copied, setCopied] = useState(false);
  const imageUrl = trip.cover_image_url || '/assets/images/no_image.png';
  const participantsCount = getTripCounters(trip).participantsCount;

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: trip.title,
          text: trip.description || `Découvrez l'expédition ${trip.title} sur Le Kit du Voyageur`,
          url,
        });
        return;
      } catch {
        // Fallback clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section className="relative mb-[var(--space-6)] min-h-[340px] w-full overflow-hidden rounded-[var(--lkv-radius-card)] shadow-elevation-3 sm:min-h-[420px]">
      {/* Background Image (D32 : fallback onError vers no_image si URL cassée) */}
      <AppImage
        src={imageUrl}
        alt={trip.title}
        fill
        sizes="100vw"
        priority
        className="scale-105 object-cover"
        fallbackSrc="/assets/images/no_image.png"
      />
      {/* Subtle darkening overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
      <div className="absolute inset-0 backdrop-blur-[2px]" />

      {/* Hero Content */}
      <div className="relative flex h-full min-h-[340px] flex-col justify-between p-[var(--space-6)] text-white sm:min-h-[420px] sm:p-[var(--space-10)]">
        {/* Top Badges & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">
            <TripBadge type="status" value={trip.status} size="md" />
            <TripBadge type="activity" value={trip.primary_activity} size="md" />
            <TripBadge type="difficulty" value={trip.difficulty} size="md" />
            {trip.user_role && <TripBadge type="role" value={trip.user_role} size="md" />}
          </div>

          <div className="flex items-center gap-[var(--space-2)]">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleShare}
              icon={copied ? <Icon name="check" size={15} /> : <Icon name="share2" size={15} />}
            >
              {copied ? 'Lien copié !' : 'Partager'}
            </Button>

            {trip.permissions.canEdit && onEditClick && (
              <Button
                variant="primary"
                size="sm"
                onClick={onEditClick}
                icon={<Icon name="edit3" size={15} />}
              >
                Modifier
              </Button>
            )}
          </div>
        </div>

        {/* Title and Destination Meta */}
        <div className="mt-[var(--space-8)] max-w-4xl space-y-[var(--space-3)]">
          {trip.destination_name && (
            <div className="inline-flex items-center gap-[var(--space-2)] rounded-full border border-white/20 bg-white/15 px-[var(--space-3)] py-1 text-[length:var(--lkv-text-footnote)] font-medium text-white/90 backdrop-blur-[var(--blur-md)] sm:text-[length:var(--lkv-text-body-sm)]">
              <Icon name="map-pin" size={14} className="text-white/80" />
              {trip.destination_name}
              {trip.destination_country_code && ` (${trip.destination_country_code})`}
            </div>
          )}

          <h1 className="text-[length:var(--lkv-text-title-lg)] font-bold leading-tight tracking-tight text-white drop-shadow-md sm:text-4xl md:text-5xl">
            {trip.title}
          </h1>

          {trip.description && (
            <p className="line-clamp-3 max-w-3xl text-[length:var(--lkv-text-footnote)] leading-relaxed text-white/90 sm:text-[length:var(--lkv-text-body-sm)]">
              {trip.description}
            </p>
          )}

          {/* Quick Date Pills */}
          <div className="flex flex-wrap items-center gap-[var(--space-4)] pt-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-white/80 sm:text-[length:var(--lkv-text-body-sm)]">
            {(trip.start_date || trip.end_date) && (
              <span className="flex items-center gap-[var(--space-2)] rounded-full border border-white/10 bg-black/30 px-[var(--space-3)] py-1 backdrop-blur-[var(--blur-sm)]">
                <Icon name="calendar" size={14} className="text-white/80" />
                {formatCivilDateRange(trip.start_date, trip.end_date, undefined, 'fr-FR')}
              </span>
            )}

            {trip.estimated_budget !== null && trip.estimated_budget !== undefined && (
              <span className="flex items-center gap-[var(--space-2)] rounded-full border border-white/10 bg-black/30 px-[var(--space-3)] py-1 backdrop-blur-[var(--blur-sm)]">
                <Icon name="credit-card" size={14} className="text-white/80" />
                Budget prévu : {trip.estimated_budget} {trip.budget_currency}
              </span>
            )}

            <span className="flex items-center gap-[var(--space-2)] rounded-full border border-white/10 bg-black/30 px-[var(--space-3)] py-1 backdrop-blur-[var(--blur-sm)]">
              <Icon name="users" size={14} className="text-white/80" />
              {participantsCount} {participantsCount > 1 ? 'participants' : 'participant'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

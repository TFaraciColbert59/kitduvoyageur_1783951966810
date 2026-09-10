'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
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
    <section className="relative w-full min-h-[340px] sm:min-h-[420px] rounded-2xl overflow-hidden shadow-xl mb-6">
      {/* Background Image (D32 : fallback onError vers no_image si URL cassée) */}
      <AppImage
        src={imageUrl}
        alt={trip.title}
        fill
        sizes="100vw"
        priority
        className="object-cover scale-105"
        fallbackSrc="/assets/images/no_image.png"
      />
      {/* Subtle darkening overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
      <div className="absolute inset-0 backdrop-blur-[2px]" />

      {/* Hero Content */}
      <div className="relative h-full min-h-[340px] sm:min-h-[420px] p-6 sm:p-10 flex flex-col justify-between text-white">
        {/* Top Badges & Actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <TripBadge type="status" value={trip.status} size="md" />
            <TripBadge type="activity" value={trip.primary_activity} size="md" />
            <TripBadge type="difficulty" value={trip.difficulty} size="md" />
            {trip.user_role && <TripBadge type="role" value={trip.user_role} size="md" />}
          </div>

          <div className="flex items-center gap-2">
            <GlassCapsuleBtn
              variant="secondary"
              size="sm"
              onClick={handleShare}
              icon={copied ? <Icon name="check" size={15} /> : <Icon name="share2" size={15} />}
            >
              {copied ? 'Lien copié !' : 'Partager'}
            </GlassCapsuleBtn>

            {trip.permissions.canEdit && onEditClick && (
              <GlassCapsuleBtn
                variant="primary"
                size="sm"
                onClick={onEditClick}
                icon={<Icon name="edit3" size={15} />}
              >
                Modifier
              </GlassCapsuleBtn>
            )}
          </div>
        </div>

        {/* Title and Destination Meta */}
        <div className="max-w-4xl space-y-3 mt-8">
          {trip.destination_name && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs sm:text-sm font-medium text-white/90">
              <Icon name="map-pin" size={14} className="text-white/80" />
              {trip.destination_name}
              {trip.destination_country_code && ` (${trip.destination_country_code})`}
            </div>
          )}

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight drop-shadow-md">
            {trip.title}
          </h1>

          {trip.description && (
            <p className="text-sm sm:text-base text-white/90 max-w-3xl leading-relaxed line-clamp-3">
              {trip.description}
            </p>
          )}

          {/* Quick Date Pills */}
          <div className="flex items-center gap-4 pt-2 text-xs sm:text-sm text-white/80 flex-wrap">
            {(trip.start_date || trip.end_date) && (
              <span className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                <Icon name="calendar" size={14} className="text-white/80" />
                {formatCivilDateRange(trip.start_date, trip.end_date, undefined, 'fr-FR')}
              </span>
            )}

            {trip.estimated_budget !== null && trip.estimated_budget !== undefined && (
              <span className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                <Icon name="credit-card" size={14} className="text-white/80" />
                Budget prévu : {trip.estimated_budget} {trip.budget_currency}
              </span>
            )}

            <span className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
              <Icon name="users" size={14} className="text-white/80" />
              {participantsCount} {participantsCount > 1 ? 'participants' : 'participant'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

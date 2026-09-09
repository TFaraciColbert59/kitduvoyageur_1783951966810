'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import { GlassCard } from '@/components/ui/GlassCard';
import { TripBadge } from './TripBadge';
import { tripSwitchHref } from '../registry/tripSectionRegistry';
import { deriveScale, deriveParty, getProfileBadgeLabel } from '../engine/tripProfileEngine';
import { MapPin, Calendar, Navigation, Users } from 'lucide-react';
import type { TripSummary, TripWithDetails } from '../types/trip.types';

import { formatCivilDate, formatCivilDateRange } from '@/lib/dates/tripDates';

export interface TripCardProps {
  trip: TripSummary | TripWithDetails;
  showRole?: boolean;
}

function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return 'Dates à définir';
  if (start && !end) return `Dès le ${formatCivilDate(start, 'fr-FR', 'short')}`;
  if (!start && end) return `Jusqu'au ${formatCivilDate(end, 'fr-FR', 'short')}`;
  return formatCivilDateRange(start, end, undefined, 'fr-FR');
}

export function TripCard({ trip, showRole = true }: TripCardProps) {
  const imageUrl = trip.cover_image_url || '/assets/images/no_image.png';
  const role = 'user_role' in trip ? trip.user_role : undefined;

  const scale = deriveScale(trip.start_date, trip.end_date);
  const party = deriveParty(
    'collaborators' in trip && Array.isArray((trip as any).collaborators)
      ? (trip as any).collaborators.length + 1
      : trip.collaborators_count
  );
  const profileLabel = getProfileBadgeLabel(scale, party);

  return (
    <Link href={tripSwitchHref(trip.slug)} className="block group">
      <GlassCard
        tone="neutral"
        blur="md"
        interactive
        className="h-full border border-white/60 hover:border-lkv-secondary/40 transition-all duration-300 hover:shadow-lg rounded-2xl overflow-hidden"
      >
        {/* Cover Image (D32 : fallback onError vers no_image si URL cassée) */}
        <div className="relative w-full h-48 bg-[var(--lkv-surface-paper)] overflow-hidden">
          <AppImage
            src={imageUrl}
            alt={trip.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            fallbackSrc="/assets/images/no_image.png"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* Top Badges */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <TripBadge type="activity" value={trip.primary_activity} size="sm" />
              <TripBadge type="difficulty" value={trip.difficulty} size="sm" />
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-xs text-[var(--lkv-primary)] border border-white/60 shadow-2xs">
                {profileLabel}
              </span>
            </div>
            <TripBadge type="status" value={trip.status} size="sm" />
          </div>

          {/* Destination Overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
            <span className="flex items-center gap-1 font-medium drop-shadow">
              <MapPin size={14} className="text-sage-300" />
              {trip.destination_name || trip.destination_country_code || 'Destination sauvage'}
            </span>
            {showRole && role && (
              <TripBadge type="role" value={role} size="sm" />
            )}
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 flex flex-col justify-between flex-1 gap-3">
          <div>
            <h3 className="font-semibold text-base sm:text-lg text-lkv-primary line-clamp-1 group-hover:text-[var(--lkv-primary-hover)] transition-colors">
              {trip.title}
            </h3>
            {trip.description && (
              <p className="text-xs sm:text-sm text-lkv-secondary line-clamp-2 mt-1 leading-relaxed">
                {trip.description}
              </p>
            )}
          </div>

          {/* Bottom Meta */}
          <div className="pt-2 border-t border-black/5 flex items-center justify-between text-xs text-lkv-secondary">
            <span className="flex items-center gap-1">
              <Calendar size={13} className="text-lkv-secondary" />
              {formatDateRange(trip.start_date, trip.end_date)}
            </span>

            <div className="flex items-center gap-3">
              {trip.steps_count !== undefined && trip.steps_count > 0 && (
                <span className="flex items-center gap-1" title={`${trip.steps_count} étapes`}>
                  <Navigation size={13} />
                  {trip.steps_count}
                </span>
              )}
              {trip.collaborators_count !== undefined && (
                <span className="flex items-center gap-1" title={`${trip.collaborators_count} participants`}>
                  <Users size={13} />
                  {trip.collaborators_count}
                </span>
              )}
            </div>
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}

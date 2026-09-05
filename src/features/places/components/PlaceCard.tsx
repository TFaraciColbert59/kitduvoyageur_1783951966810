'use client';

import React from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { LkvButton } from '@/components/ui/LkvButton';
import {
  MapPin,
  Star,
  ShieldAlert,
  Plus,
  Mountain,
  Tent,
  Droplet,
  Compass,
  CheckCircle2,
} from 'lucide-react';
import type { PlaceWithDistance } from '../types/place.types';

export interface PlaceCardProps {
  place: PlaceWithDistance;
  onAddToTrip?: (place: PlaceWithDistance) => void;
}

export function getCategoryLabel(category: string): string {
  switch (category) {
    case 'refuge':
      return 'Refuge Alpin';
    case 'bivouac':
      return 'Bivouac';
    case 'water_source':
      return 'Source d’Eau';
    case 'viewpoint':
      return 'Belvédère';
    case 'pass':
      return 'Col';
    case 'campground':
      return 'Campement';
    case 'summit':
      return 'Sommet';
    case 'lake':
      return 'Lac';
    case 'historical':
      return 'Patrimoine';
    default:
      return 'Lieu Outdoor';
  }
}

export function getCategoryIcon(category: string) {
  switch (category) {
    case 'refuge':
      return Mountain;
    case 'bivouac':
    case 'campground':
      return Tent;
    case 'water_source':
      return Droplet;
    case 'pass':
    case 'viewpoint':
    case 'summit':
      return Compass;
    default:
      return MapPin;
  }
}

export function PlaceCard({ place, onAddToTrip }: PlaceCardProps) {
  const Icon = getCategoryIcon(place.category);
  const categoryLabel = getCategoryLabel(place.category);

  return (
    <div className="group relative flex flex-col h-full">
      <Link href={`/lieux/${place.slug}`} className="block flex-1">
        <GlassCard
          tone="neutral"
          blur="md"
          interactive
          className="h-full border border-white/60 hover:border-[#5B7F55]/40 transition-all duration-300 hover:shadow-lg rounded-[24px] p-5 flex flex-col justify-between"
        >
          <div>
            {/* Header badges */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#17402C]/10 text-[#17402C] border border-[#17402C]/15">
                <Icon className="w-3.5 h-3.5 text-[#5B7F55]" />
                {categoryLabel}
              </span>

              <div className="flex items-center gap-1.5">
                {place.altitude_m && (
                  <span className="text-xs font-medium text-stone-600 bg-stone-100/80 px-2.5 py-0.5 rounded-full border border-stone-200">
                    {place.altitude_m} m
                  </span>
                )}
                <span className="text-xs font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full uppercase">
                  {place.country_code}
                </span>
              </div>
            </div>

            {/* Titre & Localisation */}
            <h3 className="text-lg font-bold text-stone-900 group-hover:text-[#17402C] transition-colors line-clamp-1 mb-1">
              {place.name}
            </h3>

            <div className="flex items-center gap-1 text-xs text-stone-500 mb-3">
              <MapPin className="w-3.5 h-3.5 text-[#5B7F55] shrink-0" />
              <span className="truncate">
                {place.city ? `${place.city}, ` : ''}
                {place.region || place.country_code}
              </span>
            </div>

            {/* Description */}
            {place.description && (
              <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed mb-4">
                {place.description}
              </p>
            )}

            {/* Alerte éthique si floutage */}
            {place.is_blurred && (
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 text-[11px] mb-3">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Zone fragile : coordonnées floutées à ~500m</span>
              </div>
            )}
          </div>

          {/* Footer Card */}
          <div className="pt-3 border-t border-stone-200/60 flex items-center justify-between mt-auto">
            {/* Note bayésienne */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                <span>
                  {place.bayesian_rating > 0 ? place.bayesian_rating.toFixed(1) : 'Nouveau'}
                </span>
              </div>
              <span className="text-xs text-stone-600">
                ({place.reviews_count} {place.reviews_count > 1 ? 'avis' : 'avis'})
              </span>
            </div>

            {place.is_verified && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#17402C] bg-[#5B7F55]/15 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-[#17402C]" />
                Vérifié
              </span>
            )}
          </div>
        </GlassCard>
      </Link>

      {/* Bouton d'action rapide Ajouter au Voyage */}
      {onAddToTrip && (
        <div className="mt-2">
          <LkvButton
            variant="secondary"
            size="sm"
            className="w-full flex items-center justify-center gap-1.5 min-h-[44px] text-xs font-semibold"
            onClick={(e) => {
              e.preventDefault();
              onAddToTrip(place);
            }}
          >
            <Plus className="w-4 h-4 text-[#17402C]" />
            Ajouter à mon voyage
          </LkvButton>
        </div>
      )}
    </div>
  );
}

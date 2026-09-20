'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import Link from 'next/link';
import { Badge, Button, Card } from '@/components/ui';
import type { PlaceWithDistance } from '../types/place.types';
import { getCategoryIcon, getCategoryLabel } from '../lib/placeCategory';

export { getCategoryIcon, getCategoryLabel } from '../lib/placeCategory';

export interface PlaceCardProps {
  place: PlaceWithDistance;
  onAddToTrip?: (place: PlaceWithDistance) => void;
}

export function PlaceCard({ place, onAddToTrip }: PlaceCardProps) {
  const CategoryIcon = getCategoryIcon(place.category);
  const categoryLabel = getCategoryLabel(place.category);

  return (
    <div className="group relative flex h-full flex-col">
      <Link href={`/lieux/${place.slug}`} className="block flex-1 no-underline">
        <Card
          variant="interactive"
          className="flex h-full flex-col justify-between p-5"
        >
          <div>
            {/* Header badges */}
            <div className="mb-[var(--space-3)] flex items-center justify-between gap-2">
              <Badge tone="sage" className="gap-1.5">
                <CategoryIcon className="h-3.5 w-3.5 text-[color:var(--lkv-primary)]" />
                {categoryLabel}
              </Badge>

              <div className="flex items-center gap-1.5">
                {place.altitude_m && (
                  <Badge tone="stone">{place.altitude_m} m</Badge>
                )}
                <Badge tone="stone" className="uppercase">{place.country_code}</Badge>
              </div>
            </div>

            {/* Titre & Localisation */}
            <h3 className="mb-[var(--space-1)] font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)] line-clamp-1">
              {place.name}
            </h3>

            <div className="mb-[var(--space-3)] flex items-center gap-1 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
              <Icon name="map-pin" className="h-3.5 w-3.5 shrink-0 text-[color:var(--lkv-primary)]" />
              <span className="truncate">
                {place.city ? `${place.city}, ` : ''}
                {place.region || place.country_code}
              </span>
            </div>

            {/* Description */}
            {place.description && (
              <p className="mb-[var(--space-4)] text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-secondary)] line-clamp-2">
                {place.description}
              </p>
            )}

            {/* Alerte éthique si floutage */}
            {place.is_blurred && (
              <div className="mb-[var(--space-3)]">
                <Badge tone="warn" className="w-full gap-1.5 py-[var(--space-2)]">
                  <Icon name="shield-alert" className="h-3.5 w-3.5 shrink-0" />
                  <span>Zone fragile : coordonnées floutées à ~500m</span>
                </Badge>
              </div>
            )}
          </div>

          {/* Footer Card */}
          <div className="mt-auto flex items-center justify-between border-t border-[color:var(--lkv-border)] pt-[var(--space-3)]">
            {/* Note bayésienne */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 text-[length:var(--lkv-text-body-sm)] font-bold text-[color:var(--lkv-warning-dark)]">
                <Icon name="star" className="h-4 w-4" />
                <span>
                  {place.bayesian_rating > 0 ? place.bayesian_rating.toFixed(1) : 'Nouveau'}
                </span>
              </div>
              <span className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                ({place.reviews_count} {place.reviews_count > 1 ? 'avis' : 'avis'})
              </span>
            </div>

            {place.is_verified && (
              <Badge tone="sage" className="gap-1">
                <Icon name="check-circle2" className="h-3 w-3 text-[color:var(--lkv-primary)]" />
                Vérifié
              </Badge>
            )}
          </div>
        </Card>
      </Link>

      {/* Bouton d'action rapide Ajouter au Voyage */}
      {onAddToTrip && (
        <div className="mt-[var(--space-2)]">
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            className="font-semibold"
            onClick={(e) => {
              e.preventDefault();
              onAddToTrip(place);
            }}
          >
            <Icon name="plus" className="h-4 w-4 text-[color:var(--lkv-primary)]" />
            Ajouter à mon voyage
          </Button>
        </div>
      )}
    </div>
  );
}

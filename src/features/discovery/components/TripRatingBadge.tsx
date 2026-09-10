import React from 'react';
import { cn } from '@/lib/utils';

export interface TripRatingBadgeProps {
  rating: number | null;
  reviewCount: number | null;
  ratingImageUrl: string | null;
  className?: string;
}

/**
 * Notation Tripadvisor officielle : on utilise l'image de bulles FOURNIE par
 * l'API (`ratingImageUrl`), sur fond blanc, largeur ≥ 55px. Aucune bulle
 * recréée avec des icônes LKDV. `0/5` ou `0 avis` ne sont jamais affichés.
 */
export function TripRatingBadge({
  rating,
  reviewCount,
  ratingImageUrl,
  className,
}: TripRatingBadgeProps) {
  const safeRating = rating != null && rating > 0 ? rating : null;
  const safeReviewCount = reviewCount != null && reviewCount > 0 ? reviewCount : null;
  const hasRating = safeRating != null && ratingImageUrl != null;

  if (!hasRating && safeReviewCount == null) {
    return (
      <span className={cn('text-[11px] font-mono text-[#5A7064]', className)}>
        Pas encore de note Tripadvisor
      </span>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-md bg-white px-2 py-1 shadow-2xs',
        className
      )}
    >
      {hasRating ? (
        /* eslint-disable-next-line @next/next/no-img-element -- bulles de notation servies directement par Tripadvisor (Display Requirements) */
        <img
          src={ratingImageUrl}
          alt={`Note Tripadvisor ${safeRating!.toFixed(1)} sur 5`}
          style={{ minWidth: 55, height: 16, width: 'auto' }}
          loading="lazy"
        />
      ) : null}
      {safeRating != null ? (
        <span className="font-mono text-xs font-bold text-[#17402C]">{safeRating.toFixed(1)}</span>
      ) : null}
      {safeReviewCount != null ? (
        <span className="text-[10.5px] font-mono text-[#5A7064]">
          ({safeReviewCount.toLocaleString('fr-FR')} avis)
        </span>
      ) : null}
    </div>
  );
}

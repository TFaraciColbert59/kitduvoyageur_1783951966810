'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import { TripRatingBadge } from './TripRatingBadge';
import { Badge, Card } from '@/components/ui';
import type { DiscoveryItem } from '../types/discovery.types';

export interface DiscoveryCardProps {
  item: DiscoveryItem;
}

function formatPrice(item: DiscoveryItem): string | null {
  if (item.priceFrom == null || !item.currency) return null;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: item.currency,
      maximumFractionDigits: 0,
    }).format(item.priceFrom);
  } catch {
    return `${item.priceFrom} ${item.currency}`;
  }
}

function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours} h ${mins} min`;
  if (hours) return `${hours} h`;
  return `${mins} min`;
}

const PARTNER_LINK =
  'flex min-h-[44px] w-full select-none items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[color:var(--lkv-action)] px-[var(--space-4)] text-[length:var(--lkv-text-caption-1)] font-bold text-[color:var(--lkv-on-action)] no-underline shadow-sm transition-transform active:scale-[var(--motion-press-scale)] hover:bg-[color:var(--lkv-action-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

/**
 * Carte d'aperçu sobre : image, nom, lieu, description, durée, note/avis et lien
 * partenaire. Aucune fausse disponibilité/prix/note : un champ absent n'est pas
 * affiché. Le prix (le cas échéant) est un « à partir de » indicatif.
 */
export function DiscoveryCard({ item }: DiscoveryCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const location = item.city || item.address;
  const linkUrl = item.affiliateUrl || item.tripadvisorUrl;
  const isViator = item.provider === 'viator';
  const rel = isViator ? 'sponsored noopener' : 'noopener noreferrer';
  const ctaLabel = isViator ? 'Voir sur Viator' : 'Voir sur Tripadvisor';
  const price = formatPrice(item);
  const duration = formatDuration(item.durationMinutes);

  return (
    <Card as="article" className="flex flex-col overflow-hidden p-0">
      <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-[color:var(--lkv-primary)]/10 via-[color:var(--lkv-surface-muted)] to-[color:var(--lkv-secondary)]/15">
        {item.photoUrl && !imageFailed ? (
          /* eslint-disable-next-line @next/next/no-img-element -- images partenaires (Viator/Tripadvisor) servies directement, jamais via next/image */
          <img
            src={item.photoUrl}
            alt={item.name}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-[color:var(--lkv-text-muted)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--card-tint-strong)] shadow-2xs backdrop-blur-[var(--blur-md)]">
              <Icon name="mountain" size={16} className="text-[color:var(--lkv-primary)]" />
            </div>
            <span className="font-mono text-[9.5px] uppercase tracking-wider">Sans photo</span>
          </div>
        )}

        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {item.category ? (
            <Badge tone="stone" className="bg-[color:var(--card-tint-strong)] font-mono uppercase">
              {item.category}
            </Badge>
          ) : null}
          {item.freeCancellation ? (
            <Badge tone="sage" className="font-mono uppercase">
              Annulation gratuite
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <div className="space-y-1.5">
          <h4 className="font-display text-[length:var(--lkv-text-body-sm)] font-bold leading-snug text-[color:var(--lkv-text-primary)] line-clamp-2">
            {linkUrl ? (
              <a
                href={linkUrl}
                target="_blank"
                rel={rel}
                className="transition-colors hover:text-[color:var(--lkv-secondary)]"
              >
                {item.name}
              </a>
            ) : (
              item.name
            )}
          </h4>
          {location ? (
            <p className="flex items-center gap-1 truncate font-mono text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">
              <Icon name="map-pin" size={12} className="shrink-0 text-[color:var(--lkv-secondary)]" />
              <span className="truncate">{location}</span>
            </p>
          ) : null}
          {item.description ? (
            <p className="text-[length:var(--lkv-text-caption-1)] leading-relaxed text-[color:var(--lkv-text-muted)] line-clamp-2">
              {item.description}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {linkUrl ? (
              <a
                href={linkUrl}
                target="_blank"
                rel={rel}
                aria-label={`Avis pour ${item.name}`}
                className="inline-flex"
              >
                <TripRatingBadge
                  rating={item.rating}
                  reviewCount={item.reviewCount}
                  ratingImageUrl={item.ratingImageUrl}
                />
              </a>
            ) : (
              <TripRatingBadge
                rating={item.rating}
                reviewCount={item.reviewCount}
                ratingImageUrl={item.ratingImageUrl}
              />
            )}
            {price ? (
              <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                dès <span className="font-bold text-[color:var(--lkv-secondary)]">{price}</span>
              </span>
            ) : null}
            {duration ? (
              <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                ⏱ {duration}
              </span>
            ) : null}
          </div>

          {linkUrl ? (
            <a
              href={linkUrl}
              target="_blank"
              rel={rel}
              className={PARTNER_LINK}
            >
              <span>{ctaLabel}</span>
              <Icon name="external-link" className="h-3.5 w-3.5 opacity-70" />
            </a>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

'use client';

import React, { useState } from 'react';
import { Mountain, MapPin, ExternalLink } from 'lucide-react';
import { TripRatingBadge } from './TripRatingBadge';
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
    <article className="glass rounded-[1.5rem] overflow-hidden border border-white/50 shadow-xs hover:border-[#5B7F55]/30 transition-all flex flex-col">
      <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-[#17402C]/10 via-[#EEF3EC] to-[#5B7F55]/15">
        {item.photoUrl && !imageFailed ? (
          /* eslint-disable-next-line @next/next/no-img-element -- images partenaires (Viator/Tripadvisor) servies directement, jamais via next/image */
          <img
            src={item.photoUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-[#5A7064]">
            <div className="w-9 h-9 rounded-full bg-white/70 backdrop-blur-md flex items-center justify-center shadow-2xs">
              <Mountain size={16} className="text-[#17402C]" />
            </div>
            <span className="text-[9.5px] font-mono uppercase tracking-wider">Sans photo</span>
          </div>
        )}

        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          {item.category ? (
            <span className="glass-pill !bg-white/90 text-[#17402C] text-[9.5px] font-mono font-bold uppercase">
              {item.category}
            </span>
          ) : null}
          {item.freeCancellation ? (
            <span className="glass-pill !bg-[#E1EBDE] text-[#17402C] text-[9.5px] font-mono font-bold uppercase">
              Annulation gratuite
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-1.5">
          <h4 className="font-display font-bold text-sm text-[#17402C] leading-snug line-clamp-2">
            {linkUrl ? (
              <a
                href={linkUrl}
                target="_blank"
                rel={rel}
                className="hover:text-[#5B7F55] transition-colors"
              >
                {item.name}
              </a>
            ) : (
              item.name
            )}
          </h4>
          {location ? (
            <p className="flex items-center gap-1 text-[11px] text-[#5A7064] font-mono truncate">
              <MapPin size={12} className="shrink-0 text-[#5B7F55]" />
              <span className="truncate">{location}</span>
            </p>
          ) : null}
          {item.description ? (
            <p className="text-[11px] text-[#5A7064] leading-relaxed line-clamp-2">
              {item.description}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
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
              <span className="text-[10px] font-mono text-[#5A7064]">
                dès <span className="font-bold text-[#5B7F55]">{price}</span>
              </span>
            ) : null}
            {duration ? (
              <span className="text-[10px] font-mono text-[#5A7064]">⏱ {duration}</span>
            ) : null}
          </div>

          {linkUrl ? (
            <a
              href={linkUrl}
              target="_blank"
              rel={rel}
              className="w-full min-h-[44px] px-4 rounded-xl bg-[#17402C] hover:bg-[#123323] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <span>{ctaLabel}</span>
              <ExternalLink className="w-3.5 h-3.5 text-white/70" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

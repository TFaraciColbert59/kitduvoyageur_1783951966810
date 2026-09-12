'use client';

import { BedDouble, ExternalLink, Plane } from 'lucide-react';
import type { AffiliateLink } from '../types/affiliate.types';
import type { StepBookingSuggestion } from '../engine/stepBookingLink';

export interface StepBookingLinkCtaProps {
  booking: StepBookingSuggestion;
  /** Lien partenaire actif qui porte le slug de redirection trackée. */
  link: AffiliateLink;
  tripId?: string;
  className?: string;
}

/**
 * Lien de réservation compact affiché à côté d'une étape (itinéraire mobile et
 * desktop). L'URL passe par la redirection trackée `/go/<slug>` de l'engine
 * existant — jamais d'URL partenaire brute — et conserve
 * `rel="sponsored nofollow"`. Aucun nouveau vocabulaire visuel : surface
 * `glass-sub-card` du design system.
 */
export function StepBookingLinkCta({
  booking,
  link,
  tripId,
  className = '',
}: StepBookingLinkCtaProps) {
  const href = tripId ? `/go/${link.slug}?trip_id=${tripId}` : `/go/${link.slug}`;
  const CategoryIcon = booking.category === 'hotel' ? BedDouble : Plane;
  const partnerName = link.partner?.name;

  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored nofollow"
      title={`Suggestion partenaire — recherche : ${booking.searchTerms}`}
      className={`glass-sub-card flex min-h-[44px] w-full items-center gap-2 rounded-2xl px-3 py-2 text-left transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] ${className}`}
    >
      <CategoryIcon size={14} className="shrink-0 text-[var(--lkv-primary)]" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-bold text-[var(--lkv-text-primary)]">
          {booking.label}
        </span>
        <span className="block truncate text-[10px] font-medium text-[var(--lkv-text-secondary)]">
          Suggestion · Lien partenaire{partnerName ? ` · ${partnerName}` : ''}
        </span>
      </span>
      <ExternalLink size={13} className="shrink-0 text-[var(--lkv-text-muted)]" aria-hidden="true" />
    </a>
  );
}

export default StepBookingLinkCta;

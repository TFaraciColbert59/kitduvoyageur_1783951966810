'use client';

import { BedDouble, Compass, ExternalLink, Plane, Shield, Smartphone } from 'lucide-react';
import type { AffiliateIntent } from '../engine/stepBookingLink';

export interface StepBookingLinkCtaProps {
  booking: AffiliateIntent;
  /** Slug du lien partenaire résolu côté serveur (redirection trackée /go). */
  slug: string;
  /** Nom du partenaire affiché (résolu côté serveur, optionnel). */
  partnerName?: string | null;
  tripId?: string;
  /** Sous-titre explicite (ex. `searchTerms` d'une suggestion LLM). */
  subtitle?: string | null;
  className?: string;
}

const CATEGORY_ICONS = {
  hotel: BedDouble,
  flight: Plane,
  activity: Compass,
  insurance: Shield,
  esim: Smartphone,
  transport: Plane,
  gear: Compass,
} as const;

/**
 * Lien de réservation compact affiché à côté d'une étape ou d'une suggestion
 * (itinéraire mobile et desktop). Le slug provient de la résolution serveur
 * (`bookingByStepId` / suggestions) : aucun rapprochement de lien n'est refait
 * côté client. L'URL passe par la redirection trackée `/go/<slug>` de l'engine
 * existant — jamais d'URL partenaire brute — et conserve `rel="sponsored
 * nofollow"`. Aucun nouveau vocabulaire visuel : surface `glass-sub-card`.
 */
export function StepBookingLinkCta({
  booking,
  slug,
  partnerName,
  tripId,
  subtitle,
  className = '',
}: StepBookingLinkCtaProps) {
  const href = tripId ? `/go/${slug}?trip_id=${tripId}` : `/go/${slug}`;
  const CategoryIcon = CATEGORY_ICONS[booking.category] ?? Plane;

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
          {subtitle ?? `Suggestion · Lien partenaire${partnerName ? ` · ${partnerName}` : ''}`}
        </span>
      </span>
      <ExternalLink size={13} className="shrink-0 text-[var(--lkv-text-muted)]" aria-hidden="true" />
    </a>
  );
}

export default StepBookingLinkCta;
